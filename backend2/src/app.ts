/**
 * Fastify app factory
 * Used for testing and server bootstrap
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { logger } from './utils/logger';

// Import routes
import uploadRoutes from './routes/v1/upload';
import ocrRoutes from './routes/v1/ocr';
import searchRoutes from './routes/v1/search';
import chatRoutes from './routes/v1/chat';
import chatsRoutes from './routes/v1/chats';
import cacheRoutes from './routes/v1/cache';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger,
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
  });

  // CORS configuration
  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim());

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  // Multipart support for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024,
    },
  });

  // Health check
  app.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  });

  // API v1 routes
  await app.register(uploadRoutes, { prefix: '/api/v1' });
  await app.register(ocrRoutes, { prefix: '/api/v1' });
  await app.register(searchRoutes, { prefix: '/api/v1' });
  await app.register(chatRoutes, { prefix: '/api/v1' });
  await app.register(chatsRoutes, { prefix: '/api/v1' });
  await app.register(cacheRoutes, { prefix: '/api/v1' });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error({ error, url: request.url }, 'Request error');
    
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    reply.status(statusCode).send({
      error: message,
      code: statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  });

  return app;
}

