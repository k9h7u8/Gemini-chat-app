// src/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CanActivate } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common'; // Import ExecutionContext

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  // Mock AuthService
  const mockAuthService = {
    signup: jest.fn(),
    sendOtp: jest.fn(),
    verifyOtp: jest.fn(),
    forgotPassword: jest.fn(),
    changePassword: jest.fn(),
  };

  // Mock JwtAuthGuard to always allow access for controller tests
  const mockJwtAuthGuard: CanActivate = {
    canActivate: jest.fn((context: ExecutionContext) => {
      // Mock req.user for protected routes
      const request = context.switchToHttp().getRequest();
      request.user = { userId: 'mock-user-id', mobileNumber: '+911234567890', subscriptionStatus: 'Basic' };
      return true;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService, // Provide the mock AuthService
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard) // Override the real JwtAuthGuard with our mock
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService); // Get the mock instance
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signup', () => {
    it('should call authService.signup and return the result', async () => {
      const signupDto = { mobileNumber: '+919876543210', password: 'password123' };
      const expectedResult = { id: 'user1', mobileNumber: signupDto.mobileNumber };
      mockAuthService.signup.mockResolvedValue(expectedResult);

      const result = await controller.signup(signupDto);
      expect(mockAuthService.signup).toHaveBeenCalledWith(signupDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('sendOtp', () => {
    it('should call authService.sendOtp and return the result', async () => {
      const sendOtpDto = { mobileNumber: '+919876543210' };
      const expectedResult = { message: 'OTP sent', otp: '123456' };
      mockAuthService.sendOtp.mockResolvedValue(expectedResult);

      const result = await controller.sendOtp(sendOtpDto);
      expect(mockAuthService.sendOtp).toHaveBeenCalledWith(sendOtpDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('verifyOtp', () => {
    it('should call authService.verifyOtp and return the result', async () => {
      const verifyOtpDto = { mobileNumber: '+919876543210', otp: '123456' };
      const expectedResult = { accessToken: 'mock_jwt_token' };
      mockAuthService.verifyOtp.mockResolvedValue(expectedResult);

      const result = await controller.verifyOtp(verifyOtpDto);
      expect(mockAuthService.verifyOtp).toHaveBeenCalledWith(verifyOtpDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword and return the result', async () => {
      const forgotPasswordDto = { mobileNumber: '+919876543210' };
      const expectedResult = { message: 'OTP sent (mocked)', otp: '654321' };
      mockAuthService.forgotPassword.mockResolvedValue(expectedResult);

      const result = await controller.forgotPassword(forgotPasswordDto);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('changePassword', () => {
    it('should call authService.changePassword with user ID from request and new password', async () => {
      const changePasswordDto = { newPassword: 'NewSecurePassword123' };
      const expectedResult = { message: 'Password changed successfully' };
      // Mock the request object's user property, which is set by the JwtAuthGuard
      const mockRequest = { user: { userId: 'mock-user-id', mobileNumber: '+911234567890' } };

      mockAuthService.changePassword.mockResolvedValue(expectedResult);

      // Pass the mock request object
      const result = await controller.changePassword(mockRequest, changePasswordDto);
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(mockRequest.user.userId, changePasswordDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getProfile', () => {
    it('should return user data from request object', async () => {
      const mockUser = { userId: 'test-user-id', mobileNumber: '+919876543210', subscriptionStatus: 'Pro' };
      const req = { user: mockUser }; // Mock the request object with user payload

      const result = controller.getProfile(req);
      expect(result).toEqual(mockUser);
    });
  });
});