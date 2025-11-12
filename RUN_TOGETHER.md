# Running Frontend + Ollama (models2) Together

## Quick Start - 3 Steps

### Step 1: Install Ollama and DeepSeek Model

```bash
# Install Ollama from https://ollama.com
# Then install DeepSeek model:
ollama pull deepseek-chat:7b
```

### Step 2: Configure Frontend

Create `frontend/.env` file:

```bash
cd frontend
cat > .env << EOF
VITE_LLM_MODE=ollama
VITE_USE_OLLAMA_SERVICE=false
VITE_OLLAMA_URL=http://localhost:11434
VITE_OLLAMA_MODEL=deepseek-chat:7b
EOF
```

### Step 3: Start Frontend

```bash
npm run dev
```

**That's it!** Open http://localhost:3000 and start chatting with DeepSeek!

## Option 2: Using Ollama Service (Port 5006)

If you prefer using the service layer:

### Step 1: Install Ollama and Model

```bash
ollama pull deepseek-chat:7b
```

### Step 2: Start Ollama Service

```bash
cd models2
pip install -r requirements.txt
python -m services.ollama_service
```

Service runs on http://localhost:5006

### Step 3: Configure and Start Frontend

```bash
cd frontend
cat > .env << EOF
VITE_LLM_MODE=ollama
VITE_USE_OLLAMA_SERVICE=true
VITE_OLLAMA_SERVICE_URL=http://localhost:5006
VITE_OLLAMA_MODEL=deepseek-chat:7b
EOF

npm run dev
```

## Verification

1. **Check Ollama is running:**
   ```bash
   ollama list
   ```

2. **Test Ollama directly:**
   ```bash
   ollama run deepseek-chat:7b "Hello"
   ```

3. **Check service (if using):**
   ```bash
   curl http://localhost:5006/health
   ```

4. **Open frontend:**
   - Go to http://localhost:3000
   - Type a message
   - You should see DeepSeek responses!

## Switching Modes

### Use Ollama (No Backend)
```bash
# In frontend/.env
VITE_LLM_MODE=ollama
```

### Use Backend (Original)
```bash
# In frontend/.env
VITE_LLM_MODE=backend
VITE_API_BASE_URL=http://localhost:8001
```

Then start backend:
```bash
cd backend2 && npm run dev
```

## Troubleshooting

### "Cannot connect to Ollama"
- Make sure Ollama is running: `ollama list`
- Check URL in `.env`: `VITE_OLLAMA_URL=http://localhost:11434`
- On Windows, Ollama should auto-start after installation

### "Model not found"
- Install model: `ollama pull deepseek-chat:7b`
- Verify: `ollama list`
- Check model name in `.env`: `VITE_OLLAMA_MODEL=deepseek-chat:7b`

### Frontend shows errors
- Check browser console (F12)
- Verify `.env` file exists in `frontend/` directory
- Restart frontend after changing `.env`

## Port Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Ollama (Direct) | 11434 | http://localhost:11434 |
| Ollama Service | 5006 | http://localhost:5006 |

## Complete Example

```bash
# Terminal 1: Make sure Ollama is running
ollama list

# Terminal 2: Start frontend (if using direct Ollama)
cd frontend
echo "VITE_LLM_MODE=ollama" > .env
echo "VITE_USE_OLLAMA_SERVICE=false" >> .env
npm run dev

# OR Terminal 2: Start service + frontend (if using service)
cd models2
python -m services.ollama_service &
cd ../frontend
echo "VITE_LLM_MODE=ollama" > .env
echo "VITE_USE_OLLAMA_SERVICE=true" >> .env
npm run dev
```

## Next Steps

- See [models2/README.md](./models2/README.md) for full Ollama setup
- See [models2/FRONTEND_INTEGRATION.md](./models2/FRONTEND_INTEGRATION.md) for detailed integration guide

