// src/chatroom/dto/create-chatroom.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatroomDto {
  @ApiProperty({ example: 'My Awesome Chatroom', description: 'Name of the chatroom' })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name cannot be empty' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  name: string;
}