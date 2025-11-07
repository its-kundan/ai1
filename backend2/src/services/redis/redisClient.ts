/**
 * Redis client wrapper for Node.js backend (backend2)
 * Handles connection, reconnection, and basic operations
 */

import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import { logger } from '../utils/logger';

// Redis connection settings from environment
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);
const REDIS_CONNECTION_TIMEOUT = parseInt(process.env.REDIS_CONNECTION_TIMEOUT || '5000', 10);
const REDIS_COMMAND_TIMEOUT = parseInt(process.env.REDIS_COMMAND_TIMEOUT || '3000', 10);

let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client instance
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  try {
    const options: RedisClientOptions = {
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        connectTimeout: REDIS_CONNECTION_TIMEOUT,
        commandTimeout: REDIS_COMMAND_TIMEOUT,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            logger.warn('Redis reconnection failed after 3 retries');
            return false; // Stop reconnecting
          }
          return Math.min(retries * 100, 3000); // Exponential backoff
        },
      },
      database: REDIS_DB,
    };

    if (REDIS_PASSWORD) {
      options.password = REDIS_PASSWORD;
    }

    redisClient = createClient(options) as RedisClientType;

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis client error');
    });

    redisClient.on('connect', () => {
      logger.info(`Connecting to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error: any) {
    logger.warn({ error }, 'Redis connection failed. Cache operations will be disabled.');
    redisClient = null;
    return null;
  }
}

/**
 * Check if Redis is connected
 */
export async function isRedisConnected(): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
}

