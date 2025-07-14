import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChatroomModule } from './chatroom/chatroom.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL is not defined in environment variables for BullMQ.');
        }
        const parsedRedisUrl = new URL(redisUrl);

        const connectionOptions: any = {
          host: parsedRedisUrl.hostname,
          port: parseInt(parsedRedisUrl.port),
          password: parsedRedisUrl.password || undefined,
          maxRetriesPerRequest: null, // Allow commands to retry indefinitely
          enableOfflineQueue: true, // Queue commands while connection is down
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000); // Exponential backoff, max 2 seconds
            console.log(`BullMQ Redis: Retrying connection (${times}). Delay: ${delay}ms`);
            return delay;
          },
          tls: parsedRedisUrl.protocol === 'rediss:' ? {} : undefined,
        };

        return {
          connection: connectionOptions,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),

    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL is not defined in environment variables for CacheModule.');
        }
        const parsedRedisUrl = new URL(redisUrl);

        const storeOptions: any = {
          store: redisStore,
          host: parsedRedisUrl.hostname,
          port: parseInt(parsedRedisUrl.port),
          password: parsedRedisUrl.password || undefined,
          ttl: 300,
          maxRetriesPerRequest: null, // Allow commands to retry indefinitely
          enableOfflineQueue: true, // Queue commands while connection is down
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000); // Exponential backoff, max 2 seconds
            console.log(`Cache Redis: Retrying connection (${times}). Delay: ${delay}ms`);
            return delay;
          },
          // Same TLS considerations as above.
          tls: parsedRedisUrl.protocol === 'rediss:' ? {} : undefined, // Explicit TLS for Upstash
        };

        return storeOptions;
      },
      inject: [ConfigService],
      isGlobal: true,
    }),

    AuthModule,
    ChatroomModule,
    SubscriptionModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}