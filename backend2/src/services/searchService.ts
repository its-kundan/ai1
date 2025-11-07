/**
 * Search Service
 * 
 * Provides semantic search using pgvector and keyword search on structured JSON.
 */

import { prisma } from '../db/prismaClient';
import { logger } from '../utils/logger';
import { embedSingle } from './embeddingService';

export interface SearchResult {
  doc_id: string;
  snippet: string;
  score: number;
  bounding_box?: any;
  metadata?: any;
}

/**
 * Perform semantic search using pgvector
 * 
 * SQL Example:
 * SELECT 
 *   e.id,
 *   e.doc_id,
 *   e.snippet,
 *   e.meta,
 *   (e.vector <-> $1::vector) AS distance
 * FROM embeddings e
 * ORDER BY distance
 * LIMIT $2;
 * 
 * Note: <-> is the L2 distance operator. Use <#> for cosine distance if needed.
 */
export async function semanticSearch(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  try {
    // Generate query embedding
    const queryEmbedding = await embedSingle(query);
    
    if (!queryEmbedding || queryEmbedding.length === 0) {
      logger.warn('Failed to generate query embedding');
      return [];
    }

    // Convert to PostgreSQL vector format: [0.1, 0.2, ...]
    const vectorStr = '[' + queryEmbedding.join(',') + ']';

    // Perform nearest neighbor search using raw SQL
    // Note: Prisma doesn't natively support vector operations, so we use raw SQL
    const results = await prisma.$queryRawUnsafe<Array<{
      id: number;
      doc_id: string;
      snippet: string;
      meta: any;
      distance: number;
    }>>(`
      SELECT 
        e.id,
        e."doc_id",
        e.snippet,
        e.meta,
        (e.vector <-> $1::vector) AS distance
      FROM embeddings e
      WHERE e.vector IS NOT NULL
      ORDER BY distance
      LIMIT $2
    `, vectorStr, topK);

    // Convert distance to similarity score (0-1, where 1 is most similar)
    // L2 distance: smaller = more similar
    // We'll normalize: score = 1 / (1 + distance)
    return results.map((r) => ({
      doc_id: r.doc_id,
      snippet: r.snippet,
      score: 1 / (1 + r.distance), // Normalize distance to 0-1 score
      metadata: r.meta,
    }));
  } catch (error) {
    logger.error({ error, query }, 'Semantic search failed');
    throw error;
  }
}

/**
 * Perform keyword search on structured JSON in ocr_results
 * 
 * Searches for query terms in:
 * - account_number
 * - transaction descriptions
 * - Other relevant fields
 */
export async function keywordSearch(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  try {
    const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    
    if (queryTerms.length === 0) {
      return [];
    }

    // Build JSONB search query
    // PostgreSQL JSONB operators: @>, ?, ?&, ?|
    const conditions = queryTerms.map((term, idx) => 
      `(ocr.structured_json::text ILIKE $${idx + 1})`
    ).join(' OR ');

    const results = await prisma.$queryRawUnsafe<Array<{
      doc_id: string;
      snippet: string;
      score: number;
    }>>(`
      SELECT 
        ocr."document_id" AS doc_id,
        SUBSTRING(ocr.raw_text, 1, 200) AS snippet,
        (
          SELECT COUNT(*) 
          FROM unnest(string_to_array(ocr.raw_text, ' ')) AS word
          WHERE word ILIKE ANY(ARRAY[${queryTerms.map((_, i) => `$${i + 1}`).join(', ')}])
        )::float / NULLIF(array_length(string_to_array(ocr.raw_text, ' '), 1), 0) AS score
      FROM ocr_results ocr
      WHERE ${conditions}
      ORDER BY score DESC
      LIMIT $${queryTerms.length + 1}
    `, ...queryTerms.map(t => `%${t}%`), topK);

    return results.map((r) => ({
      doc_id: r.doc_id,
      snippet: r.snippet,
      score: Math.min(r.score || 0, 1), // Cap at 1.0
    }));
  } catch (error) {
    logger.error({ error, query }, 'Keyword search failed');
    // Return empty results on error rather than failing
    return [];
  }
}

/**
 * Combined search: semantic + keyword
 * Merges results and deduplicates by doc_id
 */
export async function search(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  try {
    // Run both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      semanticSearch(query, topK).catch((err) => {
        logger.warn({ err }, 'Semantic search failed, using keyword only');
        return [];
      }),
      keywordSearch(query, topK).catch((err) => {
        logger.warn({ err }, 'Keyword search failed, using semantic only');
        return [];
      }),
    ]);

    // Merge and deduplicate by doc_id
    const resultMap = new Map<string, SearchResult>();

    // Add semantic results (higher priority)
    semanticResults.forEach((r) => {
      resultMap.set(r.doc_id, r);
    });

    // Add keyword results, merge if doc_id already exists
    keywordResults.forEach((r) => {
      const existing = resultMap.get(r.doc_id);
      if (existing) {
        // Combine scores (weighted average: 70% semantic, 30% keyword)
        existing.score = existing.score * 0.7 + r.score * 0.3;
        // Prefer longer snippet
        if (r.snippet.length > existing.snippet.length) {
          existing.snippet = r.snippet;
        }
      } else {
        resultMap.set(r.doc_id, r);
      }
    });

    // Sort by score and limit
    const results = Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    logger.info({ query, resultCount: results.length }, 'Search completed');

    return results;
  } catch (error) {
    logger.error({ error, query }, 'Search failed');
    throw error;
  }
}

