/**
 * Embedding Service Adapter
 * 
 * Provides two modes:
 * 1. external_http (preferred): Calls Python embedding service at http://localhost:8100/api/v1/embed
 * 2. local_node (optional): Uses @xenova/transformers or transformers.js for in-process embeddings
 * 
 * The external HTTP mode is preferred to reuse existing Python embedding code.
 */

import { logger } from '../utils/logger';

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || process.env.EMBED_HOST || 'http://localhost:8100/embed';
const EMBEDDING_DIMENSION = 1536; // Adjust based on your model (e.g., OpenAI text-embedding-ada-002 uses 1536)

export type EmbeddingMode = 'external_http' | 'local_node';

/**
 * Call Python embedding service via HTTP
 * 
 * Expected request format:
 * POST http://localhost:8100/api/v1/embed
 * {
 *   "texts": ["text snippet 1", "text snippet 2", ...]
 * }
 * 
 * Expected response format:
 * {
 *   "embeddings": [
 *     [0.123, -0.456, ...], // float array of dimension 1536
 *     [0.789, -0.012, ...]
 *   ],
 *   "dimension": 1536
 * }
 */
async function callPythonEmbeddingService(texts: string[]): Promise<number[][]> {
  try {
    const response = await fetch(EMBEDDING_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding service error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (!Array.isArray(result.embeddings)) {
      throw new Error('Invalid embedding service response: embeddings must be an array');
    }

    return result.embeddings;
  } catch (error) {
    logger.error({ error }, 'Python embedding service call failed');
    throw error;
  }
}

/**
 * Local embedding using Node.js transformers (optional)
 * 
 * NOTE: This is a stub. To enable:
 * 1. Install: npm install @xenova/transformers
 * 2. Import: import { pipeline } from '@xenova/transformers';
 * 3. Implement embedding logic here
 * 
 * Example:
 * const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
 * const output = await extractor(text, { pooling: 'mean', normalize: true });
 * return Array.from(output.data);
 * 
 * Pros:
 * - No external service dependency
 * - Faster for small batches
 * 
 * Cons:
 * - Larger bundle size
 * - Model download required
 * - May be slower for large batches
 */
async function localEmbedding(texts: string[]): Promise<number[][]> {
  // TODO: Implement local embedding using @xenova/transformers
  // Example:
  // const { pipeline } = await import('@xenova/transformers');
  // const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  // const embeddings = await Promise.all(
  //   texts.map(async (text) => {
  //     const output = await extractor(text, { pooling: 'mean', normalize: true });
  //     return Array.from(output.data);
  //   })
  // );
  // return embeddings;
  
  throw new Error(
    'Local embedding not implemented. Please use Python embedding service or implement @xenova/transformers integration.'
  );
}

/**
 * Generate embeddings for text snippets
 */
export async function embed(
  texts: string[],
  mode: EmbeddingMode = 'external_http'
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  logger.info({ count: texts.length, mode }, 'Generating embeddings');

  if (mode === 'external_http') {
    return await callPythonEmbeddingService(texts);
  } else {
    return await localEmbedding(texts);
  }
}

/**
 * Generate embedding for a single text
 */
export async function embedSingle(
  text: string,
  mode: EmbeddingMode = 'external_http'
): Promise<number[]> {
  const embeddings = await embed([text], mode);
  return embeddings[0] || [];
}

/**
 * Check if Python embedding service is available
 */
export async function checkEmbeddingServiceHealth(): Promise<boolean> {
  try {
    const healthUrl = EMBEDDING_SERVICE_URL.replace('/embed', '/health');
    const response = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

