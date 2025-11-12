# Installing DeepSeek Models with Ollama

## Recommended Model: `deepseek-chat:7b`

This is the **best choice** for a ChatGPT-like demo:
- ✅ 4.1GB size (manageable)
- ✅ Excellent chat quality
- ✅ Fast inference
- ✅ 16K context window
- ✅ Open source (Apache 2.0)

### Installation

```bash
ollama pull deepseek-chat:7b
```

This will download ~4.1GB. Wait for it to complete.

### Verify Installation

```bash
ollama list
```

You should see `deepseek-chat:7b` in the list.

### Test the Model

```bash
ollama run deepseek-chat:7b "Hello, introduce yourself"
```

## Alternative Models

### 1. `deepseek-r1:7b` (Better Reasoning)

If you need better reasoning capabilities:

```bash
ollama pull deepseek-r1:7b
```

**Use when:**
- Complex problem solving
- Multi-step reasoning
- Mathematical/logical tasks

### 2. `deepseek-coder:6.7b` (Coding Focus)

Optimized for code generation:

```bash
ollama pull deepseek-coder:6.7b
```

**Use when:**
- Code generation
- Debugging
- Code explanation

### 3. `deepseek-chat:32k` (Long Context)

For processing very long documents:

```bash
ollama pull deepseek-chat:32k
```

**Use when:**
- Processing long documents
- Extended conversations
- Large context needs

## Model Comparison

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| `deepseek-chat:7b` | 4.1GB | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **General chat (Recommended)** |
| `deepseek-r1:7b` | 4.1GB | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Complex reasoning |
| `deepseek-coder:6.7b` | 3.8GB | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Code tasks |
| `deepseek-chat:32k` | 4.1GB | ⭐⭐⭐ | ⭐⭐⭐⭐ | Long documents |

## Switching Models

After installing multiple models, you can switch by updating `.env`:

```bash
# In models2/.env
OLLAMA_MODEL_NAME=deepseek-r1:7b  # Change this
```

Or specify in API calls:

```javascript
fetch('http://localhost:5006/infer', {
  method: 'POST',
  body: JSON.stringify({
    prompt: '...',
    model: 'deepseek-r1:7b'  // Override default
  })
})
```

## System Requirements

### Minimum (CPU)
- **RAM**: 8GB (16GB recommended)
- **Disk**: 5GB free space per model
- **CPU**: 4+ cores recommended

### Recommended (GPU)
- **VRAM**: 6GB+ (NVIDIA)
- **RAM**: 16GB+
- **Disk**: 5GB free space per model

Ollama automatically uses GPU if available!

## Troubleshooting

### Model download fails
```bash
# Check internet connection
# Try again
ollama pull deepseek-chat:7b

# Check available space
df -h  # Linux/Mac
```

### Model not found after installation
```bash
# List all models
ollama list

# If missing, reinstall
ollama pull deepseek-chat:7b
```

### Out of memory
- Close other applications
- Use a smaller model
- Reduce `max_tokens` in requests
- Consider using CPU mode (slower but uses less VRAM)

## Next Steps

1. ✅ Install Ollama: https://ollama.com
2. ✅ Install model: `ollama pull deepseek-chat:7b`
3. ✅ Start service: `python -m services.ollama_service`
4. ✅ Test: `curl http://localhost:5006/health`

See [README.md](./README.md) for full setup instructions.

