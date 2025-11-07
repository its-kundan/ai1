"""
Redis client wrapper for Python backend.
Handles connection, reconnection, and basic operations.
"""

import os
import json
import logging
from typing import Optional, Any, Dict
from functools import wraps
import redis
from redis.exceptions import ConnectionError, TimeoutError

logger = logging.getLogger(__name__)

# Redis connection settings from environment
REDIS_HOST = os.getenv("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD") or None
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_CONNECTION_TIMEOUT = int(os.getenv("REDIS_CONNECTION_TIMEOUT", "5000")) // 1000  # Convert ms to seconds
REDIS_COMMAND_TIMEOUT = int(os.getenv("REDIS_COMMAND_TIMEOUT", "3000")) // 1000


class RedisClient:
    """Redis client wrapper with connection pooling and error handling."""
    
    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self._connect()
    
    def _connect(self):
        """Initialize Redis connection."""
        try:
            self._client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                password=REDIS_PASSWORD,
                db=REDIS_DB,
                socket_connect_timeout=REDIS_CONNECTION_TIMEOUT,
                socket_timeout=REDIS_COMMAND_TIMEOUT,
                decode_responses=True,  # Automatically decode bytes to strings
                health_check_interval=30
            )
            # Test connection
            self._client.ping()
            logger.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
        except (ConnectionError, TimeoutError) as e:
            logger.warning(f"Redis connection failed: {e}. Cache operations will be disabled.")
            self._client = None
        except Exception as e:
            logger.error(f"Unexpected Redis error: {e}")
            self._client = None
    
    def is_connected(self) -> bool:
        """Check if Redis is connected."""
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except Exception:
            return False
    
    def ping(self) -> bool:
        """Ping Redis server."""
        if not self.is_connected():
            return False
        try:
            return self._client.ping() is True
        except Exception:
            return False
    
    def get(self, key: str) -> Optional[str]:
        """Get value from Redis."""
        if not self.is_connected():
            return None
        try:
            return self._client.get(key)
        except Exception as e:
            logger.error(f"Redis GET error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: str, ttl: Optional[int] = None) -> bool:
        """Set value in Redis with optional TTL."""
        if not self.is_connected():
            return False
        try:
            if ttl:
                return self._client.setex(key, ttl, value)
            else:
                return self._client.set(key, value)
        except Exception as e:
            logger.error(f"Redis SET error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from Redis."""
        if not self.is_connected():
            return False
        try:
            return bool(self._client.delete(key))
        except Exception as e:
            logger.error(f"Redis DELETE error for key {key}: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """Check if key exists."""
        if not self.is_connected():
            return False
        try:
            return bool(self._client.exists(key))
        except Exception as e:
            logger.error(f"Redis EXISTS error for key {key}: {e}")
            return False
    
    def get_json(self, key: str) -> Optional[Dict[str, Any]]:
        """Get JSON value from Redis."""
        value = self.get(key)
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error for key {key}: {e}")
            return None
    
    def set_json(self, key: str, value: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Set JSON value in Redis."""
        try:
            json_str = json.dumps(value)
            return self.set(key, json_str, ttl)
        except (TypeError, ValueError) as e:
            logger.error(f"JSON encode error for key {key}: {e}")
            return False
    
    # List operations for chat context
    def lpush(self, key: str, *values: str) -> Optional[int]:
        """Push values to left of list."""
        if not self.is_connected():
            return None
        try:
            return self._client.lpush(key, *values)
        except Exception as e:
            logger.error(f"Redis LPUSH error for key {key}: {e}")
            return None
    
    def rpush(self, key: str, *values: str) -> Optional[int]:
        """Push values to right of list."""
        if not self.is_connected():
            return None
        try:
            return self._client.rpush(key, *values)
        except Exception as e:
            logger.error(f"Redis RPUSH error for key {key}: {e}")
            return None
    
    def lrange(self, key: str, start: int = 0, end: int = -1) -> list:
        """Get range of list."""
        if not self.is_connected():
            return []
        try:
            return self._client.lrange(key, start, end)
        except Exception as e:
            logger.error(f"Redis LRANGE error for key {key}: {e}")
            return []
    
    def ltrim(self, key: str, start: int, end: int) -> bool:
        """Trim list to range."""
        if not self.is_connected():
            return False
        try:
            return self._client.ltrim(key, start, end)
        except Exception as e:
            logger.error(f"Redis LTRIM error for key {key}: {e}")
            return False
    
    def llen(self, key: str) -> int:
        """Get list length."""
        if not self.is_connected():
            return 0
        try:
            return self._client.llen(key)
        except Exception as e:
            logger.error(f"Redis LLEN error for key {key}: {e}")
            return 0
    
    # Hash operations
    def hset(self, key: str, mapping: Dict[str, str]) -> Optional[int]:
        """Set hash fields."""
        if not self.is_connected():
            return None
        try:
            return self._client.hset(key, mapping=mapping)
        except Exception as e:
            logger.error(f"Redis HSET error for key {key}: {e}")
            return None
    
    def hget(self, key: str, field: str) -> Optional[str]:
        """Get hash field."""
        if not self.is_connected():
            return None
        try:
            return self._client.hget(key, field)
        except Exception as e:
            logger.error(f"Redis HGET error for key {key}: {e}")
            return None
    
    def hgetall(self, key: str) -> Dict[str, str]:
        """Get all hash fields."""
        if not self.is_connected():
            return {}
        try:
            return self._client.hgetall(key)
        except Exception as e:
            logger.error(f"Redis HGETALL error for key {key}: {e}")
            return {}
    
    # Lock operations (SETNX pattern)
    def acquire_lock(self, key: str, timeout: int = 30) -> bool:
        """Acquire distributed lock using SETNX pattern."""
        if not self.is_connected():
            return False
        try:
            # SET key value NX PX timeout_ms
            return bool(self._client.set(key, "locked", nx=True, px=timeout * 1000))
        except Exception as e:
            logger.error(f"Redis lock acquire error for key {key}: {e}")
            return False
    
    def release_lock(self, key: str) -> bool:
        """Release distributed lock."""
        return self.delete(key)
    
    def get_client(self) -> Optional[redis.Redis]:
        """Get underlying Redis client (for advanced operations)."""
        return self._client if self.is_connected() else None


# Global Redis client instance
_redis_client: Optional[RedisClient] = None


def get_redis_client() -> RedisClient:
    """Get or create global Redis client instance."""
    global _redis_client
    if _redis_client is None:
        _redis_client = RedisClient()
    return _redis_client

