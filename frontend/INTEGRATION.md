# Frontend-Backend Integration Guide

This document explains how the React frontend is connected to the Fastify backend (backend2).

## API Configuration

The frontend is configured to connect to `backend2` (Fastify) by default on port `8001`.

### Configuration Files

- **`src/utils/apiConfig.js`** - Centralized API configuration
  - Default base URL: `http://localhost:8001`
  - Can be overridden with environment variable: `VITE_API_BASE_URL`

### Environment Variables

Create a `.env` file in the `frontend/` directory to customize the API URL:

```bash
# .env
VITE_API_BASE_URL=http://localhost:8001
```

To switch to the Python backend instead:
```bash
VITE_API_BASE_URL=http://localhost:8000
```

## API Service

**`src/utils/api.js`** - Contains all API functions:

- `uploadDocument(file, docType)` - Upload a file
- `processOCR(documentId, parseTables)` - Process OCR
- `searchDocuments(query, topK)` - Search documents
- `sendChatMessage(chatId, message, useRetrieval, topK)` - Send chat message
- `getChats()` - Get all chats
- `getChatMessages(chatId, page, pageSize)` - Get chat messages
- `clearCache()` - Clear embeddings cache
- `healthCheck()` - Health check

## Component Integration

### ChatBox Component
- Uses `sendChatMessage()` API to send messages to backend
- Automatically enables document retrieval if search feature is enabled
- Shows error messages if LLM service is not available

### ChatInput Component
- Uses `uploadDocument()` API for file uploads
- Uses `processOCR()` API for OCR processing
- Automatically runs OCR if OCR feature is enabled
- Shows upload/OCR progress

### FileUpload Component
- Uses `uploadDocument()` and `processOCR()` APIs
- Handles multiple file uploads
- Shows processing status for each file

### useSearch Hook
- Uses `searchDocuments()` API for semantic search
- Combines local chat search with backend document search
- Handles errors gracefully

## CORS Configuration

The backend2 Fastify server is configured to allow requests from:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

If you're running the frontend on a different port, update `CORS_ORIGIN` in `backend2/.env`.

## Development Setup

1. **Start Backend2:**
   ```bash
   cd backend2
   npm install
   cp .env.example .env
   docker-compose up -d
   npm run prisma:generate
   npm run prisma:push
   npm run dev
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Verify Connection:**
   - Frontend should be on `http://localhost:3000`
   - Backend should be on `http://localhost:8001`
   - Check browser console for any CORS errors

## Error Handling

All API calls include error handling:
- Network errors are caught and displayed to users
- API errors show helpful error messages
- Failed uploads/OCR show error status in UI
- Chat errors show user-friendly messages

## Testing the Integration

1. **Test Upload:**
   - Go to Upload tab or drag file in chat
   - File should upload and show status
   - OCR should run automatically if enabled

2. **Test Chat:**
   - Send a message in chat
   - Should receive response from LLM (if LLM service is running)
   - If LLM not available, shows error message

3. **Test Search:**
   - Go to Search tab
   - Enter a query
   - Should show results from both chats and documents

## Troubleshooting

### CORS Errors
- Check that backend2 is running
- Verify `CORS_ORIGIN` in `backend2/.env` includes frontend URL
- Check browser console for specific CORS error

### API Connection Errors
- Verify backend2 is running on port 8001
- Check `VITE_API_BASE_URL` in frontend `.env` (if set)
- Check browser Network tab for failed requests

### Upload/OCR Errors
- Ensure Python OCR service is running (if using external HTTP mode)
- Check backend2 logs for errors
- Verify file size is within limits (50MB default)

### Chat Errors
- Ensure LLM service is running on port 5005
- Check `LLM_SERVICE_URL` in `backend2/.env`
- Verify LLM service is accessible

