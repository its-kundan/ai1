/**
 * Cache route handler
 * POST /api/v1/cache/clear
 */

import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prismaClient';
import { logger } from '../../utils/logger';
import { CacheClearResponseSchema } from '../../schemas/apiSchemas';

const cacheRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/cache/clear', async (request, reply) => {
    try {
      // Rebuild embeddings from ocr_results
      // This is useful for development/testing
      logger.info('Clearing cache and rebuilding embeddings');

      // Option 1: Clear all embeddings (simple)
      await prisma.$executeRawUnsafe('TRUNCATE TABLE embeddings');

      // Option 2: Rebuild from ocr_results (commented out - requires embedding service)
      // const ocrResults = await prisma.oCRResult.findMany();
      // for (const ocr of ocrResults) {
      //   // Re-embed and store
      //   // This would require calling embeddingService.embed() for each document
      // }

      const response: typeof CacheClearResponseSchema._type = {
        status: 'cache_cleared',
        message: 'Embeddings table cleared. Run OCR again to rebuild index.',
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      logger.error({ error }, 'Cache clear failed');
      return reply.status(500).send({
        error: `Cache clear failed: ${error.message}`,
        code: 500,
      });
    }
  });
};

export default cacheRoutes;

