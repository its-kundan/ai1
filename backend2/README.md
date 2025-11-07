# Backend2 - Fastify TypeScript Backend

A production-ready Fastify + TypeScript backend for local document processing and chat. This backend implements the same API surface as the Python backend (`backend/`) so the React frontend can switch between them seamlessly.

## Features

- **Fastify** web server with TypeScript
- **PostgreSQL** with **pgvector** for vector embeddings and semantic search
- **Prisma** ORM for type-safe database access
- **Service adapters** for OCR, embeddings, and LLM (supports HTTP calls to Python services or local Node implementations)
- **Comprehensive API** matching the Python backend:
  - `POST /api/v1/upload` - Upload documents
  - `POST /api/v1/ocr` - Process documents with OCR
  - `POST /api/v1/search` - Semantic and keyword search
  - `POST /api/v1/chat` - Chat with LLM using document context
  - `GET /api/v1/chats` - List chat sessions
  - `GET /api/v1/chats/:chat_id/messages` - Get chat messages
  - `POST /api/v1/cache/clear` - Clear embeddings cache
- **PII masking** for sensitive data
- **CORS** configured for React frontend
- **Comprehensive logging** with Pino
- **Test scaffolding** with Jest

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14 (with pgvector extension)
- **Docker** and **Docker Compose** (for local database setup)
- **Python backend services** (optional but recommended):
  - OCR service at `http://localhost:8100`
  - Embedding service at `http://localhost:8100`
- **Local LLM service** (optional):
  - text-generation-webui at `http://localhost:5005/infer`, or
  - llama.cpp binary for subprocess mode

## Quick Start

### 1. Clone and Install

```bash
cd backend2
npm install  # or pnpm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

Or create a `.env` file manually with these variables:

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/backend2?schema=public"

# Server Configuration
PORT=8001
HOST=0.0.0.0
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"

# File Upload Configuration
MAX_FILE_SIZE_MB=50
UPLOAD_DIR="./data/uploads"
OCR_RESULTS_DIR="./data/ocr_results"

# External Service URLs
OCR_SERVICE_URL="http://localhost:8100/api/v1/ocr"
EMBEDDING_SERVICE_URL="http://localhost:8100/api/v1/embed"
LLM_SERVICE_URL="http://localhost:5005/infer"
LLM_TIMEOUT_MS=30000
LLM_MAX_TOKENS=512

# Logging
LOG_LEVEL="info"
```

See `.env.example` for all available options, or `SETUP.md` for detailed configuration.

### 3. Start PostgreSQL with pgvector

```bash
docker-compose up -d
```

This starts:
- PostgreSQL with pgvector extension on port 5432
- Redis (optional, for future BullMQ background jobs) on port 6379

The pgvector extension is automatically initialized via `docker/init-pgvector.sql`.

### 4. Set Up Database Schema

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (creates tables)
npm run prisma:migrate
# Or for quick dev setup:
npm run prisma:push
```

### 5. Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:8001` (or the port specified in `.env`).

### 6. Verify Health

```bash
curl http://localhost:8001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-XX..."
}
```

## Project Structure

```
backend2/
├── src/
│   ├── server.ts              # Server entry point
│   ├── app.ts                 # Fastify app factory (for tests)
│   ├── routes/
│   │   └── v1/                # API v1 routes
│   │       ├── upload.ts
│   │       ├── ocr.ts
│   │       ├── search.ts
│   │       ├── chat.ts
│   │       ├── chats.ts
│   │       └── cache.ts
│   ├── services/              # Business logic
│   │   ├── fileService.ts
│   │   ├── ocrService.ts      # OCR adapter (Python HTTP or Tesseract.js)
│   │   ├── parserService.ts   # Document parsers (bank statements, CDR, etc.)
│   │   ├── embeddingService.ts # Embedding adapter (Python HTTP or local)
│   │   ├── llmClient.ts       # LLM adapter (HTTP or subprocess)
│   │   └── searchService.ts   # pgvector semantic search + keyword search
│   ├── db/
│   │   └── prismaClient.ts    # Prisma client singleton
│   ├── schemas/
│   │   └── apiSchemas.ts      # Zod validation schemas
│   └── utils/
│       ├── logger.ts          # Pino logger
│       ├── validators.ts      # File validation
│       └── masks.ts            # PII masking
├── prisma/
│   └── schema.prisma          # Database schema
├── tests/
│   ├── unit/                  # Unit tests
│   └── integration/           # Integration tests
├── data/                      # Local file storage
│   ├── uploads/               # Uploaded documents
│   └── ocr_results/           # OCR result JSON files
├── docker-compose.yml          # PostgreSQL + Redis setup
├── docker/
│   └── init-pgvector.sql      # pgvector initialization
├── .env.example               # Environment template
└── README.md                  # This file
```

## API Endpoints

### POST /api/v1/upload

Upload a document file.

**Request:**
- `multipart/form-data` with `file` field
- Optional `doc_type`: `bank_statement`, `cdr`, `ipdr`, or `general`

**Response:**
```json
{
  "document_id": "doc_abc123...",
  "status": "uploaded",
  "filename": "statement.pdf"
}
```

**Example:**
```bash
curl -X POST http://localhost:8001/api/v1/upload \
  -F "file=@statement.pdf" \
  -F "doc_type=bank_statement"
```

### POST /api/v1/ocr

Process a document with OCR and parsing.

**Request:**
```json
{
  "document_id": "doc_abc123...",
  "parse_tables": true
}
```

**Response:**
```json
{
  "document_id": "doc_abc123...",
  "status": "processed",
  "parsed_preview": {
    "account_number": "****1234",
    "total_debits": 10234.50,
    "from_date": "2025-09-01"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8001/api/v1/ocr \
  -H "Content-Type: application/json" \
  -d '{"document_id": "doc_abc123...", "parse_tables": true}'
```

**Note:** This endpoint requires the Python OCR service to be running at `http://localhost:8100/api/v1/ocr` (or configure `OCR_SERVICE_URL` in `.env`).

### POST /api/v1/search

Semantic search across indexed documents.

**Request:**
```json
{
  "query": "total debit last month",
  "top_k": 5
}
```

**Response:**
```json
{
  "query": "total debit last month",
  "results": [
    {
      "doc_id": "doc_abc123...",
      "snippet": "Total debit: 10,234.50",
      "score": 0.93
    }
  ],
  "total_found": 1
}
```

**Example:**
```bash
curl -X POST http://localhost:8001/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "total debit last month", "top_k": 5}'
```

### POST /api/v1/chat

Chat with LLM using document context.

**Request:**
```json
{
  "chat_id": "chat_1",
  "user_message": "What was my total debit in September?",
  "use_retrieval": true,
  "top_k": 3
}
```

**Response:**
```json
{
  "chat_id": "chat_1",
  "reply": "Your total debits for September 2025 were ₹10,234.50. (Source: statement.pdf, row 12)",
  "used_docs": ["doc_abc123..."]
}
```

**Example:**
```bash
curl -X POST http://localhost:8001/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "chat_1",
    "user_message": "What was my total debit in September?",
    "use_retrieval": true,
    "top_k": 3
  }'
```

**Note:** This endpoint requires the LLM service to be running at `http://localhost:5005/infer` (or configure `LLM_SERVICE_URL` in `.env`).

### GET /api/v1/chats

List all chat sessions.

**Response:**
```json
{
  "chats": [
    {
      "chat_id": "chat_1",
      "last_active": "2025-01-XX...",
      "message_count": 10,
      "title": null
    }
  ],
  "total": 1
}
```

### GET /api/v1/chats/:chat_id/messages

Get paginated messages for a chat.

**Query Parameters:**
- `page` (default: 1)
- `page_size` (default: 50)

**Response:**
```json
{
  "chat_id": "chat_1",
  "messages": [
    {
      "id": 1,
      "chat_id": "chat_1",
      "role": "user",
      "text": "What was my total debit?",
      "timestamp": "2025-01-XX...",
      "used_docs": null
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 50
}
```

### POST /api/v1/cache/clear

Clear embeddings cache (useful for development).

**Response:**
```json
{
  "status": "cache_cleared",
  "message": "Embeddings table cleared. Run OCR again to rebuild index."
}
```

## Integration with Python Backend

This Node backend is designed to work alongside the Python backend (`backend/`). The recommended setup is:

1. **Run Python services** for heavy ML tasks:
   - OCR service on port 8100
   - Embedding service on port 8100

2. **Run Node backend** for API and database:
   - Fastify server on port 8001
   - PostgreSQL with pgvector for vector search

3. **Frontend** can switch between backends by changing the API base URL.

### Python Service Contracts

#### OCR Service

**Endpoint:** `POST http://localhost:8100/api/v1/ocr`

**Request:**
```json
{
  "document_id": "doc_12345",
  "file_path": "./data/uploads/doc_12345.pdf",
  "parse_tables": true
}
```

**Response:**
```json
{
  "document_id": "doc_12345",
  "raw_text": "...",
  "blocks": [
    {
      "text": "...",
      "bbox": {"x1": 0, "y1": 0, "x2": 100, "y2": 20},
      "confidence": 0.95,
      "page": 1
    }
  ],
  "tables": [
    {
      "row_index": 0,
      "cells": ["Date", "Description", "Amount"],
      "page": 1
    }
  ],
  "parsed_data": {...},
  "processing_time": 2.5
}
```

#### Embedding Service

**Endpoint:** `POST http://localhost:8100/api/v1/embed`

**Request:**
```json
{
  "texts": ["text snippet 1", "text snippet 2"]
}
```

**Response:**
```json
{
  "embeddings": [
    [0.123, -0.456, ...],  // float array of dimension 1536
    [0.789, -0.012, ...]
  ],
  "dimension": 1536
}
```

## Database Schema

The Prisma schema defines:

- **users** (optional, for future multi-user support)
- **chats** - Chat sessions
- **messages** - Chat messages
- **documents** - Uploaded documents
- **ocr_results** - OCR processing results (JSONB)
- **embeddings** - Vector embeddings with pgvector

### pgvector Setup

The `embeddings` table uses PostgreSQL's `vector` type (via pgvector):

```sql
-- Vector column (added via migration)
ALTER TABLE "embeddings" ADD COLUMN vector vector(1536);

-- Index for fast nearest neighbor search
CREATE INDEX ON embeddings USING ivfflat (vector vector_l2_ops) WITH (lists = 100);
```

**Nearest neighbor query example:**
```sql
SELECT 
  e.id,
  e.doc_id,
  e.snippet,
  e.meta,
  (e.vector <-> $1::vector) AS distance
FROM embeddings e
WHERE e.vector IS NOT NULL
ORDER BY distance
LIMIT $2;
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Database Migrations

```bash
# Create a new migration
npm run prisma:migrate

# Push schema changes (dev only)
npm run prisma:push

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

### Building for Production

```bash
npm run build
npm start
```

## Configuration

### Environment Variables

See `.env.example` for all available options. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `OCR_SERVICE_URL` - Python OCR service URL
- `EMBEDDING_SERVICE_URL` - Python embedding service URL
- `LLM_SERVICE_URL` - LLM inference endpoint
- `CORS_ORIGIN` - Allowed frontend origins
- `MAX_FILE_SIZE_MB` - Maximum upload size (default: 50MB)

### Service Modes

#### OCR Service

- **External HTTP (preferred):** Calls Python OCR service
- **Local Node (optional):** Uses Tesseract.js (stub provided)

#### Embedding Service

- **External HTTP (preferred):** Calls Python embedding service
- **Local Node (optional):** Uses @xenova/transformers (stub provided)

#### LLM Client

- **HTTP (preferred):** Calls text-generation-webui or similar
- **Subprocess (optional):** Spawns llama.cpp binary (stub provided)

## Troubleshooting

### pgvector Extension Missing

If you see errors about the `vector` type:

1. Ensure PostgreSQL container is running: `docker-compose ps`
2. Check extension is installed: `docker-compose exec postgres psql -U postgres -d backend2 -c "SELECT * FROM pg_extension WHERE extname = 'vector';"`
3. If missing, run: `docker-compose exec postgres psql -U postgres -d backend2 -c "CREATE EXTENSION vector;"`

### Prisma Migration Errors

If migrations fail:

1. Reset database (dev only): `npx prisma migrate reset`
2. Or push schema directly: `npm run prisma:push`

### External Services Not Available

If OCR/embedding/LLM services are not running:

- The endpoints will return helpful error messages
- Check service URLs in `.env`
- Ensure Python services are running on the expected ports
- For LLM, ensure text-generation-webui or similar is running

### CORS Errors

If the frontend can't connect:

1. Check `CORS_ORIGIN` in `.env` includes your frontend URL
2. Restart the server after changing `.env`

## Background Jobs (Future)

The codebase includes comments showing how to integrate BullMQ + Redis for background OCR processing:

```typescript
// Example: Enqueue OCR job
// import { Queue } from 'bullmq';
// const ocrQueue = new Queue('ocr', { connection: { host: 'localhost', port: 6379 } });
// await ocrQueue.add('process', { documentId, filePath });
```

Currently, all flows are synchronous for simplicity.

## License

MIT

## Contributing

This is a scaffold for local development. Feel free to extend with:
- Additional document parsers
- ML-based extraction models
- Background job processing
- Authentication
- Multi-user support

