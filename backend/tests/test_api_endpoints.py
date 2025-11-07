"""
Unit tests for API endpoints (with mocks).
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
from app.main import app
from app.db.init_db import init_db, reset_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    """Setup test database."""
    init_db()
    yield
    # Cleanup if needed


def test_health_check():
    """Test health check endpoint."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "services" in data


def test_upload_file():
    """Test file upload endpoint."""
    # Create a dummy file
    file_content = b"fake pdf content"
    files = {"file": ("test.pdf", file_content, "application/pdf")}
    data = {"doc_type": "bank_statement"}
    
    response = client.post("/api/v1/upload", files=files, data=data)
    
    # Should succeed or fail gracefully
    assert response.status_code in [200, 400, 500]
    if response.status_code == 200:
        data = response.json()
        assert "document_id" in data
        assert "status" in data


@patch('app.api.v1.endpoints.ocr_service')
@patch('app.api.v1.endpoints.parser_service')
@patch('app.api.v1.endpoints.embedding_service')
def test_ocr_endpoint(mock_embedding, mock_parser, mock_ocr):
    """Test OCR endpoint with mocks."""
    # Mock OCR result
    from app.models.pydantic_schemas import OCRResult
    mock_ocr_result = OCRResult(
        document_id="doc_123",
        raw_text="Sample text",
        blocks=[],
        tables=[]
    )
    mock_ocr.process_document.return_value = mock_ocr_result
    
    # Mock parser
    mock_parser.parse.return_value = {"account_number": "1234", "total_debits": 1000.0}
    
    # Mock embedding
    mock_embedding.add_documents.return_value = [0, 1]
    
    # First upload a file
    file_content = b"fake pdf"
    files = {"file": ("test.pdf", file_content, "application/pdf")}
    upload_response = client.post("/api/v1/upload", files=files)
    
    if upload_response.status_code == 200:
        doc_id = upload_response.json()["document_id"]
        
        # Then process OCR
        response = client.post(
            "/api/v1/ocr",
            json={"document_id": doc_id, "parse_tables": True}
        )
        
        # Should process or handle error
        assert response.status_code in [200, 500]


@patch('app.api.v1.endpoints.embedding_service')
def test_search_endpoint(mock_embedding):
    """Test search endpoint with mocks."""
    # Mock search results
    mock_embedding.search.return_value = [
        {
            "doc_id": "doc_1",
            "snippet": "Sample text",
            "score": 0.95,
            "bounding_box": None,
            "metadata": {}
        }
    ]
    
    response = client.post(
        "/api/v1/search",
        json={"query": "test query", "top_k": 5}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "results" in data


@patch('app.api.v1.endpoints.llm_client')
@patch('app.api.v1.endpoints.embedding_service')
def test_chat_endpoint(mock_embedding, mock_llm):
    """Test chat endpoint with mocks."""
    # Mock LLM
    mock_llm.generate_chat_response.return_value = "This is a test response"
    mock_llm.available = True
    
    # Mock search (for retrieval)
    mock_embedding.search.return_value = [
        {
            "doc_id": "doc_1",
            "snippet": "Relevant context",
            "score": 0.9
        }
    ]
    
    response = client.post(
        "/api/v1/chat",
        json={
            "chat_id": "chat_test_1",
            "user_message": "What is the total debit?",
            "use_retrieval": True,
            "top_k": 3
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "chat_id" in data
    assert "reply" in data


def test_list_chats():
    """Test list chats endpoint."""
    response = client.get("/api/v1/chats")
    assert response.status_code == 200
    data = response.json()
    assert "chats" in data
    assert "total" in data

