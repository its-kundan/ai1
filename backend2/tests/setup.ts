/**
 * Test setup file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/backend2_test?schema=public';
process.env.PORT = '8002';
process.env.OCR_SERVICE_URL = 'http://localhost:8100/api/v1/ocr';
process.env.EMBEDDING_SERVICE_URL = 'http://localhost:8100/api/v1/embed';
process.env.LLM_SERVICE_URL = 'http://localhost:5005/infer';

