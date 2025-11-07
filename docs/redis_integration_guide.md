# Redis Integration Guide

This guide explains how to integrate Redis caching into both the Python backend (`backend/`) and Node.js backend (`backend2/`).

## Overview

Redis is used as an ephemeral cache layer for:
- **Chat session context** - Fast access to recent messages for building LLM prompts
- **LLM response cache** - Avoid re-running identical prompts
- **Embeddings cache** - Cache frequently-used embeddings to reduce API calls
- **Job status** - Track background OCR/processing job progress
- **Distributed locks** - Prevent concurrent operations on shared resources
- **Feature flags** - User preferences and session settings

**Important**: Redis is a cache accelerator, not the source of truth. Always persist authoritative data to:
- Database (PostgreSQL/SQLite)
- File system (`data/parsed/`, `data/ocr_results/`)

## Quick Start

### 1. Start Redis

```bash
# Using docker-compose (recommended)
./scripts/start-redis.sh

# Or manually
docker compose -f docker-compose.redis.yml up -d
```

### 2. Configure Environment

Copy `.env.cache.example` to `.env.cache` and adjust settings:

```bash
cp .env.cache.example .env.cache
```

### 3. Test Connection

```bash
redis-cli -h 127.0.0.1 -p 6379 ping
# Should return: PONG
```

## Python Backend Integration

### Installation

Add Redis dependency to `backend/requirements.txt`:

```
redis>=5.0.0
```

Install:

```bash
cd backend
pip install -r requirements.txt
```

### Usage

#### 1. Import Cache Service

```python
from app.services.redis import get_cache_service

cache = get_cache_service()
```

#### 2. Chat Context Caching

```python
# Add message to chat context
cache.add_chat_message(
    chat_id="chat_1",
    role="user",
    text="What is my account balance?"
)

# Get recent messages for LLM prompt
messages = cache.get_chat_context(chat_id="chat_1", limit=10)
# Returns: [{"role": "user", "text": "...", "timestamp": "..."}, ...]

# Set chat metadata
cache.set_chat_meta("chat_1", {
    "last_active": "2025-01-08T10:00:00Z",
    "model_version": "gpt-4"
})
```

#### 3. LLM Response Caching

```python
# Before calling LLM, check cache
model_version = "gpt-4"
prompt = "What is my account balance?"

cached = cache.get_llm_cache(model_version, prompt)
if cached:
    return cached["reply"]  # Return cached response

# Call LLM
reply = await llm_client.generate(prompt)

# Cache the response
cache.set_llm_cache(
    model_version=model_version,
    prompt=prompt,
    reply=reply,
    used_docs=["doc_12345"]
)
```

#### 4. Embedding Cache

```python
# Check cache before embedding
text = "Account balance query"
cached_embedding = cache.get_embedding_cache(text)

if cached_embedding:
    embedding = cached_embedding
else:
    # Call embedding service
    embedding = await embedding_service.embed(text)
    # Cache it
    cache.set_embedding_cache(text, embedding)
```

#### 5. Job Status Tracking

```python
# Set job status
cache.set_job_status(
    job_id="ocr_job_123",
    status="processing",
    progress=50,
    result_ptr="data/ocr_results/ocr_doc_12345.json"
)

# Poll job status (from client)
status = cache.get_job_status("ocr_job_123")
# Returns: {"status": "processing", "progress": 50, ...}

# Delete after retrieval
cache.delete_job_status("ocr_job_123")
```

#### 6. Distributed Locks

```python
# Acquire lock before reindexing
if cache.acquire_lock("faiss_reindex", timeout=300):
    try:
        # Perform reindex operation
        rebuild_faiss_index()
    finally:
        cache.release_lock("faiss_reindex")
else:
    raise Exception("Another reindex operation is in progress")
```

### Integration with Existing Endpoints

Update `backend/app/api/v1/endpoints.py`:

```python
from app.services.redis import get_cache_service

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, session: Session = Depends(get_session)):
    cache = get_cache_service()
    
    # Get cached context
    cached_messages = cache.get_chat_context(request.chat_id)
    
    # Build prompt with cached context
    messages = [{"role": m["role"], "content": m["text"]} for m in cached_messages]
    messages.append({"role": "user", "content": request.user_message})
    
    # Check LLM cache
    prompt_hash = f"{request.model_version}:{request.user_message}"
    cached_reply = cache.get_llm_cache(request.model_version, request.user_message)
    
    if cached_reply:
        reply = cached_reply["reply"]
    else:
        # Call LLM
        reply = await llm_client.generate(messages)
        # Cache it
        cache.set_llm_cache(request.model_version, request.user_message, reply)
    
    # Add to chat context
    cache.add_chat_message(request.chat_id, "user", request.user_message)
    cache.add_chat_message(request.chat_id, "assistant", reply)
    
    # Also persist to DB (source of truth)
    # ... existing DB save logic ...
    
    return ChatResponse(reply=reply, ...)
```

## Node.js Backend Integration

### Installation

Add Redis dependency to `backend2/package.json`:

```bash
cd backend2
npm install redis
```

### Usage

#### 1. Import Cache Service

```typescript
import { getCacheService } from './services/redis';

const cache = getCacheService();
```

#### 2. Chat Context Caching

```typescript
// Add message to chat context
await cache.addChatMessage('chat_1', 'user', 'What is my account balance?');

// Get recent messages
const messages = await cache.getChatContext('chat_1', 10);

// Set chat metadata
await cache.setChatMeta('chat_1', {
  last_active: new Date().toISOString(),
  model_version: 'gpt-4',
});
```

#### 3. LLM Response Caching

```typescript
const modelVersion = 'gpt-4';
const prompt = 'What is my account balance?';

// Check cache
const cached = await cache.getLLMCache(modelVersion, prompt);
if (cached) {
  return cached.reply;
}

// Call LLM
const reply = await generateChatResponse(systemPrompt, messages, context);

// Cache response
await cache.setLLMCache(modelVersion, prompt, reply, usedDocs);
```

#### 4. Embedding Cache

```typescript
const text = 'Account balance query';

// Check cache
let embedding = await cache.getEmbeddingCache(text);

if (!embedding) {
  // Call embedding service
  embedding = await embeddingService.embed(text);
  // Cache it
  await cache.setEmbeddingCache(text, embedding);
}
```

#### 5. Job Status Tracking

```typescript
// Set job status
await cache.setJobStatus('ocr_job_123', 'processing', 50, 'data/ocr_results/ocr_doc_12345.json');

// Poll status
const status = await cache.getJobStatus('ocr_job_123');

// Delete after retrieval
await cache.deleteJobStatus('ocr_job_123');
```

#### 6. Distributed Locks

```typescript
// Acquire lock
const acquired = await cache.acquireLock('faiss_reindex', 300);
if (!acquired) {
  throw new Error('Another reindex operation is in progress');
}

try {
  // Perform reindex
  await rebuildFaissIndex();
} finally {
  await cache.releaseLock('faiss_reindex');
}
```

### Integration with Existing Routes

Update `backend2/src/routes/v1/chat.ts`:

```typescript
import { getCacheService } from '../../services/redis';

const cache = getCacheService();

fastify.post('/chat', async (request, reply) => {
  const { chat_id, user_message, use_retrieval } = request.body;
  
  // Get cached context
  const cachedMessages = await cache.getChatContext(chat_id);
  
  // Build messages array
  const messages = cachedMessages.map(m => ({
    role: m.role,
    content: m.text,
  }));
  messages.push({ role: 'user', content: user_message });
  
  // Check LLM cache
  const cached = await cache.getLLMCache('default', user_message);
  let assistantReply: string;
  
  if (cached) {
    assistantReply = cached.reply;
  } else {
    // Call LLM
    assistantReply = await generateChatResponse(systemPrompt, messages, context);
    // Cache it
    await cache.setLLMCache('default', user_message, assistantReply);
  }
  
  // Add to chat context
  await cache.addChatMessage(chat_id, 'user', user_message);
  await cache.addChatMessage(chat_id, 'assistant', assistantReply);
  
  // Also persist to DB (source of truth)
  await prisma.message.createMany({ ... });
  
  return { reply: assistantReply, ... };
});
```

## Cache Warming

Pre-populate Redis cache from existing data:

```bash
./scripts/redis-warm-cache.sh
```

This script:
1. Reads parsed documents from `data/parsed/`
2. Extracts text snippets
3. Pre-computes embeddings (if embedding service is available)
4. Caches common query patterns

## Monitoring

### View Statistics

```bash
./scripts/redis-stats.sh
```

This outputs:
- Memory usage
- Key counts by prefix
- Cache hit/miss rates
- Connection stats

### Using redis-cli

```bash
# Connect to Redis
redis-cli -h 127.0.0.1 -p 6379

# View all chat keys
KEYS chat:*

# Get a specific key
GET chat:chat_1:context

# View memory info
INFO memory

# Monitor commands in real-time
MONITOR
```

### Using RedisInsight (GUI)

1. Download RedisInsight from https://redis.com/redis-enterprise/redis-insight/
2. Connect to `127.0.0.1:6379`
3. Browse keys, view memory usage, run commands

## Backup & Recovery

### Backup

```bash
./scripts/backup-redis.sh
```

Creates timestamped backups in `data/redis_backups/`.

### Restore

```bash
./scripts/restore-redis.sh dump_20250108_120000.rdb
```

**Warning**: This replaces current Redis data with the backup.

## TTL Configuration

Default TTLs (configurable via `.env.cache`):

- **Chat context**: 24 hours (86400 seconds)
- **LLM cache**: 7 days (604800 seconds)
- **Embedding cache**: 30 days (2592000 seconds)
- **Job status**: 48 hours (172800 seconds)
- **Session features**: 24 hours (86400 seconds)

## Security Notes

### PII Masking

Always mask sensitive data before caching:

```python
# Python
from app.utils.pii_masking import mask_parsed_data

masked_data = mask_parsed_data(parsed_data)
cache.set_json("key", masked_data)
```

```typescript
// TypeScript
import { maskParsedData } from '../utils/masks';

const masked = maskParsedData(data);
await cache.setSessionFeatures(sessionId, masked);
```

### Local Development

For local single-user demo:
- Redis password is optional (can leave unsecured)
- Bind to `127.0.0.1` only (not exposed to network)
- Document that production should use authentication

### Production Considerations

- Enable Redis password authentication
- Use TLS for connections
- Restrict network access (firewall rules)
- Monitor for suspicious activity
- Set up Redis Sentinel or Cluster for high availability

## Troubleshooting

### Redis Not Connecting

1. Check if Redis is running: `docker compose -f docker-compose.redis.yml ps`
2. Check logs: `docker compose -f docker-compose.redis.yml logs redis`
3. Verify connection: `redis-cli -h 127.0.0.1 -p 6379 ping`

### Cache Misses

- Check TTLs (keys may have expired)
- Verify key naming matches between set/get
- Check Redis memory limits (keys may have been evicted)

### Memory Issues

- Review `maxmemory` setting in `redis/redis.conf`
- Check eviction policy (`allkeys-lru` recommended)
- Monitor with `./scripts/redis-stats.sh`

## Key Naming Conventions

All keys use namespaced prefixes:

- `chat:{chat_id}:context` - Chat message list
- `chat:{chat_id}:meta` - Chat metadata
- `llm:cache:{model_version}:{prompt_hash}` - LLM cached response
- `embed:cache:{text_hash}` - Cached embedding
- `job:{job_id}` - Job status
- `locks:{resource}` - Distributed lock
- `feature:session:{session_id}` - Session preferences

## Best Practices

1. **Always persist to DB/file system** - Redis is cache, not source of truth
2. **Set appropriate TTLs** - Balance between performance and memory
3. **Monitor memory usage** - Use `redis-stats.sh` regularly
4. **Mask PII** - Never cache raw sensitive data
5. **Handle connection failures gracefully** - Cache should degrade gracefully
6. **Use locks for critical operations** - Prevent race conditions
7. **Warm cache on startup** - Pre-populate frequently-used data

## Further Reading

- [Redis Documentation](https://redis.io/docs/)
- [Redis Python Client](https://redis-py.readthedocs.io/)
- [Redis Node.js Client](https://github.com/redis/node-redis)
- See `docs/cache_examples.md` for sample key/value pairs

