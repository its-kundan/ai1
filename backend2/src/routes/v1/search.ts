/**
 * Search route handler
 * POST /api/v1/search
 */

import { FastifyPluginAsync } from 'fastify';
import { search } from '../../services/searchService';
import { maskSensitiveNumbers } from '../../utils/masks';
import { logger } from '../../utils/logger';
import { SearchRequestSchema, SearchResponseSchema } from '../../schemas/apiSchemas';
import { z } from 'zod';

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: z.infer<typeof SearchRequestSchema>;
  }>('/search', async (request, reply) => {
    try {
      const { query, top_k } = request.body;

      // Perform search
      const results = await search(query, top_k);

      // Mask sensitive numbers in snippets
      const maskedResults = results.map((r) => ({
        ...r,
        snippet: maskSensitiveNumbers(r.snippet),
      }));

      const response: typeof SearchResponseSchema._type = {
        query,
        results: maskedResults,
        total_found: maskedResults.length,
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      logger.error({ error }, 'Search failed');
      return reply.status(500).send({
        error: `Search failed: ${error.message}`,
        code: 500,
      });
    }
  });
};

export default searchRoutes;

