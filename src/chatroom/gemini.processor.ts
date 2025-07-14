import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { PrismaService } from '../prisma/prisma.service';

export const GEMINI_QUEUE_NAME = 'gemini-messages';

@Processor(GEMINI_QUEUE_NAME)
export class GeminiProcessor extends WorkerHost {
  private readonly logger = new Logger(GeminiProcessor.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}. Data: ${JSON.stringify(job.data)}`);
    const { messageContent, chatroomId, userId } = job.data;

    try {
      // Simulate Gemini API call
      const geminiResponse = await this.geminiService.generateContent(messageContent);

      // Store Gemini's response as a new message
      await this.prisma.message.create({
        data: {
          content: geminiResponse,
          isFromGemini: true,
          chatroomId: chatroomId,
        },
      });

      this.logger.log(`Job ${job.id} completed. Gemini response stored for chatroom ${chatroomId}.`);
      return { success: true, geminiResponse };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      // Re-throw to allow BullMQ to handle retries and move to failed queue
      throw error;
    }
  }

  // Optional: Listen to worker events for logging/monitoring
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed with error ${err.message}.`);
  }
}