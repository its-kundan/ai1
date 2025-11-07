/**
 * OCR Service Adapter
 * 
 * This service provides two modes:
 * 1. external_http (preferred): Calls Python OCR microservice at http://localhost:8100/api/v1/ocr
 * 2. local_node (optional): Uses Tesseract.js for in-process OCR
 * 
 * For table extraction, prefer the Python service as it can use Camelot (Python-only).
 */

import { logger } from '../utils/logger';
import { readFile } from 'fs/promises';
import path from 'path';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:8100/api/v1/ocr';

export interface OCRBlock {
  text: string;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  confidence?: number;
  page?: number;
}

export interface TableRow {
  row_index: number;
  cells: string[];
  page?: number;
}

export interface OCRResult {
  document_id: string;
  raw_text: string;
  blocks: OCRBlock[];
  tables: TableRow[];
  parsed_data?: any;
  processing_time?: number;
}

/**
 * Call Python OCR microservice via HTTP
 * 
 * Expected request format:
 * POST http://localhost:8100/api/v1/ocr
 * {
 *   "document_id": "doc_12345",
 *   "parse_tables": true
 * }
 * 
 * Expected response format:
 * {
 *   "document_id": "doc_12345",
 *   "raw_text": "...",
 *   "blocks": [...],
 *   "tables": [...],
 *   "parsed_data": {...},
 *   "processing_time": 2.5
 * }
 */
async function callPythonOCRService(
  documentId: string,
  filePath: string,
  parseTables: boolean = true
): Promise<OCRResult> {
  try {
    // Read file as base64 or send file path
    // Option 1: Send file path (if Python service can access filesystem)
    // Option 2: Send file as multipart/form-data
    
    const response = await fetch(OCR_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_id: documentId,
        file_path: filePath, // Python service should read from this path
        parse_tables: parseTables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OCR service error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    return {
      document_id: result.document_id || documentId,
      raw_text: result.raw_text || '',
      blocks: result.blocks || [],
      tables: result.tables || [],
      parsed_data: result.parsed_data,
      processing_time: result.processing_time,
    };
  } catch (error) {
    logger.error({ error, documentId }, 'Python OCR service call failed');
    throw error;
  }
}

/**
 * Local OCR using Tesseract.js (optional fallback)
 * 
 * NOTE: This is a stub. To enable:
 * 1. Install: npm install tesseract.js
 * 2. Import: import { createWorker } from 'tesseract.js';
 * 3. Implement OCR logic here
 * 
 * Limitations:
 * - Tesseract.js doesn't extract tables well
 * - For PDFs, you'd need pdf-parse or pdfjs-dist to extract pages first
 * - Table extraction requires Camelot (Python-only) or similar
 */
async function localOCR(
  filePath: string,
  parseTables: boolean = false
): Promise<OCRResult> {
  // TODO: Implement Tesseract.js OCR
  // Example:
  // const worker = await createWorker('eng');
  // const { data: { text } } = await worker.recognize(filePath);
  // await worker.terminate();
  
  throw new Error(
    'Local OCR not implemented. Please use Python OCR service or implement Tesseract.js integration.'
  );
}

/**
 * Process document with OCR
 * 
 * Mode is determined by environment variable or defaults to external_http
 */
export async function processDocument(
  documentId: string,
  filePath: string,
  parseTables: boolean = true,
  mode: 'external_http' | 'local_node' = 'external_http'
): Promise<OCRResult> {
  logger.info({ documentId, mode, parseTables }, 'Processing OCR');

  if (mode === 'external_http') {
    return await callPythonOCRService(documentId, filePath, parseTables);
  } else {
    return await localOCR(filePath, parseTables);
  }
}

/**
 * Check if Python OCR service is available
 */
export async function checkOCRServiceHealth(): Promise<boolean> {
  try {
    // Try to ping the health endpoint or make a simple request
    const healthUrl = OCR_SERVICE_URL.replace('/ocr', '/health');
    const response = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

