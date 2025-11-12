# Frontend Integration Guide - Running Frontend + Ollama Together

## Quick Start - Run Both Together

### Option 1: Using Ollama Directly (Simplest - No Service Needed)

1. **Install and Start Ollama:**
   ```bash
   # Install Ollama from https://ollama.com
   # Ollama runs automatically after installation
   
   # Install DeepSeek model
   ollama pull deepseek-chat:7b
   ```

2. **Configure Frontend:**
   ```bash
   cd frontend
   # Create .env file
   echo "VITE_LLM_MODE=ollama" > .env
   echo "VITE_USE_OLLAMA_SERVICE=false" >> .env
   echo "VITE_OLLAMA_URL=http://localhost:11434" >> .env
   echo "VITE_OLLAMA_MODEL=deepseek-chat:7b" >> .env
   ```

3. **Start Frontend:**
   ```bash
   npm run dev
   ```

4. **That's it!** Frontend will call Ollama directly on port 11434.

### Option 2: Using Ollama Service (Port 5006)

1. **Install and Start Ollama:**
   ```bash
   # Install Ollama from https://ollama.com
   ollama pull deepseek-chat:7b
   ```

2. **Start Ollama Service:**
   ```bash
   cd models2
   pip install -r requirements.txt
   python -m services.ollama_service
   # Service runs on http://localhost:5006
   ```

3. **Configure Frontend:**
   ```bash
   cd frontend
   # Create .env file
   echo "VITE_LLM_MODE=ollama" > .env
   echo "VITE_USE_OLLAMA_SERVICE=true" >> .env
   echo "VITE_OLLAMA_SERVICE_URL=http://localhost:5006" >> .env
   echo "VITE_OLLAMA_MODEL=deepseek-chat:7b" >> .env
   ```

4. **Start Frontend:**
   ```bash
   npm run dev
   ```

## Complete Setup Steps

### Step 1: Install Ollama

**Windows:**
- Download from https://ollama.com/download
- Run installer
- Ollama starts automatically

**Linux/Mac:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Step 2: Install DeepSeek Model

```bash
ollama pull deepseek-chat:7b
```

Verify installation:
```bash
ollama list
```

### Step 3: Choose Your Setup

#### Setup A: Direct Ollama (No Service)

**Pros:**
- Simplest setup
- One less service to run
- Direct API calls

**Cons:**
- No service layer features
- Direct dependency on Ollama API

**Steps:**
1. Make sure Ollama is running: `ollama list`
2. Create `frontend/.env`:
   ```bash
   VITE_LLM_MODE=ollama
   VITE_USE_OLLAMA_SERVICE=false
   VITE_OLLAMA_URL=http://localhost:11434
   VITE_OLLAMA_MODEL=deepseek-chat:7b
   ```
3. Start frontend: `cd frontend && npm run dev`

#### Setup B: With Ollama Service

**Pros:**
- Service layer for compatibility
- Additional features (health checks, metrics)
- Easier to switch models

**Cons:**
- One more service to run

**Steps:**
1. Start Ollama service:
   ```bash
   cd models2
   pip install -r requirements.txt
   python -m services.ollama_service
   ```
2. Create `frontend/.env`:
   ```bash
   VITE_LLM_MODE=ollama
   VITE_USE_OLLAMA_SERVICE=true
   VITE_OLLAMA_SERVICE_URL=http://localhost:5006
   VITE_OLLAMA_MODEL=deepseek-chat:7b
   ```
3. Start frontend: `cd frontend && npm run dev`

### Step 4: Test the Integration

1. Open browser: http://localhost:3000
2. Type a message in the chat
3. You should see responses from DeepSeek!

## Switching Between Backend and Ollama

### Use Backend Mode (Original)
```bash
# In frontend/.env
VITE_LLM_MODE=backend
VITE_API_BASE_URL=http://localhost:8001
```

Then start backend:
```bash
cd backend2 && npm run dev
```

### Use Ollama Mode (No Backend)
```bash
# In frontend/.env
VITE_LLM_MODE=ollama
VITE_USE_OLLAMA_SERVICE=false  # or true for service
```

No backend needed!

## Troubleshooting

### Frontend can't connect to Ollama

**Error:** "Cannot connect to Ollama"

**Solutions:**
1. Check Ollama is running:
   ```bash
   ollama list
   ```
2. Check Ollama URL in `.env`:
   ```bash
   # Should be http://localhost:11434
   VITE_OLLAMA_URL=http://localhost:11434
   ```
3. Check browser console for CORS errors
4. Try using the service instead:
   ```bash
   VITE_USE_OLLAMA_SERVICE=true
   ```

### Model not found

**Error:** "Model not found"

**Solutions:**
1. Install the model:
   ```bash
   ollama pull deepseek-chat:7b
   ```
2. Verify model exists:
   ```bash
   ollama list
   ```
3. Check model name in `.env`:
   ```bash
   VITE_OLLAMA_MODEL=deepseek-chat:7b
   ```

### Service not starting

**Error:** "Cannot connect to Ollama service"

**Solutions:**
1. Check service is running:
   ```bash
   curl http://localhost:5006/health
   ```
2. Check Ollama is running:
   ```bash
   ollama list
   ```
3. Check service logs for errors
4. Try direct Ollama instead:
   ```bash
   VITE_USE_OLLAMA_SERVICE=false
   ```

## Port Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Ollama (Direct) | 11434 | http://localhost:11434 |
| Ollama Service | 5006 | http://localhost:5006 |
| Backend2 | 8001 | http://localhost:8001 |

## Environment Variables Summary

### For Direct Ollama (No Service)
```bash
VITE_LLM_MODE=ollama
VITE_USE_OLLAMA_SERVICE=false
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=deepseek-chat:7b
```

### For Ollama Service
```bash
VITE_LLM_MODE=ollama
VITE_USE_OLLAMA_SERVICE=true
VITE_OLLAMA_SERVICE_URL=http://localhost:5006
VITE_OLLAMA_MODEL=deepseek-chat:7b
```

### For Backend Mode (Original)
```bash
VITE_LLM_MODE=backend
VITE_API_BASE_URL=http://localhost:8001
```

## Quick Commands

```bash
# Check Ollama is running
ollama list

# Test Ollama directly
ollama run deepseek-chat:7b "Hello"

# Check service health
curl http://localhost:5006/health

# Check frontend is running
curl http://localhost:3000
```

## Next Steps

- See [README.md](./README.md) for full Ollama setup
- See [INSTALL_DEEPSEEK.md](./INSTALL_DEEPSEEK.md) for model options
- See [FRONTEND_EXAMPLE.md](./FRONTEND_EXAMPLE.md) for code examples

