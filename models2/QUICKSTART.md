# Quick Start Guide - Ollama + DeepSeek

## 5-Minute Setup

### Step 1: Install Ollama
```bash
# Windows: Download from https://ollama.com/download
# Linux/Mac:
curl -fsSL https://ollama.com/install.sh | sh
```

### Step 2: Install DeepSeek Model
```bash
ollama pull deepseek-chat:7b
```

### Step 3: Start Service
```bash
cd models2
pip install -r requirements.txt
python -m services.ollama_service
```

### Step 4: Test
```bash
curl http://localhost:5006/health
```

## Frontend Integration

### Direct Ollama API (No Service Needed)
```javascript
fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-chat:7b',
    prompt: 'Hello!',
    stream: false
  })
})
.then(r => r.json())
.then(data => console.log(data.response));
```

### Using the Service
```javascript
fetch('http://localhost:5006/infer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Hello!',
    max_tokens: 200
  })
})
.then(r => r.json())
.then(data => console.log(data.reply));
```

## Recommended Model

**`deepseek-chat:7b`** - Best balance of quality, speed, and size (4.1GB)

Alternative: **`deepseek-r1:7b`** - Better for reasoning tasks

