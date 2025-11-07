# Quick Reference Guide

## Ports

| Service | Port | Health Endpoint |
|---------|------|-----------------|
| Frontend | 3000 | http://localhost:3000 |
| Python Backend | 8000 | http://localhost:8000/api/v1/health |
| Node Backend | 8001 | http://localhost:8001/api/v1/health |
| LLM Service | 5005 | http://localhost:5005/health |
| Embedding Service | 8100 | http://localhost:8100/health |
| OCR Service | 8200 | http://localhost:8200/health |
| PostgreSQL | 5432 | `docker-compose exec postgres psql -U postgres -d chatdb -c "SELECT 1;"` |
| Redis | 6379 | `redis-cli -h 127.0.0.1 -p 6379 ping` |

## Environment Variables Quick Reference

### Frontend
```bash
VITE_API_BASE_URL=http://localhost:8001  # or 8000 for Python backend
```

### Backend (Python)
```bash
PORT=8000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
LLM_HOST=http://localhost:5005
EMBED_HOST=http://localhost:8100
OCR_HOST=http://localhost:8200
DATA_DIR=./data
```

### Backend2 (Node)
```bash
PORT=8001
DATABASE_URL=postgresql://postgres:password@localhost:5432/chatdb
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
LLM_SERVICE_URL=http://localhost:5005/infer
EMBEDDING_SERVICE_URL=http://localhost:8100/embed
OCR_SERVICE_URL=http://localhost:8200/ocr
```

## Common Commands

### Start Services
```bash
# Infrastructure
docker-compose up -d postgres redis

# Model services
cd models
python -m services.embedding_service &
python -m services.ocr_service &
python -m services.llm_service &

# Backend
cd backend2 && npm run dev

# Frontend
cd frontend && npm run dev
```

### Health Checks
```bash
# All services
curl http://localhost:8001/api/v1/health
curl http://localhost:8100/health
curl http://localhost:8200/health
curl http://localhost:5005/health

# Database
docker-compose exec postgres psql -U postgres -d chatdb -c "SELECT 1;"
redis-cli -h 127.0.0.1 -p 6379 ping
```

### Reset Development
```bash
./scripts/reset-dev.sh  # Clears DB, Redis, uploads
```

## API Endpoints

### Upload
```bash
curl -X POST http://localhost:8001/api/v1/upload \
  -F "file=@document.pdf" \
  -F "doc_type=bank_statement"
```

### OCR
```bash
curl -X POST http://localhost:8001/api/v1/ocr \
  -H "Content-Type: application/json" \
  -d '{"document_id": "doc_123", "parse_tables": true}'
```

### Search
```bash
curl -X POST http://localhost:8001/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "search query", "top_k": 5}'
```

### Chat
```bash
curl -X POST http://localhost:8001/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "chat_1",
    "user_message": "Hello",
    "use_retrieval": true,
    "top_k": 3
  }'
```

## Redis Keys

- `chat:{chat_id}:context` - Chat context (List, TTL 24h)
- `llm:cache:{model}:{hash}` - LLM cache (String, TTL 7d)
- `embed:cache:{sha256}` - Embedding cache (String, TTL 30d)
- `job:{job_id}` - Job status (Hash, TTL 48h)

## Database Tables

- `documents` - Uploaded documents
- `embeddings` - Vector embeddings (pgvector)
- `messages` - Chat messages
- `chats` - Chat sessions

## Troubleshooting Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| OCR fails | Check `data/uploads/` permissions, restart OCR service |
| Embeddings missing | Verify pgvector extension: `CREATE EXTENSION vector;` |
| LLM timeout | Increase `LLM_TIMEOUT_MS` in backend `.env` |
| Redis connection refused | `docker-compose restart redis` |
| Backend can't find data | Verify `DATA_DIR` path in `.env` |

## File Locations

- Uploads: `data/uploads/`
- OCR results: `data/ocr_results/`
- Logs: `data/logs/` or `models/logs/`
- FAISS index: `data/faiss_index/` (Python backend)
- Database: Postgres (Docker volume)

