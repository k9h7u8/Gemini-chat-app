// src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
// You can remove this 'bcrypt' import if you are mocking the service's internal method
// import * as bcrypt from 'bcrypt';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';

// Mock PrismaService
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn(() => 'mockAccessToken'),
  verify: jest.fn(), // If you ever use verify in AuthService directly
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_SECRET') {
      return 'testSecret';
    }
    return null;
  }),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService; // Not strictly needed for these mocks but kept for clarity
  let jwtService: JwtService; // Not strictly needed for these mocks but kept for clarity

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    it('should create a new user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null); // No existing user
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-id-1',
        mobileNumber: '+919876543210',
        subscriptionStatus: 'Basic',
        createdAt: new Date(),
      });

      // MOCK THE PRIVATE hashPassword method of the service instance
      // This is the correct and cleaner way to test methods that call other internal methods.
      jest.spyOn(service as any, 'hashPassword').mockResolvedValue('mockHashedPassword');

      const result = await service.signup({
        mobileNumber: '+919876543210',
        password: 'password123',
      });

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { mobileNumber: '+919876543210' },
      });
      // Expect the service's hashPassword to have been called with the correct argument
      expect((service as any)['hashPassword']).toHaveBeenCalledWith('password123');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mobileNumber: '+919876543210',
            password: 'mockHashedPassword', // Expect the mocked hashed password here
          }),
        }),
      );
      expect(result).toHaveProperty('id');
      expect(result.mobileNumber).toBe('+919876543210');
    });

    it('should throw BadRequestException if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existing-user' }); // User exists

      await expect(
        service.signup({ mobileNumber: '+919876543210', password: 'password123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendOtp', () => {
    it('should generate and store OTP for an existing user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-id-1', mobileNumber: '+919876543210' });

      const result = await service.sendOtp({ mobileNumber: '+919876543210' });

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { mobileNumber: '+919876543210' },
      });
      expect(result).toHaveProperty('otp');
      expect(result.otp).toHaveLength(6);
      expect(result.message).toBe('OTP sent successfully (mocked)');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null); // User does not exist

      await expect(service.sendOtp({ mobileNumber: '+919876543210' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyOtp', () => {
    const mobileNumber = '+919876543210';
    const userId = 'user-id-1';
    const validOtp = '123456';

    beforeEach(() => {
      // Manually set OTP in the in-memory store for testing
      // Accessing private property for testing purposes
      (service as any)['otpStore'][mobileNumber] = {
        code: validOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      };
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId, mobileNumber: mobileNumber });
    });

    it('should return an access token for valid OTP', async () => {
      const result = await service.verifyOtp({ mobileNumber, otp: validOtp });

      expect(result).toHaveProperty('accessToken');
      expect(mockJwtService.sign).toHaveBeenCalledWith({ mobileNumber, sub: userId });
      expect((service as any)['otpStore'][mobileNumber]).toBeUndefined(); // OTP should be deleted
    });

    it('should throw UnauthorizedException for invalid OTP', async () => {
      await expect(service.verifyOtp({ mobileNumber, otp: 'wrongotp' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired OTP', async () => {
      // Set OTP to be expired
      (service as any)['otpStore'][mobileNumber].expiresAt = new Date(Date.now() - 1000); // 1 second ago

      await expect(service.verifyOtp({ mobileNumber, otp: validOtp })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if no OTP stored', async () => {
      delete (service as any)['otpStore'][mobileNumber]; // Remove OTP from store

      await expect(service.verifyOtp({ mobileNumber, otp: validOtp })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    const userId = 'user-id-1';
    const newPassword = 'NewSecurePassword123';

    it('should change user password', async () => {
      mockPrismaService.user.update.mockResolvedValue({ id: userId, password: 'hashedNewPassword' });
      // Mock the internal hashPassword method call
      jest.spyOn(service as any, 'hashPassword').mockResolvedValue('hashedNewPassword');

      const result = await service.changePassword(userId, { newPassword });

      expect((service as any)['hashPassword']).toHaveBeenCalledWith(newPassword);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: 'hashedNewPassword' },
      });
      expect(result.message).toBe('Password changed successfully');
    });
  });

  describe('validateUser', () => {
    it('should return user object if user exists', async () => {
      const user = { id: 'user-id-1', mobileNumber: '+919876543210', subscriptionStatus: 'Basic' };
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.validateUser('+919876543210');
      // Corrected expectation: expecting 'id', not 'userId'
      expect(result).toEqual({ id: user.id, mobileNumber: user.mobileNumber, subscriptionStatus: user.subscriptionStatus });
    });

    it('should return null if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const result = await service.validateUser('+919999999999');
      expect(result).toBeNull();
    });
  });
});