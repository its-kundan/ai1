/**
 * Unit tests for embedding service
 */

import { embed, embedSingle, checkEmbeddingServiceHealth } from '../../src/services/embeddingService';

// Mock fetch globally
global.fetch = jest.fn();

describe('embeddingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('embed', () => {
    it('should call Python embedding service and return embeddings', async () => {
      const mockEmbeddings = [
        [0.1, 0.2, 0.3, 0.4],
        [0.5, 0.6, 0.7, 0.8],
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          embeddings: mockEmbeddings,
          dimension: 4,
        }),
      } as Response);

      const result = await embed(['text1', 'text2'], 'external_http');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockEmbeddings[0]);
      expect(result[1]).toEqual(mockEmbeddings[1]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/embed'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: ['text1', 'text2'] }),
        })
      );
    });

    it('should return empty array for empty input', async () => {
      const result = await embed([], 'external_http');
      expect(result).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw error when service fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Service unavailable',
      } as Response);

      await expect(embed(['text'], 'external_http')).rejects.toThrow('Embedding service error');
    });
  });

  describe('embedSingle', () => {
    it('should return single embedding for one text', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          embeddings: [mockEmbedding],
          dimension: 3,
        }),
      } as Response);

      const result = await embedSingle('text', 'external_http');
      expect(result).toEqual(mockEmbedding);
    });
  });

  describe('checkEmbeddingServiceHealth', () => {
    it('should return true when service is healthy', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      } as Response);

      const isHealthy = await checkEmbeddingServiceHealth();
      expect(isHealthy).toBe(true);
    });

    it('should return false when service is unavailable', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const isHealthy = await checkEmbeddingServiceHealth();
      expect(isHealthy).toBe(false);
    });
  });
});

