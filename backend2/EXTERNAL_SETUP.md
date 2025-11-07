# External Setup Requirements

Beyond setting `.env` variables, you need to complete these external setup steps:

## ✅ Required Setup (Must Do)

### 1. Install Node.js Dependencies
```bash
cd backend2
npm install
# or
pnpm install
```

### 2. Start PostgreSQL Database
```bash
# Start PostgreSQL with pgvector extension
docker-compose up -d

# Verify it's running
docker-compose ps
```

**Prerequisites:** You need Docker and Docker Compose installed on your system.

### 3. Initialize Database Schema
```bash
# Generate Prisma client
npm run prisma:generate

# Create database tables
npm run prisma:migrate
# OR for quick dev (no migration history):
npm run prisma:push
```

### 4. Add pgvector Column (Manual Step)
After the initial migration, you need to manually add the vector column:

```bash
# Connect to database
docker-compose exec postgres psql -U postgres -d backend2

# Run these SQL commands:
ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS vector vector(1536);
CREATE INDEX IF NOT EXISTS embeddings_vector_idx 
ON embeddings USING ivfflat (vector vector_l2_ops) WITH (lists = 100);
```

Or create a Prisma migration file (see `prisma/migrations/README.md`).

## ⚠️ Optional but Recommended (For Full Functionality)

### 5. Start Python OCR Service (for `/api/v1/ocr` endpoint)
If you want to use OCR functionality, you need to run the Python OCR service from your `backend/` folder:

```bash
# In a separate terminal, from the backend/ directory
# Start your Python OCR service on port 8100
# The exact command depends on your Python backend setup
```

**Note:** The Node backend will return errors if this service is not available when calling `/api/v1/ocr`.

### 6. Start Python Embedding Service (for `/api/v1/search` endpoint)
Similarly, for semantic search to work, you need the Python embedding service:

```bash
# Start your Python embedding service on port 8100
# (may be the same service as OCR, or separate)
```

**Note:** Search will fail if this service is not available.

### 7. Start LLM Service (for `/api/v1/chat` endpoint)
For chat functionality, you need a local LLM service:

**Option A: text-generation-webui**
```bash
# Install and run text-generation-webui
# Configure it to expose API on port 5005
```

**Option B: llama.cpp (subprocess mode)**
- Download llama.cpp binary
- Download a model file (.gguf format)
- Set `LLAMA_CPP_PATH` and `LLM_MODEL_PATH` in `.env`

**Note:** Chat endpoint will return an error if LLM service is not available.

## 📋 Quick Checklist

- [ ] `npm install` completed
- [ ] `.env` file created and configured
- [ ] Docker Compose started (`docker-compose up -d`)
- [ ] Database schema initialized (`npm run prisma:migrate`)
- [ ] pgvector column added manually
- [ ] Python OCR service running (optional)
- [ ] Python embedding service running (optional)
- [ ] LLM service running (optional)

## 🚀 Minimal Setup (Just to Start the Server)

If you just want to start the server and test basic endpoints:

1. ✅ `npm install`
2. ✅ Create `.env` file
3. ✅ `docker-compose up -d`
4. ✅ `npm run prisma:generate && npm run prisma:push`
5. ✅ Add pgvector column (SQL commands above)
6. ✅ `npm run dev`

The server will start, but:
- `/api/v1/upload` - ✅ Works (no external dependency)
- `/api/v1/ocr` - ❌ Will fail (needs Python OCR service)
- `/api/v1/search` - ❌ Will fail (needs embedding service)
- `/api/v1/chat` - ❌ Will fail (needs LLM service)
- `/api/v1/chats` - ✅ Works (no external dependency)
- `/api/v1/cache/clear` - ✅ Works (no external dependency)

## 🔧 Testing Without External Services

You can run tests without external services (they're mocked):

```bash
npm test
```

Tests don't require Python services or LLM to be running.

