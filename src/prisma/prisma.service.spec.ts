// src/prisma/prisma.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

describe('PrismaService', () => {
  let service: PrismaService;
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);

    // Manually connect and disconnect for testing
    await service.$connect();
  });

  afterAll(async () => {
    await service.$disconnect();
    // Clean up data after tests, e.g., delete all users, chatrooms, messages
    // This is crucial for consistent test runs
    await service.message.deleteMany({});
    await service.chatroom.deleteMany({});
    await service.user.deleteMany({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should connect to the database', async () => {
    // If $connect() in beforeAll didn't throw, it means connection was successful
    // We can try a simple query to confirm
    const result = await service.$queryRaw`SELECT 1`;
    expect(result).toEqual([{ '?column?': 1 }]);
  });

  it('should perform basic CRUD operations on User model', async () => {
    // Create
    const user = await service.user.create({
      data: {
        mobileNumber: '1234567890',
        password: 'hashedpassword123',
        subscriptionStatus: 'Basic',
      },
    });
    expect(user).toBeDefined();
    expect(user.mobileNumber).toBe('1234567890');

    // Read
    const foundUser = await service.user.findUnique({
      where: { id: user.id },
    });
    expect(foundUser).toEqual(user);

    // Update
    const updatedUser = await service.user.update({
      where: { id: user.id },
      data: { subscriptionStatus: 'Pro' },
    });
    expect(updatedUser.subscriptionStatus).toBe('Pro');

    // Delete (clean up after test)
    await service.user.delete({ where: { id: user.id } });
    const deletedUser = await service.user.findUnique({ where: { id: user.id } });
    expect(deletedUser).toBeNull();
  });

  // You can add similar tests for Chatroom and Message models
});