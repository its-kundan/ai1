# Security Notes for Redis Cache

## PII Masking

**Critical**: Never cache raw PII (Personally Identifiable Information) in Redis without masking.

### What to Mask

- Account numbers (show only last 4 digits)
- Phone numbers (show only last 4 digits)
- Social Security Numbers
- Email addresses (consider masking)
- Any other sensitive personal data

### Implementation

#### Python Backend

```python
from app.utils.pii_masking import mask_parsed_data
from app.services.redis import get_cache_service

cache = get_cache_service()

# Before caching, mask sensitive data
parsed_data = {
    "account_number": "1234567890123456",
    "msisdn": "+919876543210",
    "transactions": [...]
}

masked_data = mask_parsed_data(parsed_data)
# Result: {"account_number": "****3456", "msisdn": "****3210", ...}

# Cache the masked data
cache.set_json("key", masked_data)
```

#### Node.js Backend

```typescript
import { maskParsedData } from '../utils/masks';
import { getCacheService } from '../services/redis';

const cache = getCacheService();

// Before caching, mask sensitive data
const parsedData = {
  account_number: '1234567890123456',
  msisdn: '+919876543210',
  transactions: [...],
};

const masked = maskParsedData(parsedData);
// Result: { account_number: '****3456', msisdn: '****3210', ... }

// Cache the masked data
await cache.setSessionFeatures(sessionId, masked);
```

## Local Development Security

### Redis Password (Optional for Local)

For local single-user demo, Redis password is optional:

```bash
# In redis/redis.conf
# requirepass yourpassword  # Uncomment and set if needed
```

**Note**: For production, always set a strong password.

### Network Binding

Redis is bound to `127.0.0.1` only (localhost) in `docker-compose.redis.yml`:

```yaml
# redis/redis.conf
bind 127.0.0.1
```

This prevents external network access. For production, use firewall rules in addition.

### Access Control

- Backends connect using environment variables (`REDIS_HOST`, `REDIS_PASSWORD`)
- Never hardcode credentials in code
- Use `.env.cache` file (not committed to git)

## Production Security Checklist

### 1. Authentication

- [ ] Enable Redis password (`requirepass` in `redis.conf`)
- [ ] Use strong, randomly generated password
- [ ] Store password in secure secret management system
- [ ] Rotate password periodically

### 2. Network Security

- [ ] Bind Redis to specific IP (not `0.0.0.0`)
- [ ] Use firewall rules to restrict access
- [ ] Enable TLS/SSL for Redis connections
- [ ] Use Redis Sentinel or Cluster for high availability

### 3. Data Protection

- [ ] Mask PII before caching
- [ ] Set appropriate TTLs (don't cache sensitive data long-term)
- [ ] Encrypt sensitive cached values if needed
- [ ] Regularly audit cached keys for PII

### 4. Monitoring

- [ ] Monitor for suspicious access patterns
- [ ] Set up alerts for failed authentication attempts
- [ ] Log all Redis operations (consider AOF for audit trail)
- [ ] Review cache hit/miss rates regularly

### 5. Backup Security

- [ ] Encrypt Redis backup files
- [ ] Store backups in secure location
- [ ] Limit access to backup files
- [ ] Test restore procedures regularly

## Redis Configuration Security

### Recommended Production Settings

```conf
# redis/redis.conf (production)

# Authentication
requirepass <strong-random-password>

# Network
bind 127.0.0.1  # Or specific internal IP
protected-mode yes

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG "CONFIG_SECURE"

# Memory limits
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence (for audit)
appendonly yes
appendfsync everysec
```

## Key Naming Security

Use namespaced keys to prevent collisions and enable access control:

- ✅ Good: `chat:{chat_id}:context`
- ❌ Bad: `chat_context` (no namespace)

This allows:
- Easy key pattern matching for access control
- Clear separation of data types
- Simplified backup/restore operations

## TTL Best Practices

Set conservative TTLs for sensitive data:

- **Chat context**: 24 hours (sufficient for active sessions)
- **LLM cache**: 7 days (long enough for repeated queries, short enough to expire)
- **Embeddings**: 30 days (or persist to DB as source of truth)
- **Job status**: 48 hours (clean up after retrieval)

**Never** cache sensitive data without TTL.

## Incident Response

If PII is accidentally cached:

1. **Immediate**: Delete the key from Redis
   ```bash
   redis-cli DEL <key>
   ```

2. **Audit**: Check for other instances
   ```bash
   redis-cli --scan --pattern "*" | xargs redis-cli GET
   ```

3. **Review**: Check logs and backups for exposure

4. **Prevent**: Update code to mask PII before caching

## Compliance Notes

### GDPR

- Cache only necessary data
- Set appropriate TTLs
- Provide data deletion mechanisms
- Document data retention policies

### PCI DSS

- Never cache full credit card numbers
- Mask card numbers (show only last 4 digits)
- Use tokenization if needed
- Encrypt cached payment data

### HIPAA

- Never cache PHI (Protected Health Information) without encryption
- Use strong encryption for any health data
- Set strict TTLs
- Maintain audit logs

## See Also

- `docs/redis_integration_guide.md` - Integration guide
- `docs/cache_examples.md` - Cache usage examples
- `backend/app/utils/pii_masking.py` - PII masking utilities (Python)
- `backend2/src/utils/masks.ts` - PII masking utilities (TypeScript)

