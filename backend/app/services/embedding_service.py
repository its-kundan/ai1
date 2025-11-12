"""
Embedding service using sentence-transformers and FAISS for vector search.
"""
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from app.utils.logging import get_logger
from app.utils.file_utils import FAISS_INDEX_DIR

logger = get_logger("embedding_service")


class EmbeddingService:
    """Service for generating embeddings and managing FAISS index."""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize embedding service.
        
        Args:
            model_name: Sentence transformer model name.
                       Default: "all-MiniLM-L6-v2" (small, fast, CPU-friendly)
                       Other options: "all-mpnet-base-v2" (larger, better quality)
        
        NOTE: Model will be auto-downloaded on first use from HuggingFace.
        """
        self.model_name = model_name
        self.model = None
        self.index = None
        self.vector_dim = None
        self.id_to_meta: Dict[int, Dict[str, Any]] = {}
        self.next_vector_id = 0
        self._initialize_model()
        self._load_index()
    
    def _initialize_model(self):
        """Lazy load sentence transformer model."""
        try:
            from sentence_transformers import SentenceTransformer
            
            logger.info(f"Loading sentence transformer model: {self.model_name}")
            # This will download the model on first use
            self.model = SentenceTransformer(self.model_name)
            # Get embedding dimension
            test_embedding = self.model.encode("test", convert_to_numpy=True)
            self.vector_dim = test_embedding.shape[0]
            logger.info(f"Model loaded. Embedding dimension: {self.vector_dim}")
        except ImportError:
            logger.error("sentence-transformers not installed. Install with: pip install sentence-transformers")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
    
    def _normalize_text(self, text: str, max_length: int = 500) -> str:
        """
        Normalize text for embedding (truncate, clean).
        
        Args:
            text: Input text
            max_length: Maximum character length
            
        Returns:
            Normalized text
        """
        # Remove extra whitespace
        text = " ".join(text.split())
        # Truncate if too long
        if len(text) > max_length:
            text = text[:max_length] + "..."
        return text.strip()
    
    def embed_texts(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings for a list of texts.
        
        Args:
            texts: List of text strings
            
        Returns:
            numpy array of shape (n_texts, embedding_dim)
        """
        if not self.model:
            raise RuntimeError("Embedding model not initialized")
        
        # Normalize texts
        normalized = [self._normalize_text(text) for text in texts]
        
        # Generate embeddings
        embeddings = self.model.encode(
            normalized,
            convert_to_numpy=True,
            show_progress_bar=False,
            batch_size=32
        )
        
        return embeddings
    
    def _initialize_faiss_index(self, dimension: int):
        """Initialize FAISS index."""
        try:
            import faiss
            
            # Use IndexFlatIP (inner product) for cosine similarity
            # Normalize vectors for cosine similarity
            self.index = faiss.IndexFlatIP(dimension)
            logger.info(f"Initialized FAISS index with dimension {dimension}")
        except ImportError:
            logger.error("faiss-cpu not installed. Install with: pip install faiss-cpu")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize FAISS index: {e}")
            raise
    
    def add_documents(
        self,
        document_id: str,
        text_snippets: List[str],
        metadata_list: Optional[List[Dict[str, Any]]] = None
    ) -> List[int]:
        """
        Add document snippets to FAISS index.
        
        Args:
            document_id: Document ID
            text_snippets: List of text snippets to embed
            metadata_list: Optional metadata for each snippet
            
        Returns:
            List of vector IDs assigned to these snippets
        """
        if not self.model:
            raise RuntimeError("Embedding model not initialized")
        
        if not text_snippets:
            return []
        
        # Generate embeddings
        embeddings = self.embed_texts(text_snippets)
        
        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings)
        
        # Initialize index if needed
        if self.index is None:
            self._initialize_faiss_index(embeddings.shape[1])
        
        # Get starting vector ID
        start_id = self.next_vector_id
        vector_ids = list(range(start_id, start_id + len(text_snippets)))
        
        # Add to index
        self.index.add(embeddings)
        
        # Store metadata
        for i, (snippet, vector_id) in enumerate(zip(text_snippets, vector_ids)):
            meta = {
                "document_id": document_id,
                "source_text": snippet,
                "vector_id": vector_id
            }
            if metadata_list and i < len(metadata_list):
                meta.update(metadata_list[i])
            
            self.id_to_meta[vector_id] = meta
        
        self.next_vector_id += len(text_snippets)
        logger.info(f"Added {len(text_snippets)} snippets for document {document_id}")
        
        return vector_ids
    
    def search(
        self,
        query: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for similar documents.
        
        Args:
            query: Search query text
            top_k: Number of results to return
            
        Returns:
            List of search results with doc_id, snippet, score, metadata
        """
        if not self.model or self.index is None:
            raise RuntimeError("Embedding service not initialized")
        
        if self.index.ntotal == 0:
            logger.warning("FAISS index is empty")
            return []
        
        # Embed query
        query_embedding = self.embed_texts([query])
        faiss.normalize_L2(query_embedding)
        
        # Search
        scores, indices = self.index.search(query_embedding, min(top_k, self.index.ntotal))
        
        # Format results
        results = []
        for score, vector_id in zip(scores[0], indices[0]):
            if vector_id == -1:  # FAISS returns -1 for empty results
                continue
            
            meta = self.id_to_meta.get(vector_id, {})
            results.append({
                "doc_id": meta.get("document_id", "unknown"),
                "snippet": meta.get("source_text", ""),
                "score": float(score),
                "bounding_box": meta.get("bbox"),
                "metadata": {k: v for k, v in meta.items() if k not in ["document_id", "source_text"]}
            })
        
        return results
    
    def save_index(self):
        """Save FAISS index and metadata to disk."""
        if self.index is None:
            logger.warning("No index to save")
            return
        
        try:
            import faiss
            
            # Save FAISS index
            index_path = FAISS_INDEX_DIR / "faiss.index"
            faiss.write_index(self.index, str(index_path))
            
            # Save metadata
            metadata_path = FAISS_INDEX_DIR / "metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump({
                    "id_to_meta": self.id_to_meta,
                    "next_vector_id": self.next_vector_id,
                    "model_name": self.model_name,
                    "vector_dim": self.vector_dim
                }, f, indent=2)
            
            logger.info(f"Saved FAISS index to {index_path}")
        except Exception as e:
            logger.error(f"Failed to save FAISS index: {e}")
    
    def _load_index(self):
        """Load FAISS index and metadata from disk."""
        index_path = FAISS_INDEX_DIR / "faiss.index"
        metadata_path = FAISS_INDEX_DIR / "metadata.json"
        
        if not index_path.exists() or not metadata_path.exists():
            logger.info("No existing FAISS index found. Starting fresh.")
            return
        
        try:
            import faiss
            
            # Load index
            self.index = faiss.read_index(str(index_path))
            
            # Load metadata
            with open(metadata_path, 'r') as f:
                data = json.load(f)
                self.id_to_meta = {int(k): v for k, v in data["id_to_meta"].items()}
                self.next_vector_id = data.get("next_vector_id", self.index.ntotal)
                self.vector_dim = data.get("vector_dim")
            
            logger.info(f"Loaded FAISS index with {self.index.ntotal} vectors")
        except Exception as e:
            logger.error(f"Failed to load FAISS index: {e}")
            # Start fresh
            self.index = None
            self.id_to_meta = {}
            self.next_vector_id = 0





