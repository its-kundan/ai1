/**
 * Chats route handlers
 * GET /api/v1/chats
 * GET /api/v1/chats/:chat_id/messages
 */

import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prismaClient';
import { logger } from '../../utils/logger';
import { ChatListResponseSchema, ChatMessagesResponseSchema } from '../../schemas/apiSchemas';

const chatsRoutes: FastifyPluginAsync = async (fastify) => {
  // List all chats
  fastify.get('/chats', async (request, reply) => {
    try {
      const chats = await prisma.chat.findMany({
        orderBy: { lastActive: 'desc' },
        include: {
          _count: {
            select: { messages: true },
          },
        },
      });

      const chatList = chats.map((chat) => ({
        chat_id: chat.chatId,
        last_active: chat.lastActive,
        message_count: chat._count.messages,
        title: chat.title || null,
      }));

      const response: typeof ChatListResponseSchema._type = {
        chats: chatList,
        total: chatList.length,
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      logger.error({ error }, 'List chats failed');
      return reply.status(500).send({
        error: `Failed to list chats: ${error.message}`,
        code: 500,
      });
    }
  });

  // Get messages for a specific chat
  fastify.get<{
    Params: { chat_id: string };
    Querystring: { page?: string; page_size?: string };
  }>('/chats/:chat_id/messages', async (request, reply) => {
    try {
      const { chat_id } = request.params;
      const page = parseInt(request.query.page || '1', 10);
      const pageSize = parseInt(request.query.page_size || '50', 10);

      // Validate chat exists
      const chat = await prisma.chat.findUnique({
        where: { chatId: chat_id },
      });

      if (!chat) {
        return reply.status(404).send({
          error: 'Chat not found',
          code: 404,
        });
      }

      // Get messages with pagination
      const offset = (page - 1) * pageSize;
      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where: { chatId: chat_id },
          orderBy: { createdAt: 'asc' },
          skip: offset,
          take: pageSize,
        }),
        prisma.message.count({
          where: { chatId: chat_id },
        }),
      ]);

      const messageList = messages.map((msg) => {
        const meta = msg.meta as any;
        return {
          id: msg.id,
          chat_id: msg.chatId,
          role: msg.role,
          text: msg.text,
          timestamp: msg.createdAt,
          used_docs: meta?.used_docs || null,
        };
      });

      const response: typeof ChatMessagesResponseSchema._type = {
        chat_id,
        messages: messageList,
        total,
        page,
        page_size: pageSize,
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      logger.error({ error }, 'Get messages failed');
      return reply.status(500).send({
        error: `Failed to get messages: ${error.message}`,
        code: 500,
      });
    }
  });
};

export default chatsRoutes;

