import { IsMobilePhone, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: '+919876543210', description: 'User mobile number' })
  @IsMobilePhone('en-IN',undefined,{ message: 'Invalid mobile number format' })
  mobileNumber: string;

  @ApiProperty({ example: 'MySecurePassword123', description: 'User password' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password cannot be more than 50 characters long' })
  password: string;
}