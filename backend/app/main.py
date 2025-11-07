"""
FastAPI main application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.utils.logging import get_logger
from app.db.init_db import init_db
from app.api.v1.endpoints import router as v1_router

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    # Startup
    logger.info("Starting backend application...")
    
    # Initialize database
    try:
        init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
    
    # Initialize services (they will lazy-load models)
    logger.info("Services initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down backend application...")
    # Save FAISS index on shutdown
    try:
        from app.api.v1.endpoints import embedding_service
        embedding_service.save_index()
        logger.info("FAISS index saved")
    except Exception as e:
        logger.warning(f"Failed to save FAISS index: {e}")


# Create FastAPI app
app = FastAPI(
    title="ChatGPT-like Demo Backend",
    description="Local backend for OCR, parsing, embeddings, and chat with local LLM",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(v1_router, prefix="/api/v1", tags=["v1"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "ChatGPT-like Demo Backend",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

