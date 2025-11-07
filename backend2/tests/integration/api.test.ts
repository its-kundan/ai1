/**
 * Integration tests for API endpoints
 * These tests mock external services (OCR, embedding, LLM) to run without heavy dependencies
 */

import { buildApp } from '../../src/app';
import { prisma } from '../../src/db/prismaClient';
import { FastifyInstance } from 'fastify';

describe('API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.message.deleteMany();
    await prisma.chat.deleteMany();
    await prisma.embedding.deleteMany();
    await prisma.oCRResult.deleteMany();
    await prisma.document.deleteMany();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/v1/upload', () => {
    it('should upload a file and create document record', async () => {
      // Mock file buffer
      const fileBuffer = Buffer.from('test PDF content');
      const filename = 'test.pdf';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/upload',
        payload: {
          file: {
            data: fileBuffer,
            filename,
            mimetype: 'application/pdf',
          },
        },
        headers: {
          'content-type': 'multipart/form-data',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.document_id).toMatch(/^doc_[a-f0-9]+$/);
      expect(body.status).toBe('uploaded');
      expect(body.filename).toBe(filename);

      // Verify document in database
      const document = await prisma.document.findUnique({
        where: { documentId: body.document_id },
      });
      expect(document).toBeDefined();
      expect(document?.filename).toBe(filename);
    });

    it('should reject invalid file types', async () => {
      const fileBuffer = Buffer.from('test content');
      const filename = 'test.exe';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/upload',
        payload: {
          file: {
            data: fileBuffer,
            filename,
            mimetype: 'application/x-msdownload',
          },
        },
        headers: {
          'content-type': 'multipart/form-data',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid file type');
    });
  });

  describe('POST /api/v1/chat', () => {
    it('should create chat and return response (with mocked LLM)', async () => {
      // Create a test document first
      const document = await prisma.document.create({
        data: {
          documentId: 'doc_test123',
          filename: 'test.pdf',
          docType: 'general',
          filepath: './data/uploads/test.pdf',
          status: 'uploaded',
          meta: {},
        },
      });

      // Mock LLM service by intercepting fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          text: 'This is a test response from the LLM.',
          finish_reason: 'stop',
        }),
      } as Response);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/chat',
        payload: {
          chat_id: 'chat_test1',
          user_message: 'Hello, test message',
          use_retrieval: false,
          top_k: 3,
        },
      });

      // Restore fetch
      global.fetch = originalFetch;

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.chat_id).toBe('chat_test1');
      expect(body.reply).toContain('test response');
      expect(body.used_docs).toBeDefined();

      // Verify chat and messages in database
      const chat = await prisma.chat.findUnique({
        where: { chatId: 'chat_test1' },
        include: { messages: true },
      });
      expect(chat).toBeDefined();
      expect(chat?.messages.length).toBe(2); // user + assistant
    });
  });

  describe('GET /api/v1/chats', () => {
    it('should list all chats', async () => {
      // Create test chats
      await prisma.chat.createMany({
        data: [
          {
            chatId: 'chat_1',
            meta: {},
          },
          {
            chatId: 'chat_2',
            meta: {},
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/chats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.chats).toHaveLength(2);
      expect(body.total).toBe(2);
    });
  });

  describe('POST /api/v1/cache/clear', () => {
    it('should clear embeddings cache', async () => {
      // Create test embedding
      await prisma.$executeRawUnsafe(`
        INSERT INTO embeddings ("doc_id", snippet, vector, meta)
        VALUES ('doc_test', 'test snippet', '[0.1, 0.2, 0.3]'::vector, '{}'::jsonb)
      `);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/clear',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('cache_cleared');

      // Verify embeddings are cleared
      const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT COUNT(*) as count FROM embeddings'
      );
      expect(Number(count[0].count)).toBe(0);
    });
  });
});

