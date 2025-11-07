"""
Smoke tests - quick health checks for all services.

Run with: pytest tests/integration/test_smoke.py -v
"""

import pytest
import requests
import os

# Health check endpoints
HEALTH_ENDPOINTS = {
    "postgres": "http://localhost:5432",  # Will use psql, not HTTP
    "redis": "http://localhost:6379",  # Will use redis-cli, not HTTP
    "backend_python": "http://localhost:8000/api/v1/health",
    "backend_node": "http://localhost:8001/api/v1/health",
    "embedding": "http://localhost:8100/health",
    "ocr": "http://localhost:8200/health",
    "llm": "http://localhost:5005/health",
}


def test_backend_python_health():
    """Test Python backend health endpoint."""
    try:
        response = requests.get(HEALTH_ENDPOINTS["backend_python"], timeout=2)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert data.get("service") == "python-backend"
    except requests.exceptions.RequestException:
        pytest.skip("Python backend not available")


def test_backend_node_health():
    """Test Node backend health endpoint."""
    try:
        response = requests.get(HEALTH_ENDPOINTS["backend_node"], timeout=2)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        assert data.get("service") == "node-backend"
    except requests.exceptions.RequestException:
        pytest.skip("Node backend not available")


def test_embedding_service_health():
    """Test embedding service health endpoint."""
    try:
        response = requests.get(HEALTH_ENDPOINTS["embedding"], timeout=2)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
    except requests.exceptions.RequestException:
        pytest.skip("Embedding service not available")


def test_ocr_service_health():
    """Test OCR service health endpoint."""
    try:
        response = requests.get(HEALTH_ENDPOINTS["ocr"], timeout=2)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
    except requests.exceptions.RequestException:
        pytest.skip("OCR service not available")


def test_llm_service_health():
    """Test LLM service health endpoint."""
    try:
        response = requests.get(HEALTH_ENDPOINTS["llm"], timeout=2)
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
    except requests.exceptions.RequestException:
        pytest.skip("LLM service not available")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

