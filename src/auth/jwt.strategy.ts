// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service'; // Assuming you need to validate against DB

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService, // Inject PrismaService to validate user against DB
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // JWTs should expire
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Validates the JWT payload.
   * @param payload The decoded JWT payload.
   * @returns The user object if valid, throws UnauthorizedException otherwise.
   */
  async validate(payload: { sub: string; mobileNumber: string }) {
    // 'sub' is typically the user ID, 'mobileNumber' is from our custom payload
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, mobileNumber: payload.mobileNumber },
    });

    if (!user) {
      throw new UnauthorizedException();
    }
    // Return the user object. This will be attached to the request object (req.user)
    return { userId: user.id, mobileNumber: user.mobileNumber, subscriptionStatus: user.subscriptionStatus };
  }
}