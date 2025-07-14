import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionStatusDto } from './dto/subscription-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('subscription')
@Controller('subscription')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('subscribe/pro')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Pro subscription checkout session' })
  @ApiResponse({
    status: 201,
    description: 'Checkout session created successfully',
    schema: {
      type: 'object',
      properties: {
        checkoutUrl: {
          type: 'string',
          description: 'Stripe checkout URL',
          example: 'https://checkout.stripe.com/pay/cs_test_...',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createProSubscription(
    @GetUser('id') userId: string,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<{ checkoutUrl: string }> {
    return this.subscriptionService.createSubscription(userId, createSubscriptionDto);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current subscription status' })
  @ApiResponse({
    status: 200,
    description: 'Subscription status retrieved successfully',
    type: SubscriptionStatusDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getSubscriptionStatus(@GetUser('id') userId: string): Promise<SubscriptionStatusDto> {
    return this.subscriptionService.getSubscriptionStatus(userId);
  }

  @Post('webhook/stripe')
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleStripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!request.rawBody) {
      throw new BadRequestException('Missing request body');
    }

    try {
      // Verify the webhook signature
      const event = this.subscriptionService.verifyWebhookSignature(
        request.rawBody.toString(),
        signature,
      );

      // Handle the webhook event
      await this.subscriptionService.handleStripeWebhook(event);

      this.logger.log(`Webhook processed successfully: ${event.type}`);

      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      throw new BadRequestException('Webhook processing failed');
    }
  }
} 