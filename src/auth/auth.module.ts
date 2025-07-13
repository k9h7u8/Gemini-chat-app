// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config'; // Import ConfigService for JWT secret
import { JwtStrategy } from './jwt.strategy'; // Will create this next
import { PassportModule } from '@nestjs/passport'; // Import PassportModule

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [], // No specific imports needed here, ConfigModule is global
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '60m' }, // Token expires in 60 minutes
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PrismaService, JwtStrategy], // Add PrismaService and JwtStrategy
  exports: [AuthService], // Export AuthService if other modules need to use it
})
export class AuthModule {}