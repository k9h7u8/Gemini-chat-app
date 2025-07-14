import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { CreateSubscriptionDto, SubscriptionTier } from './dto/create-subscription.dto';
import { SubscriptionStatusDto } from './dto/subscription-status.dto';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private stripe: Stripe;
  private static testStripeInstance: Stripe | null = null;

  static setTestStripeInstance(stripe: Stripe) {
    this.testStripeInstance = stripe;
  }

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    if (SubscriptionService.testStripeInstance) {
      this.stripe = SubscriptionService.testStripeInstance;
      return;
    }
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      if (process.env.NODE_ENV === 'test') {
        this.stripe = {} as any;
      } else {
        throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
      }
    } else {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-06-30.basil',
      });
    }
  }

  async createSubscription(
    userId: string,
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<{ checkoutUrl: string }> {
    try {
      // Get user details
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get frontend URL from env
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const successUrl = `${frontendUrl}/success`;
      const cancelUrl = `${frontendUrl}/cancel`;

      // Get the appropriate price ID based on the tier
      const priceId = this.getPriceIdForTier(createSubscriptionDto.tier);

      // Create Stripe checkout session
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: user.mobileNumber + '@example.com', // Using mobile number as email
        metadata: {
          userId: userId,
          tier: createSubscriptionDto.tier,
        },
        subscription_data: {
          metadata: {
            userId: userId,
            tier: createSubscriptionDto.tier,
          },
        },
      });

      this.logger.log(`Created checkout session for user ${userId} for ${createSubscriptionDto.tier} tier`);

      return { checkoutUrl: session.url! };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error creating subscription: ${error.message}`);
      throw new BadRequestException('Failed to create subscription');
    }
  }

  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error handling webhook: ${error.message}`);
      throw error;
    }
  }

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    }) as any;

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      status: user.subscriptionStatus as any,
      isActive: true, // Assuming subscription is active if user exists
      tier: user.subscriptionStatus,
      subscriptionId: user.subscriptionId || undefined,
      subscriptionEndDate: user.subscriptionEndDate || undefined,
      updatedAt: user.updatedAt,
    };
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier as SubscriptionTier;

    if (!userId || !tier) {
      this.logger.error('Missing userId or tier in session metadata');
      return;
    }

    // Update user subscription status and store Stripe customer ID
    await this.prisma.user.update({
      where: { id: userId },
      data: { 
        subscriptionStatus: tier,
        stripeCustomerId: session.customer as string,
        updatedAt: new Date(),
      } as any,
    });

    this.logger.log(`User ${userId} subscription upgraded to ${tier}`);
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription;
    if (subscriptionId) {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId as string);
      const userId = subscription.metadata?.userId;
      const tier = subscription.metadata?.tier as SubscriptionTier;

      if (userId && tier) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { 
            subscriptionStatus: tier,
            subscriptionId: subscriptionId as string,
            subscriptionEndDate: new Date((subscription as any).current_period_end * 1000),
            updatedAt: new Date(),
          } as any,
        });

        this.logger.log(`User ${userId} subscription payment succeeded for ${tier} tier`);
      }
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription;
    if (subscriptionId) {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId as string);
      const userId = subscription.metadata?.userId;

      if (userId) {
        // Downgrade to Basic on payment failure
        await this.prisma.user.update({
          where: { id: userId },
          data: { 
            subscriptionStatus: 'Basic',
            subscriptionId: null,
            subscriptionEndDate: null,
            updatedAt: new Date(),
          } as any,
        });

        this.logger.log(`User ${userId} subscription downgraded to Basic due to payment failure`);
      }
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata?.userId;

    if (userId) {
      // Downgrade to Basic when subscription is cancelled
      await this.prisma.user.update({
        where: { id: userId },
        data: { 
          subscriptionStatus: 'Basic',
          subscriptionId: null,
          subscriptionEndDate: null,
          updatedAt: new Date(),
        } as any,
      });

      this.logger.log(`User ${userId} subscription cancelled, downgraded to Basic`);
    }
  }

  private getPriceIdForTier(tier: SubscriptionTier): string {
    const priceIds = {
      [SubscriptionTier.Basic]: this.configService.get<string>('STRIPE_BASIC_PRICE_ID'),
      [SubscriptionTier.Pro]: this.configService.get<string>('STRIPE_PRO_PRICE_ID'),
    };

    const priceId = priceIds[tier];
    if (!priceId) {
      throw new BadRequestException(`Price ID not configured for tier: ${tier}`);
    }

    return priceId;
  }

  // Method to verify Stripe webhook signature
  verifyWebhookSignature(payload: string, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not defined');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }
  }
} 