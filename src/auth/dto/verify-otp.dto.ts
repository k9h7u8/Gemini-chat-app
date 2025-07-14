import { IsMobilePhone, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: '+919876543210', description: 'Mobile number associated with the OTP' })
  @IsMobilePhone('en-IN',undefined,{ message: 'Invalid mobile number format' })
  mobileNumber: string;

  @ApiProperty({ example: '123456', description: 'The OTP received' })
  @IsString({ message: 'OTP must be a string' })
  @Length(6, 6, { message: 'OTP must be exactly 6 characters long' })
  otp: string;
}