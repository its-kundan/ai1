# Redis Cache Setup - Quick Start Guide

This guide provides a quick overview of the Redis cache setup for the chatgpt-local-demo project.

## 🚀 Quick Start

### 1. Start Redis

```bash
# Using docker-compose (recommended)
./scripts/start-redis.sh

# Or manually
docker compose -f docker-compose.redis.yml up -d
```

### 2. Verify Connection

```bash
redis-cli -h 127.0.0.1 -p 6379 ping
# Should return: PONG
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.cache.example .env.cache
```

Edit `.env.cache` if needed (defaults work for local demo).

## 📁 Data Directory Structure

All persistent data lives under `data/`:

```
data/
├── uploads/                # Raw uploaded files
├── ocr_results/            # OCR JSON results
├── parsed/                 # Parsed document outputs
├── faiss_index/            # FAISS vector index files
├── sqlite/                 # SQLite DB files
├── postgres_backups/       # PostgreSQL dumps
├── redis_data/             # Redis persistent data (RDB/AOF)
├── redis_backups/          # Redis backup snapshots
└── logs/                   # Service logs
```

See `data/README.md` for detailed documentation.

## 🔧 Redis Configuration

### Docker Compose

Redis runs via `docker-compose.redis.yml`:
- **Port**: 6379 (localhost only)
- **Data**: Mounted to `data/redis_data/`
- **Config**: Uses `redis/redis.conf`

### Configuration File

`redis/redis.conf` includes:
- Memory limit: 1GB
- Eviction policy: `allkeys-lru`
- RDB snapshots: Every 60s if 10000+ keys changed
- AOF: Disabled by default (can enable for better durability)

## 💾 What Gets Cached

Redis caches:

1. **Chat Context** - Recent messages for fast LLM prompt building
2. **LLM Responses** - Avoid re-running identical prompts
3. **Embeddings** - Cache frequently-used text embeddings
4. **Job Status** - Track OCR/processing job progress
5. **Locks** - Distributed locks for critical operations
6. **Session Features** - User preferences and feature toggles

**Important**: Redis is a cache, not the source of truth. All authoritative data is persisted to:
- Database (PostgreSQL/SQLite)
- File system (`data/parsed/`, `data/ocr_results/`)

## 📚 Integration

### Python Backend (`backend/`)

```python
from app.services.redis import get_cache_service

cache = get_cache_service()

# Add chat message
cache.add_chat_message("chat_1", "user", "Hello")

# Get chat context
messages = cache.get_chat_context("chat_1")

# Cache LLM response
cache.set_llm_cache("gpt-4", prompt, reply)
```

### Node.js Backend (`backend2/`)

```typescript
import { getCacheService } from './services/redis';

const cache = getCacheService();

// Add chat message
await cache.addChatMessage('chat_1', 'user', 'Hello');

// Get chat context
const messages = await cache.getChatContext('chat_1');

// Cache LLM response
await cache.setLLMCache('gpt-4', prompt, reply);
```

See `docs/redis_integration_guide.md` for complete integration examples.

## 🛠️ Utility Scripts

### Start Redis
```bash
./scripts/start-redis.sh
```

### View Statistics
```bash
./scripts/redis-stats.sh
```

### Backup Redis
```bash
./scripts/backup-redis.sh
```

### Restore Redis
```bash
./scripts/restore-redis.sh dump_20250108_120000.rdb
```

### Warm Cache
```bash
./scripts/redis-warm-cache.sh
```

## 📊 Monitoring

### View Keys
```bash
# All chat keys
redis-cli KEYS "chat:*"

# LLM cache entries
redis-cli --scan --pattern "llm:cache:*"
```

### Memory Usage
```bash
redis-cli INFO memory
```

### Real-time Monitoring
```bash
redis-cli MONITOR
```

### Using RedisInsight (GUI)

1. Download from https://redis.com/redis-enterprise/redis-insight/
2. Connect to `127.0.0.1:6379`
3. Browse keys, view memory, run commands

## 🔒 Security Notes

### Local Development

- Redis password is **optional** for local demo
- Bind to `127.0.0.1` only (not exposed to network)
- Document that production should use authentication

### PII Masking

Always mask sensitive data before caching:

```python
# Python
from app.utils.pii_masking import mask_parsed_data
masked = mask_parsed_data(data)
cache.set_json("key", masked)
```

```typescript
// TypeScript
import { maskParsedData } from './utils/masks';
const masked = maskParsedData(data);
await cache.setSessionFeatures(sessionId, masked);
```

### Production Considerations

- Enable Redis password authentication
- Use TLS for connections
- Restrict network access
- Monitor for suspicious activity
- Set up Redis Sentinel/Cluster for HA

## ⏱️ TTL Configuration

Default TTLs (configurable via `.env.cache`):

- **Chat context**: 24 hours
- **LLM cache**: 7 days
- **Embedding cache**: 30 days
- **Job status**: 48 hours
- **Session features**: 24 hours

## 🧪 Testing

### Python Tests
```bash
cd backend
pytest tests/test_redis_cache.py -v
```

### Node.js Tests
```bash
cd backend2
npm test -- redisCache.test.ts
```

## 📖 Documentation

- **Integration Guide**: `docs/redis_integration_guide.md`
- **Cache Examples**: `docs/cache_examples.md`
- **Data Structure**: `data/README.md`

## 🐛 Troubleshooting

### Redis Not Connecting

1. Check if running: `docker compose -f docker-compose.redis.yml ps`
2. Check logs: `docker compose -f docker-compose.redis.yml logs redis`
3. Test connection: `redis-cli -h 127.0.0.1 -p 6379 ping`

### Cache Misses

- Check TTLs (keys may have expired)
- Verify key naming matches
- Check Redis memory limits (keys may have been evicted)

### Memory Issues

- Review `maxmemory` in `redis/redis.conf`
- Check eviction policy
- Monitor with `./scripts/redis-stats.sh`

## 🎯 Key Naming Conventions

All keys use namespaced prefixes:

- `chat:{chat_id}:context` - Chat message list
- `chat:{chat_id}:meta` - Chat metadata
- `llm:cache:{model_version}:{prompt_hash}` - LLM cached response
- `embed:cache:{text_hash}` - Cached embedding
- `job:{job_id}` - Job status
- `locks:{resource}` - Distributed lock
- `feature:session:{session_id}` - Session preferences

## 🔄 Backup & Recovery

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

## 📝 Best Practices

1. **Always persist to DB/file system** - Redis is cache, not source of truth
2. **Set appropriate TTLs** - Balance performance and memory
3. **Monitor memory usage** - Use `redis-stats.sh` regularly
4. **Mask PII** - Never cache raw sensitive data
5. **Handle connection failures gracefully** - Cache should degrade gracefully
6. **Use locks for critical operations** - Prevent race conditions
7. **Warm cache on startup** - Pre-populate frequently-used data

## 🚀 Next Steps

1. Start Redis: `./scripts/start-redis.sh`
2. Install dependencies:
   - Python: `cd backend && pip install -r requirements.txt`
   - Node.js: `cd backend2 && npm install`
3. Configure: Copy `.env.cache.example` to `.env.cache`
4. Integrate: See `docs/redis_integration_guide.md`
5. Test: Run test suites to verify setup

For detailed information, see the full documentation in `docs/`.

