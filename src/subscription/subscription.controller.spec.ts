import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto, SubscriptionTier } from './dto/create-subscription.dto';
import { SubscriptionStatusDto } from './dto/subscription-status.dto';
import { BadRequestException } from '@nestjs/common';

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let service: SubscriptionService;

  const mockSubscriptionService = {
    createSubscription: jest.fn(),
    getSubscriptionStatus: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    handleStripeWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        {
          provide: SubscriptionService,
          useValue: mockSubscriptionService,
        },
      ],
    }).compile();

    controller = module.get<SubscriptionController>(SubscriptionController);
    service = module.get<SubscriptionService>(SubscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProSubscription', () => {
    const mockUser = { id: 'user-123' };
    const createSubscriptionDto: CreateSubscriptionDto = {
      tier: SubscriptionTier.Pro,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    };

    it('should create a Pro subscription successfully', async () => {
      const expectedResult = { checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_...' };
      mockSubscriptionService.createSubscription.mockResolvedValue(expectedResult);

      const result = await controller.createProSubscription(mockUser.id, createSubscriptionDto);

      expect(result).toEqual(expectedResult);
      expect(service.createSubscription).toHaveBeenCalledWith(mockUser.id, createSubscriptionDto);
    });
  });

  describe('getSubscriptionStatus', () => {
    const mockUser = { id: 'user-123' };
    const expectedStatus: SubscriptionStatusDto = {
      status: 'Pro' as any,
      isActive: true,
      tier: 'Pro',
      updatedAt: new Date(),
    };

    it('should return subscription status successfully', async () => {
      mockSubscriptionService.getSubscriptionStatus.mockResolvedValue(expectedStatus);

      const result = await controller.getSubscriptionStatus(mockUser.id);

      expect(result).toEqual(expectedStatus);
      expect(service.getSubscriptionStatus).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('handleStripeWebhook', () => {
    const mockRequest = {
      rawBody: Buffer.from('test payload'),
      url: '/subscription/webhook/stripe',
    };

    const mockSignature = 'test_signature';
    const mockEvent = { type: 'checkout.session.completed' };

    it('should handle Stripe webhook successfully', async () => {
      mockSubscriptionService.verifyWebhookSignature.mockReturnValue(mockEvent);
      mockSubscriptionService.handleStripeWebhook.mockResolvedValue(undefined);

      const result = await controller.handleStripeWebhook(mockRequest as any, mockSignature);

      expect(result).toEqual({ received: true });
      expect(service.verifyWebhookSignature).toHaveBeenCalledWith(
        mockRequest.rawBody.toString(),
        mockSignature,
      );
      expect(service.handleStripeWebhook).toHaveBeenCalledWith(mockEvent);
    });

    it('should throw BadRequestException when signature is missing', async () => {
      await expect(controller.handleStripeWebhook(mockRequest as any, undefined as any))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when raw body is missing', async () => {
      const requestWithoutBody = { ...mockRequest, rawBody: undefined };

      await expect(controller.handleStripeWebhook(requestWithoutBody as any, mockSignature))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when webhook processing fails', async () => {
      mockSubscriptionService.verifyWebhookSignature.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(controller.handleStripeWebhook(mockRequest as any, mockSignature))
        .rejects.toThrow(BadRequestException);
    });
  });
}); 