import { ApiProperty } from '@nestjs/swagger';

export enum SubscriptionStatus {
  Basic = 'Basic',
  Pro = 'Pro',
}

export class SubscriptionStatusDto {
  @ApiProperty({
    description: 'The current subscription status of the user',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.Pro,
  })
  status: SubscriptionStatus;

  @ApiProperty({
    description: 'Whether the subscription is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'The subscription tier name',
    example: 'Pro',
  })
  tier: string;

  @ApiProperty({
    description: 'The Stripe subscription ID',
    example: 'sub_1234567890',
    required: false,
  })
  subscriptionId?: string;

  @ApiProperty({
    description: 'When the subscription expires',
    example: '2024-08-14T10:30:00Z',
    required: false,
  })
  subscriptionEndDate?: Date;

  @ApiProperty({
    description: 'The date when the subscription was last updated',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;
} 