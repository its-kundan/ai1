/**
 * OCR route handler
 * POST /api/v1/ocr
 */

import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prismaClient';
import { processDocument } from '../../services/ocrService';
import { parse } from '../../services/parserService';
import { embed } from '../../services/embeddingService';
import { saveOCRResult, getOCRResultPath } from '../../services/fileService';
import { maskParsedData } from '../../utils/masks';
import { logger } from '../../utils/logger';
import { OCRRequestSchema, OCRResponseSchema } from '../../schemas/apiSchemas';
import { z } from 'zod';

const ocrRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: z.infer<typeof OCRRequestSchema> | { document_id?: string; parse_tables?: boolean };
  }>('/ocr', async (request, reply) => {
    let documentId: string | null = null;

    try {
      // Handle multipart form data (file upload fallback)
      const data = await request.file();
      let docId: string | undefined;
      let parseTables = true;

      if (data) {
        // File upload path - save file first
        const buffer = await data.toBuffer();
        const { saveUploadedFile } = await import('../../services/fileService');
        const { validateFileType, validateFileSize } = await import('../../utils/validators');
        
        if (!validateFileType(data.filename) || !validateFileSize(buffer.length)) {
          return reply.status(400).send({ error: 'Invalid file', code: 400 });
        }

        const { filePath, documentId: newDocId } = await saveUploadedFile(buffer, data.filename);
        docId = newDocId;

        // Create document record
        await prisma.document.create({
          data: {
            documentId: newDocId,
            filename: data.filename,
            docType: 'general',
            filepath: filePath,
            status: 'uploaded',
            meta: {},
          },
        });
      } else {
        // JSON body path
        const body = request.body as any;
        docId = body.document_id;
        parseTables = body.parse_tables !== false;
      }

      if (!docId) {
        return reply.status(400).send({
          error: 'Either document_id or file required',
          code: 400,
        });
      }

      documentId = docId;

      // Get document from DB
      const document = await prisma.document.findUnique({
        where: { documentId: docId },
      });

      if (!document) {
        return reply.status(404).send({
          error: 'Document not found',
          code: 404,
        });
      }

      // Update status to processing
      await prisma.document.update({
        where: { documentId: docId },
        data: { status: 'processing' },
      });

      // Run OCR
      logger.info({ documentId: docId }, 'Processing OCR');
      const ocrResult = await processDocument(
        docId,
        document.filepath,
        parseTables,
        'external_http' // Use Python OCR service
      );

      // Parse based on document type
      const parsedData = parse(document.docType, ocrResult.raw_text, ocrResult.tables);

      // Mask sensitive data
      const maskedParsedData = maskParsedData(parsedData as Record<string, any>);

      // Save OCR result
      const ocrResultData = {
        ...ocrResult,
        parsed_data: maskedParsedData,
      };
      await saveOCRResult(docId, ocrResultData);

      // Save to database
      await prisma.oCRResult.create({
        data: {
          documentId: docId,
          rawText: ocrResult.raw_text,
          structuredJson: maskedParsedData as any,
        },
      });

      // Generate embeddings and store in database
      const textChunks: string[] = [];
      const metadataList: any[] = [];

      // Add OCR blocks as chunks
      ocrResult.blocks.slice(0, 50).forEach((block) => {
        textChunks.push(block.text);
        metadataList.push({
          bbox: block.bbox,
          page: block.page,
          confidence: block.confidence,
        });
      });

      // Add table rows as chunks
      ocrResult.tables.slice(0, 20).forEach((table) => {
        const rowText = table.cells.join(' | ');
        textChunks.push(rowText);
        metadataList.push({
          type: 'table',
          row_index: table.row_index,
          page: table.page,
        });
      });

      if (textChunks.length > 0) {
        try {
          const embeddings = await embed(textChunks, 'external_http');
          
          // Store embeddings in database
          // Note: We need to use raw SQL to insert vector data
          for (let i = 0; i < textChunks.length; i++) {
            const vectorStr = '[' + embeddings[i].join(',') + ']';
            await prisma.$executeRawUnsafe(`
              INSERT INTO embeddings ("doc_id", snippet, vector, meta)
              VALUES ($1, $2, $3::vector, $4::jsonb)
            `, docId, textChunks[i], vectorStr, JSON.stringify(metadataList[i]));
          }
        } catch (embedError) {
          logger.warn({ embedError }, 'Failed to generate embeddings, continuing without them');
        }
      }

      // Update document status
      await prisma.document.update({
        where: { documentId: docId },
        data: {
          status: 'processed',
          meta: { ocr_result_path: getOCRResultPath(docId) },
        },
      });

      // Create preview (first 5 keys)
      const preview: Record<string, any> = {};
      if (typeof maskedParsedData === 'object' && maskedParsedData !== null) {
        const entries = Object.entries(maskedParsedData).slice(0, 5);
        entries.forEach(([key, value]) => {
          preview[key] = value;
        });
      }

      const response: typeof OCRResponseSchema._type = {
        document_id: docId,
        status: 'processed',
        parsed_preview: Object.keys(preview).length > 0 ? preview : null,
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      logger.error({ error, documentId }, 'OCR processing failed');

      // Update document status to failed
      if (documentId) {
        try {
          await prisma.document.update({
            where: { documentId },
            data: {
              status: 'failed',
              meta: { error_message: error.message },
            },
          });
        } catch (updateError) {
          logger.error({ updateError }, 'Failed to update document status');
        }
      }

      return reply.status(500).send({
        error: `OCR processing failed: ${error.message}`,
        code: 500,
      });
    }
  });
};

export default ocrRoutes;

