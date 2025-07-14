import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
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
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }
    // Return the user object with 'id' property for GetUser('id')
    return { id: user.id, mobileNumber: user.mobileNumber, subscriptionStatus: user.subscriptionStatus };
  }
}