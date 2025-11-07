# End-to-End Integration Guide

Complete guide for connecting and running the ChatGPT-like demo stack locally.

## Architecture Overview

```
┌─────────────┐
│  Frontend   │  React (Vite) on port 3000
│  (React)    │  └─→ Uses FRONTEND_API_URL to connect to backend
└──────┬──────┘
       │ HTTP /api/v1/*
       │
       ├─────────────────┐
       │                 │
┌──────▼──────┐   ┌──────▼──────┐
│  Backend    │   │  Backend2   │
│  (Python)   │   │  (Node)     │
│  Port 8000  │   │  Port 8001  │
└──────┬──────┘   └──────┬──────┘
       │                 │
       │                 │
       ├────────┬────────┘
       │        │
       │  ┌─────▼─────┐
       │  │  Postgres │  Port 5432 (with pgvector)
       │  │  + Redis  │  Port 6379
       │  └─────────┘
       │
       ├──────────────┬──────────────┬──────────────┐
       │              │              │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│  LLM       │ │ Embedding  │ │   OCR     │ │   Data/    │
│  Service   │ │  Service   │ │  Service  │ │  Storage  │
│  Port 5005 │ │ Port 8100  │ │ Port 8200 │ │ ./data/    │
└────────────┘ └────────────┘ └───────────┘ └────────────┘
```

## Quick Start

### 1. Prerequisites

- **Docker** and **Docker Compose** (for Postgres + Redis)
- **Node.js** >= 18.0.0 (for frontend and backend2)
- **Python** >= 3.9 (for backend and model services)
- **PostgreSQL client tools** (optional, for manual DB access)
- **Redis CLI** (optional, for manual cache inspection)

### 2. Environment Setup

#### Frontend Configuration

Create `frontend/.env`:
```bash
# Use Node backend (backend2) on port 8001
VITE_API_BASE_URL=http://localhost:8001

# Or use Python backend on port 8000
# VITE_API_BASE_URL=http://localhost:8000
```

#### Backend Configuration

**Python Backend (`backend/.env`):**
```bash
PORT=8000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
POSTGRES_URL=postgresql://postgres:password@localhost:5432/chatdb
LLM_HOST=http://localhost:5005
EMBED_HOST=http://localhost:8100
OCR_HOST=http://localhost:8200
DATA_DIR=./data
```

**Node Backend (`backend2/.env`):**
```bash
PORT=8001
DATABASE_URL=postgresql://postgres:password@localhost:5432/chatdb
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
LLM_SERVICE_URL=http://localhost:5005/infer
EMBEDDING_SERVICE_URL=http://localhost:8100/embed
OCR_SERVICE_URL=http://localhost:8200/ocr
DATA_DIR=./data
```

**Model Services (`models/.env`):**
```bash
LLM_PORT=5005
LLM_HOST=127.0.0.1
EMBED_PORT=8100
EMBED_HOST=127.0.0.1
OCR_PORT=8200
OCR_HOST=127.0.0.1
```

### 3. Startup Order

#### Option A: Automated (Recommended)

```bash
# Start infrastructure (Postgres + Redis)
./scripts/start-all.sh

# Start model services (optional, in separate terminals)
cd models
python -m services.embedding_service  # Port 8100
python -m services.ocr_service         # Port 8200
python -m services.llm_service         # Port 5005

# Start backend (choose one or both)
cd backend2
npm install
npm run prisma:generate
npm run prisma:push
npm run dev  # Port 8001

# Or Python backend
cd backend
pip install -r requirements.txt
python -m app.main  # Port 8000

# Start frontend
cd frontend
npm install
npm run dev  # Port 3000
```

#### Option B: Manual Docker Compose

```bash
# Start infrastructure
docker-compose up -d postgres redis

# Wait for services to be healthy
docker-compose ps

# Then start backends and frontend as above
```

### 4. Health Checks

Verify all services are running:

```bash
# Infrastructure
docker-compose ps  # Check Postgres and Redis

# Backends
curl http://localhost:8000/api/v1/health  # Python backend
curl http://localhost:8001/api/v1/health  # Node backend

# Model services
curl http://localhost:8100/health  # Embedding
curl http://localhost:8200/health  # OCR
curl http://localhost:5005/health  # LLM

# Frontend
open http://localhost:3000
```

Expected health response format:
```json
{
  "status": "ok",
  "service": "node-backend",
  "model": "optional-model-name"
}
```

## Integration Flows

### Flow A: Upload → OCR → Index

**1. Upload Document**

```bash
curl -X POST http://localhost:8001/api/v1/upload \
  -F "file=@statement.pdf" \
  -F "doc_type=bank_statement"
```

Response:
```json
{
  "document_id": "doc_abc123",
  "status": "uploaded",
  "filename": "statement.pdf"
}
```

**2. Process OCR**

```bash
curl -X POST http://localhost:8001/api/v1/ocr \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "doc_abc123",
    "parse_tables": true
  }'
```

Response:
```json
{
  "document_id": "doc_abc123",
  "status": "processed",
  "parsed_preview": {
    "preview": {
      "account_number": "****1234",
      "balance": "$1,234.56"
    }
  }
}
```

**3. Verify Indexing**

- OCR result saved to: `data/ocr_results/doc_abc123.json`
- Embeddings stored in Postgres `embeddings` table (pgvector)
- Or in FAISS index: `data/faiss_index/`

### Flow B: Search

**Semantic Search**

```bash
curl -X POST http://localhost:8001/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What was my total debit in September?",
    "top_k": 5
  }'
```

Response:
```json
{
  "results": [
    {
      "doc_id": "doc_abc123",
      "snippet": "September transactions: Debit $500.00...",
      "score": 0.89,
      "metadata": {
        "type": "text",
        "page": 1
      }
    }
  ]
}
```

### Flow C: Chat RAG

**Chat with Document Retrieval**

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

Response:
```json
{
  "assistant_reply": "Based on your documents, your total debit in September was $500.00...",
  "used_docs": ["doc_abc123"],
  "chat_id": "chat_1"
}
```

**Internal Flow:**
1. Backend loads last N messages from DB (or Redis `chat:{chat_id}:context`)
2. If `use_retrieval=true`, calls `/api/v1/search` internally
3. Masks PII in retrieved snippets
4. Checks Redis `llm:cache:{model}:{prompt_hash}` for cached response
5. If not cached, calls LLM service: `POST http://LLM_HOST/infer`
6. Persists user message and assistant reply to DB
7. Updates Redis `chat:{chat_id}:context` with new messages
8. Returns response to frontend

## Redis & Postgres Interactions

### Redis Keys

**Chat Context:**
- Key: `chat:{chat_id}:context`
- Type: List (LPUSH, LTRIM to keep last 20)
- TTL: 24 hours

**LLM Cache:**
- Key: `llm:cache:{model_version}:{prompt_hash}`
- Type: String (JSON)
- TTL: 7 days

**Embedding Cache:**
- Key: `embed:cache:{sha256(text)}`
- Type: String (base64 or JSON)
- TTL: 30 days

**Job Tracking:**
- Key: `job:{job_id}`
- Type: Hash (HSET status, progress, etc.)
- TTL: 48 hours (set when done)

### Postgres Schema

**Documents Table:**
- `document_id` (PK)
- `filename`, `doc_type`, `status`
- `ocr_result_path`
- `created_at`, `updated_at`

**Embeddings Table (pgvector):**
- `id` (PK)
- `document_id` (FK)
- `embedding` (vector type)
- `text_snippet`
- `metadata` (JSONB)

**Messages Table:**
- `id` (PK)
- `chat_id`
- `role` (user/assistant)
- `text`
- `used_docs` (JSONB array)
- `created_at`

**Chats Table:**
- `chat_id` (PK)
- `meta` (JSONB)
- `created_at`, `updated_at`

## Switching Backends

The frontend can switch between Python and Node backends by changing `VITE_API_BASE_URL`:

```bash
# In frontend/.env
VITE_API_BASE_URL=http://localhost:8001  # Node backend
# or
VITE_API_BASE_URL=http://localhost:8000  # Python backend
```

**Important:** Both backends should:
- Use the same Postgres database (`chatdb`)
- Use the same Redis instance
- Share the same `data/` directory (or at least `data/uploads/` and `data/ocr_results/`)

**Recommended Setup:**
- **Node backend (backend2)** as primary API (uses Postgres + pgvector)
- **Python backend** for heavy OCR/embedding tasks (can be called via HTTP from Node backend)
- Both read from same `data/` folder

## Troubleshooting

### OCR Fails

**Symptoms:** OCR endpoint returns 500 error or timeout

**Checks:**
1. OCR service health: `curl http://localhost:8200/health`
2. File path accessible: Check `data/uploads/` exists and has correct permissions
3. Language packs: EasyOCR may need language downloads on first run
4. Service logs: Check `models/logs/` or terminal output

**Fix:**
```bash
# Restart OCR service
cd models
python -m services.ocr_service

# Check file permissions
chmod -R 755 data/uploads
```

### Embeddings Missing in Postgres

**Symptoms:** Search returns no results after OCR

**Checks:**
1. Embedding service health: `curl http://localhost:8100/health`
2. Postgres connection: `docker-compose exec postgres psql -U postgres -d chatdb -c "SELECT COUNT(*) FROM embeddings;"`
3. pgvector extension: `docker-compose exec postgres psql -U postgres -d chatdb -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"`

**Fix:**
```bash
# Enable pgvector if missing
docker-compose exec postgres psql -U postgres -d chatdb -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Re-run OCR to rebuild embeddings
curl -X POST http://localhost:8001/api/v1/ocr -d '{"document_id": "doc_abc123"}'
```

### LLM Timeout

**Symptoms:** Chat endpoint times out or returns 504

**Checks:**
1. LLM service health: `curl http://localhost:5005/health`
2. Model path: Verify model file exists and is accessible
3. Memory: Check if process has enough RAM
4. Timeout settings: Increase `LLM_TIMEOUT_MS` in backend `.env`

**Fix:**
```bash
# Increase timeout in backend2/.env
LLM_TIMEOUT_MS=60000  # 60 seconds

# Check LLM service logs
cd models
python -m services.llm_service  # Check terminal output
```

### Redis Connection Refused

**Symptoms:** Cache operations fail, Redis errors in logs

**Checks:**
1. Redis running: `docker-compose ps redis`
2. Redis accessible: `redis-cli -h 127.0.0.1 -p 6379 ping` (should return PONG)
3. Connection string: Verify `REDIS_HOST` and `REDIS_PORT` in backend `.env`

**Fix:**
```bash
# Restart Redis
docker-compose restart redis

# Test connection
docker-compose exec redis redis-cli ping
```

### Switching Backends Yields Missing Data

**Symptoms:** Documents uploaded via one backend not visible in the other

**Checks:**
1. Same database: Verify both backends use same `POSTGRES_URL`/`DATABASE_URL`
2. Same Redis: Verify both use same `REDIS_HOST` and `REDIS_PORT`
3. Data directory: Check if both backends point to same `DATA_DIR`

**Fix:**
```bash
# Ensure both backends use same config
# backend/.env and backend2/.env should have:
POSTGRES_URL=postgresql://postgres:password@localhost:5432/chatdb
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
DATA_DIR=./data  # Or use absolute path
```

## Development Checklist

Use this checklist to verify the entire system is working:

- [ ] **Infrastructure:**
  - [ ] Postgres running: `docker-compose ps postgres`
  - [ ] Redis running: `docker-compose ps redis`
  - [ ] pgvector extension enabled: `docker-compose exec postgres psql -U postgres -d chatdb -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"`

- [ ] **Model Services:**
  - [ ] Embedding service: `curl http://localhost:8100/health`
  - [ ] OCR service: `curl http://localhost:8200/health`
  - [ ] LLM service: `curl http://localhost:5005/health`

- [ ] **Backends:**
  - [ ] Python backend: `curl http://localhost:8000/api/v1/health`
  - [ ] Node backend: `curl http://localhost:8001/api/v1/health`

- [ ] **Frontend:**
  - [ ] Frontend accessible: `open http://localhost:3000`
  - [ ] API calls work: Check browser console for errors

- [ ] **End-to-End Test:**
  - [ ] Upload a test document via frontend or curl
  - [ ] Verify OCR processing completes
  - [ ] Run a search query
  - [ ] Send a chat message with retrieval enabled
  - [ ] Verify response includes `used_docs`

## Sample curl Scenarios

### Complete Upload → OCR → Search → Chat Flow

```bash
# 1. Upload
DOC_ID=$(curl -s -X POST http://localhost:8001/api/v1/upload \
  -F "file=@test.pdf" \
  -F "doc_type=general" | jq -r '.document_id')

echo "Document ID: $DOC_ID"

# 2. OCR
curl -X POST http://localhost:8001/api/v1/ocr \
  -H "Content-Type: application/json" \
  -d "{\"document_id\": \"$DOC_ID\", \"parse_tables\": false}"

# 3. Wait for indexing
sleep 3

# 4. Search
curl -X POST http://localhost:8001/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test query", "top_k": 3}'

# 5. Chat
curl -X POST http://localhost:8001/api/v1/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"chat_id\": \"test_chat\",
    \"user_message\": \"What is in the document?\",
    \"use_retrieval\": true,
    \"top_k\": 3
  }"
```

## Log Locations

- **Backend logs:** `backend/data/logs/` or terminal output
- **Backend2 logs:** Terminal output (Pino logger)
- **Model services logs:** `models/logs/` or terminal output
- **Docker logs:** `docker-compose logs postgres`, `docker-compose logs redis`
- **Frontend logs:** Browser console

## Next Steps

1. **Customize Models:** Update model paths in `models/.env`
2. **Add Authentication:** Implement API keys or OAuth
3. **Scale Services:** Use Docker Compose to run multiple instances
4. **Production Deployment:** Use environment-specific configs, add monitoring
5. **Performance Tuning:** Adjust Redis TTLs, embedding batch sizes, LLM timeouts

## Support

For issues or questions:
1. Check service health endpoints
2. Review logs in `data/logs/` or terminal output
3. Verify environment variables match this guide
4. Run integration tests: `pytest tests/integration/ -v`

