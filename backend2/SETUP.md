# Quick Setup Guide

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd backend2
npm install
# or
pnpm install
```

### 2. Configure Environment

Create `.env` file from template:

```bash
cp .env.example .env
```

The `.env.example` file contains all the required environment variables with default values.

Edit `.env` and set:
- `DATABASE_URL` (default: `postgresql://postgres:postgres@localhost:5432/backend2?schema=public`)
- `OCR_SERVICE_URL` (default: `http://localhost:8100/api/v1/ocr`)
- `EMBEDDING_SERVICE_URL` (default: `http://localhost:8100/api/v1/embed`)
- `LLM_SERVICE_URL` (default: `http://localhost:5005/infer`)

### 3. Start PostgreSQL with pgvector

```bash
docker-compose up -d
```

Wait for PostgreSQL to be ready (check logs: `docker-compose logs postgres`).

### 4. Initialize Database

```bash
# Generate Prisma client
npm run prisma:generate

# Create database schema
npm run prisma:migrate
# Or for quick dev: npm run prisma:push
```

### 5. Add pgvector Column (Manual Step)

After the initial migration, add the vector column:

```sql
-- Connect to database
docker-compose exec postgres psql -U postgres -d backend2

-- Run these commands:
ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS vector vector(1536);
CREATE INDEX IF NOT EXISTS embeddings_vector_idx 
ON embeddings USING ivfflat (vector vector_l2_ops) WITH (lists = 100);
```

Or use the migration guide in `prisma/migrations/README.md`.

### 6. Start the Server

```bash
npm run dev
```

Server will start on `http://localhost:8001` (or your configured port).

### 7. Verify Setup

```bash
# Health check
curl http://localhost:8001/health

# Expected response:
# {"status":"healthy","timestamp":"..."}
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

**Note:** Tests mock external services, so they don't require Python OCR/embedding services or LLM to be running.

## Troubleshooting

### PostgreSQL Connection Error

- Ensure Docker container is running: `docker-compose ps`
- Check connection string in `.env`
- Verify PostgreSQL is listening: `docker-compose logs postgres`

### pgvector Extension Error

- Ensure extension is installed: `docker-compose exec postgres psql -U postgres -d backend2 -c "SELECT * FROM pg_extension WHERE extname = 'vector';"`
- If missing, run: `docker-compose exec postgres psql -U postgres -d backend2 -c "CREATE EXTENSION vector;"`

### Prisma Migration Errors

- Reset database (dev only): `npx prisma migrate reset`
- Or push schema directly: `npm run prisma:push`

### External Services Not Available

The endpoints will return helpful error messages if:
- Python OCR service is not running
- Python embedding service is not running
- LLM service is not running

Check service URLs in `.env` and ensure services are running on expected ports.

## Next Steps

1. **Start Python services** (if using external HTTP mode):
   - OCR service on port 8100
   - Embedding service on port 8100

2. **Start LLM service** (for chat endpoint):
   - text-generation-webui on port 5005, or
   - Configure subprocess mode for llama.cpp

3. **Test API endpoints**:
   - Upload a document: `POST /api/v1/upload`
   - Process OCR: `POST /api/v1/ocr`
   - Search: `POST /api/v1/search`
   - Chat: `POST /api/v1/chat`

See `README.md` for detailed API documentation and examples.

