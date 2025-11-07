"""
Tokenization utilities for prompt management and token counting.
Supports multiple tokenizers (HuggingFace, llama.cpp compatible).
"""
import os
import logging
from typing import List, Optional

# Configure logging for standalone use
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tokenization")


class Tokenizer:
    """Tokenization utility for various model backends."""
    
    def __init__(self, model_path: Optional[str] = None, backend: str = "auto"):
        """
        Initialize tokenizer.
        
        Args:
            model_path: Path to model or tokenizer config
            backend: "auto", "huggingface", "llamacpp", or "tiktoken"
        """
        self.model_path = model_path
        self.backend = backend
        self.tokenizer = None
        self._initialize()
    
    def _initialize(self):
        """Initialize tokenizer based on backend."""
        if self.backend == "auto":
            # Try to detect based on model path
            if self.model_path and self.model_path.endswith(".gguf"):
                self.backend = "llamacpp"
            else:
                self.backend = "huggingface"
        
        try:
            if self.backend == "huggingface":
                from transformers import AutoTokenizer
                if self.model_path:
                    self.tokenizer = AutoTokenizer.from_pretrained(self.model_path)
                else:
                    # Use a default tokenizer (GPT-2 style)
                    self.tokenizer = AutoTokenizer.from_pretrained("gpt2")
                logger.info(f"Initialized HuggingFace tokenizer: {self.model_path or 'default'}")
            
            elif self.backend == "tiktoken":
                import tiktoken
                # Use cl100k_base (GPT-4 tokenizer)
                self.tokenizer = tiktoken.get_encoding("cl100k_base")
                logger.info("Initialized tiktoken tokenizer")
            
            elif self.backend == "llamacpp":
                # llama.cpp uses SentencePiece, try to load from model path
                # For now, use a simple approximation
                logger.info("Using simple tokenizer approximation for llama.cpp")
                self.tokenizer = None  # Will use character-based approximation
            
            else:
                raise ValueError(f"Unknown backend: {self.backend}")
                
        except ImportError as e:
            logger.warning(f"Failed to initialize {self.backend} tokenizer: {e}")
            logger.warning("Falling back to character-based approximation")
            self.tokenizer = None
    
    def count_tokens(self, text: str) -> int:
        """
        Count tokens in text.
        
        Args:
            text: Input text
            
        Returns:
            Token count
        """
        if self.tokenizer is None:
            # Fallback: approximate 1 token = 4 characters (rough estimate)
            return len(text) // 4
        
        try:
            if self.backend == "huggingface":
                tokens = self.tokenizer.encode(text, add_special_tokens=False)
                return len(tokens)
            elif self.backend == "tiktoken":
                return len(self.tokenizer.encode(text))
            else:
                return len(text) // 4
        except Exception as e:
            logger.warning(f"Tokenization failed: {e}, using approximation")
            return len(text) // 4
    
    def tokenize(self, text: str) -> List[str]:
        """
        Tokenize text into tokens.
        
        Args:
            text: Input text
            
        Returns:
            List of token strings
        """
        if self.tokenizer is None:
            # Simple word-based tokenization
            return text.split()
        
        try:
            if self.backend == "huggingface":
                tokens = self.tokenizer.tokenize(text)
                return tokens
            elif self.backend == "tiktoken":
                token_ids = self.tokenizer.encode(text)
                return [self.tokenizer.decode([tid]) for tid in token_ids]
            else:
                return text.split()
        except Exception as e:
            logger.warning(f"Tokenization failed: {e}")
            return text.split()
    
    def truncate_to_tokens(self, text: str, max_tokens: int) -> str:
        """
        Truncate text to fit within token limit.
        
        Args:
            text: Input text
            max_tokens: Maximum token count
            
        Returns:
            Truncated text
        """
        tokens = self.tokenize(text)
        if len(tokens) <= max_tokens:
            return text
        
        truncated = tokens[:max_tokens]
        
        if self.backend == "huggingface" and self.tokenizer:
            return self.tokenizer.convert_tokens_to_string(truncated)
        else:
            return " ".join(truncated)


# Global tokenizer instance (lazy initialized)
_global_tokenizer: Optional[Tokenizer] = None


def get_tokenizer(model_path: Optional[str] = None, backend: str = "auto") -> Tokenizer:
    """Get or create global tokenizer instance."""
    global _global_tokenizer
    if _global_tokenizer is None:
        _global_tokenizer = Tokenizer(model_path, backend)
    return _global_tokenizer


def count_tokens(text: str, model_path: Optional[str] = None) -> int:
    """Convenience function to count tokens."""
    tokenizer = get_tokenizer(model_path)
    return tokenizer.count_tokens(text)


def truncate_text(text: str, max_tokens: int, model_path: Optional[str] = None) -> str:
    """Convenience function to truncate text to token limit."""
    tokenizer = get_tokenizer(model_path)
    return tokenizer.truncate_to_tokens(text, max_tokens)

