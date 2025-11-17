# Quick Start Guide - Model Layer Services

This guide will help you get the model services running quickly for local development.

## Prerequisites

- Python 3.9+
- 16GB+ RAM (for CPU mode)
- 20-50GB free disk space for model files
- Optional: NVIDIA GPU with 8GB+ VRAM for GPU mode

## Step 1: Install Dependencies

```bash
cd models
pip install -r requirements.txt
```

## Step 2: Configure Environment

```bash
# Copy example environment file
cp env.example .env

# Edit .env with your settings (optional for testing)
# For testing without models, LLM_BACKEND=mock is already set
```

## Step 3: Start Services (Mock Mode - No Models Required)

For quick testing without downloading models:

```bash
# Start all services in mock mode
python start_all_services.py
```

This will start:
- LLM Service on http://localhost:5005 (mock mode)
- Embedding Service on http://localhost:8100
- OCR Service on http://localhost:8200

## Step 4: Verify Services

In another terminal:

```bash
# Run smoke test
python tests/smoke_test.py

# Or test manually:
curl http://localhost:5005/health
curl http://localhost:8100/health
curl http://localhost:8200/health
```

## Step 5: Test Endpoints

### LLM Service (Mock)

```bash
curl -X POST http://localhost:5005/infer \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello, how are you?",
    "max_tokens": 50,
    "temperature": 0.7,
    "stream": false
  }'
```

### Embedding Service

```bash
curl -X POST http://localhost:8100/embed \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["Hello world", "Test embedding"]
  }'
```

### OCR Service

```bash
# Upload a document (requires a file)
curl -X POST http://localhost:8200/ocr \
  -F "document_id=test_doc" \
  -F "file=@/path/to/document.pdf"
```

## Next Steps: Using Real Models

### LLM Service with Real Model

1. **Download a quantized model:**
   - Visit: https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF
   - Download a Q4_K_M or Q4_0 quantized model
   - Place in `models/llm/` directory

2. **Update .env:**
   ```bash
   LLM_MODEL_PATH=models/llm/llama-2-7b-chat.Q4_K_M.gguf
   LLM_BACKEND=llamacpp
   LLM_GPU_ENABLED=false  # Set to true if you have GPU
   ```

3. **Restart LLM service:**
   ```bash
   python services/llm_service.py
   ```

### Embedding Service

The embedding service auto-downloads models on first use. No manual download needed!

### OCR Service

The OCR service auto-downloads EasyOCR models on first use. No manual download needed!

## Running Tests

```bash
# Unit tests (no services required)
pytest tests/test_pii_masking.py
pytest tests/test_tokenization.py

# Smoke tests (requires services running)
pytest tests/smoke_test.py
# Or
python tests/smoke_test.py
```

## Troubleshooting

### Service won't start

- Check if port is already in use: `netstat -an | grep <port>`
- Check logs for errors
- Verify Python version: `python --version` (should be 3.9+)

### Import errors

- Make sure you're in the `models/` directory
- Verify dependencies: `pip list | grep fastapi`
- Try: `pip install -r requirements.txt --upgrade`

### Model loading fails

- Verify model path in `.env` is correct
- Check file permissions
- For llama.cpp, ensure model is in GGUF format

## Production Deployment

For production, consider:
- Using Docker (see `docker-compose.yml`)
- Setting authentication tokens in `.env`
- Using GPU if available
- Setting up proper logging and monitoring
- Using a process manager (systemd, pm2, etc.)

See `README.md` for detailed documentation.







