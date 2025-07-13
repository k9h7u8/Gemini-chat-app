// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/signup.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfigService } from '@nestjs/config';

// In-memory store for OTPs (for mocking/development purposes)
// In a real application, use Redis or a database table for persistence and scalability.
interface OtpStore {
  [mobileNumber: string]: {
    code: string;
    expiresAt: Date;
  };
}

@Injectable()
export class AuthService {
  private readonly otpStore: OtpStore = {}; // In-memory OTP storage

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Hashes a plain text password.
   * @param password The plain text password.
   * @returns The hashed password.
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compares a plain text password with a hashed password.
   * @param password The plain text password.
   * @param hashedPassword The hashed password.
   * @returns True if passwords match, false otherwise.
   */
  private async comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generates a random 6-digit OTP.
   * @returns The generated OTP.
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Signs up a new user.
   * @param signupDto Data for user signup.
   * @returns The created user (excluding password).
   */
  async signup(signupDto: SignupDto) {
    const { mobileNumber, password } = signupDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (existingUser) {
      throw new BadRequestException('User with this mobile number already exists');
    }

    const hashedPassword = await this.hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        mobileNumber,
        password: hashedPassword,
        subscriptionStatus: 'Basic', // Default to Basic
      },
      select: { id: true, mobileNumber: true, subscriptionStatus: true }, // Exclude password
    });

    return user;
  }

  /**
   * Sends an OTP to the specified mobile number.
   * For mocking, returns the OTP in the response.
   * @param sendOtpDto Mobile number to send OTP to.
   * @returns The generated OTP.
   */
  async sendOtp(sendOtpDto: SendOtpDto) {
    const { mobileNumber } = sendOtpDto;

    const user = await this.prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      throw new NotFoundException('User not found with this mobile number');
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP valid for 5 minutes

    this.otpStore[mobileNumber] = { code: otp, expiresAt };
    console.log(`OTP for ${mobileNumber}: ${otp}`); // Log for mocking/testing

    return { message: 'OTP sent successfully (mocked)', otp }; // Return OTP for mocking
  }

  /**
   * Verifies an OTP and returns a JWT token on success.
   * @param verifyOtpDto Mobile number and OTP to verify.
   * @returns JWT access token.
   */
  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { mobileNumber, otp } = verifyOtpDto;

    const storedOtp = this.otpStore[mobileNumber];

    if (!storedOtp || storedOtp.code !== otp || new Date() > storedOtp.expiresAt) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // OTP is valid, remove it from store
    delete this.otpStore[mobileNumber];

    const user = await this.prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      // This should ideally not happen if sendOtp checked for user existence
      throw new NotFoundException('User not found');
    }

    const payload = { mobileNumber: user.mobileNumber, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  /**
   * Handles forgot password flow by sending an OTP.
   * @param forgotPasswordDto Mobile number for password reset.
   * @returns The generated OTP (mocked).
   */
  async forgotPassword(forgotPasswordDto: SendOtpDto) {
    // This reuses the sendOtp logic for simplicity,
    // as it's just sending an OTP to a mobile number.
    return this.sendOtp(forgotPasswordDto);
  }

  /**
   * Changes the user's password. Requires the user to be authenticated
   * (via JWT) and potentially have verified an OTP for password reset.
   * @param userId The ID of the user changing the password.
   * @param changePasswordDto New password.
   * @returns Success message.
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { newPassword } = changePasswordDto;

    const hashedPassword = await this.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Validates a user for JWT strategy.
   * @param mobileNumber User's mobile number.
   * @returns User object if valid, null otherwise.
   */
  async validateUser(mobileNumber: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { mobileNumber } });
    if (user) {
      // Return a subset of user data that's safe to expose in the request object
      return { id: user.id, mobileNumber: user.mobileNumber, subscriptionStatus: user.subscriptionStatus };
    }
    return null;
  }
}