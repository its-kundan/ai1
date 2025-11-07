"""
OCR/Document Vision Service - Extract text and tables from documents.

Supports:
- EasyOCR (CPU-friendly, default)
- PaddleOCR (better quality, optional)
- Camelot (table extraction from PDFs)

Endpoints:
- POST /ocr - Process document (multipart form or JSON)
- GET /health - Health check
- GET /metrics - Prometheus metrics
"""
import os
import sys
import logging
import time
import json
import uuid
from typing import List, Dict, Optional, Any
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
import uvicorn
import aiofiles

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import PII masking utilities
try:
    from utils.pii_masking import mask_pii
except ImportError:
    # Fallback for when running as module
    from models.utils.pii_masking import mask_pii

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ocr_service")


class Settings(BaseSettings):
    """Service configuration from environment variables."""
    port: int = Field(default=8200, env="OCR_PORT")
    host: str = Field(default="127.0.0.1", env="OCR_HOST")
    backend: str = Field(default="easyocr", env="OCR_BACKEND")  # easyocr, paddleocr
    gpu_enabled: bool = Field(default=False, env="OCR_GPU_ENABLED")
    max_concurrent: int = Field(default=3, env="OCR_MAX_CONCURRENT")
    auth_token: Optional[str] = Field(default=None, env="OCR_AUTH_TOKEN")
    upload_dir: str = Field(default="./data/uploads", env="OCR_UPLOAD_DIR")
    enable_table_extraction: bool = Field(default=True, env="OCR_ENABLE_TABLES")
    mask_pii: bool = Field(default=False, env="OCR_MASK_PII")  # Mask PII in extracted text
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.upload_dir, exist_ok=True)


# Request/Response Models
class OCRResponse(BaseModel):
    document_id: str
    raw_text_blocks: List[Dict[str, Any]]
    tables: List[Dict[str, Any]]
    structured_json: Optional[Dict[str, Any]] = None


class HealthResponse(BaseModel):
    status: str
    model: str
    gpu: bool
    backend: str


# Global OCR reader instance
ocr_reader = None


async def get_ocr_reader():
    """Get or initialize OCR reader."""
    global ocr_reader
    
    if ocr_reader is None:
        try:
            if settings.backend == "easyocr":
                import easyocr
                logger.info("Initializing EasyOCR...")
                device = "cuda" if settings.gpu_enabled else "cpu"
                ocr_reader = easyocr.Reader(['en'], gpu=settings.gpu_enabled)
                logger.info(f"EasyOCR initialized (device={device})")
            
            elif settings.backend == "paddleocr":
                from paddleocr import PaddleOCR
                logger.info("Initializing PaddleOCR...")
                use_gpu = settings.gpu_enabled
                ocr_reader = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=use_gpu)
                logger.info(f"PaddleOCR initialized (gpu={use_gpu})")
            
            else:
                raise ValueError(f"Unsupported OCR backend: {settings.backend}")
        
        except ImportError as e:
            raise RuntimeError(f"OCR library not installed. Install with: pip install {settings.backend}")
        except Exception as e:
            logger.error(f"Failed to initialize OCR reader: {e}")
            raise
    
    return ocr_reader


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    # Startup
    logger.info("Starting OCR Service...")
    logger.info(f"Backend: {settings.backend}, GPU: {settings.gpu_enabled}")
    
    try:
        await get_ocr_reader()
        logger.info("OCR reader initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize OCR reader: {e}")
        logger.warning("Service will start but OCR will fail until backend is available")
    
    yield
    
    # Shutdown
    logger.info("Shutting down OCR Service...")


# FastAPI app
app = FastAPI(
    title="OCR Service",
    description="Local OCR service for document text and table extraction",
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
    'total_pages_processed': 0
}


def check_auth(authorization: Optional[str] = Header(None)):
    """Check authentication token if enabled."""
    if settings.auth_token:
        if not authorization or authorization != f"Bearer {settings.auth_token}":
            raise HTTPException(status_code=401, detail="Invalid or missing auth token")


def extract_tables_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """Extract tables from PDF using Camelot."""
    tables = []
    
    if not settings.enable_table_extraction:
        return tables
    
    try:
        import camelot
        
        logger.info(f"Extracting tables from {pdf_path}")
        pdf_tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
        
        for i, table in enumerate(pdf_tables):
            # Convert table to list of lists
            table_data = table.df.values.tolist()
            
            tables.append({
                'page': table.page,
                'rows': table_data,
                'accuracy': table.accuracy if hasattr(table, 'accuracy') else None
            })
        
        logger.info(f"Extracted {len(tables)} tables from PDF")
    
    except ImportError:
        logger.warning("Camelot not installed. Table extraction disabled. Install with: pip install camelot-py[cv]")
    except Exception as e:
        logger.warning(f"Table extraction failed: {e}")
    
    return tables


async def process_image_with_ocr(image_path: str, page_num: int = 1) -> List[Dict[str, Any]]:
    """Process image with OCR and return text blocks."""
    reader = await get_ocr_reader()
    text_blocks = []
    
    try:
        if settings.backend == "easyocr":
            results = reader.readtext(image_path)
            
            for (bbox, text, confidence) in results:
                # bbox is [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                # Convert to [x, y, width, height] format
                x_coords = [point[0] for point in bbox]
                y_coords = [point[1] for point in bbox]
                x = min(x_coords)
                y = min(y_coords)
                width = max(x_coords) - x
                height = max(y_coords) - y
                
                text_blocks.append({
                    'page': page_num,
                    'bbox': [x, y, width, height],
                    'text': text,
                    'confidence': float(confidence)
                })
        
        elif settings.backend == "paddleocr":
            results = reader.ocr(image_path, cls=True)
            
            for line in results[0] if results else []:
                bbox = line[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
                text = line[1][0]
                confidence = line[1][1]
                
                x_coords = [point[0] for point in bbox]
                y_coords = [point[1] for point in bbox]
                x = min(x_coords)
                y = min(y_coords)
                width = max(x_coords) - x
                height = max(y_coords) - y
                
                text_blocks.append({
                    'page': page_num,
                    'bbox': [x, y, width, height],
                    'text': text,
                    'confidence': float(confidence)
                })
    
    except Exception as e:
        logger.error(f"OCR processing failed for {image_path}: {e}")
        raise
    
    return text_blocks


async def process_pdf(file_path: str) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Process PDF file: extract text and tables."""
    try:
        from pdf2image import convert_from_path
        
        # Convert PDF to images
        images = convert_from_path(file_path, dpi=200)
        logger.info(f"Converted PDF to {len(images)} images")
        
        all_text_blocks = []
        all_tables = []
        
        # Process each page
        for page_num, image in enumerate(images, 1):
            # Save temporary image
            temp_image_path = f"/tmp/ocr_page_{page_num}.png"
            image.save(temp_image_path, 'PNG')
            
            try:
                # OCR on image
                text_blocks = await process_image_with_ocr(temp_image_path, page_num)
                all_text_blocks.extend(text_blocks)
                
                metrics['total_pages_processed'] += 1
            finally:
                # Cleanup
                if os.path.exists(temp_image_path):
                    os.remove(temp_image_path)
        
        # Extract tables
        if settings.enable_table_extraction:
            all_tables = extract_tables_from_pdf(file_path)
        
        return all_text_blocks, all_tables
    
    except ImportError:
        raise RuntimeError("pdf2image not installed. Install with: pip install pdf2image")
    except Exception as e:
        logger.error(f"PDF processing failed: {e}")
        raise


@app.post("/ocr", response_model=OCRResponse)
async def ocr(
    document_id: str = Form(...),
    file: Optional[UploadFile] = File(None),
    file_path: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None)
):
    """Process document with OCR."""
    check_auth(authorization)
    
    start_time = time.time()
    
    try:
        metrics['request_count'] += 1
        
        # Get file path
        if file:
            # Save uploaded file
            file_ext = Path(file.filename).suffix if file.filename else ".pdf"
            saved_path = os.path.join(settings.upload_dir, f"{document_id}{file_ext}")
            
            async with aiofiles.open(saved_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            file_path = saved_path
        
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=400, detail="File not provided or not found")
        
        logger.info(f"Processing document: {file_path} (id={document_id})")
        
        # Determine file type
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext == '.pdf':
            text_blocks, tables = await process_pdf(file_path)
        elif file_ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
            text_blocks = await process_image_with_ocr(file_path, page_num=1)
            tables = []
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")
        
        # Mask PII if enabled
        if settings.mask_pii:
            for block in text_blocks:
                block['text'] = mask_pii(block['text'])
        
        # Build structured JSON (placeholder - can be enhanced with domain-specific parsers)
        structured_json = None
        if text_blocks:
            # Simple structure: combine all text
            full_text = " ".join([block['text'] for block in text_blocks])
            structured_json = {
                'full_text': full_text,
                'page_count': max([b['page'] for b in text_blocks], default=1),
                'text_block_count': len(text_blocks)
            }
        
        latency_ms = (time.time() - start_time) * 1000
        metrics['total_latency_ms'] += latency_ms
        
        logger.info(f"OCR completed: {len(text_blocks)} text blocks, {len(tables)} tables (latency={latency_ms:.2f}ms)")
        
        return OCRResponse(
            document_id=document_id,
            raw_text_blocks=text_blocks,
            tables=tables,
            structured_json=structured_json
        )
    
    except Exception as e:
        metrics['error_count'] += 1
        logger.error(f"OCR failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    try:
        await get_ocr_reader()
        return HealthResponse(
            status="ok",
            model=settings.backend,
            gpu=settings.gpu_enabled,
            backend=settings.backend
        )
    except Exception as e:
        return HealthResponse(
            status="error",
            model=settings.backend,
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
        'total_pages_processed': metrics['total_pages_processed'],
        'backend': settings.backend,
        'gpu_enabled': settings.gpu_enabled
    }


if __name__ == "__main__":
    uvicorn.run(
        "ocr_service:app",
        host=settings.host,
        port=settings.port,
        log_level="info"
    )

