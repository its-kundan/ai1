/**
 * Chat route handler
 * POST /api/v1/chat
 */

import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prismaClient';
import { search } from '../../services/searchService';
import { generateChatResponse } from '../../services/llmClient';
import { logger } from '../../utils/logger';
import { ChatRequestSchema, ChatResponseSchema } from '../../schemas/apiSchemas';
import { z } from 'zod';

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: z.infer<typeof ChatRequestSchema>;
  }>('/chat', async (request, reply) => {
    try {
      const { chat_id, user_message, use_retrieval, top_k } = request.body;

      // Get or create chat
      let chat = await prisma.chat.findUnique({
        where: { chatId: chat_id },
      });

      if (!chat) {
        chat = await prisma.chat.create({
          data: {
            chatId: chat_id,
            meta: {},
          },
        });
      }

      // Load last N messages (sliding window, e.g., last 6)
      const recentMessages = await prisma.message.findMany({
        where: { chatId: chat_id },
        orderBy: { createdAt: 'desc' },
        take: 6,
      });

      // Reverse to get chronological order
      const messages = recentMessages.reverse().map((msg) => ({
        role: msg.role,
        content: msg.text,
      }));

      // Add current user message
      messages.push({
        role: 'user',
        content: user_message,
      });

      // Retrieve context if requested
      let retrievedContext: string | undefined;
      const usedDocs: string[] = [];

      if (use_retrieval) {
        try {
          const searchResults = await search(user_message, top_k);

          if (searchResults.length > 0) {
            const contextParts: string[] = [];
            const docIds = new Set<string>();

            searchResults.forEach((result) => {
              contextParts.push(`Document ${result.doc_id}: ${result.snippet}`);
              docIds.add(result.doc_id);
            });

            retrievedContext = contextParts.join('\n');
            usedDocs.push(...Array.from(docIds));
          }
        } catch (retrievalError) {
          logger.warn({ retrievalError }, 'Retrieval failed, continuing without context');
        }
      }

      // Generate response
      const systemPrompt = `You are a helpful assistant that answers questions based on provided context.
If the context contains relevant information, use it to answer. Otherwise, answer based on your knowledge.
Be concise and accurate.`;

      let assistantReply: string;
      try {
        assistantReply = await generateChatResponse(
          systemPrompt,
          messages,
          retrievedContext,
          'http' // Use HTTP LLM service
        );
      } catch (llmError: any) {
        logger.error({ llmError }, 'LLM generation failed');
        assistantReply = "I'm sorry, the language model service is not available. Please ensure your local LLM server is running.";
      }

      // Save messages to DB
      await prisma.message.createMany({
        data: [
          {
            chatId: chat_id,
            role: 'user',
            text: user_message,
            meta: usedDocs.length > 0 ? { used_docs: usedDocs } : {},
          },
          {
            chatId: chat_id,
            role: 'assistant',
            text: assistantReply,
            meta: usedDocs.length > 0 ? { used_docs: usedDocs } : {},
          },
        ],
      });

      // Update chat metadata
      await prisma.chat.update({
        where: { chatId: chat_id },
        data: {
          lastActive: new Date(),
        },
      });

      const response: typeof ChatResponseSchema._type = {
        chat_id,
        reply: assistantReply,
        used_docs: usedDocs,
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      logger.error({ error }, 'Chat failed');
      return reply.status(500).send({
        error: `Chat failed: ${error.message}`,
        code: 500,
      });
    }
  });
};

export default chatRoutes;

