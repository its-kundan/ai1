/**
 * File service for handling file uploads and storage
 */

import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './data/uploads';
const OCR_RESULTS_DIR = process.env.OCR_RESULTS_DIR || './data/ocr_results';

/**
 * Ensure data directories exist
 */
export async function ensureDirectories(): Promise<void> {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(OCR_RESULTS_DIR, { recursive: true });
  } catch (error) {
    logger.error({ error }, 'Failed to create data directories');
    throw error;
  }
}

/**
 * Save uploaded file and return file path and document ID
 */
export async function saveUploadedFile(
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{ filePath: string; documentId: string }> {
  await ensureDirectories();
  
  // Generate document ID: doc_<uuid>
  const documentId = `doc_${randomUUID().replace(/-/g, '')}`;
  
  // Preserve original extension
  const ext = path.extname(originalFilename);
  const filename = `${documentId}${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  
  await fs.writeFile(filePath, fileBuffer);
  
  logger.info({ documentId, filename }, 'File saved');
  
  return { filePath, documentId };
}

/**
 * Get OCR result file path
 */
export function getOCRResultPath(documentId: string): string {
  return path.join(OCR_RESULTS_DIR, `${documentId}.json`);
}

/**
 * Read OCR result from file
 */
export async function readOCRResult(documentId: string): Promise<any> {
  const filePath = getOCRResultPath(documentId);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to read OCR result');
    throw error;
  }
}

/**
 * Save OCR result to file
 */
export async function saveOCRResult(documentId: string, data: any): Promise<void> {
  await ensureDirectories();
  const filePath = getOCRResultPath(documentId);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  logger.info({ documentId }, 'OCR result saved');
}

