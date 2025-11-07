# Redis Cache Examples

This document provides example Redis key/value pairs and usage patterns for the chatgpt-local-demo project.

## Key Naming Patterns

All keys follow a namespaced pattern: `{prefix}:{identifier}:{suffix}`

## Chat Context

### Key: `chat:{chat_id}:context`
**Type**: Redis List  
**TTL**: 24 hours (86400 seconds)  
**Purpose**: Sliding window of recent chat messages

**Example**:
```
Key: chat:chat_1:context
Type: List
Values (JSON strings):
  [
    {"role": "user", "text": "What is my account balance?", "timestamp": "2025-01-08T10:00:00Z"},
    {"role": "assistant", "text": "Your account balance is $1,234.56.", "timestamp": "2025-01-08T10:00:05Z"},
    {"role": "user", "text": "Show me recent transactions", "timestamp": "2025-01-08T10:01:00Z"}
  ]
```

**Operations**:
```bash
# View messages
redis-cli LRANGE chat:chat_1:context 0 -1

# Add message (from application)
LPUSH chat:chat_1:context '{"role":"user","text":"New message","timestamp":"..."}'
LTRIM chat:chat_1:context 0 19  # Keep last 20 messages
```

### Key: `chat:{chat_id}:meta`
**Type**: Redis String (JSON)  
**TTL**: 24 hours  
**Purpose**: Chat session metadata

**Example**:
```json
{
  "last_active": "2025-01-08T10:01:00Z",
  "model_version": "gpt-4",
  "message_count": 6,
  "title": "Account Inquiry"
}
```

**Operations**:
```bash
# Get metadata
redis-cli GET chat:chat_1:meta

# Set metadata
redis-cli SETEX chat:chat_1:meta 86400 '{"last_active":"2025-01-08T10:01:00Z","model_version":"gpt-4"}'
```

## LLM Response Cache

### Key: `llm:cache:{model_version}:{prompt_hash}`
**Type**: Redis String (JSON)  
**TTL**: 7 days (604800 seconds)  
**Purpose**: Cache LLM responses to avoid re-running identical prompts

**Example**:
```
Key: llm:cache:gpt-4:a1b2c3d4e5f6
Value (JSON):
{
  "reply": "Your account balance is $1,234.56. Recent transactions include...",
  "used_docs": ["doc_12345", "doc_67890"],
  "created_at": "2025-01-08T10:00:05Z"
}
```

**Hash Calculation**:
```python
import hashlib
prompt_hash = hashlib.sha256(f"{model_version}:{prompt}".encode()).hexdigest()[:16]
# Result: "a1b2c3d4e5f6"
```

**Operations**:
```bash
# Check if cached
redis-cli GET llm:cache:gpt-4:a1b2c3d4e5f6

# View all LLM cache keys
redis-cli --scan --pattern "llm:cache:*"
```

## Embedding Cache

### Key: `embed:cache:{text_hash}`
**Type**: Redis String (JSON)  
**TTL**: 30 days (2592000 seconds)  
**Purpose**: Cache embeddings for frequently-used text snippets

**Example**:
```
Key: embed:cache:9f8e7d6c5b4a3210
Value (JSON):
{
  "embedding": [0.123, -0.456, 0.789, ...],  # 384-dimensional vector
  "text_hash": "9f8e7d6c5b4a3210",
  "created_at": "2025-01-08T10:00:00Z"
}
```

**Hash Calculation**:
```python
import hashlib
text_hash = hashlib.sha256(text.encode()).hexdigest()
# Result: "9f8e7d6c5b4a3210fedcba9876543210..."
```

**Operations**:
```bash
# Get embedding
redis-cli GET embed:cache:9f8e7d6c5b4a3210

# Count cached embeddings
redis-cli --scan --pattern "embed:cache:*" | wc -l
```

## Job Status

### Key: `job:{job_id}`
**Type**: Redis String (JSON)  
**TTL**: 48 hours (172800 seconds)  
**Purpose**: Track background job progress (OCR, parsing, etc.)

**Example - Queued**:
```json
{
  "status": "queued",
  "progress": 0,
  "updated_at": "2025-01-08T10:00:00Z"
}
```

**Example - Processing**:
```json
{
  "status": "processing",
  "progress": 50,
  "updated_at": "2025-01-08T10:00:30Z"
}
```

**Example - Done**:
```json
{
  "status": "done",
  "progress": 100,
  "result_ptr": "data/ocr_results/ocr_doc_12345.json",
  "updated_at": "2025-01-08T10:01:00Z"
}
```

**Example - Failed**:
```json
{
  "status": "failed",
  "progress": 0,
  "error": "OCR service timeout",
  "updated_at": "2025-01-08T10:01:00Z"
}
```

**Operations**:
```bash
# Check job status
redis-cli GET job:ocr_job_123

# Update job progress
redis-cli SETEX job:ocr_job_123 172800 '{"status":"processing","progress":75,"updated_at":"..."}'

# Delete after retrieval
redis-cli DEL job:ocr_job_123
```

## Distributed Locks

### Key: `locks:{resource}`
**Type**: Redis String  
**TTL**: Lock timeout (e.g., 30 seconds)  
**Purpose**: Prevent concurrent operations on shared resources

**Example**:
```
Key: locks:faiss_reindex
Value: "locked"
TTL: 300 seconds (5 minutes)
```

**Operations**:
```bash
# Acquire lock (SETNX pattern)
redis-cli SET locks:faiss_reindex "locked" NX PX 300000

# Check if locked
redis-cli GET locks:faiss_reindex

# Release lock
redis-cli DEL locks:faiss_reindex
```

**Usage Pattern**:
```python
# Python
if cache.acquire_lock("faiss_reindex", timeout=300):
    try:
        rebuild_faiss_index()
    finally:
        cache.release_lock("faiss_reindex")
```

## Feature Flags / Session Preferences

### Key: `feature:session:{session_id}`
**Type**: Redis String (JSON)  
**TTL**: 24 hours  
**Purpose**: Store user preferences and feature toggles

**Example**:
```json
{
  "theme": "dark",
  "selected_features": ["bank_statement", "cdr"],
  "last_used_model": "gpt-4",
  "preferences": {
    "auto_retrieve": true,
    "max_context_messages": 20
  }
}
```

**Operations**:
```bash
# Get session features
redis-cli GET feature:session:user_123

# Set session features
redis-cli SETEX feature:session:user_123 86400 '{"theme":"dark","selected_features":["bank_statement"]}'
```

## Complete Example: Chat Flow

### 1. User sends message
```bash
# Add to chat context
LPUSH chat:chat_1:context '{"role":"user","text":"What is my balance?","timestamp":"2025-01-08T10:00:00Z"}'
LTRIM chat:chat_1:context 0 19
EXPIRE chat:chat_1:context 86400
```

### 2. Check LLM cache
```bash
# Compute prompt hash: sha256("gpt-4:What is my balance?")[:16] = "a1b2c3d4"
GET llm:cache:gpt-4:a1b2c3d4
# Returns: null (cache miss)
```

### 3. Call LLM and cache response
```bash
# After LLM call, cache the response
SETEX llm:cache:gpt-4:a1b2c3d4 604800 '{"reply":"Your balance is $1,234.56","used_docs":["doc_123"],"created_at":"2025-01-08T10:00:05Z"}'
```

### 4. Add assistant response to context
```bash
LPUSH chat:chat_1:context '{"role":"assistant","text":"Your balance is $1,234.56","timestamp":"2025-01-08T10:00:05Z"}'
LTRIM chat:chat_1:context 0 19
```

### 5. Update chat metadata
```bash
SETEX chat:chat_1:meta 86400 '{"last_active":"2025-01-08T10:00:05Z","model_version":"gpt-4","message_count":6}'
```

## Memory Usage Examples

### Typical Key Sizes

- **Chat context (20 messages)**: ~5-10 KB
- **LLM cache entry**: ~1-5 KB (depends on response length)
- **Embedding cache (384-dim)**: ~2-3 KB (JSON with float array)
- **Job status**: ~200 bytes
- **Lock**: ~10 bytes
- **Session features**: ~500 bytes

### Memory Estimates

For a single-user demo with:
- 10 active chats: ~100 KB
- 1000 LLM cache entries: ~2-5 MB
- 5000 embedding cache entries: ~10-15 MB
- 100 job status entries: ~20 KB
- **Total**: ~15-20 MB (well within 1GB limit)

## TTL Examples

### Keys with TTL
```bash
# Set with TTL
SETEX chat:chat_1:context 86400 '{"messages":[...]}'

# Check remaining TTL
TTL chat:chat_1:context
# Returns: 86345 (seconds remaining)

# Refresh TTL
EXPIRE chat:chat_1:context 86400
```

### Keys without TTL (persist until eviction)
```bash
# Set without TTL (not recommended for cache keys)
SET chat:chat_1:context '{"messages":[...]}'

# Will be evicted when memory limit reached (allkeys-lru policy)
```

## Monitoring Examples

### Count keys by prefix
```bash
# Count chat contexts
redis-cli --scan --pattern "chat:*:context" | wc -l

# Count LLM cache entries
redis-cli --scan --pattern "llm:cache:*" | wc -l

# Count all job statuses
redis-cli --scan --pattern "job:*" | wc -l
```

### View memory usage by key pattern
```bash
# Get memory usage for a specific key
redis-cli MEMORY USAGE chat:chat_1:context

# Get top memory-consuming keys
redis-cli --bigkeys
```

### Monitor commands in real-time
```bash
# Watch all Redis commands
redis-cli MONITOR

# Filter for specific patterns (using grep)
redis-cli MONITOR | grep "chat:"
```

## Error Handling Examples

### Graceful Degradation

If Redis is unavailable, the application should continue without caching:

```python
# Python
try:
    cached = cache.get_llm_cache(model_version, prompt)
    if cached:
        return cached["reply"]
except Exception as e:
    logger.warning(f"Cache unavailable: {e}")
    # Continue without cache
    return await llm_client.generate(prompt)
```

```typescript
// TypeScript
try {
  const cached = await cache.getLLMCache(modelVersion, prompt);
  if (cached) return cached.reply;
} catch (error) {
  logger.warn({ error }, 'Cache unavailable');
  // Continue without cache
  return await generateChatResponse(...);
}
```

## Best Practices

1. **Always set TTLs** - Prevent memory bloat
2. **Use consistent key naming** - Follow the patterns above
3. **Handle cache misses gracefully** - Don't fail if cache is unavailable
4. **Monitor memory usage** - Use `redis-stats.sh` regularly
5. **Mask PII before caching** - Never cache raw sensitive data
6. **Delete job keys after retrieval** - Clean up completed jobs
7. **Use locks for critical operations** - Prevent race conditions

## See Also

- `docs/redis_integration_guide.md` - Full integration guide
- `data/README.md` - Data directory structure
- `redis/redis.conf` - Redis configuration

