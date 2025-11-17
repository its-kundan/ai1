# Implementation Notes

This document describes the implementation details and design decisions for the model layer services.

## Architecture Overview

The model layer consists of three independent HTTP microservices:

1. **LLM Inference Service** (`services/llm_service.py`)
   - Text generation with streaming support
   - Supports multiple backends: llama.cpp (CPU), vLLM (GPU), mock (testing)
   - Endpoints: `/infer`, `/health`, `/tokenize`, `/metrics`

2. **Embedding Service** (`services/embedding_service.py`)
   - Text-to-vector conversion using sentence-transformers
   - Supports CPU and GPU modes
   - Endpoints: `/embed`, `/health`, `/metrics`

3. **OCR/Document Vision Service** (`services/ocr_service.py`)
   - Document text and table extraction
   - Supports EasyOCR (default) and PaddleOCR
   - Endpoints: `/ocr`, `/health`, `/metrics`

## Design Decisions

### 1. Service Independence

Each service is completely independent and can run standalone. This allows:
- Individual scaling
- Different hardware requirements per service
- Easy testing and debugging
- Flexible deployment (Docker, systemd, etc.)

### 2. Mock Mode for Testing

All services support a "mock" mode that doesn't require actual models:
- LLM: `LLM_BACKEND=mock` returns mock responses
- Embedding: Works without models (but will fail on actual requests)
- OCR: Requires models but can be tested with health checks

This enables:
- Quick development without downloading large models
- CI/CD testing
- Backend integration testing

### 3. Environment-Based Configuration

All configuration is done via environment variables (`.env` file):
- No hardcoded paths or settings
- Easy deployment across environments
- Clear separation of configuration and code

### 4. PII Masking

PII masking is implemented as a utility (`utils/pii_masking.py`) that can be used:
- In OCR service (optional, via `OCR_MASK_PII=true`)
- In prompt templates (automatic when building RAG prompts)
- By backend services when processing documents

### 5. Tokenization

Tokenization utility (`utils/tokenization.py`) supports:
- Multiple backends: HuggingFace, tiktoken, llama.cpp approximation
- Graceful fallback to character-based approximation
- Used for prompt length management and token counting

### 6. Prompt Templates

RAG prompt templates (`utils/prompt_templates.py`) provide:
- Standardized prompt structure
- Automatic PII masking in contexts
- Chat history truncation
- Configurable system instructions

## Backend Integration

### LLM Service Integration

Backends should call the LLM service like this:

```python
import httpx

async with httpx.AsyncClient() as client:
    response = await client.post(
        "http://localhost:5005/infer",
        json={
            "prompt": "Your prompt here",
            "max_tokens": 256,
            "temperature": 0.7,
            "stream": False
        }
    )
    result = response.json()
```

### Embedding Service Integration

```python
response = await client.post(
    "http://localhost:8100/embed",
    json={"texts": ["text1", "text2"]}
)
result = response.json()
vectors = result["vectors"]  # List of embedding vectors
```

### OCR Service Integration

```python
with open("document.pdf", "rb") as f:
    response = await client.post(
        "http://localhost:8200/ocr",
        data={
            "document_id": "doc_123",
            "file": f
        }
    )
result = response.json()
text_blocks = result["raw_text_blocks"]
tables = result["tables"]
```

## Model Download Instructions

### LLM Models

1. **For CPU (llama.cpp):**
   - Download quantized GGUF models from Hugging Face
   - Recommended: LLaMA-2 7B Q4_K_M
   - Place in `models/llm/` directory
   - Set `LLM_MODEL_PATH` in `.env`

2. **For GPU (vLLM):**
   - Download models from Hugging Face (HF format)
   - Recommended: Mistral 7B or LLaMA-2 13B
   - Set `LLM_MODEL_PATH` to Hugging Face model ID or path
   - Set `LLM_BACKEND=vllm`

### Embedding Models

- Models auto-download from Hugging Face on first use
- Default: `all-MiniLM-L6-v2` (384 dims, fast)
- Better quality: `all-mpnet-base-v2` (768 dims)
- Set `EMBED_MODEL_NAME` in `.env`

### OCR Models

- EasyOCR: Auto-downloads on first use
- PaddleOCR: Auto-downloads on first use
- No manual download required

## Performance Considerations

### CPU Mode

- Use quantized models (Q4_K_M or Q4_0)
- Limit concurrent requests (`LLM_MAX_CONCURRENT=2`)
- Acceptable latency: 2-5 seconds per request for 7B models

### GPU Mode

- Use FP16 or bf16 models
- Higher concurrency possible
- Lower latency: 0.5-2 seconds per request

### Embedding Service

- Fast on CPU for small batches (< 100 texts)
- GPU recommended for large batches (> 1000 texts)
- Batch processing is automatic

### OCR Service

- CPU mode works but slower (10-30s per page)
- GPU mode significantly faster (2-5s per page)
- Table extraction adds overhead

## Security Considerations

1. **Local-only by default**: Services bind to `127.0.0.1` (localhost)
2. **Optional authentication**: Set `*_AUTH_TOKEN` in `.env` for basic protection
3. **PII masking**: Available in OCR and prompt templates
4. **No telemetry**: No external requests by default
5. **Model verification**: Users should verify model checksums

## Testing Strategy

1. **Unit tests**: Test utilities (PII masking, tokenization) without services
2. **Smoke tests**: Quick health checks of running services
3. **Integration tests**: Full workflow tests (requires services running)
4. **Mock mode**: Test backends without models

## Deployment Options

1. **Local development**: `python start_all_services.py`
2. **Docker**: `docker-compose up`
3. **Systemd** (Linux): Create service files (see examples in README)
4. **PM2** (Node.js): Use PM2 ecosystem file
5. **Kubernetes**: Deploy as separate pods with service definitions

## Known Limitations

1. **LLM streaming**: Currently basic SSE implementation; can be enhanced
2. **OCR table extraction**: Camelot requires specific PDF formats
3. **Model loading**: Large models take time to load on startup
4. **Memory usage**: 7B models require 4-8GB RAM in CPU mode
5. **Concurrency**: Limited by model backend capabilities

## Future Enhancements

- [ ] vLLM backend implementation
- [ ] text-generation-webui integration
- [ ] Advanced reranking for RAG
- [ ] Model caching and versioning
- [ ] Prometheus metrics export
- [ ] OpenTelemetry tracing
- [ ] WebSocket support for streaming
- [ ] Batch processing endpoints
- [ ] Model fine-tuning utilities
- [ ] Multi-language OCR support

## Troubleshooting

See `README.md` for detailed troubleshooting guide. Common issues:

1. **Import errors**: Ensure you're in the `models/` directory or PYTHONPATH is set
2. **Port conflicts**: Change ports in `.env` or stop conflicting services
3. **Model loading fails**: Verify model path and file permissions
4. **GPU not detected**: Check CUDA installation and `nvidia-smi`
5. **Memory errors**: Use quantized models or reduce batch size

## License Notes

- **LLaMA-2**: Requires Meta license acceptance (see Hugging Face model page)
- **Mistral**: Apache 2.0
- **sentence-transformers**: Apache 2.0
- **EasyOCR**: Apache 2.0
- **Service code**: Check project license

Always verify model licenses before commercial use.







