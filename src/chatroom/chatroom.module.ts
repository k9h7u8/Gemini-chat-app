import { Module } from '@nestjs/common';
import { ChatroomService } from './chatroom.service';
import { ChatroomController } from './chatroom.controller';
import { PrismaService } from '../prisma/prisma.service';
import { BullModule } from '@nestjs/bullmq';
import { GEMINI_QUEUE_NAME, GeminiProcessor } from './gemini.processor';
import { GeminiService } from './gemini.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    

    PassportModule,
    BullModule.registerQueue({
      name: GEMINI_QUEUE_NAME,
    }),
  ],
  controllers: [ChatroomController],
  providers: [
    ChatroomService,
    PrismaService, // Needs to be explicitly provided in ChatroomModule as well
    GeminiService,
    GeminiProcessor, // The BullMQ processor
  ],
  exports: [ChatroomService],
})
export class ChatroomModule {}