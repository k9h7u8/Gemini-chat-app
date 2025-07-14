import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SubscriptionTier {
  Basic = 'Basic',
  Pro = 'Pro',
}

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'The subscription tier to subscribe to',
    enum: SubscriptionTier,
    example: SubscriptionTier.Pro,
  })
  @IsNotEmpty()
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;
} 