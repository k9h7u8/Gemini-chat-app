import { IsMobilePhone } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: '+919876543210', description: 'Mobile number to send OTP to' })
  @IsMobilePhone('en-IN',undefined, { message: 'Invalid mobile number format' })
  mobileNumber: string;
}