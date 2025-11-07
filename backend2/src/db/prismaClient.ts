import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/nextjs-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Initialize pgvector extension and create index on first connection
// Note: This should ideally be done via migrations, but we include it here as a safety check
prisma.$executeRawUnsafe(`
  CREATE EXTENSION IF NOT EXISTS vector;
`).catch((err) => {
  // Extension might already exist, which is fine
  if (!err.message.includes('already exists')) {
    logger.warn({ err }, 'Could not create pgvector extension (may already exist)');
  }
});

export default prisma;

