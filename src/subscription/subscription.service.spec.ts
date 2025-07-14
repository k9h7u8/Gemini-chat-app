import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto, SubscriptionTier } from './dto/create-subscription.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Mock Stripe
const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_test_...' }),
    },
  },
  subscriptions: {
    retrieve: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

// Mock the entire Stripe module
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockStripe),
}));

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let configService: ConfigService;
  let prismaService: PrismaService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SubscriptionService,
          useFactory: (configService, prismaService) => {
            SubscriptionService.setTestStripeInstance(mockStripe as any);
            return new SubscriptionService(configService, prismaService);
          },
          inject: [ConfigService, PrismaService],
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    configService = module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Setup default config values
    mockConfigService.get.mockImplementation((key: string) => {
      const config = {
        STRIPE_SECRET_KEY: 'sk_test_...',
        STRIPE_BASIC_PRICE_ID: 'price_basic',
        STRIPE_PRO_PRICE_ID: 'price_pro',
        STRIPE_WEBHOOK_SECRET: 'whsec_...',
      };
      return config[key] || null;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    const mockUser = {
      id: 'user-123',
      mobileNumber: '1234567890',
      subscriptionStatus: 'Basic',
    };

    const createSubscriptionDto: CreateSubscriptionDto = {
      tier: SubscriptionTier.Pro,
    };

    it('should create a subscription successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockStripe.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/cs_test_...',
      });

      const result = await service.createSubscription('user-123', createSubscriptionDto);

      expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_...' });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        line_items: [
          {
            price: 'price_pro',
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        customer_email: '1234567890@example.com',
        metadata: {
          userId: 'user-123',
          tier: 'Pro',
        },
        subscription_data: {
          metadata: {
            userId: 'user-123',
            tier: 'Pro',
          },
        },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.createSubscription('user-123', createSubscriptionDto))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when price ID not configured', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockConfigService.get.mockReturnValue(null);

      await expect(service.createSubscription('user-123', createSubscriptionDto))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getSubscriptionStatus', () => {
    const mockUser = {
      id: 'user-123',
      mobileNumber: '1234567890',
      subscriptionStatus: 'Pro',
    };

    it('should return subscription status successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getSubscriptionStatus('user-123');

      expect(result).toEqual({
        status: 'Pro',
        isActive: true,
        tier: 'Pro',
        subscriptionId: undefined,
        subscriptionEndDate: undefined,
        updatedAt: undefined,
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getSubscriptionStatus('user-123'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('handleStripeWebhook', () => {
    it('should handle checkout.session.completed event', async () => {
      const mockSession = {
        metadata: {
          userId: 'user-123',
          tier: 'Pro',
        },
      };

      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: mockSession,
        },
      };

      mockPrismaService.user.update.mockResolvedValue({});

      await service.handleStripeWebhook(mockEvent as any);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { 
          subscriptionStatus: 'Pro',
          stripeCustomerId: undefined,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle invoice.payment_succeeded event', async () => {
      const mockInvoice = {
        subscription: 'sub_123',
      };

      const mockSubscription = {
        metadata: {
          userId: 'user-123',
          tier: 'Pro',
        },
      };

      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: mockInvoice,
        },
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      mockPrismaService.user.update.mockResolvedValue({});

      await service.handleStripeWebhook(mockEvent as any);

      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { 
          subscriptionStatus: 'Pro',
          subscriptionId: 'sub_123',
          subscriptionEndDate: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle invoice.payment_failed event', async () => {
      const mockInvoice = {
        subscription: 'sub_123',
      };

      const mockSubscription = {
        metadata: {
          userId: 'user-123',
        },
      };

      const mockEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: mockInvoice,
        },
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      mockPrismaService.user.update.mockResolvedValue({});

      await service.handleStripeWebhook(mockEvent as any);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { 
          subscriptionStatus: 'Basic',
          subscriptionId: null,
          subscriptionEndDate: null,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle customer.subscription.deleted event', async () => {
      const mockSubscription = {
        metadata: {
          userId: 'user-123',
        },
      };

      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: mockSubscription,
        },
      };

      mockPrismaService.user.update.mockResolvedValue({});

      await service.handleStripeWebhook(mockEvent as any);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { 
          subscriptionStatus: 'Basic',
          subscriptionId: null,
          subscriptionEndDate: null,
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature successfully', () => {
      const payload = 'test payload';
      const signature = 'test signature';
      const mockEvent = { type: 'test.event' };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = service.verifyWebhookSignature(payload, signature);

      expect(result).toEqual(mockEvent);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_...',
      );
    });

    it('should throw BadRequestException when signature verification fails', () => {
      const payload = 'test payload';
      const signature = 'invalid signature';

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => service.verifyWebhookSignature(payload, signature))
        .toThrow(BadRequestException);
    });
  });
}); 