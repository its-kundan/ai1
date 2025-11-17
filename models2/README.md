# Models2 - Ollama + DeepSeek

This directory contains an Ollama-based LLM service that connects directly to Ollama API. **No backend is required** - the frontend can call this service directly, or even call Ollama API directly.

## Quick Start

### 1. Install Ollama

Download and install Ollama from: https://ollama.com

**Windows:**
- Download installer from https://ollama.com/download
- Run the installer
- Ollama will start automatically

**Linux/Mac:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Install DeepSeek Model

**Available DeepSeek Models in Ollama:**

- **`deepseek-v2:16b`** - Recommended for general purpose chat (16B parameters, ~8.9GB)
  ```bash
  ollama pull deepseek-v2:16b
  ```

- **`deepseek-v2:236b`** - Larger model for advanced tasks (236B parameters, very large)
  ```bash
  ollama pull deepseek-v2:236b
  ```

**Note:** These models require Ollama version 0.1.40 or later. Check your version with `ollama --version`.

**Model Comparison:**

| Model | Size | Best For | Context | Requirements |
|-------|------|----------|---------|--------------|
| `deepseek-v2:16b` | ~8.9GB | General chat, balanced quality | 64K | Ollama 0.1.40+ |
| `deepseek-v2:236b` | Very Large | Advanced tasks, highest quality | 64K | Ollama 0.1.40+, High-end hardware |

**Alternative Models (if DeepSeek unavailable):**

If you encounter network issues or prefer smaller models, try these alternatives:

```bash
ollama pull llama2        # 3.8GB - General purpose, proven stable
ollama pull mistral       # 4.1GB - High quality, fast
ollama pull gemma2:2b     # 1.4GB - Lightweight option
```

**Note:** If you encounter network timeout errors or "file does not exist" errors, see the [Troubleshooting](#model-not-found--network-timeout-errors) section below.

### 3. Verify Installation

```bash
# Check Ollama is running
ollama list

# Test the model
ollama run deepseek-v2:16b "Hello, how are you?"
# Or if using alternative:
ollama run llama2 "Hello, how are you?"
```

### 4. Start the Service

```bash
cd models2
pip install -r requirements.txt

# Set environment variables (optional)
cp .env.example .env
# Edit .env if needed

# Start the service
python -m services.ollama_service
```

The service will run on `http://localhost:5006` by default.

### 5. Test the Service

```bash
# Health check
curl http://localhost:5006/health

# Generate text
curl -X POST http://localhost:5006/infer \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain quantum computing in simple terms",
    "max_tokens": 200,
    "temperature": 0.7
  }'
```

## Direct Frontend Integration

Since Ollama provides a REST API, your frontend can call it **directly** without any backend:

### Option 1: Call Ollama Directly (No Service Needed)

```javascript
// Frontend code - direct Ollama API call
const response = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-v2:16b',
    prompt: 'Your question here',
    stream: false
  })
});

const data = await response.json();
console.log(data.response);
```

### Option 2: Use the Service (Compatible with Existing API)

```javascript
// Frontend code - using the service
const response = await fetch('http://localhost:5006/infer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Your question here',
    max_tokens: 200,
    temperature: 0.7
  })
});

const data = await response.json();
console.log(data.reply);
```

## Configuration

Create a `.env` file in `models2/` directory:

```bash
# Ollama Service Configuration
OLLAMA_PORT=5006
OLLAMA_HOST=127.0.0.1
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL_NAME=deepseek-v2:16b
OLLAMA_TIMEOUT=120
OLLAMA_AUTH_TOKEN=  # Optional, leave empty to disable
```

## API Endpoints

### POST /infer
Compatible with `models/llm_service` API format.

**Request:**
```json
{
  "prompt": "Your prompt here",
  "max_tokens": 256,
  "temperature": 0.7,
  "stream": false,
  "stop": []
}
```

**Response:**
```json
{
  "id": "req_abc123",
  "reply": "Generated text...",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 50
  }
}
```

### POST /chat
Native Ollama chat API format.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "model": "deepseek-chat:7b",
  "stream": false,
  "temperature": 0.7
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "model": "deepseek-chat:7b",
  "ollama_url": "http://localhost:11434",
  "ollama_connected": true
}
```

### GET /models
List all available Ollama models.

## Why DeepSeek?

- **Open Source**: Apache 2.0 license
- **High Quality**: Competitive with proprietary models
- **Efficient**: 7B parameters, runs well on consumer hardware
- **Fast**: Optimized inference with Ollama
- **Multilingual**: Supports multiple languages
- **Free**: No API costs, runs locally

## Hardware Requirements

### Minimum (CPU)
- 8GB RAM
- 4GB free disk space (for 7B model)
- Modern CPU (4+ cores recommended)

### Recommended (GPU)
- NVIDIA GPU with 6GB+ VRAM
- 16GB+ system RAM
- CUDA support

Ollama automatically uses GPU if available, otherwise falls back to CPU.

## Troubleshooting

### Ollama not found
```bash
# Check if Ollama is installed
ollama --version

# If not installed, download from https://ollama.com
```

### Model not found / Network timeout errors

If you get errors like `Error: pull model manifest: file does not exist` or `i/o timeout`:

**1. Check your internet connection:**
```bash
# Test connectivity to Ollama registry
curl -I https://registry.ollama.ai
```

**2. Try alternative model names:**
The correct DeepSeek model names in Ollama are:
```bash
# DeepSeek V2 models (requires Ollama 0.1.40+)
ollama pull deepseek-v2:16b      # Recommended: 16B model (~8.9GB)
ollama pull deepseek-v2:236b     # Large model for advanced tasks

# If DeepSeek models fail, try these alternatives:
ollama pull llama2        # Test with known working model first
ollama pull mistral       # Another alternative
ollama pull gemma2:2b    # Lightweight option
```

**Note:** The older model names like `deepseek-chat:7b` and `deepseek-r1:7b` are not available in Ollama's library. Use `deepseek-v2:16b` instead.

**3. Check Ollama version:**
```bash
ollama --version
# Update to latest if needed: https://ollama.com/download
```

**4. Network/Proxy issues:**
If behind a firewall or proxy:
```bash
# Set proxy environment variables (if needed)
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port

# Then retry
ollama pull deepseek-v2:16b
```

**5. Retry with longer timeout:**
Network issues may be temporary. Simply retry:
```bash
ollama pull deepseek-v2:16b
# If it fails, wait a few minutes and try again
# Large models (8.9GB+) may take 30+ minutes to download
```

**6. Verify model availability:**
Check Ollama's library website for current model names:
- https://ollama.com/library
- Search for "deepseek" to see available models

**7. Use a working model temporarily:**
If DeepSeek models are unavailable, you can use other models:
```bash
ollama pull llama2        # 3.8GB - General purpose
ollama pull mistral       # 4.1GB - High quality
ollama pull gemma2:2b    # 1.4GB - Lightweight
```

Then update your `.env` file:
```bash
OLLAMA_MODEL_NAME=llama2  # or mistral, gemma2:2b, etc.
```

### Service can't connect to Ollama
- Make sure Ollama is running: `ollama list` should work
- Check Ollama URL in `.env`: default is `http://localhost:11434`
- On Windows, Ollama should start automatically after installation
- Restart Ollama service if needed:
  ```bash
  # Windows: Restart from Services or Task Manager
  # Linux/Mac: 
  sudo systemctl restart ollama
  ```

### Slow responses
- Use GPU if available (Ollama auto-detects)
- Try a smaller model or reduce `max_tokens`
- Check system resources (CPU/RAM usage)

## Comparison with models/ Service

| Feature | models/ (llama.cpp) | models2/ (Ollama) |
|---------|---------------------|-------------------|
| Setup | Manual model download | `ollama pull` |
| Backend Required | Yes | No (direct API) |
| Model Management | Manual | Automatic via Ollama |
| GPU Support | Manual config | Auto-detected |
| Model Switching | Restart service | Change model name |
| API Compatibility | Custom | Ollama standard |

## License

DeepSeek models are open source (Apache 2.0). Ollama is MIT licensed.

## Support

- Ollama docs: https://github.com/ollama/ollama
- DeepSeek models: https://huggingface.co/deepseek-ai
- Service issues: Check logs in console output

