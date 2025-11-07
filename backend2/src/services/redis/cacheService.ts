/**
 * Cache service for Node.js backend (backend2)
 * Provides high-level caching operations for chat, LLM, embeddings, and jobs
 */

import { RedisClientType } from 'redis';
import { getRedisClient } from './redisClient';
import { logger } from '../utils/logger';
import { maskParsedData } from '../utils/masks';

// TTLs from environment (in seconds)
const TTL_CHAT_CONTEXT = parseInt(process.env.REDIS_TTL_CHAT_CONTEXT || '86400', 10); // 24 hours
const TTL_LLM_CACHE = parseInt(process.env.REDIS_TTL_LLM_CACHE || '604800', 10); // 7 days
const TTL_EMBED_CACHE = parseInt(process.env.REDIS_TTL_EMBED_CACHE || '2592000', 10); // 30 days
const TTL_JOB_STATUS = parseInt(process.env.REDIS_TTL_JOB_STATUS || '172800', 10); // 48 hours
const TTL_SESSION = parseInt(process.env.REDIS_TTL_SESSION || '86400', 10); // 24 hours

// Key prefixes
const PREFIX_CHAT = process.env.REDIS_KEY_PREFIX_CHAT || 'chat:';
const PREFIX_LLM = process.env.REDIS_KEY_PREFIX_LLM || 'llm:cache:';
const PREFIX_EMBED = process.env.REDIS_KEY_PREFIX_EMBED || 'embed:cache:';
const PREFIX_JOB = process.env.REDIS_KEY_PREFIX_JOB || 'job:';
const PREFIX_LOCK = process.env.REDIS_KEY_PREFIX_LOCK || 'locks:';
const PREFIX_FEATURE = process.env.REDIS_KEY_PREFIX_FEATURE || 'feature:session:';

// Chat context window size
const CHAT_CONTEXT_SIZE = parseInt(process.env.REDIS_CHAT_CONTEXT_SIZE || '20', 10);

interface ChatMessage {
  role: string;
  text: string;
  timestamp: string;
}

interface LLMCacheValue {
  reply: string;
  used_docs: string[];
  created_at: string;
}

interface EmbeddingCacheValue {
  embedding: number[];
  text_hash: string;
  created_at: string;
}

interface JobStatus {
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  result_ptr?: string;
  updated_at: string;
}

/**
 * High-level cache service
 */
export class CacheService {
  private async getClient(): Promise<RedisClientType | null> {
    return await getRedisClient();
  }

  // Chat Context Operations
  async addChatMessage(chatId: string, role: string, text: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const key = `${PREFIX_CHAT}${chatId}:context`;
      const message: ChatMessage = {
        role,
        text,
        timestamp: new Date().toISOString(),
      };

      // Push to left (newest first) and trim to keep last N messages
      await client.lPush(key, JSON.stringify(message));
      await client.lTrim(key, 0, CHAT_CONTEXT_SIZE - 1);
      await client.expire(key, TTL_CHAT_CONTEXT);

      return true;
    } catch (error: any) {
      logger.error({ error, chatId }, 'Failed to add chat message to cache');
      return false;
    }
  }

  async getChatContext(chatId: string, limit?: number): Promise<ChatMessage[]> {
    const client = await this.getClient();
    if (!client) return [];

    try {
      const key = `${PREFIX_CHAT}${chatId}:context`;
      const limitCount = limit || CHAT_CONTEXT_SIZE;

      // Get all messages (or last N)
      const messagesJson = await client.lRange(key, 0, limitCount - 1);
      const messages: ChatMessage[] = [];

      // Reverse to get chronological order (oldest first)
      for (let i = messagesJson.length - 1; i >= 0; i--) {
        try {
          messages.push(JSON.parse(messagesJson[i]));
        } catch (e) {
          logger.warn({ error: e }, 'Failed to parse chat message from cache');
        }
      }

      return messages;
    } catch (error: any) {
      logger.error({ error, chatId }, 'Failed to get chat context from cache');
      return [];
    }
  }

  async setChatMeta(chatId: string, meta: Record<string, any>): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const key = `${PREFIX_CHAT}${chatId}:meta`;
      await client.setEx(key, TTL_CHAT_CONTEXT, JSON.stringify(meta));
      return true;
    } catch (error: any) {
      logger.error({ error, chatId }, 'Failed to set chat meta in cache');
      return false;
    }
  }

  async getChatMeta(chatId: string): Promise<Record<string, any> | null> {
    const client = await this.getClient();
    if (!client) return null;

    try {
      const key = `${PREFIX_CHAT}${chatId}:meta`;
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value);
    } catch (error: any) {
      logger.error({ error, chatId }, 'Failed to get chat meta from cache');
      return null;
    }
  }

  // LLM Cache Operations
  async getLLMCache(modelVersion: string, prompt: string): Promise<LLMCacheValue | null> {
    const client = await this.getClient();
    if (!client) return null;

    try {
      const crypto = await import('crypto');
      const promptHash = crypto.createHash('sha256').update(`${modelVersion}:${prompt}`).digest('hex').slice(0, 16);
      const key = `${PREFIX_LLM}${modelVersion}:${promptHash}`;

      const value = await client.get(key);
      if (!value) return null;

      return JSON.parse(value) as LLMCacheValue;
    } catch (error: any) {
      logger.error({ error }, 'Failed to get LLM cache');
      return null;
    }
  }

  async setLLMCache(
    modelVersion: string,
    prompt: string,
    reply: string,
    usedDocs?: string[]
  ): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const crypto = await import('crypto');
      const promptHash = crypto.createHash('sha256').update(`${modelVersion}:${prompt}`).digest('hex').slice(0, 16);
      const key = `${PREFIX_LLM}${modelVersion}:${promptHash}`;

      const cacheValue: LLMCacheValue = {
        reply,
        used_docs: usedDocs || [],
        created_at: new Date().toISOString(),
      };

      await client.setEx(key, TTL_LLM_CACHE, JSON.stringify(cacheValue));
      return true;
    } catch (error: any) {
      logger.error({ error }, 'Failed to set LLM cache');
      return false;
    }
  }

  // Embedding Cache Operations
  async getEmbeddingCache(text: string): Promise<number[] | null> {
    const client = await this.getClient();
    if (!client) return null;

    try {
      const crypto = await import('crypto');
      const textHash = crypto.createHash('sha256').update(text).digest('hex');
      const key = `${PREFIX_EMBED}${textHash}`;

      const value = await client.get(key);
      if (!value) return null;

      const cached: EmbeddingCacheValue = JSON.parse(value);
      return cached.embedding;
    } catch (error: any) {
      logger.error({ error }, 'Failed to get embedding cache');
      return null;
    }
  }

  async setEmbeddingCache(text: string, embedding: number[]): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const crypto = await import('crypto');
      const textHash = crypto.createHash('sha256').update(text).digest('hex');
      const key = `${PREFIX_EMBED}${textHash}`;

      const cacheValue: EmbeddingCacheValue = {
        embedding,
        text_hash: textHash,
        created_at: new Date().toISOString(),
      };

      await client.setEx(key, TTL_EMBED_CACHE, JSON.stringify(cacheValue));
      return true;
    } catch (error: any) {
      logger.error({ error }, 'Failed to set embedding cache');
      return false;
    }
  }

  // Job Status Operations
  async setJobStatus(
    jobId: string,
    status: 'queued' | 'processing' | 'done' | 'failed',
    progress: number = 0,
    resultPtr?: string
  ): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const key = `${PREFIX_JOB}${jobId}`;

      const jobData: JobStatus = {
        status,
        progress,
        result_ptr: resultPtr,
        updated_at: new Date().toISOString(),
      };

      await client.setEx(key, TTL_JOB_STATUS, JSON.stringify(jobData));
      return true;
    } catch (error: any) {
      logger.error({ error, jobId }, 'Failed to set job status in cache');
      return false;
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const client = await this.getClient();
    if (!client) return null;

    try {
      const key = `${PREFIX_JOB}${jobId}`;
      const value = await client.get(key);
      if (!value) return null;

      return JSON.parse(value) as JobStatus;
    } catch (error: any) {
      logger.error({ error, jobId }, 'Failed to get job status from cache');
      return null;
    }
  }

  async deleteJobStatus(jobId: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const key = `${PREFIX_JOB}${jobId}`;
      await client.del(key);
      return true;
    } catch (error: any) {
      logger.error({ error, jobId }, 'Failed to delete job status from cache');
      return false;
    }
  }

  // Lock Operations
  async acquireLock(resource: string, timeout: number = 30): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const key = `${PREFIX_LOCK}${resource}`;
      // SET key value NX PX timeout_ms
      const result = await client.set(key, 'locked', {
        NX: true,
        PX: timeout * 1000,
      });
      return result === 'OK';
    } catch (error: any) {
      logger.error({ error, resource }, 'Failed to acquire lock');
      return false;
    }
  }

  async releaseLock(resource: string): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const key = `${PREFIX_LOCK}${resource}`;
      await client.del(key);
      return true;
    } catch (error: any) {
      logger.error({ error, resource }, 'Failed to release lock');
      return false;
    }
  }

  // Feature Flags / Session Preferences
  async setSessionFeatures(sessionId: string, features: Record<string, any>): Promise<boolean> {
    const client = await this.getClient();
    if (!client) return false;

    try {
      const key = `${PREFIX_FEATURE}${sessionId}`;
      // Mask PII before storing
      const maskedFeatures = maskParsedData(features);
      await client.setEx(key, TTL_SESSION, JSON.stringify(maskedFeatures));
      return true;
    } catch (error: any) {
      logger.error({ error, sessionId }, 'Failed to set session features in cache');
      return false;
    }
  }

  async getSessionFeatures(sessionId: string): Promise<Record<string, any> | null> {
    const client = await this.getClient();
    if (!client) return null;

    try {
      const key = `${PREFIX_FEATURE}${sessionId}`;
      const value = await client.get(key);
      if (!value) return null;

      return JSON.parse(value);
    } catch (error: any) {
      logger.error({ error, sessionId }, 'Failed to get session features from cache');
      return null;
    }
  }
}

// Global cache service instance
let cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
}

