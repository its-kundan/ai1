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

We recommend **`deepseek-chat:7b`** for general purpose chat:

```bash
ollama pull deepseek-chat:7b
```

**Alternative DeepSeek Models:**

- **`deepseek-r1:7b`** - Better reasoning capabilities (recommended for complex tasks)
  ```bash
  ollama pull deepseek-r1:7b
  ```

- **`deepseek-coder:6.7b`** - Optimized for coding tasks
  ```bash
  ollama pull deepseek-coder:6.7b
  ```

- **`deepseek-chat:32k`** - Longer context window (if you need to process long documents)
  ```bash
  ollama pull deepseek-chat:32k
  ```

**Model Comparison:**

| Model | Size | Best For | Context |
|-------|------|----------|---------|
| `deepseek-chat:7b` | 4.1GB | General chat, balanced | 16K |
| `deepseek-r1:7b` | 4.1GB | Reasoning, complex tasks | 16K |
| `deepseek-coder:6.7b` | 3.8GB | Code generation, debugging | 16K |
| `deepseek-chat:32k` | 4.1GB | Long documents, extended context | 32K |

### 3. Verify Installation

```bash
# Check Ollama is running
ollama list

# Test the model
ollama run deepseek-chat:7b "Hello, how are you?"
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
    model: 'deepseek-chat:7b',
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
OLLAMA_MODEL_NAME=deepseek-chat:7b
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

### Model not found
```bash
# List installed models
ollama list

# Pull the model if missing
ollama pull deepseek-chat:7b
```

### Service can't connect to Ollama
- Make sure Ollama is running: `ollama list` should work
- Check Ollama URL in `.env`: default is `http://localhost:11434`
- On Windows, Ollama should start automatically after installation

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

