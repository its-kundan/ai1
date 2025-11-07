/**
 * File validation utilities
 */

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/bmp'
];

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'];

export function validateFileType(filename: string): boolean {
  if (!filename) return false;
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase());
}

export function validateFileSize(fileSize: number, maxSizeMB: number = 50): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSize <= maxSizeBytes;
}

export function validateDocumentType(docType: string | null | undefined): string {
  const validTypes = ['bank_statement', 'cdr', 'ipdr', 'general'];
  if (!docType || !validTypes.includes(docType)) {
    return 'general';
  }
  return docType;
}

