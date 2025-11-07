/**
 * Test examples for Redis cache operations (Node.js/TypeScript)
 * These tests demonstrate how to use the Redis cache service.
 */

import { getCacheService, getRedisClient, isRedisConnected } from '../../src/services/redis';

describe('Redis Cache Service', () => {
  const cache = getCacheService();
  let redisAvailable = false;

  beforeAll(async () => {
    redisAvailable = await isRedisConnected();
    if (!redisAvailable) {
      console.warn('Redis not available, skipping tests');
    }
  });

  describe('Chat Context', () => {
    const chatId = `test_chat_${Date.now()}`;

    it('should add and retrieve chat messages', async () => {
      if (!redisAvailable) return;

      await cache.addChatMessage(chatId, 'user', 'Hello, what is my balance?');
      await cache.addChatMessage(chatId, 'assistant', 'Your balance is $1,234.56.');
      await cache.addChatMessage(chatId, 'user', 'Show recent transactions');

      const messages = await cache.getChatContext(chatId);

      expect(messages.length).toBe(3);
      expect(messages[0].role).toBe('user');
      expect(messages[0].text).toBe('Hello, what is my balance?');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
    });

    it('should maintain sliding window (last N messages)', async () => {
      if (!redisAvailable) return;

      const chatId2 = `test_chat_window_${Date.now()}`;

      // Add more messages than window size (default 20)
      for (let i = 0; i < 25; i++) {
        await cache.addChatMessage(chatId2, 'user', `Message ${i}`);
      }

      const messages = await cache.getChatContext(chatId2);
      expect(messages.length).toBe(20);
      expect(messages[0].text).toBe('Message 5'); // First message in window
      expect(messages[messages.length - 1].text).toBe('Message 24'); // Last message
    });

    it('should set and get chat metadata', async () => {
      if (!redisAvailable) return;

      const chatId3 = `test_chat_meta_${Date.now()}`;
      const meta = {
        last_active: new Date().toISOString(),
        model_version: 'gpt-4',
        message_count: 5,
      };

      await cache.setChatMeta(chatId3, meta);
      const retrieved = await cache.getChatMeta(chatId3);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.model_version).toBe('gpt-4');
      expect(retrieved?.message_count).toBe(5);
    });
  });

  describe('LLM Cache', () => {
    it('should cache and retrieve LLM responses', async () => {
      if (!redisAvailable) return;

      const modelVersion = 'gpt-4';
      const prompt = 'What is my account balance?';

      // First call - cache miss
      const cached1 = await cache.getLLMCache(modelVersion, prompt);
      expect(cached1).toBeNull();

      // Cache the response
      const reply = 'Your account balance is $1,234.56.';
      await cache.setLLMCache(modelVersion, prompt, reply, ['doc_123']);

      // Second call - cache hit
      const cached2 = await cache.getLLMCache(modelVersion, prompt);
      expect(cached2).not.toBeNull();
      expect(cached2?.reply).toBe(reply);
      expect(cached2?.used_docs).toEqual(['doc_123']);
      expect(cached2?.created_at).toBeDefined();
    });

    it('should handle different prompts separately', async () => {
      if (!redisAvailable) return;

      const modelVersion = 'gpt-4';
      const prompt1 = 'What is my balance?';
      const prompt2 = 'Show me transactions';

      await cache.setLLMCache(modelVersion, prompt1, 'Reply 1');
      await cache.setLLMCache(modelVersion, prompt2, 'Reply 2');

      const cached1 = await cache.getLLMCache(modelVersion, prompt1);
      const cached2 = await cache.getLLMCache(modelVersion, prompt2);

      expect(cached1?.reply).toBe('Reply 1');
      expect(cached2?.reply).toBe('Reply 2');
    });
  });

  describe('Embedding Cache', () => {
    it('should cache and retrieve embeddings', async () => {
      if (!redisAvailable) return;

      const text = 'Account balance query';
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      // Cache miss
      const cached1 = await cache.getEmbeddingCache(text);
      expect(cached1).toBeNull();

      // Cache the embedding
      await cache.setEmbeddingCache(text, embedding);

      // Cache hit
      const cached2 = await cache.getEmbeddingCache(text);
      expect(cached2).toEqual(embedding);
    });

    it('should handle different texts separately', async () => {
      if (!redisAvailable) return;

      const text1 = 'Account balance';
      const text2 = 'Transaction history';
      const embedding1 = [0.1, 0.2, 0.3];
      const embedding2 = [0.4, 0.5, 0.6];

      await cache.setEmbeddingCache(text1, embedding1);
      await cache.setEmbeddingCache(text2, embedding2);

      const cached1 = await cache.getEmbeddingCache(text1);
      const cached2 = await cache.getEmbeddingCache(text2);

      expect(cached1).toEqual(embedding1);
      expect(cached2).toEqual(embedding2);
    });
  });

  describe('Job Status', () => {
    it('should track job lifecycle: queued -> processing -> done', async () => {
      if (!redisAvailable) return;

      const jobId = `test_job_${Date.now()}`;

      // Queued
      await cache.setJobStatus(jobId, 'queued', 0);
      let status = await cache.getJobStatus(jobId);
      expect(status?.status).toBe('queued');
      expect(status?.progress).toBe(0);

      // Processing
      await cache.setJobStatus(jobId, 'processing', 50);
      status = await cache.getJobStatus(jobId);
      expect(status?.status).toBe('processing');
      expect(status?.progress).toBe(50);

      // Done
      await cache.setJobStatus(jobId, 'done', 100, 'data/ocr_results/doc_123.json');
      status = await cache.getJobStatus(jobId);
      expect(status?.status).toBe('done');
      expect(status?.progress).toBe(100);
      expect(status?.result_ptr).toBe('data/ocr_results/doc_123.json');

      // Delete after retrieval
      await cache.deleteJobStatus(jobId);
      status = await cache.getJobStatus(jobId);
      expect(status).toBeNull();
    });

    it('should handle failed job status', async () => {
      if (!redisAvailable) return;

      const jobId = `test_job_failed_${Date.now()}`;

      await cache.setJobStatus(jobId, 'failed', 0);
      const status = await cache.getJobStatus(jobId);

      expect(status?.status).toBe('failed');
      expect(status?.progress).toBe(0);
    });
  });

  describe('Distributed Locks', () => {
    it('should acquire and release locks', async () => {
      if (!redisAvailable) return;

      const resource = `test_resource_${Date.now()}`;

      // Acquire lock
      const acquired1 = await cache.acquireLock(resource, 30);
      expect(acquired1).toBe(true);

      // Try to acquire again (should fail - already locked)
      const acquired2 = await cache.acquireLock(resource, 30);
      expect(acquired2).toBe(false);

      // Release lock
      const released = await cache.releaseLock(resource);
      expect(released).toBe(true);

      // Now can acquire again
      const acquired3 = await cache.acquireLock(resource, 30);
      expect(acquired3).toBe(true);

      // Clean up
      await cache.releaseLock(resource);
    });

    it('should handle lock timeout', async () => {
      if (!redisAvailable) return;

      const resource = `test_resource_timeout_${Date.now()}`;

      // Acquire lock with short timeout (1 second)
      const acquired1 = await cache.acquireLock(resource, 1);
      expect(acquired1).toBe(true);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Lock should have expired, can acquire again
      const acquired2 = await cache.acquireLock(resource, 30);
      expect(acquired2).toBe(true);

      // Clean up
      await cache.releaseLock(resource);
    }, 10000); // Increase timeout for this test
  });

  describe('Session Features', () => {
    it('should set and get session features', async () => {
      if (!redisAvailable) return;

      const sessionId = `test_session_${Date.now()}`;
      const features = {
        theme: 'dark',
        selected_features: ['bank_statement', 'cdr'],
        last_used_model: 'gpt-4',
      };

      await cache.setSessionFeatures(sessionId, features);
      const retrieved = await cache.getSessionFeatures(sessionId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.theme).toBe('dark');
      expect(retrieved?.selected_features).toEqual(['bank_statement', 'cdr']);
    });
  });

  describe('Integration: Complete Chat Flow', () => {
    it('should handle complete chat flow with caching', async () => {
      if (!redisAvailable) return;

      const chatId = `integration_test_${Date.now()}`;
      const modelVersion = 'gpt-4';
      const userMessage = 'What is my account balance?';

      // 1. User sends message
      await cache.addChatMessage(chatId, 'user', userMessage);

      // 2. Check LLM cache
      let cachedReply = await cache.getLLMCache(modelVersion, userMessage);

      let assistantReply: string;
      if (cachedReply) {
        assistantReply = cachedReply.reply;
      } else {
        // 3. Call LLM (simulated)
        assistantReply = 'Your account balance is $1,234.56.';

        // 4. Cache LLM response
        await cache.setLLMCache(modelVersion, userMessage, assistantReply, ['doc_123']);
      }

      // 5. Add assistant response to context
      await cache.addChatMessage(chatId, 'assistant', assistantReply);

      // 6. Get full context
      const messages = await cache.getChatContext(chatId);
      expect(messages.length).toBe(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');

      // 7. Second identical message should hit cache
      const cachedReply2 = await cache.getLLMCache(modelVersion, userMessage);
      expect(cachedReply2).not.toBeNull();
      expect(cachedReply2?.reply).toBe(assistantReply);
    });
  });
});

