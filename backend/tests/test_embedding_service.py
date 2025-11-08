"""
Unit tests for embedding service (with mocks).
"""
import pytest
import numpy as np
from unittest.mock import Mock, patch
from app.services.embedding_service import EmbeddingService


@patch('app.services.embedding_service.SentenceTransformer')
def test_embedding_service_initialization(mock_transformer):
    """Test embedding service initialization."""
    # Mock the model
    mock_model = Mock()
    mock_embedding = np.random.rand(384).astype(np.float32)
    mock_model.encode.return_value = mock_embedding
    mock_transformer.return_value = mock_model
    
    service = EmbeddingService()
    
    assert service.model is not None
    assert service.vector_dim == 384


@patch('app.services.embedding_service.SentenceTransformer')
@patch('app.services.embedding_service.faiss')
def test_add_and_search_documents(mock_faiss, mock_transformer):
    """Test adding documents and searching."""
    # Mock transformer
    mock_model = Mock()
    mock_embedding = np.random.rand(384).astype(np.float32)
    mock_model.encode.return_value = np.array([mock_embedding])
    mock_transformer.return_value = mock_model
    
    # Mock FAISS
    mock_index = Mock()
    mock_index.ntotal = 0
    mock_index.search.return_value = (
        np.array([[0.95, 0.85]]),
        np.array([[0, 1]])
    )
    mock_faiss.IndexFlatIP.return_value = mock_index
    mock_faiss.normalize_L2 = lambda x: x  # No-op for test
    
    service = EmbeddingService()
    
    # Add documents
    vector_ids = service.add_documents(
        document_id="doc_1",
        text_snippets=["This is a test document", "Another snippet"]
    )
    
    assert len(vector_ids) == 2
    assert mock_index.add.called
    
    # Search
    results = service.search("test query", top_k=2)
    
    assert len(results) > 0
    assert results[0]["doc_id"] == "doc_1"
    assert "score" in results[0]


