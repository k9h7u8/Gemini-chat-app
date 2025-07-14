import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChatroomDto } from './dto/create-chatroom.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { GEMINI_QUEUE_NAME } from './gemini.processor';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class ChatroomService {
  private readonly logger = new Logger(ChatroomService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue(GEMINI_QUEUE_NAME) private readonly geminiQueue: Queue,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Creates a new chatroom.
   * @param createChatroomDto Data for creating the chatroom.
   * @param userId The ID of the user creating the chatroom.
   * @returns The created chatroom.
   */
  async createChatroom(createChatroomDto: CreateChatroomDto, userId: string) {
    const chatroom = await this.prisma.chatroom.create({
      data: {
        name: createChatroomDto.name,
        creatorId: userId,
      },
    });
    // Invalidate cache for chatroom listing after creating a new one
    await this.cacheManager.del(`chatrooms_user_${userId}`);
    this.logger.log(`New chatroom created: ${chatroom.id}. Cache invalidated for user ${userId}.`);
    return chatroom;
  }

  /**
   * Lists all chatrooms for a specific user.
   * Uses caching to improve performance.
   * @param userId The ID of the user.
   * @returns List of chatrooms.
   */
  async listChatrooms(userId: string) {
    const cacheKey = `chatrooms_user_${userId}`;
    const cachedChatrooms = await this.cacheManager.get(cacheKey);

    if (cachedChatrooms) {
      this.logger.log(`Serving chatrooms for user ${userId} from cache.`);
      // IMPORTANT: If you are returning from cache, ensure the type matches what
      // Prisma would return. cache-manager stores JSON, so it might not be the exact
      // object type from Prisma unless you explicitly deserialize/cast it.
      // For simple data, it's often fine.
      return cachedChatrooms;
    }

    const chatrooms = await this.prisma.chatroom.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Cache for 1 minute (60 * 1000 milliseconds)
    await this.cacheManager.set(cacheKey, chatrooms, 60 * 1000);
    this.logger.log(`Fetched chatrooms for user ${userId} from DB and cached.`);
    return chatrooms;
  }

  /**
   * Retrieves a specific chatroom's details and its messages.
   * @param chatroomId The ID of the chatroom.
   * @param userId The ID of the user requesting the chatroom (for authorization).
   * @returns The chatroom details with messages.
   */
  async getChatroomDetails(chatroomId: string, userId: string) {
    const chatroom = await this.prisma.chatroom.findUnique({
      where: { id: chatroomId, creatorId: userId }, // Ensure user owns the chatroom
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!chatroom) {
      throw new NotFoundException(`Chatroom with ID ${chatroomId} not found or you don't have access.`);
    }
    return chatroom;
  }

  /**
   * Sends a message to a chatroom and adds a job to the queue for Gemini processing.
   * @param chatroomId The ID of the chatroom.
   * @param userId The ID of the user sending the message.
   * @param sendMessageDto The message content.
   * @returns The created user message.
   */
  async sendMessage(chatroomId: string, userId: string, sendMessageDto: SendMessageDto) {
    // 1. Verify chatroom exists and belongs to the user
    const chatroom = await this.prisma.chatroom.findUnique({
      where: { id: chatroomId, creatorId: userId },
    });

    if (!chatroom) {
      throw new NotFoundException(`Chatroom with ID ${chatroomId} not found or you don't have access.`);
    }

    // 2. Store the user's message in the database
    const userMessage = await this.prisma.message.create({
      data: {
        content: sendMessageDto.content,
        isFromGemini: false, // This is a user message
        chatroomId: chatroomId,
      },
    });
    this.logger.log(`User message stored for chatroom ${chatroomId}.`);

    // 3. Add a job to the Gemini queue for AI response
    try {
      await this.geminiQueue.add(
        'process-gemini-message', // Job name
        {
          messageContent: sendMessageDto.content,
          chatroomId: chatroomId,
          userId: userId, // Pass userId for potential future logging/context in processor
        },
        {
          removeOnComplete: true, // Clean up job when done
          removeOnFail: false, // Keep failed jobs for debugging
        }
      );
      this.logger.log(`Job added to ${GEMINI_QUEUE_NAME} queue for chatroom ${chatroomId}.`);
    } catch (error) {
      this.logger.error(`Failed to add job to queue: ${error.message}`, error.stack);
      // Decide how to handle this: e.g., throw, or return partial success
      throw new InternalServerErrorException('Failed to send message for AI processing.');
    }

    return userMessage;
  }
}