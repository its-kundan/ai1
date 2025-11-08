"""
Embedding Service - Convert text to embedding vectors for semantic search.

Uses sentence-transformers for embeddings.
Supports CPU and GPU modes.

Endpoints:
- POST /embed - Generate embeddings for text(s)
- GET /health - Health check
- GET /metrics - Prometheus metrics
"""
import os
import sys
import logging
import time
from typing import List, Optional, Union
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
import uvicorn
import numpy as np

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("embedding_service")


class Settings(BaseSettings):
    """Service configuration from environment variables."""
    port: int = Field(default=8100, env="EMBED_PORT")
    host: str = Field(default="127.0.0.1", env="EMBED_HOST")
    model_name: str = Field(default="all-MiniLM-L6-v2", env="EMBED_MODEL_NAME")
    gpu_enabled: bool = Field(default=False, env="EMBED_GPU_ENABLED")
    max_concurrent: int = Field(default=10, env="EMBED_MAX_CONCURRENT")
    auth_token: Optional[str] = Field(default=None, env="EMBED_AUTH_TOKEN")
    device: str = Field(default="auto", env="EMBED_DEVICE")  # auto, cpu, cuda
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()


# Request/Response Models
class EmbedRequest(BaseModel):
    texts: Union[str, List[str]]


class EmbedResponse(BaseModel):
    vectors: List[List[float]]
    dims: int


class HealthResponse(BaseModel):
    status: str
    model: str
    dims: int
    device: str


# Global model instance
embedding_model = None
model_dims = None


async def get_embedding_model():
    """Get or initialize embedding model."""
    global embedding_model, model_dims
    
    if embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            
            logger.info(f"Loading embedding model: {settings.model_name}")
            
            # Determine device
            if settings.device == "auto":
                device = "cuda" if settings.gpu_enabled else "cpu"
            else:
                device = settings.device
            
            embedding_model = SentenceTransformer(settings.model_name, device=device)
            model_dims = embedding_model.get_sentence_embedding_dimension()
            
            logger.info(f"Embedding model loaded: {settings.model_name} (dims={model_dims}, device={device})")
            
        except ImportError:
            raise RuntimeError("sentence-transformers not installed. Install with: pip install sentence-transformers")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    return embedding_model, model_dims


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    # Startup
    logger.info("Starting Embedding Service...")
    logger.info(f"Model: {settings.model_name}, GPU: {settings.gpu_enabled}")
    
    try:
        await get_embedding_model()
        logger.info("Embedding model initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize embedding model: {e}")
        logger.warning("Service will start but embeddings will fail until model is available")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Embedding Service...")


# FastAPI app
app = FastAPI(
    title="Embedding Service",
    description="Local embedding service for text-to-vector conversion",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Metrics
metrics = {
    'request_count': 0,
    'error_count': 0,
    'total_latency_ms': 0,
    'total_texts_processed': 0
}


def check_auth(authorization: Optional[str] = Header(None)):
    """Check authentication token if enabled."""
    if settings.auth_token:
        if not authorization or authorization != f"Bearer {settings.auth_token}":
            raise HTTPException(status_code=401, detail="Invalid or missing auth token")


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest, authorization: Optional[str] = Header(None)):
    """Generate embeddings for text(s)."""
    check_auth(authorization)
    
    start_time = time.time()
    
    try:
        metrics['request_count'] += 1
        
        # Normalize input to list
        if isinstance(request.texts, str):
            texts = [request.texts]
        else:
            texts = request.texts
        
        if not texts:
            raise HTTPException(status_code=400, detail="Empty texts list")
        
        metrics['total_texts_processed'] += len(texts)
        
        # Get model
        model, dims = await get_embedding_model()
        
        # Generate embeddings
        embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        
        # Convert to list of lists
        vectors = embeddings.tolist()
        
        latency_ms = (time.time() - start_time) * 1000
        metrics['total_latency_ms'] += latency_ms
        
        logger.info(f"Generated embeddings for {len(texts)} texts (dims={dims}, latency={latency_ms:.2f}ms)")
        
        return EmbedResponse(vectors=vectors, dims=dims)
    
    except Exception as e:
        metrics['error_count'] += 1
        logger.error(f"Embedding failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    try:
        model, dims = await get_embedding_model()
        device = "cuda" if settings.gpu_enabled else "cpu"
        return HealthResponse(
            status="ok",
            model=settings.model_name,
            dims=dims,
            device=device
        )
    except Exception as e:
        return HealthResponse(
            status="error",
            model=settings.model_name,
            dims=0,
            device="unknown"
        )


@app.get("/metrics")
async def metrics_endpoint():
    """Prometheus-style metrics endpoint."""
    avg_latency = (
        metrics['total_latency_ms'] / metrics['request_count']
        if metrics['request_count'] > 0 else 0
    )
    avg_texts_per_request = (
        metrics['total_texts_processed'] / metrics['request_count']
        if metrics['request_count'] > 0 else 0
    )
    
    return {
        'request_count': metrics['request_count'],
        'error_count': metrics['error_count'],
        'avg_latency_ms': avg_latency,
        'total_texts_processed': metrics['total_texts_processed'],
        'avg_texts_per_request': avg_texts_per_request,
        'model': settings.model_name,
        'dims': model_dims or 0,
        'gpu_enabled': settings.gpu_enabled
    }


if __name__ == "__main__":
    uvicorn.run(
        "embedding_service:app",
        host=settings.host,
        port=settings.port,
        log_level="info"
    )


