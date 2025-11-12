# Model Layer Services

Local, single-user model services for LLM inference, embeddings, and OCR/document vision.

## Overview

This directory contains three standalone HTTP services:

1. **LLM Inference Service** (port 5005) - Text generation with streaming support
2. **Embedding Service** (port 8100) - Text to embedding vectors
3. **OCR/Document Vision Service** (port 8200) - OCR and table extraction

All services run locally, support CPU and GPU modes, and expose simple HTTP endpoints.

## Quick Start

### Prerequisites

- Python 3.9+
- 16GB+ RAM (for CPU mode)
- 20-50GB free disk space for model files
- Optional: NVIDIA GPU with 8GB+ VRAM for GPU mode

### Installation

1. **Install Python dependencies:**

```bash
cd models
pip install -r requirements.txt
```

2. **Download model weights** (see sections below for each service)

3. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your model paths and settings
```

4. **Start services:**

```bash
# Start all services (recommended for development)
python start_all_services.py

# Or start individually:
python services/llm_service.py
python services/embedding_service.py
python services/ocr_service.py
```

## Service Details

### 1. LLM Inference Service

**Default Port:** 5005

**Endpoints:**
- `POST /infer` - Generate text from prompt
- `GET /health` - Health check
- `POST /tokenize` - Tokenize text (optional)

**Model Options:**

**CPU/Lightweight:**
- Use llama.cpp with quantized GGUF models
- Recommended: LLaMA-2 7B Q4_K_M or Q4_0
- Download from Hugging Face: https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF
- Place `.gguf` file in `models/llm/` directory

**GPU/High Quality:**
- Use vLLM or text-generation-webui
- Recommended: Mistral 7B or LLaMA-2 13B
- See GPU setup instructions below

**Setup Steps:**

1. **For CPU (llama.cpp):**
   ```bash
   # Download llama.cpp
   git clone https://github.com/ggerganov/llama.cpp.git
   cd llama.cpp
   make  # or cmake build for Windows
   
   # Download quantized model
   # Place in models/llm/llama-2-7b-chat.Q4_K_M.gguf
   
   # Set environment variable
   export LLM_MODEL_PATH=models/llm/llama-2-7b-chat.Q4_K_M.gguf
   export LLM_BACKEND=llamacpp
   ```

2. **For GPU (vLLM):**
   ```bash
   pip install vllm
   # Download model from Hugging Face
   export LLM_MODEL_PATH=mistralai/Mistral-7B-Instruct-v0.2
   export LLM_BACKEND=vllm
   export LLM_GPU_ENABLED=true
   ```

**Example Request:**
```json
{
  "prompt": "SYSTEM: You are a helpful assistant.\n\nUSER: What is AI?",
  "max_tokens": 256,
  "temperature": 0.7,
  "stream": false,
  "stop": ["\n\n"]
}
```

**Example Response:**
```json
{
  "id": "req_abc123",
  "reply": "AI stands for Artificial Intelligence...",
  "usage": {
    "input_tokens": 20,
    "output_tokens": 45
  }
}
```

### 2. Embedding Service

**Default Port:** 8100

**Endpoints:**
- `POST /embed` - Generate embeddings for text(s)
- `GET /health` - Health check

**Model Options:**

- **CPU/Fast:** `all-MiniLM-L6-v2` (384 dims, default)
- **Better Quality:** `all-mpnet-base-v2` (768 dims)
- **GPU/High Quality:** `multi-qa-mpnet-base-dot-v1`

Models are auto-downloaded from Hugging Face on first use.

**Setup:**

```bash
pip install sentence-transformers
export EMBED_MODEL_NAME=all-MiniLM-L6-v2
# Or for better quality:
export EMBED_MODEL_NAME=all-mpnet-base-v2
```

**Example Request:**
```json
{
  "texts": ["Total debit: 10,234.50", "Account number ****1234"]
}
```

**Example Response:**
```json
{
  "vectors": [[0.001, -0.23, ...], [0.1, 0.02, ...]],
  "dims": 384
}
```

### 3. OCR/Document Vision Service

**Default Port:** 8200

**Endpoints:**
- `POST /ocr` - Process document (multipart form or JSON with file path)
- `GET /health` - Health check

**Model Options:**

- **CPU/General:** EasyOCR (default, auto-downloads)
- **Better Quality:** PaddleOCR (requires manual download)
- **Table Extraction:** Camelot-py (for PDFs)

**Setup:**

```bash
# EasyOCR (default, CPU-friendly)
pip install easyocr

# For better quality (optional)
pip install paddlepaddle paddleocr

# For table extraction
pip install camelot-py[cv]
# Also requires: pip install opencv-python

# For PDF processing
pip install pdf2image
# Windows: Download poppler from https://github.com/oschwartz10612/poppler-windows/releases
```

**Example Request:**
```bash
curl -X POST http://localhost:8200/ocr \
  -F "document_id=doc_12345" \
  -F "file=@/path/to/document.pdf"
```

**Example Response:**
```json
{
  "document_id": "doc_12345",
  "raw_text_blocks": [
    {
      "page": 1,
      "bbox": [10, 20, 100, 30],
      "text": "Total debit: 10,234.50"
    }
  ],
  "tables": [
    {
      "page": 1,
      "rows": [
        ["Date", "Desc", "Debit", "Credit"],
        ["2025-09-01", "Payment", "10234.50", ""]
      ]
    }
  ],
  "structured_json": {
    "account_last4": "1234",
    "transactions": [...]
  }
}
```

## Configuration

All services use environment variables. See `.env.example` for all options:

```bash
# LLM Service
LLM_PORT=5005
LLM_MODEL_PATH=models/llm/llama-2-7b-chat.Q4_K_M.gguf
LLM_BACKEND=llamacpp  # or vllm, webui
LLM_GPU_ENABLED=false
LLM_MAX_CONCURRENT=2
LLM_TIMEOUT=60
LLM_AUTH_TOKEN=  # Optional, leave empty to disable

# Embedding Service
EMBED_PORT=8100
EMBED_MODEL_NAME=all-MiniLM-L6-v2
EMBED_GPU_ENABLED=false
EMBED_MAX_CONCURRENT=10
EMBED_AUTH_TOKEN=

# OCR Service
OCR_PORT=8200
OCR_BACKEND=easyocr  # or paddleocr
OCR_GPU_ENABLED=false
OCR_MAX_CONCURRENT=3
OCR_AUTH_TOKEN=
```

## Hardware Requirements

### Minimum (CPU Demo)
- Quad-core CPU
- 16GB RAM
- 20-50GB free disk space
- Quantized 7B models (Q4_K_M)

### Recommended (GPU)
- NVIDIA GPU with 8-12GB VRAM (7B models)
- 24GB+ VRAM for 13B/70B models
- 32GB+ system RAM

## Quantization Guide

For CPU inference, use quantized GGUF models:

- **Q4_0 / Q4_K_M**: Good speed/quality tradeoff (recommended for CPU)
- **Q5_K_M**: Better quality, slower
- **Q6_K**: Best quality, slowest

Conversion tools:
- Use `llama.cpp/convert.py` to convert HF models to GGUF
- Or download pre-quantized models from Hugging Face

## Security & Licensing

- **No auto-downloads**: Models must be manually downloaded
- **Local only**: Services bind to localhost by default
- **Optional auth**: Set `*_AUTH_TOKEN` for basic protection
- **PII masking**: Utilities included for masking sensitive data
- **Model licenses**: Check individual model licenses (LLaMA-2 requires Meta license acceptance)

## Troubleshooting

### LLM Service

**Issue:** Service fails to start
- Check model path is correct
- Verify model file exists and is readable
- Check logs in `logs/llm_service.log`

**Issue:** Slow inference
- Use quantized models (Q4_K_M) for CPU
- Enable GPU if available
- Reduce `max_tokens` parameter

### Embedding Service

**Issue:** Model download fails
- Check internet connection
- Models download from Hugging Face on first use
- Manually download and place in cache if needed

### OCR Service

**Issue:** EasyOCR fails
- Install system dependencies (see EasyOCR docs)
- Try CPU mode: `OCR_GPU_ENABLED=false`

**Issue:** Table extraction fails
- Install Camelot dependencies: `pip install camelot-py[cv]`
- For PDFs, ensure poppler is installed

## Testing

Run tests:

```bash
# Unit tests (mock mode, no models required)
pytest tests/unit/

# Integration tests (requires services running)
pytest tests/integration/

# Smoke test (quick health check)
python tests/smoke_test.py
```

## Monitoring

Each service exposes metrics at `/metrics`:

```bash
curl http://localhost:5005/metrics
```

Metrics include:
- Request count
- Average latency
- Error count
- Memory usage
- Model version

## Development

### Project Structure

```
models/
├── services/
│   ├── llm_service.py          # LLM inference service
│   ├── embedding_service.py     # Embedding service
│   └── ocr_service.py           # OCR service
├── utils/
│   ├── tokenization.py          # Tokenization utilities
│   ├── pii_masking.py           # PII masking utilities
│   └── prompt_templates.py     # RAG prompt templates
├── prompts/
│   ├── system_templates/        # System instruction templates
│   └── examples/                # Example prompts
├── tests/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── smoke_test.py            # Smoke test
├── .env.example                 # Environment template
├── requirements.txt             # Python dependencies
├── start_all_services.py        # Start all services
└── README.md                    # This file
```

### Adding New Models

1. Download model weights to appropriate directory
2. Update `.env` with model path
3. Restart service
4. Verify with `/health` endpoint

## License

Check individual model licenses:
- **LLaMA-2**: Requires Meta license acceptance
- **Mistral**: Apache 2.0
- **sentence-transformers**: Apache 2.0
- **EasyOCR**: Apache 2.0

## Support

For issues:
1. Check logs in `logs/` directory
2. Verify model files are correct
3. Check hardware requirements
4. Review troubleshooting section above





