"""
Cache service for Python backend.
Provides high-level caching operations for chat, LLM, embeddings, and jobs.
"""

import os
import hashlib
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from .redis_client import get_redis_client

logger = logging.getLogger(__name__)

# TTLs from environment (in seconds)
TTL_CHAT_CONTEXT = int(os.getenv("REDIS_TTL_CHAT_CONTEXT", "86400"))  # 24 hours
TTL_LLM_CACHE = int(os.getenv("REDIS_TTL_LLM_CACHE", "604800"))  # 7 days
TTL_EMBED_CACHE = int(os.getenv("REDIS_TTL_EMBED_CACHE", "2592000"))  # 30 days
TTL_JOB_STATUS = int(os.getenv("REDIS_TTL_JOB_STATUS", "172800"))  # 48 hours
TTL_SESSION = int(os.getenv("REDIS_TTL_SESSION", "86400"))  # 24 hours

# Key prefixes
PREFIX_CHAT = os.getenv("REDIS_KEY_PREFIX_CHAT", "chat:")
PREFIX_LLM = os.getenv("REDIS_KEY_PREFIX_LLM", "llm:cache:")
PREFIX_EMBED = os.getenv("REDIS_KEY_PREFIX_EMBED", "embed:cache:")
PREFIX_JOB = os.getenv("REDIS_KEY_PREFIX_JOB", "job:")
PREFIX_LOCK = os.getenv("REDIS_KEY_PREFIX_LOCK", "locks:")
PREFIX_FEATURE = os.getenv("REDIS_KEY_PREFIX_FEATURE", "feature:session:")

# Chat context window size
CHAT_CONTEXT_SIZE = int(os.getenv("REDIS_CHAT_CONTEXT_SIZE", "20"))


class CacheService:
    """High-level cache service for common operations."""
    
    def __init__(self):
        self.redis = get_redis_client()
    
    # Chat Context Operations
    def add_chat_message(self, chat_id: str, role: str, text: str) -> bool:
        """
        Add message to chat context (sliding window).
        Maintains last N messages in Redis List.
        """
        key = f"{PREFIX_CHAT}{chat_id}:context"
        message = json.dumps({"role": role, "text": text, "timestamp": datetime.utcnow().isoformat()})
        
        # Push to left (newest first) and trim to keep last N messages
        self.redis.lpush(key, message)
        self.redis.ltrim(key, 0, CHAT_CONTEXT_SIZE - 1)
        
        # Set TTL on the key
        self.redis.get_client().expire(key, TTL_CHAT_CONTEXT)
        
        return True
    
    def get_chat_context(self, chat_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get chat context (last N messages).
        Returns messages in chronological order (oldest first).
        """
        key = f"{PREFIX_CHAT}{chat_id}:context"
        limit = limit or CHAT_CONTEXT_SIZE
        
        # Get all messages (or last N)
        messages_json = self.redis.lrange(key, 0, limit - 1)
        messages = []
        
        for msg_json in reversed(messages_json):  # Reverse to get chronological order
            try:
                messages.append(json.loads(msg_json))
            except json.JSONDecodeError:
                continue
        
        return messages
    
    def set_chat_meta(self, chat_id: str, meta: Dict[str, Any]) -> bool:
        """Set chat metadata (last_active, model_version, etc.)."""
        key = f"{PREFIX_CHAT}{chat_id}:meta"
        return self.redis.set_json(key, meta, ttl=TTL_CHAT_CONTEXT)
    
    def get_chat_meta(self, chat_id: str) -> Optional[Dict[str, Any]]:
        """Get chat metadata."""
        key = f"{PREFIX_CHAT}{chat_id}:meta"
        return self.redis.get_json(key)
    
    # LLM Cache Operations
    def get_llm_cache(self, model_version: str, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Get cached LLM response.
        Key is based on model_version and prompt hash.
        """
        prompt_hash = hashlib.sha256(f"{model_version}:{prompt}".encode()).hexdigest()[:16]
        key = f"{PREFIX_LLM}{model_version}:{prompt_hash}"
        return self.redis.get_json(key)
    
    def set_llm_cache(self, model_version: str, prompt: str, reply: str, used_docs: Optional[List[str]] = None) -> bool:
        """Cache LLM response."""
        prompt_hash = hashlib.sha256(f"{model_version}:{prompt}".encode()).hexdigest()[:16]
        key = f"{PREFIX_LLM}{model_version}:{prompt_hash}"
        
        cache_value = {
            "reply": reply,
            "used_docs": used_docs or [],
            "created_at": datetime.utcnow().isoformat()
        }
        
        return self.redis.set_json(key, cache_value, ttl=TTL_LLM_CACHE)
    
    # Embedding Cache Operations
    def get_embedding_cache(self, text: str) -> Optional[List[float]]:
        """Get cached embedding for text."""
        text_hash = hashlib.sha256(text.encode()).hexdigest()
        key = f"{PREFIX_EMBED}{text_hash}"
        
        cached = self.redis.get_json(key)
        if cached:
            return cached.get("embedding")
        return None
    
    def set_embedding_cache(self, text: str, embedding: List[float]) -> bool:
        """Cache embedding for text."""
        text_hash = hashlib.sha256(text.encode()).hexdigest()
        key = f"{PREFIX_EMBED}{text_hash}"
        
        cache_value = {
            "embedding": embedding,
            "text_hash": text_hash,
            "created_at": datetime.utcnow().isoformat()
        }
        
        return self.redis.set_json(key, cache_value, ttl=TTL_EMBED_CACHE)
    
    # Job Status Operations
    def set_job_status(self, job_id: str, status: str, progress: int = 0, result_ptr: Optional[str] = None) -> bool:
        """
        Set job status in Redis.
        Status: queued, processing, done, failed
        Progress: 0-100
        result_ptr: path to result file or DB id
        """
        key = f"{PREFIX_JOB}{job_id}"
        
        job_data = {
            "status": status,
            "progress": progress,
            "result_ptr": result_ptr,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        return self.redis.set_json(key, job_data, ttl=TTL_JOB_STATUS)
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status."""
        key = f"{PREFIX_JOB}{job_id}"
        return self.redis.get_json(key)
    
    def delete_job_status(self, job_id: str) -> bool:
        """Delete job status after retrieval."""
        key = f"{PREFIX_JOB}{job_id}"
        return self.redis.delete(key)
    
    # Lock Operations
    def acquire_lock(self, resource: str, timeout: int = 30) -> bool:
        """Acquire distributed lock for resource."""
        key = f"{PREFIX_LOCK}{resource}"
        return self.redis.acquire_lock(key, timeout)
    
    def release_lock(self, resource: str) -> bool:
        """Release distributed lock."""
        key = f"{PREFIX_LOCK}{resource}"
        return self.redis.release_lock(key)
    
    # Feature Flags / Session Preferences
    def set_session_features(self, session_id: str, features: Dict[str, Any]) -> bool:
        """Set user feature preferences for session."""
        key = f"{PREFIX_FEATURE}{session_id}"
        return self.redis.set_json(key, features, ttl=TTL_SESSION)
    
    def get_session_features(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get user feature preferences."""
        key = f"{PREFIX_FEATURE}{session_id}"
        return self.redis.get_json(key)


# Global cache service instance
_cache_service: Optional[CacheService] = None


def get_cache_service() -> CacheService:
    """Get or create global cache service instance."""
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service

