# ChatGPT-like Demo - Local Stack

A complete local ChatGPT-like demo with document processing, semantic search, and RAG (Retrieval-Augmented Generation).

## Quick Start

### Option 1: Full Stack (Backend + Models)

```bash
# 1. Start infrastructure (Postgres + Redis)
./scripts/start-all.sh

# 2. Start model services (in separate terminals)
cd models
python -m services.embedding_service  # Port 8100
python -m services.ocr_service         # Port 8200
python -m services.llm_service         # Port 5005

# 3. Start backend (choose one)
cd backend2 && npm run dev  # Node backend on port 8001
# OR
cd backend && python -m app.main  # Python backend on port 8000

# 4. Start frontend
cd frontend && npm run dev  # Port 3000
```

### Option 2: Ollama Mode (No Backend Required) ⚡

**Simplest setup - Frontend connects directly to Ollama:**

```bash
# 1. Install Ollama and DeepSeek model
ollama pull deepseek-chat:7b

# 2. Configure frontend
cd frontend
echo "VITE_LLM_MODE=ollama" > .env
echo "VITE_USE_OLLAMA_SERVICE=false" >> .env

# 3. Start frontend
npm run dev  # Port 3000
```

**That's it!** See [RUN_TOGETHER.md](./RUN_TOGETHER.md) for detailed setup.

## Architecture

```
Frontend (React) → Backend (Python/Node) → Model Services (LLM, Embedding, OCR)
                                              ↓
                                    Postgres + Redis
```

See [INTEGRATION.md](./INTEGRATION.md) for complete architecture, setup, and troubleshooting.

## Components

- **Frontend** (`frontend/`): React + Vite app on port 3000
- **Backend** (`backend/`): Python FastAPI on port 8000
- **Backend2** (`backend2/`): Node Fastify TypeScript on port 8001
- **Model Services** (`models/`): Python microservices
  - LLM inference (port 5005)
  - Embedding service (port 8100)
  - OCR service (port 8200)
- **Ollama Service** (`models2/`): Ollama + DeepSeek (port 5006)
  - **No backend required** - frontend can call directly
  - Uses Ollama API with DeepSeek open-source models
  - See [models2/README.md](./models2/README.md) for setup
- **Infrastructure**: Postgres (5432) + Redis (6379)

## Environment Variables

Create `.env` files in each directory:

- `frontend/.env`: `VITE_API_BASE_URL=http://localhost:8001`
- `backend/.env`: See `backend/.env.example`
- `backend2/.env`: See `backend2/.env.example`
- `models/.env`: See `models/env.example`

## Health Checks

```bash
curl http://localhost:8001/api/v1/health  # Node backend
curl http://localhost:8000/api/v1/health  # Python backend
curl http://localhost:8100/health          # Embedding
curl http://localhost:8200/health          # OCR
curl http://localhost:5005/health          # LLM
```

## Documentation

- **[RUN_TOGETHER.md](./RUN_TOGETHER.md)**: Quick guide to run Frontend + Ollama together
- **[INTEGRATION.md](./INTEGRATION.md)**: Complete integration guide with flows, troubleshooting, and examples
- **[backend/README.md](./backend/README.md)**: Python backend documentation
- **[backend2/README.md](./backend2/README.md)**: Node backend documentation
- **[models/README.md](./models/README.md)**: Model services documentation
- **[models2/README.md](./models2/README.md)**: Ollama + DeepSeek setup guide
- **[models2/FRONTEND_INTEGRATION.md](./models2/FRONTEND_INTEGRATION.md)**: Frontend integration details

## Testing

```bash
# Smoke tests
pytest tests/integration/test_smoke.py -v

# End-to-end tests
pytest tests/integration/test_end_to_end.py -v
```

## Scripts

- `./scripts/start-all.sh`: Start infrastructure (Postgres + Redis)
- `./scripts/stop-all.sh`: Stop all services
- `./scripts/reset-dev.sh`: Reset development environment (clear DB, Redis, uploads)

## License

MIT

