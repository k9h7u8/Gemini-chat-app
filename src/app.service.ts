// src/app.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // Import ConfigService

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {} // Inject ConfigService

  getHello(): string {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    console.log('Database URL from ConfigService:', databaseUrl); // Log to verify
    return 'Hello World!';
  }
}