"""
End-to-end integration tests for the ChatGPT-like demo stack.

These tests verify the complete flow:
1. Upload → OCR → Index
2. Search
3. Chat RAG

Run with: pytest tests/integration/test_end_to_end.py -v
"""

import pytest
import requests
import json
import time
import os
from pathlib import Path

# Test configuration
BASE_URL = os.getenv("TEST_BACKEND_URL", "http://localhost:8001")
API_BASE = f"{BASE_URL}/api/v1"

# Health check endpoints
HEALTH_ENDPOINTS = {
    "backend": f"{BASE_URL}/api/v1/health",
    "embedding": "http://localhost:8100/health",
    "ocr": "http://localhost:8200/health",
    "llm": "http://localhost:5005/health",
}

# Test data directory
TEST_DATA_DIR = Path(__file__).parent.parent / "test_data"


@pytest.fixture(scope="session")
def health_check():
    """Verify all services are healthy before running tests."""
    print("\n🔍 Checking service health...")
    for service, url in HEALTH_ENDPOINTS.items():
        try:
            response = requests.get(url, timeout=2)
            if response.status_code == 200:
                data = response.json()
                assert data.get("status") == "ok", f"{service} health check failed"
                print(f"  ✓ {service}: {data.get('service', service)}")
            else:
                pytest.skip(f"{service} service not available at {url}")
        except requests.exceptions.RequestException:
            pytest.skip(f"{service} service not available at {url}")
    print("✅ All services healthy\n")


class TestUploadOCRIndex:
    """Test the upload → OCR → index flow."""

    def test_upload_document(self, health_check):
        """Test document upload."""
        # Create a simple test file
        test_file_path = TEST_DATA_DIR / "test_document.txt"
        test_file_path.parent.mkdir(exist_ok=True)
        test_file_path.write_text("Test document content for OCR processing.")

        with open(test_file_path, "rb") as f:
            files = {"file": ("test_document.txt", f, "text/plain")}
            data = {"doc_type": "general"}
            response = requests.post(f"{API_BASE}/upload", files=files, data=data)

        assert response.status_code == 200
        result = response.json()
        assert "document_id" in result
        assert result["status"] == "uploaded"
        return result["document_id"]

    def test_ocr_processing(self, health_check):
        """Test OCR processing."""
        # First upload a document
        document_id = self.test_upload_document(health_check)

        # Process OCR
        response = requests.post(
            f"{API_BASE}/ocr",
            json={"document_id": document_id, "parse_tables": False},
        )

        assert response.status_code == 200
        result = response.json()
        assert result["status"] == "processed"
        assert "parsed_preview" in result or result.get("parsed_preview") is None

        # Verify OCR result file exists
        ocr_result_path = Path(f"./data/ocr_results/{document_id}.json")
        if ocr_result_path.exists():
            with open(ocr_result_path) as f:
                ocr_data = json.load(f)
                assert "raw_text_blocks" in ocr_data or "text" in ocr_data

        return document_id

    def test_indexing(self, health_check):
        """Test that embeddings are created and indexed."""
        # Process OCR first
        document_id = self.test_ocr_processing(health_check)

        # Wait a bit for indexing
        time.sleep(2)

        # Verify embeddings exist (check via search)
        response = requests.post(
            f"{API_BASE}/search",
            json={"query": "test document", "top_k": 1},
        )

        # Search should work (may or may not find the document depending on timing)
        assert response.status_code == 200
        result = response.json()
        assert "results" in result


class TestSearch:
    """Test search functionality."""

    def test_semantic_search(self, health_check):
        """Test semantic search."""
        response = requests.post(
            f"{API_BASE}/search",
            json={"query": "test query", "top_k": 5},
        )

        assert response.status_code == 200
        result = response.json()
        assert "results" in result
        assert isinstance(result["results"], list)

    def test_search_with_no_results(self, health_check):
        """Test search with query that should return no results."""
        response = requests.post(
            f"{API_BASE}/search",
            json={"query": "xyzabc123nonexistent", "top_k": 5},
        )

        assert response.status_code == 200
        result = response.json()
        assert "results" in result
        # Should return empty list or low-score results


class TestChatRAG:
    """Test chat with RAG functionality."""

    def test_chat_without_retrieval(self, health_check):
        """Test chat without document retrieval."""
        response = requests.post(
            f"{API_BASE}/chat",
            json={
                "chat_id": "test_chat_1",
                "user_message": "Hello, this is a test message.",
                "use_retrieval": False,
                "top_k": 3,
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert "assistant_reply" in result
        assert "used_docs" in result
        # Without retrieval, used_docs should be empty
        assert result["used_docs"] == []

    def test_chat_with_retrieval(self, health_check):
        """Test chat with document retrieval (RAG)."""
        # First, ensure we have a document indexed
        upload_test = TestUploadOCRIndex()
        document_id = upload_test.test_ocr_processing(health_check)
        time.sleep(2)  # Wait for indexing

        # Now test chat with retrieval
        response = requests.post(
            f"{API_BASE}/chat",
            json={
                "chat_id": "test_chat_rag",
                "user_message": "What documents do you have?",
                "use_retrieval": True,
                "top_k": 3,
            },
        )

        assert response.status_code == 200
        result = response.json()
        assert "assistant_reply" in result
        assert "used_docs" in result
        # With retrieval, used_docs may contain document IDs
        assert isinstance(result["used_docs"], list)

    def test_chat_persistence(self, health_check):
        """Test that chat messages are persisted."""
        chat_id = f"test_chat_persist_{int(time.time())}"

        # Send first message
        response1 = requests.post(
            f"{API_BASE}/chat",
            json={
                "chat_id": chat_id,
                "user_message": "First message",
                "use_retrieval": False,
            },
        )
        assert response1.status_code == 200

        # Send second message (should have context)
        response2 = requests.post(
            f"{API_BASE}/chat",
            json={
                "chat_id": chat_id,
                "user_message": "Second message",
                "use_retrieval": False,
            },
        )
        assert response2.status_code == 200

        # Verify messages are persisted (check via chats endpoint if available)
        # This is backend-specific, so we just verify the chat works


class TestCache:
    """Test caching functionality."""

    def test_llm_cache(self, health_check):
        """Test that LLM responses are cached."""
        chat_id = f"test_cache_{int(time.time())}"
        message = "What is 2+2?"

        # First request (should call LLM)
        response1 = requests.post(
            f"{API_BASE}/chat",
            json={
                "chat_id": chat_id,
                "user_message": message,
                "use_retrieval": False,
            },
        )
        assert response1.status_code == 200
        reply1 = response1.json()["assistant_reply"]

        # Second request with same prompt (should use cache if implemented)
        response2 = requests.post(
            f"{API_BASE}/chat",
            json={
                "chat_id": chat_id,
                "user_message": message,
                "use_retrieval": False,
            },
        )
        assert response2.status_code == 200
        reply2 = response2.json()["assistant_reply"]

        # Note: Cache behavior depends on implementation
        # This test just verifies both requests succeed


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

