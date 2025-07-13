// src/chatroom/chatroom.module.ts
import { Module } from '@nestjs/common';
import { ChatroomService } from './chatroom.service';
import { ChatroomController } from './chatroom.controller';
import { PrismaService } from '../prisma/prisma.service'; // Ensure this path is correct
import { BullModule } from '@nestjs/bullmq'; // Make sure this is from '@nestjs/bullmq'
import { GEMINI_QUEUE_NAME, GeminiProcessor } from './gemini.processor';
import { GeminiService } from './gemini.service';
import { PassportModule } from '@nestjs/passport'; // Needed for AuthGuard
import { JwtModule } from '@nestjs/jwt'; // Conditionally needed if AuthModule doesn't export it

@Module({
  imports: [
    // PrismaService is a provider, not an importable module directly in imports array this way.
    // It should be listed in providers of modules that use it.
    // We already list it in providers below, so remove it from here if it was present.
    // You typically import the module that provides PrismaService, but if it's a global provider (from AppModule)
    // and just injected directly, it doesn't go here.

    PassportModule, // Required by JwtAuthGuard

    // If AuthModule doesn't export JwtModule, you might need to register it here:
    // This depends on how your AuthModule is structured. If AuthModule correctly
    // exports JwtModule, you don't need this. Otherwise, you might.
    // JwtModule.registerAsync({
    //   imports: [ConfigModule], // Make sure ConfigModule is imported if you use it here
    //   useFactory: async (configService: ConfigService) => ({ secret: configService.get<string>('JWT_SECRET') }),
    //   inject: [ConfigService],
    // }),

    // CORRECTED: Use BullModule.registerQueue() for @nestjs/bullmq
    BullModule.registerQueue({
      name: GEMINI_QUEUE_NAME,
      // You can also provide specific connection options for this queue here
      // if they differ from the global BullModule.forRootAsync() settings.
      // E.g., connection: { host: 'localhost', port: 6379 }
    }),
  ],
  controllers: [ChatroomController],
  providers: [
    ChatroomService,
    PrismaService, // Needs to be explicitly provided in ChatroomModule as well
    GeminiService,
    GeminiProcessor, // The BullMQ processor
  ],
  exports: [ChatroomService], // Export ChatroomService if other modules need to inject it
})
export class ChatroomModule {}