"""
Ollama LLM Service - Direct connection to Ollama API.

This service acts as a lightweight proxy/wrapper around Ollama API.
Frontend can call this service directly, or call Ollama API directly.

Supports:
- DeepSeek models via Ollama
- Streaming responses
- Direct API access (no backend required)

Endpoints:
- POST /infer - Generate text from prompt (compatible with models/llm_service)
- POST /chat - Chat completion (Ollama-style)
- GET /health - Health check
- GET /models - List available Ollama models
"""
import os
import sys
import asyncio
import logging
import time
import uuid
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
import uvicorn
import httpx

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ollama_service")


class Settings(BaseSettings):
    """Service configuration from environment variables."""
    port: int = Field(default=5006, env="OLLAMA_PORT")
    host: str = Field(default="127.0.0.1", env="OLLAMA_HOST")
    ollama_base_url: str = Field(default="http://localhost:11434", env="OLLAMA_BASE_URL")
    model_name: str = Field(default="deepseek-chat:7b", env="OLLAMA_MODEL_NAME")
    timeout: int = Field(default=120, env="OLLAMA_TIMEOUT")
    auth_token: Optional[str] = Field(default=None, env="OLLAMA_AUTH_TOKEN")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()


# Request/Response Models
class InferRequest(BaseModel):
    """Compatible with models/llm_service API."""
    prompt: str
    max_tokens: int = Field(default=256, ge=1, le=8192)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    stream: bool = False
    stop: List[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    """Ollama-style chat request."""
    messages: List[Dict[str, str]]
    model: Optional[str] = None
    stream: bool = False
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=8192)


class InferResponse(BaseModel):
    id: str
    reply: str
    usage: Dict[str, int]


class HealthResponse(BaseModel):
    status: str
    model: str
    ollama_url: str
    ollama_connected: bool


class ModelsResponse(BaseModel):
    models: List[Dict[str, Any]]


# HTTP client for Ollama
http_client: Optional[httpx.AsyncClient] = None


async def get_http_client() -> httpx.AsyncClient:
    """Get or create HTTP client for Ollama."""
    global http_client
    if http_client is None:
        http_client = httpx.AsyncClient(
            base_url=settings.ollama_base_url,
            timeout=settings.timeout
        )
    return http_client


async def check_ollama_connection() -> bool:
    """Check if Ollama is running and accessible."""
    try:
        client = await get_http_client()
        response = await client.get("/api/tags")
        return response.status_code == 200
    except Exception as e:
        logger.warning(f"Ollama connection check failed: {e}")
        return False


async def check_model_exists(model_name: str) -> bool:
    """Check if the specified model exists in Ollama."""
    try:
        client = await get_http_client()
        response = await client.get("/api/tags")
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_names = [m.get("name", "") for m in models]
            return model_name in model_names
        return False
    except Exception as e:
        logger.error(f"Failed to check model existence: {e}")
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    # Startup
    logger.info("Starting Ollama LLM Service...")
    logger.info(f"Ollama URL: {settings.ollama_base_url}")
    logger.info(f"Model: {settings.model_name}")
    
    # Check Ollama connection
    connected = await check_ollama_connection()
    if connected:
        logger.info("✓ Ollama is running and accessible")
        
        # Check if model exists
        model_exists = await check_model_exists(settings.model_name)
        if model_exists:
            logger.info(f"✓ Model '{settings.model_name}' is available")
        else:
            logger.warning(f"⚠ Model '{settings.model_name}' not found in Ollama")
            logger.warning(f"  Install it with: ollama pull {settings.model_name}")
    else:
        logger.warning("⚠ Cannot connect to Ollama. Make sure Ollama is running.")
        logger.warning(f"  Start Ollama or check URL: {settings.ollama_base_url}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Ollama LLM Service...")
    global http_client
    if http_client:
        await http_client.aclose()
        http_client = None


# FastAPI app
app = FastAPI(
    title="Ollama LLM Service",
    description="Ollama-based LLM service for DeepSeek and other models",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - allow frontend to call directly
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
    """
    Generate text from prompt (compatible with models/llm_service API).
    
    This endpoint wraps Ollama's generate API to match the existing service interface.
    """
    check_auth(authorization)
    
    start_time = time.time()
    request_id = f"req_{uuid.uuid4().hex[:8]}"
    
    try:
        client = await get_http_client()
        
        # Convert to Ollama format
        ollama_request = {
            "model": settings.model_name,
            "prompt": request.prompt,
            "stream": request.stream,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            }
        }
        
        if request.stop:
            ollama_request["options"]["stop"] = request.stop
        
        if request.stream:
            # Streaming response
            async def generate():
                async with client.stream(
                    "POST",
                    "/api/generate",
                    json=ollama_request
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        raise HTTPException(
                            status_code=response.status_code,
                            detail=f"Ollama error: {error_text.decode()}"
                        )
                    
                    full_text = ""
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                import json
                                chunk = json.loads(line)
                                if "response" in chunk:
                                    text = chunk["response"]
                                    full_text += text
                                    yield f"data: {text}\n\n"
                                
                                if chunk.get("done", False):
                                    # Final usage stats
                                    usage = {
                                        'input_tokens': chunk.get("prompt_eval_count", 0),
                                        'output_tokens': chunk.get("eval_count", 0)
                                    }
                                    yield f"data: [DONE]\n"
                                    yield f"event: usage\n"
                                    yield f"data: {usage}\n\n"
                                    break
                            except json.JSONDecodeError:
                                continue
            
            return StreamingResponse(generate(), media_type="text/event-stream")
        else:
            # Non-streaming response
            response = await client.post("/api/generate", json=ollama_request)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama error: {response.text}"
                )
            
            result = response.json()
            
            return InferResponse(
                id=request_id,
                reply=result.get("response", ""),
                usage={
                    'input_tokens': result.get("prompt_eval_count", 0),
                    'output_tokens': result.get("eval_count", 0)
                }
            )
    
    except httpx.RequestError as e:
        logger.error(f"Ollama request failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Cannot connect to Ollama at {settings.ollama_base_url}. Make sure Ollama is running."
        )
    except Exception as e:
        logger.error(f"Inference failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(request: ChatRequest, authorization: Optional[str] = Header(None)):
    """
    Chat completion endpoint (Ollama-style).
    
    This is the native Ollama chat API format.
    """
    check_auth(authorization)
    
    model = request.model or settings.model_name
    
    try:
        client = await get_http_client()
        
        ollama_request = {
            "model": model,
            "messages": request.messages,
            "stream": request.stream,
            "options": {
                "temperature": request.temperature,
            }
        }
        
        if request.max_tokens:
            ollama_request["options"]["num_predict"] = request.max_tokens
        
        if request.stream:
            # Streaming response
            async def generate():
                async with client.stream(
                    "POST",
                    "/api/chat",
                    json=ollama_request
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        raise HTTPException(
                            status_code=response.status_code,
                            detail=f"Ollama error: {error_text.decode()}"
                        )
                    
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                import json
                                chunk = json.loads(line)
                                if "message" in chunk and "content" in chunk["message"]:
                                    text = chunk["message"]["content"]
                                    yield f"data: {text}\n\n"
                                
                                if chunk.get("done", False):
                                    yield f"data: [DONE]\n\n"
                                    break
                            except json.JSONDecodeError:
                                continue
            
            return StreamingResponse(generate(), media_type="text/event-stream")
        else:
            # Non-streaming response
            response = await client.post("/api/chat", json=ollama_request)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama error: {response.text}"
                )
            
            return response.json()
    
    except httpx.RequestError as e:
        logger.error(f"Ollama request failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Cannot connect to Ollama at {settings.ollama_base_url}. Make sure Ollama is running."
        )
    except Exception as e:
        logger.error(f"Chat failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    connected = await check_ollama_connection()
    model_exists = await check_model_exists(settings.model_name) if connected else False
    
    return HealthResponse(
        status="ok" if connected and model_exists else "warning",
        model=settings.model_name,
        ollama_url=settings.ollama_base_url,
        ollama_connected=connected
    )


@app.get("/models", response_model=ModelsResponse)
async def list_models(authorization: Optional[str] = Header(None)):
    """List all available Ollama models."""
    check_auth(authorization)
    
    try:
        client = await get_http_client()
        response = await client.get("/api/tags")
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Ollama error: {response.text}"
            )
        
        return ModelsResponse(models=response.json().get("models", []))
    
    except httpx.RequestError as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Cannot connect to Ollama at {settings.ollama_base_url}"
        )


if __name__ == "__main__":
    uvicorn.run(
        "ollama_service:app",
        host=settings.host,
        port=settings.port,
        log_level="info"
    )

