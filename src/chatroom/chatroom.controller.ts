// src/chatroom/chatroom.controller.ts
import { Controller, Post, Body, UseGuards, Request, Get, Param, BadRequestException } from '@nestjs/common';
import { ChatroomService } from './chatroom.service';
import { CreateChatroomDto } from './dto/create-chatroom.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Assuming JwtAuthGuard is here or exported
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'; // For Swagger/OpenAPI documentation

@ApiTags('Chatrooms') // Tag for Swagger UI
@ApiBearerAuth() // Indicates this controller requires a Bearer token
@UseGuards(JwtAuthGuard) // Protect all routes in this controller
@Controller('chatroom')
export class ChatroomController {
  constructor(private readonly chatroomService: ChatroomService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new chatroom' })
  @ApiResponse({ status: 201, description: 'The chatroom has been successfully created.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createChatroom(
    @Request() req,
    @Body() createChatroomDto: CreateChatroomDto,
  ) {
    // req.user is populated by JwtAuthGuard
    return this.chatroomService.createChatroom(createChatroomDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all chatrooms for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of chatrooms.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async listChatrooms(@Request() req) {
    return this.chatroomService.listChatrooms(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific chatroom, including messages' })
  @ApiResponse({ status: 200, description: 'Chatroom details and messages.' })
  @ApiResponse({ status: 404, description: 'Chatroom not found or unauthorized access.' })
  async getChatroomDetails(@Request() req, @Param('id') chatroomId: string) {
    if (!chatroomId) {
      throw new BadRequestException('Chatroom ID is required.');
    }
    return this.chatroomService.getChatroomDetails(chatroomId, req.user.userId);
  }

  @Post(':id/message')
  @ApiOperation({ summary: 'Send a message to a chatroom' })
  @ApiResponse({ status: 201, description: 'The message has been successfully sent and queued for AI processing.' })
  @ApiResponse({ status: 404, description: 'Chatroom not found or unauthorized access.' })
  @ApiResponse({ status: 500, description: 'Failed to queue message for AI processing.' })
  async sendMessage(
    @Request() req,
    @Param('id') chatroomId: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    if (!chatroomId) {
      throw new BadRequestException('Chatroom ID is required.');
    }
    return this.chatroomService.sendMessage(chatroomId, req.user.userId, sendMessageDto);
  }
}