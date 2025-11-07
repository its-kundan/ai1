/**
 * Upload route handler
 * POST /api/v1/upload
 */

import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prismaClient';
import { saveUploadedFile } from '../../services/fileService';
import { validateFileType, validateFileSize, validateDocumentType } from '../../utils/validators';
import { logger } from '../../utils/logger';
import { UploadResponseSchema } from '../../schemas/apiSchemas';

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{
    Body: {
      file: any;
      doc_type?: string;
    };
  }>('/upload', async (request, reply) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({
          error: 'No file provided',
          code: 400,
        });
      }

      // Validate file type
      if (!validateFileType(data.filename)) {
        return reply.status(400).send({
          error: 'Invalid file type. Allowed: PDF, PNG, JPG, JPEG, TIFF, BMP',
          code: 400,
        });
      }

      // Read file buffer
      const buffer = await data.toBuffer();
      
      // Validate file size
      const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
      if (!validateFileSize(buffer.length, maxSizeMB)) {
        return reply.status(400).send({
          error: `File too large. Maximum size: ${maxSizeMB}MB`,
          code: 400,
        });
      }

      // Get doc_type from form data or default to general
      const docType = validateDocumentType(data.fields?.doc_type?.value as string);

      // Save file
      const { filePath, documentId } = await saveUploadedFile(buffer, data.filename);

      // Create document record
      const document = await prisma.document.create({
        data: {
          documentId,
          filename: data.filename,
          docType,
          filepath: filePath,
          status: 'uploaded',
          meta: {},
        },
      });

      logger.info({ documentId, filename: data.filename }, 'File uploaded');

      const response: typeof UploadResponseSchema._type = {
        document_id: documentId,
        status: 'uploaded',
        filename: data.filename,
      };

      return reply.status(200).send(response);
    } catch (error: any) {
      logger.error({ error }, 'Upload failed');
      return reply.status(500).send({
        error: `Upload failed: ${error.message}`,
        code: 500,
      });
    }
  });
};

export default uploadRoutes;

