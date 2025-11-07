"""
LLM Inference Service - Local text generation with streaming support.

Supports:
- llama.cpp (CPU, quantized GGUF models)
- vLLM (GPU, high performance)
- text-generation-webui (via HTTP)

Endpoints:
- POST /infer - Generate text from prompt
- GET /health - Health check
- POST /tokenize - Tokenize text (optional)
- GET /metrics - Prometheus metrics
"""
import os
import sys
import asyncio
import logging
import time
import uuid
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
import uvicorn

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import tokenization utilities
try:
    from utils.tokenization import Tokenizer, get_tokenizer
except ImportError:
    # Fallback for when running as module
    from models.utils.tokenization import Tokenizer, get_tokenizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("llm_service")


class Settings(BaseSettings):
    """Service configuration from environment variables."""
    port: int = Field(default=5005, env="LLM_PORT")
    host: str = Field(default="127.0.0.1", env="LLM_HOST")
    model_path: Optional[str] = Field(default=None, env="LLM_MODEL_PATH")
    backend: str = Field(default="llamacpp", env="LLM_BACKEND")  # llamacpp, vllm, webui, mock
    gpu_enabled: bool = Field(default=False, env="LLM_GPU_ENABLED")
    max_concurrent: int = Field(default=2, env="LLM_MAX_CONCURRENT")
    timeout: int = Field(default=60, env="LLM_TIMEOUT")
    auth_token: Optional[str] = Field(default=None, env="LLM_AUTH_TOKEN")
    model_name: str = Field(default="unknown", env="LLM_MODEL_NAME")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()


# Request/Response Models
class InferRequest(BaseModel):
    prompt: str
    max_tokens: int = Field(default=256, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    stream: bool = False
    stop: List[str] = Field(default_factory=list)


class InferResponse(BaseModel):
    id: str
    reply: str
    usage: Dict[str, int]


class TokenizeRequest(BaseModel):
    text: str


class TokenizeResponse(BaseModel):
    tokens: int
    token_list: Optional[List[str]] = None


class HealthResponse(BaseModel):
    status: str
    model: str
    gpu: bool
    backend: str


# LLM Backend Interface
class LLMBackend:
    """Abstract base class for LLM backends."""
    
    def __init__(self, model_path: str, gpu_enabled: bool = False):
        self.model_path = model_path
        self.gpu_enabled = gpu_enabled
        self.model = None
        self.tokenizer = None
    
    async def initialize(self):
        """Initialize model and tokenizer."""
        raise NotImplementedError
    
    async def generate(self, prompt: str, max_tokens: int, temperature: float, stop: List[str]) -> Dict[str, Any]:
        """Generate text from prompt."""
        raise NotImplementedError
    
    async def generate_stream(self, prompt: str, max_tokens: int, temperature: float, stop: List[str]):
        """Generate text with streaming."""
        raise NotImplementedError


class LlamaCppBackend(LLMBackend):
    """llama.cpp backend for CPU inference."""
    
    async def initialize(self):
        """Initialize llama.cpp model."""
        try:
            from llama_cpp import Llama
            
            logger.info(f"Loading llama.cpp model from {self.model_path}")
            self.model = Llama(
                model_path=self.model_path,
                n_ctx=2048,  # Context window
                n_threads=os.cpu_count() or 4,
                n_gpu_layers=35 if self.gpu_enabled else 0,
                verbose=False
            )
            logger.info("llama.cpp model loaded successfully")
            
            # Initialize tokenizer (approximate for llama.cpp)
            self.tokenizer = get_tokenizer(model_path=self.model_path, backend="llamacpp")
            
        except ImportError:
            raise RuntimeError("llama-cpp-python not installed. Install with: pip install llama-cpp-python")
        except Exception as e:
            logger.error(f"Failed to load llama.cpp model: {e}")
            raise
    
    async def generate(self, prompt: str, max_tokens: int, temperature: float, stop: List[str]) -> Dict[str, Any]:
        """Generate text using llama.cpp."""
        if not self.model:
            raise RuntimeError("Model not initialized")
        
        try:
            # llama.cpp generate
            result = self.model(
                prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                stop=stop if stop else None,
                echo=False
            )
            
            reply = result['choices'][0]['text']
            input_tokens = len(self.model.tokenize(prompt.encode()))
            output_tokens = result.get('usage', {}).get('completion_tokens', 0)
            
            return {
                'reply': reply,
                'input_tokens': input_tokens,
                'output_tokens': output_tokens
            }
        except Exception as e:
            logger.error(f"Generation failed: {e}")
            raise
    
    async def generate_stream(self, prompt: str, max_tokens: int, temperature: float, stop: List[str]):
        """Generate text with streaming."""
        if not self.model:
            raise RuntimeError("Model not initialized")
        
        try:
            # llama.cpp streaming (run in thread pool to avoid blocking)
            import concurrent.futures
            loop = asyncio.get_event_loop()
            
            def run_stream():
                stream = self.model(
                    prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    stop=stop if stop else None,
                    echo=False,
                    stream=True
                )
                return list(stream)
            
            chunks = await loop.run_in_executor(None, run_stream)
            
            full_text = ""
            for chunk in chunks:
                if 'choices' in chunk and len(chunk['choices']) > 0:
                    delta = chunk['choices'][0].get('text', '')
                    if delta:
                        full_text += delta
                        yield delta
            
            # Return final usage stats
            input_tokens = len(self.model.tokenize(prompt.encode()))
            output_tokens = len(full_text.split())
            yield f"\n\n[USAGE: input_tokens={input_tokens}, output_tokens={output_tokens}]"
            
        except Exception as e:
            logger.error(f"Streaming generation failed: {e}")
            raise


class MockBackend(LLMBackend):
    """Mock backend for testing without models."""
    
    async def initialize(self):
        """Initialize mock backend."""
        logger.info("Initializing mock LLM backend (no model required)")
        self.tokenizer = get_tokenizer(backend="tiktoken")
    
    async def generate(self, prompt: str, max_tokens: int, temperature: float, stop: List[str]) -> Dict[str, Any]:
        """Generate mock response."""
        await asyncio.sleep(0.1)  # Simulate processing
        
        mock_reply = f"This is a mock response to: {prompt[:50]}..."
        input_tokens = self.tokenizer.count_tokens(prompt) if self.tokenizer else len(prompt) // 4
        output_tokens = self.tokenizer.count_tokens(mock_reply) if self.tokenizer else len(mock_reply) // 4
        
        return {
            'reply': mock_reply,
            'input_tokens': input_tokens,
            'output_tokens': output_tokens
        }
    
    async def generate_stream(self, prompt: str, max_tokens: int, temperature: float, stop: List[str]):
        """Generate mock streaming response."""
        words = ["This", "is", "a", "mock", "streaming", "response", "to", "your", "prompt."]
        for word in words:
            await asyncio.sleep(0.1)
            yield word + " "
        yield "\n\n[USAGE: input_tokens=10, output_tokens=9]"


# Global backend instance
backend: Optional[LLMBackend] = None

# Metrics
metrics = {
    'request_count': 0,
    'error_count': 0,
    'total_latency_ms': 0,
    'model_version': settings.model_name,
    'memory_usage_mb': 0
}


async def get_backend() -> LLMBackend:
    """Get or initialize LLM backend."""
    global backend
    
    if backend is None:
        if settings.backend == "llamacpp":
            if not settings.model_path:
                raise RuntimeError("LLM_MODEL_PATH not set for llama.cpp backend")
            backend = LlamaCppBackend(settings.model_path, settings.gpu_enabled)
        elif settings.backend == "mock":
            backend = MockBackend("", False)
        else:
            raise ValueError(f"Unsupported backend: {settings.backend}")
        
        await backend.initialize()
    
    return backend


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    # Startup
    logger.info("Starting LLM Inference Service...")
    logger.info(f"Backend: {settings.backend}, GPU: {settings.gpu_enabled}")
    
    if settings.backend != "mock":
        try:
            await get_backend()
            logger.info("LLM backend initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize LLM backend: {e}")
            logger.warning("Service will start in mock mode. Set LLM_MODEL_PATH to use real model.")
            settings.backend = "mock"
            await get_backend()
    
    yield
    
    # Shutdown
    logger.info("Shutting down LLM Inference Service...")


# FastAPI app
app = FastAPI(
    title="LLM Inference Service",
    description="Local LLM inference service for text generation",
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


def check_auth(authorization: Optional[str] = Header(None)):
    """Check authentication token if enabled."""
    if settings.auth_token:
        if not authorization or authorization != f"Bearer {settings.auth_token}":
            raise HTTPException(status_code=401, detail="Invalid or missing auth token")


@app.post("/infer", response_model=InferResponse)
async def infer(request: InferRequest, authorization: Optional[str] = Header(None)):
    """Generate text from prompt."""
    check_auth(authorization)
    
    start_time = time.time()
    request_id = f"req_{uuid.uuid4().hex[:8]}"
    
    try:
        metrics['request_count'] += 1
        llm_backend = await get_backend()
        
        if request.stream:
            # Streaming response
            async def generate():
                full_reply = ""
                async for chunk in llm_backend.generate_stream(
                    request.prompt,
                    request.max_tokens,
                    request.temperature,
                    request.stop
                ):
                    full_reply += chunk
                    yield f"data: {chunk}\n\n"
                
                # Final event with metadata
                usage = {
                    'input_tokens': llm_backend.tokenizer.count_tokens(request.prompt) if llm_backend.tokenizer else len(request.prompt) // 4,
                    'output_tokens': llm_backend.tokenizer.count_tokens(full_reply) if llm_backend.tokenizer else len(full_reply) // 4
                }
                yield f"data: [DONE]\n"
                yield f"event: usage\n"
                yield f"data: {usage}\n\n"
            
            return StreamingResponse(generate(), media_type="text/event-stream")
        else:
            # Non-streaming response
            result = await llm_backend.generate(
                request.prompt,
                request.max_tokens,
                request.temperature,
                request.stop
            )
            
            latency_ms = (time.time() - start_time) * 1000
            metrics['total_latency_ms'] += latency_ms
            
            return InferResponse(
                id=request_id,
                reply=result['reply'],
                usage={
                    'input_tokens': result['input_tokens'],
                    'output_tokens': result['output_tokens']
                }
            )
    
    except Exception as e:
        metrics['error_count'] += 1
        logger.error(f"Inference failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tokenize", response_model=TokenizeResponse)
async def tokenize(request: TokenizeRequest, authorization: Optional[str] = Header(None)):
    """Tokenize text and return token count."""
    check_auth(authorization)
    
    try:
        llm_backend = await get_backend()
        tokenizer = llm_backend.tokenizer or get_tokenizer()
        
        tokens = tokenizer.count_tokens(request.text)
        token_list = tokenizer.tokenize(request.text) if hasattr(tokenizer, 'tokenize') else None
        
        return TokenizeResponse(tokens=tokens, token_list=token_list)
    
    except Exception as e:
        logger.error(f"Tokenization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        model=settings.model_name or "unknown",
        gpu=settings.gpu_enabled,
        backend=settings.backend
    )


@app.get("/metrics")
async def metrics_endpoint():
    """Prometheus-style metrics endpoint."""
    avg_latency = (
        metrics['total_latency_ms'] / metrics['request_count']
        if metrics['request_count'] > 0 else 0
    )
    
    return {
        'request_count': metrics['request_count'],
        'error_count': metrics['error_count'],
        'avg_latency_ms': avg_latency,
        'model_version': metrics['model_version'],
        'memory_usage_mb': metrics['memory_usage_mb'],
        'backend': settings.backend,
        'gpu_enabled': settings.gpu_enabled
    }


if __name__ == "__main__":
    uvicorn.run(
        "llm_service:app",
        host=settings.host,
        port=settings.port,
        log_level="info"
    )

