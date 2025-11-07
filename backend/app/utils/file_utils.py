"""
File utility functions for uploads and storage.
"""
from pathlib import Path
from typing import Optional, Tuple
import hashlib
import uuid
from datetime import datetime

# Base data directory
DATA_DIR = Path(__file__).parent.parent.parent / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
OCR_RESULTS_DIR = DATA_DIR / "ocr_results"
FAISS_INDEX_DIR = DATA_DIR / "faiss_index"

# Create directories
for dir_path in [UPLOADS_DIR, OCR_RESULTS_DIR, FAISS_INDEX_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)


def generate_document_id() -> str:
    """Generate a unique document ID."""
    return f"doc_{uuid.uuid4().hex[:12]}"


def save_uploaded_file(file_content: bytes, filename: str) -> Tuple[Path, str]:
    """
    Save uploaded file to data/uploads/ and return (file_path, document_id).
    
    Args:
        file_content: File bytes
        filename: Original filename
        
    Returns:
        Tuple of (file_path, document_id)
    """
    document_id = generate_document_id()
    # Preserve extension
    ext = Path(filename).suffix
    safe_filename = f"{document_id}{ext}"
    file_path = UPLOADS_DIR / safe_filename
    
    file_path.write_bytes(file_content)
    return file_path, document_id


def get_ocr_result_path(document_id: str) -> Path:
    """Get path for OCR result JSON file."""
    return OCR_RESULTS_DIR / f"{document_id}.json"


def validate_file_type(filename: str, allowed_extensions: Optional[list[str]] = None) -> bool:
    """
    Validate file extension.
    
    Args:
        filename: File name
        allowed_extensions: List of allowed extensions (e.g., ['.pdf', '.png', '.jpg'])
        
    Returns:
        True if valid
    """
    if allowed_extensions is None:
        allowed_extensions = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp']
    
    ext = Path(filename).suffix.lower()
    return ext in allowed_extensions


def validate_file_size(file_content: bytes, max_size_mb: int = 50) -> bool:
    """
    Validate file size.
    
    Args:
        file_content: File bytes
        max_size_mb: Maximum size in MB
        
    Returns:
        True if valid
    """
    size_mb = len(file_content) / (1024 * 1024)
    return size_mb <= max_size_mb


def mask_account_number(account_number: Optional[str]) -> Optional[str]:
    """
    Mask account number showing only last 4 digits.
    
    Args:
        account_number: Full account number
        
    Returns:
        Masked account number (e.g., "****1234")
    """
    if not account_number:
        return None
    
    account_number = str(account_number).strip()
    if len(account_number) <= 4:
        return "****"
    
    return "*" * (len(account_number) - 4) + account_number[-4:]

