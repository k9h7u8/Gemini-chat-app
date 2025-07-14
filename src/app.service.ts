import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHello(): string {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    console.log('Database URL from ConfigService:', databaseUrl); // Log to verify
    return 'Hello World!';
  }
}