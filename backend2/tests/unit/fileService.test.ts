/**
 * Unit tests for fileService
 */

import { saveUploadedFile, getOCRResultPath } from '../../src/services/fileService';
import { promises as fs } from 'fs';
import path from 'path';

describe('fileService', () => {
  const testBuffer = Buffer.from('test file content');

  afterEach(async () => {
    // Cleanup test files
    try {
      const uploadDir = process.env.UPLOAD_DIR || './data/uploads';
      const files = await fs.readdir(uploadDir);
      for (const file of files) {
        if (file.startsWith('doc_')) {
          await fs.unlink(path.join(uploadDir, file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('saveUploadedFile', () => {
    it('should save file and return document ID', async () => {
      const { filePath, documentId } = await saveUploadedFile(testBuffer, 'test.pdf');

      expect(documentId).toMatch(/^doc_[a-f0-9]+$/);
      expect(filePath).toContain(documentId);

      // Verify file exists
      const fileContent = await fs.readFile(filePath);
      expect(fileContent).toEqual(testBuffer);
    });

    it('should preserve file extension', async () => {
      const { filePath } = await saveUploadedFile(testBuffer, 'test.png');
      expect(filePath).toMatch(/\.png$/);
    });
  });

  describe('getOCRResultPath', () => {
    it('should return correct OCR result path', () => {
      const documentId = 'doc_12345';
      const resultPath = getOCRResultPath(documentId);
      expect(resultPath).toContain(documentId);
      expect(resultPath).toMatch(/\.json$/);
    });
  });
});

