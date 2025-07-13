// src/auth/dto/forgot-password.dto.ts
import { IsMobilePhone } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: '+919876543210', description: 'Mobile number for password reset' })
  @IsMobilePhone('en-IN',undefined, { message: 'Invalid mobile number format' })
  mobileNumber: string;
}