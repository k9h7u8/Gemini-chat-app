import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express'; 

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configure Express to handle raw body for Stripe webhooks
  app.use(express.json({
    verify: (req: any, res, buf) => {
      if (req.url?.startsWith('/subscription/webhook/stripe')) {
        req.rawBody = buf;
      }
    },
  }));
  
  app.useGlobalPipes(new ValidationPipe()); 
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
