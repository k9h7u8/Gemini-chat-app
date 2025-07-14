import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: any; // Using 'any' for simplicity, or define specific model types if needed

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured.');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Using a conversational model, e.g., gemini-pro
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  /**
   * Generates content using the Google Gemini API.
   * @param prompt The user's message to send to Gemini.
   * @returns The generated response from Gemini.
   */
  async generateContent(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      this.logger.log(`Gemini response: ${text.substring(0, 100)}...`);
      return text;
    } catch (error) {
      this.logger.error(`Error interacting with Gemini API: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get response from AI.');
    }
  }

  // You can add more methods here for multi-turn conversations if needed
  // e.g., using chat = model.startChat()
}