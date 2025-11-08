# ChatGPT-like Demo Backend

A local backend for a ChatGPT-like demo application with OCR, document parsing, semantic search, and chat capabilities using a local LLM.

## Features

- **File Upload**: Upload PDFs and images for processing
- **OCR**: Extract text from images and PDFs using EasyOCR (with Tesseract fallback)
- **Table Extraction**: Extract tables from PDFs using Camelot/Tabula
- **Document Parsing**: Rule-based parsers for bank statements, CDR, and IPDR
- **Semantic Search**: FAISS-based vector search using sentence-transformers
- **Chat with RAG**: Chat endpoint with retrieval-augmented generation
- **Local LLM Integration**: Support for local LLM runtimes (text-generation-webui, llama.cpp)

## Tech Stack

- **Framework**: FastAPI (async)
- **Database**: SQLite via SQLModel
- **OCR**: EasyOCR (primary), Tesseract (fallback)
- **Embeddings**: sentence-transformers (all-MiniLM-L6-v2)
- **Vector DB**: FAISS (CPU)
- **LLM**: Local HTTP endpoint or llama.cpp subprocess

## Setup

### Prerequisites

- Python 3.10+
- pip
- (Optional) Tesseract OCR system package
- (Optional) Poppler for PDF processing

### Installation

1. **Create virtual environment**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Install system dependencies** (if needed):
   - **Tesseract OCR**: 
     - Windows: Download from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)
     - Linux: `sudo apt-get install tesseract-ocr`
     - macOS: `brew install tesseract`
   
   - **Poppler** (for PDF to image conversion):
     - Windows: Download from [poppler-windows](https://github.com/oschwartz10612/poppler-windows/releases)
     - Linux: `sudo apt-get install poppler-utils`
     - macOS: `brew install poppler`

4. **Create data directories** (auto-created on first run):
   - `data/uploads/` - Uploaded files
   - `data/ocr_results/` - OCR results JSON
   - `data/faiss_index/` - FAISS index files
   - `data/logs/` - Application logs

5. **Initialize database** (auto-created on first run):
   ```bash
   python -c "from app.db.init_db import init_db; init_db()"
   ```

### Model Downloads

#### Embedding Model
The sentence-transformers model (`all-MiniLM-L6-v2`) will be **automatically downloaded** on first use from HuggingFace. No manual download needed.

#### LLM Model (Optional)
For chat functionality, you need a local LLM runtime:

**Option 1: text-generation-webui** (Recommended)
1. Install [text-generation-webui](https://github.com/oobabooga/text-generation-webui)
2. Start with API enabled:
   ```bash
   python server.py --api --listen-port 5005
   ```
3. The backend will connect to `http://localhost:5005/infer`

**Option 2: llama.cpp**
1. Download [llama.cpp](https://github.com/ggerganov/llama.cpp)
2. Build: `make`
3. Download a model in `.gguf` format
4. Update `llm_client.py` with correct paths
5. Set mode to `subprocess` in LLMClient initialization

## Running the Server

```bash
# Development mode (with auto-reload)
uvicorn app.main:app --reload --port 8000

# Or use Python directly
python -m app.main
```

The API will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/v1/health

## API Endpoints

### POST `/api/v1/upload`
Upload a file for processing.

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/upload" \
  -F "file=@statement.pdf" \
  -F "doc_type=bank_statement"
```

**Response**:
```json
{
  "document_id": "doc_12345",
  "status": "uploaded",
  "filename": "statement.pdf"
}
```

### POST `/api/v1/ocr`
Process OCR and parsing for a document.

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/ocr" \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "doc_12345",
    "parse_tables": true
  }'
```

**Response**:
```json
{
  "document_id": "doc_12345",
  "status": "processed",
  "parsed_preview": {
    "preview": {
      "account_number": "****3456",
      "total_debits": 10234.50,
      "from_date": "2025-09-01"
    }
  }
}
```

### POST `/api/v1/search`
Semantic search across indexed documents.

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "total debit last month",
    "top_k": 5
  }'
```

**Response**:
```json
{
  "query": "total debit last month",
  "results": [
    {
      "doc_id": "doc_12345",
      "snippet": "Total debit: 10,234.50",
      "score": 0.93,
      "bounding_box": null,
      "metadata": {}
    }
  ],
  "total_found": 1
}
```

### POST `/api/v1/chat`
Chat endpoint with optional RAG.

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "chat_1",
    "user_message": "What was my total debit in September?",
    "use_retrieval": true,
    "top_k": 3
  }'
```

**Response**:
```json
{
  "chat_id": "chat_1",
  "reply": "Your total debits for September 2025 were ₹10,234.50. (Source: statement.pdf, row 12)",
  "used_docs": ["doc_12345"]
}
```

### GET `/api/v1/chats`
List all chat sessions.

**Request**:
```bash
curl "http://localhost:8000/api/v1/chats"
```

### GET `/api/v1/chats/{chat_id}/messages`
Get messages for a chat.

**Request**:
```bash
curl "http://localhost:8000/api/v1/chats/chat_1/messages?page=1&page_size=50"
```

### POST `/api/v1/cache/clear`
Clear local caches.

**Request**:
```bash
curl -X POST "http://localhost:8000/api/v1/cache/clear"
```

### GET `/api/v1/health`
Health check endpoint.

## Testing

Run tests with pytest:

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run specific test file
pytest tests/test_parser_service.py
```

## Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app entry point
│   ├── api/
│   │   └── v1/
│   │       └── endpoints.py    # API endpoints
│   ├── services/
│   │   ├── ocr_service.py      # OCR and table extraction
│   │   ├── parser_service.py   # Document parsing
│   │   ├── embedding_service.py # Embeddings and FAISS
│   │   └── llm_client.py       # LLM client
│   ├── models/
│   │   ├── db_models.py        # SQLModel database models
│   │   └── pydantic_schemas.py # Pydantic request/response schemas
│   ├── db/
│   │   └── init_db.py          # Database initialization
│   └── utils/
│       ├── file_utils.py       # File handling utilities
│       └── logging.py          # Logging configuration
├── data/
│   ├── uploads/                # Uploaded files
│   ├── ocr_results/            # OCR result JSONs
│   ├── faiss_index/            # FAISS index files
│   └── logs/                   # Application logs
├── tests/                      # Unit tests
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

## Troubleshooting

### EasyOCR not working
- Ensure EasyOCR is installed: `pip install easyocr`
- First run will download models (may take time)
- Check internet connection for model download

### Tesseract not found
- Install Tesseract OCR system package
- On Windows, add Tesseract to PATH or set `TESSDATA_PREFIX` environment variable

### PDF processing fails
- Install Poppler utilities
- On Windows, add Poppler `bin` directory to PATH

### FAISS import error
- Install: `pip install faiss-cpu`
- For GPU support: `pip install faiss-gpu` (requires CUDA)

### LLM not available
- Ensure your LLM server is running (text-generation-webui or llama.cpp)
- Check the endpoint URL in `llm_client.py`
- Verify the server is accessible: `curl http://localhost:5005/health`

### Database errors
- Delete `data/app.db` to reset database
- Run: `python -c "from app.db.init_db import reset_db; reset_db()"`

### CORS errors
- Ensure frontend is running on `http://localhost:3000`
- Check CORS settings in `app/main.py`

## Development Notes

### Background Tasks
The current implementation uses synchronous processing for OCR. To enable background tasks:

1. Use FastAPI `BackgroundTasks`:
   ```python
   from fastapi import BackgroundTasks
   
   @router.post("/ocr")
   async def process_ocr(background_tasks: BackgroundTasks, ...):
       background_tasks.add_task(run_ocr_async, document_id)
       return {"status": "processing", "job_id": job_id}
   ```

2. Or use Celery for more complex task queues (requires Redis/RabbitMQ).

### Extending Parsers
The parser service uses rule-based extraction. To add ML-based parsing:

1. Add a new method in `parser_service.py`
2. Integrate with a model (e.g., spaCy NER, transformers)
3. Update the `parse()` method to route to the new parser

### Custom LLM Integration
To add support for other LLM runtimes:

1. Extend `LLMClient` in `llm_client.py`
2. Add a new mode (e.g., `ollama`, `vllm`)
3. Implement the `_generate_*` method for that mode

## License

This project is for local development and demo purposes.


