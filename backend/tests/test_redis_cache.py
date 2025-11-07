"""
Test examples for Redis cache operations.
These tests demonstrate how to use the Redis cache service.
"""

import pytest
import json
from datetime import datetime
from app.services.redis import get_cache_service, get_redis_client


@pytest.fixture
def cache():
    """Get cache service instance."""
    return get_cache_service()


@pytest.fixture
def redis_client():
    """Get Redis client instance."""
    return get_redis_client()


class TestChatContext:
    """Test chat context caching operations."""
    
    def test_add_and_get_chat_message(self, cache):
        """Test adding and retrieving chat messages."""
        chat_id = "test_chat_1"
        
        # Add messages
        cache.add_chat_message(chat_id, "user", "Hello, what is my balance?")
        cache.add_chat_message(chat_id, "assistant", "Your balance is $1,234.56.")
        cache.add_chat_message(chat_id, "user", "Show recent transactions")
        
        # Get context
        messages = cache.get_chat_context(chat_id)
        
        assert len(messages) == 3
        assert messages[0]["role"] == "user"
        assert messages[0]["text"] == "Hello, what is my balance?"
        assert messages[1]["role"] == "assistant"
        assert messages[2]["role"] == "user"
    
    def test_chat_context_sliding_window(self, cache):
        """Test that chat context maintains sliding window (last N messages)."""
        chat_id = "test_chat_2"
        
        # Add more messages than window size (default 20)
        for i in range(25):
            cache.add_chat_message(chat_id, "user", f"Message {i}")
        
        # Should only keep last 20 messages
        messages = cache.get_chat_context(chat_id)
        assert len(messages) == 20
        assert messages[0]["text"] == "Message 5"  # First message in window
        assert messages[-1]["text"] == "Message 24"  # Last message
    
    def test_set_and_get_chat_meta(self, cache):
        """Test chat metadata operations."""
        chat_id = "test_chat_3"
        
        meta = {
            "last_active": datetime.utcnow().isoformat(),
            "model_version": "gpt-4",
            "message_count": 5
        }
        
        cache.set_chat_meta(chat_id, meta)
        retrieved = cache.get_chat_meta(chat_id)
        
        assert retrieved is not None
        assert retrieved["model_version"] == "gpt-4"
        assert retrieved["message_count"] == 5


class TestLLMCache:
    """Test LLM response caching."""
    
    def test_llm_cache_miss_and_hit(self, cache):
        """Test LLM cache miss (not found) and hit (found)."""
        model_version = "gpt-4"
        prompt = "What is my account balance?"
        
        # First call - cache miss
        cached = cache.get_llm_cache(model_version, prompt)
        assert cached is None
        
        # Cache the response
        reply = "Your account balance is $1,234.56."
        cache.set_llm_cache(model_version, prompt, reply, used_docs=["doc_123"])
        
        # Second call - cache hit
        cached = cache.get_llm_cache(model_version, prompt)
        assert cached is not None
        assert cached["reply"] == reply
        assert cached["used_docs"] == ["doc_123"]
        assert "created_at" in cached
    
    def test_llm_cache_different_prompts(self, cache):
        """Test that different prompts produce different cache keys."""
        model_version = "gpt-4"
        prompt1 = "What is my balance?"
        prompt2 = "Show me transactions"
        
        cache.set_llm_cache(model_version, prompt1, "Reply 1")
        cache.set_llm_cache(model_version, prompt2, "Reply 2")
        
        cached1 = cache.get_llm_cache(model_version, prompt1)
        cached2 = cache.get_llm_cache(model_version, prompt2)
        
        assert cached1["reply"] == "Reply 1"
        assert cached2["reply"] == "Reply 2"


class TestEmbeddingCache:
    """Test embedding caching."""
    
    def test_embedding_cache(self, cache):
        """Test embedding cache operations."""
        text = "Account balance query"
        embedding = [0.1, 0.2, 0.3, 0.4, 0.5]  # Example embedding vector
        
        # Cache miss
        cached = cache.get_embedding_cache(text)
        assert cached is None
        
        # Cache the embedding
        cache.set_embedding_cache(text, embedding)
        
        # Cache hit
        cached = cache.get_embedding_cache(text)
        assert cached == embedding
    
    def test_embedding_cache_different_texts(self, cache):
        """Test that different texts produce different cache keys."""
        text1 = "Account balance"
        text2 = "Transaction history"
        embedding1 = [0.1, 0.2, 0.3]
        embedding2 = [0.4, 0.5, 0.6]
        
        cache.set_embedding_cache(text1, embedding1)
        cache.set_embedding_cache(text2, embedding2)
        
        cached1 = cache.get_embedding_cache(text1)
        cached2 = cache.get_embedding_cache(text2)
        
        assert cached1 == embedding1
        assert cached2 == embedding2


class TestJobStatus:
    """Test job status tracking."""
    
    def test_job_lifecycle(self, cache):
        """Test complete job lifecycle: queued -> processing -> done."""
        job_id = "test_job_123"
        
        # Queued
        cache.set_job_status(job_id, "queued", progress=0)
        status = cache.get_job_status(job_id)
        assert status["status"] == "queued"
        assert status["progress"] == 0
        
        # Processing
        cache.set_job_status(job_id, "processing", progress=50)
        status = cache.get_job_status(job_id)
        assert status["status"] == "processing"
        assert status["progress"] == 50
        
        # Done
        cache.set_job_status(job_id, "done", progress=100, result_ptr="data/ocr_results/doc_123.json")
        status = cache.get_job_status(job_id)
        assert status["status"] == "done"
        assert status["progress"] == 100
        assert status["result_ptr"] == "data/ocr_results/doc_123.json"
        
        # Delete after retrieval
        cache.delete_job_status(job_id)
        status = cache.get_job_status(job_id)
        assert status is None
    
    def test_job_failed_status(self, cache):
        """Test job failed status."""
        job_id = "test_job_failed"
        
        cache.set_job_status(job_id, "failed", progress=0)
        status = cache.get_job_status(job_id)
        
        assert status["status"] == "failed"
        assert status["progress"] == 0


class TestDistributedLocks:
    """Test distributed lock operations."""
    
    def test_acquire_and_release_lock(self, cache):
        """Test acquiring and releasing a lock."""
        resource = "test_resource"
        
        # Acquire lock
        acquired = cache.acquire_lock(resource, timeout=30)
        assert acquired is True
        
        # Try to acquire again (should fail - already locked)
        acquired2 = cache.acquire_lock(resource, timeout=30)
        assert acquired2 is False
        
        # Release lock
        released = cache.release_lock(resource)
        assert released is True
        
        # Now can acquire again
        acquired3 = cache.acquire_lock(resource, timeout=30)
        assert acquired3 is True
        
        # Clean up
        cache.release_lock(resource)
    
    def test_lock_timeout(self, cache, redis_client):
        """Test that locks expire after timeout."""
        resource = "test_resource_timeout"
        
        # Acquire lock with short timeout (1 second)
        acquired = cache.acquire_lock(resource, timeout=1)
        assert acquired is True
        
        # Wait for timeout
        import time
        time.sleep(2)
        
        # Lock should have expired, can acquire again
        acquired2 = cache.acquire_lock(resource, timeout=30)
        assert acquired2 is True
        
        # Clean up
        cache.release_lock(resource)


class TestSessionFeatures:
    """Test session feature flags."""
    
    def test_set_and_get_session_features(self, cache):
        """Test setting and getting session features."""
        session_id = "test_session_1"
        
        features = {
            "theme": "dark",
            "selected_features": ["bank_statement", "cdr"],
            "last_used_model": "gpt-4"
        }
        
        cache.set_session_features(session_id, features)
        retrieved = cache.get_session_features(session_id)
        
        assert retrieved is not None
        assert retrieved["theme"] == "dark"
        assert retrieved["selected_features"] == ["bank_statement", "cdr"]


class TestRedisClient:
    """Test low-level Redis client operations."""
    
    def test_redis_connection(self, redis_client):
        """Test that Redis client can connect."""
        # If Redis is not available, client should handle gracefully
        if redis_client.is_connected():
            assert redis_client.ping() is True
        else:
            pytest.skip("Redis not available")
    
    def test_basic_operations(self, redis_client):
        """Test basic Redis operations."""
        if not redis_client.is_connected():
            pytest.skip("Redis not available")
        
        key = "test_key"
        value = "test_value"
        
        # Set
        redis_client.set(key, value)
        
        # Get
        retrieved = redis_client.get(key)
        assert retrieved == value
        
        # Exists
        assert redis_client.exists(key) is True
        
        # Delete
        redis_client.delete(key)
        assert redis_client.exists(key) is False
    
    def test_json_operations(self, redis_client):
        """Test JSON serialization operations."""
        if not redis_client.is_connected():
            pytest.skip("Redis not available")
        
        key = "test_json_key"
        data = {"name": "test", "value": 123, "nested": {"key": "value"}}
        
        # Set JSON
        redis_client.set_json(key, data)
        
        # Get JSON
        retrieved = redis_client.get_json(key)
        assert retrieved == data


# Integration test: Complete chat flow with caching
def test_complete_chat_flow(cache):
    """Test complete chat flow with all caching operations."""
    if not get_redis_client().is_connected():
        pytest.skip("Redis not available")
    
    chat_id = "integration_test_chat"
    model_version = "gpt-4"
    
    # 1. User sends message
    user_message = "What is my account balance?"
    cache.add_chat_message(chat_id, "user", user_message)
    
    # 2. Check LLM cache
    cached_reply = cache.get_llm_cache(model_version, user_message)
    
    if cached_reply:
        assistant_reply = cached_reply["reply"]
    else:
        # 3. Call LLM (simulated)
        assistant_reply = "Your account balance is $1,234.56."
        
        # 4. Cache LLM response
        cache.set_llm_cache(model_version, user_message, assistant_reply, used_docs=["doc_123"])
    
    # 5. Add assistant response to context
    cache.add_chat_message(chat_id, "assistant", assistant_reply)
    
    # 6. Get full context
    messages = cache.get_chat_context(chat_id)
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    
    # 7. Second identical message should hit cache
    cached_reply2 = cache.get_llm_cache(model_version, user_message)
    assert cached_reply2 is not None
    assert cached_reply2["reply"] == assistant_reply


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])

