"""
Unit tests for tokenization utilities.
"""
import pytest
from models.utils.tokenization import Tokenizer, count_tokens, truncate_text


class TestTokenizer:
    """Tests for Tokenizer class."""
    
    def test_count_tokens_approximation(self):
        """Test token counting with approximation fallback."""
        tokenizer = Tokenizer(backend="llamacpp")
        text = "This is a test sentence."
        count = tokenizer.count_tokens(text)
        assert count > 0
        assert isinstance(count, int)
    
    def test_tokenize_basic(self):
        """Test basic tokenization."""
        tokenizer = Tokenizer(backend="llamacpp")
        text = "Hello world"
        tokens = tokenizer.tokenize(text)
        assert isinstance(tokens, list)
        assert len(tokens) > 0
    
    def test_truncate_to_tokens(self):
        """Test text truncation."""
        tokenizer = Tokenizer(backend="llamacpp")
        text = "This is a very long text that needs to be truncated."
        truncated = tokenizer.truncate_to_tokens(text, max_tokens=5)
        assert tokenizer.count_tokens(truncated) <= 5


class TestConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_count_tokens_function(self):
        """Test count_tokens convenience function."""
        text = "Test text"
        count = count_tokens(text)
        assert count > 0
    
    def test_truncate_text_function(self):
        """Test truncate_text convenience function."""
        text = "This is a test"
        truncated = truncate_text(text, max_tokens=3)
        assert count_tokens(truncated) <= 3







