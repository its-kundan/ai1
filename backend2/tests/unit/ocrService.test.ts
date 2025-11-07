/**
 * Unit tests for OCR service
 */

import { processDocument, checkOCRServiceHealth } from '../../src/services/ocrService';

// Mock fetch globally
global.fetch = jest.fn();

describe('ocrService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processDocument', () => {
    it('should call Python OCR service when mode is external_http', async () => {
      const mockOCRResponse = {
        document_id: 'doc_test123',
        raw_text: 'Sample OCR text',
        blocks: [
          {
            text: 'Sample text',
            bbox: { x1: 0, y1: 0, x2: 100, y2: 20 },
            confidence: 0.95,
            page: 1,
          },
        ],
        tables: [],
        parsed_data: {},
        processing_time: 1.5,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockOCRResponse,
      } as Response);

      const result = await processDocument(
        'doc_test123',
        './data/uploads/doc_test123.pdf',
        true,
        'external_http'
      );

      expect(result.document_id).toBe('doc_test123');
      expect(result.raw_text).toBe('Sample OCR text');
      expect(result.blocks).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/ocr'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should throw error when OCR service fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      } as Response);

      await expect(
        processDocument('doc_test123', './data/uploads/doc_test123.pdf', true, 'external_http')
      ).rejects.toThrow('OCR service error');
    });

    it('should throw error for local_node mode (not implemented)', async () => {
      await expect(
        processDocument('doc_test123', './data/uploads/doc_test123.pdf', true, 'local_node')
      ).rejects.toThrow('Local OCR not implemented');
    });
  });

  describe('checkOCRServiceHealth', () => {
    it('should return true when service is healthy', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      } as Response);

      const isHealthy = await checkOCRServiceHealth();
      expect(isHealthy).toBe(true));
    });

    it('should return false when service is unavailable', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const isHealthy = await checkOCRServiceHealth();
      expect(isHealthy).toBe(false);
    });
  });
});

