# Frontend-Backend2 Integration Complete ✅

The React frontend has been successfully connected to the Fastify backend (backend2).

## What Was Changed

### 1. New API Service Files
- **`frontend/src/utils/apiConfig.js`** - API configuration (base URL, endpoints)
- **`frontend/src/utils/api.js`** - All API functions (upload, OCR, search, chat, etc.)

### 2. Updated Components
- **`ChatBox.jsx`** - Now uses real chat API instead of mocks
- **`ChatInput.jsx`** - Now uses real upload and OCR APIs
- **`FileUpload.jsx`** - Now uses real upload and OCR APIs
- **`useSearch.js`** - Now uses real search API

### 3. Integration Features
- ✅ File upload to backend2
- ✅ OCR processing via backend2
- ✅ Semantic search via backend2
- ✅ Chat with LLM via backend2
- ✅ Error handling for all API calls
- ✅ Progress indicators for uploads/OCR

## Quick Start

### 1. Start Backend2
```bash
cd backend2
npm install
cp .env.example .env
docker-compose up -d
npm run prisma:generate
npm run prisma:push
# Add pgvector column (see backend2/SETUP.md)
npm run dev
```

Backend2 will run on `http://localhost:8001`

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:3000`

### 3. Test the Integration

1. **Upload a file:**
   - Go to Upload tab or drag file in chat
   - File uploads to backend2
   - OCR runs automatically (if Python OCR service is running)

2. **Send a chat message:**
   - Type a message in chat
   - Message is sent to backend2
   - Response comes from LLM (if LLM service is running)

3. **Search:**
   - Go to Search tab
   - Enter a query
   - Results come from backend2 semantic search

## API Endpoints Used

The frontend calls these backend2 endpoints:

- `POST /api/v1/upload` - Upload documents
- `POST /api/v1/ocr` - Process OCR
- `POST /api/v1/search` - Search documents
- `POST /api/v1/chat` - Chat with LLM
- `GET /api/v1/chats` - List chats (not yet integrated)
- `GET /api/v1/chats/:chat_id/messages` - Get messages (not yet integrated)

## Configuration

### Backend2 CORS
Backend2 is configured to allow requests from:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

If you change the frontend port, update `CORS_ORIGIN` in `backend2/.env`.

### Frontend API URL
Default: `http://localhost:8001`

To change, create `frontend/.env`:
```bash
VITE_API_BASE_URL=http://localhost:8001
```

To switch to Python backend:
```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Dependencies

### Required Services for Full Functionality

1. **PostgreSQL with pgvector** (Required)
   - Started via `docker-compose up -d`
   - Database must be initialized

2. **Python OCR Service** (Optional but recommended)
   - For `/api/v1/ocr` endpoint
   - Should run on `http://localhost:8100`
   - Without it, OCR will fail

3. **Python Embedding Service** (Optional but recommended)
   - For `/api/v1/search` endpoint
   - Should run on `http://localhost:8100`
   - Without it, search will fail

4. **LLM Service** (Optional but recommended)
   - For `/api/v1/chat` endpoint
   - Should run on `http://localhost:5005`
   - Without it, chat will show error message

## Error Handling

All components handle errors gracefully:
- Network errors show user-friendly messages
- API errors display in UI
- Failed uploads/OCR show error status
- Chat errors show helpful messages

## Testing Without External Services

You can test the frontend-backend connection even without Python services:

1. **Upload** - Will work (file saved to backend2)
2. **OCR** - Will fail with error message (expected if Python OCR not running)
3. **Search** - Will fail with error message (expected if embedding service not running)
4. **Chat** - Will show error message (expected if LLM not running)

## Next Steps

1. **Start Python services** for full functionality:
   - OCR service on port 8100
   - Embedding service on port 8100
   - LLM service on port 5005

2. **Sync chat data** (optional):
   - Currently chats are stored in localStorage
   - Can be enhanced to sync with backend2 `/api/v1/chats` endpoint

3. **Add authentication** (optional):
   - Backend2 is ready for API key middleware
   - Frontend can add auth headers

## Troubleshooting

### CORS Errors
- Check backend2 is running
- Verify `CORS_ORIGIN` in `backend2/.env`
- Check browser console for specific error

### API Connection Errors
- Verify backend2 is running: `curl http://localhost:8001/health`
- Check `VITE_API_BASE_URL` in frontend `.env` (if set)
- Check browser Network tab

### Upload/OCR Errors
- Check backend2 logs
- Verify Python OCR service is running (if using external HTTP mode)
- Check file size limits (50MB default)

### Chat Errors
- Verify LLM service is running
- Check `LLM_SERVICE_URL` in `backend2/.env`
- Check backend2 logs for LLM connection errors

## Files Changed

- ✅ `frontend/src/utils/apiConfig.js` (new)
- ✅ `frontend/src/utils/api.js` (new)
- ✅ `frontend/src/components/ChatBox.jsx` (updated)
- ✅ `frontend/src/components/ChatInput.jsx` (updated)
- ✅ `frontend/src/components/FileUpload.jsx` (updated)
- ✅ `frontend/src/hooks/useSearch.js` (updated)
- ✅ `frontend/INTEGRATION.md` (new)

The frontend is now fully integrated with backend2! 🎉

