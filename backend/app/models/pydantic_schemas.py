"""
Pydantic schemas for API request/response validation.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class DocumentType(str, Enum):
    """Document type for upload."""
    BANK_STATEMENT = "bank_statement"
    CDR = "cdr"
    IPDR = "ipdr"
    GENERAL = "general"


class DocumentStatus(str, Enum):
    """Document status."""
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


# ========== Upload Endpoint ==========

class UploadResponse(BaseModel):
    """Response for file upload."""
    document_id: str
    status: str
    filename: str


# ========== OCR Endpoint ==========

class OCRRequest(BaseModel):
    """Request for OCR processing."""
    document_id: Optional[str] = None
    parse_tables: bool = Field(default=True, description="Extract tables from PDFs")
    
    @validator('document_id')
    def document_id_or_file(cls, v, values):
        """Either document_id or file must be provided (file handled in endpoint)."""
        return v


class ParsedPreview(BaseModel):
    """Preview of parsed fields (first 5 keys)."""
    preview: Dict[str, Any] = Field(description="First 5 parsed fields")


class OCRResponse(BaseModel):
    """Response from OCR processing."""
    document_id: str
    status: str
    parsed_preview: Optional[ParsedPreview] = None
    error: Optional[str] = None


# ========== Search Endpoint ==========

class SearchRequest(BaseModel):
    """Request for semantic search."""
    query: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(default=5, ge=1, le=50)


class SearchResult(BaseModel):
    """Single search result."""
    doc_id: str
    snippet: str
    score: float = Field(..., ge=0.0, le=1.0)
    bounding_box: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class SearchResponse(BaseModel):
    """Response from semantic search."""
    query: str
    results: List[SearchResult]
    total_found: int


# ========== Chat Endpoint ==========

class ChatRequest(BaseModel):
    """Request for chat completion."""
    chat_id: str = Field(..., min_length=1)
    user_message: str = Field(..., min_length=1, max_length=5000)
    use_retrieval: bool = Field(default=True, description="Use RAG retrieval")
    top_k: int = Field(default=3, ge=1, le=10)


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    chat_id: str
    reply: str
    used_docs: List[str] = Field(default_factory=list)


# ========== Chat List Endpoint ==========

class ChatMetadata(BaseModel):
    """Chat session metadata."""
    chat_id: str
    last_active: datetime
    message_count: int
    title: Optional[str] = None


class ChatListResponse(BaseModel):
    """Response for chat list."""
    chats: List[ChatMetadata]
    total: int


# ========== Chat Messages Endpoint ==========

class MessageResponse(BaseModel):
    """Single chat message."""
    id: int
    chat_id: str
    role: str
    text: str
    timestamp: datetime
    used_docs: Optional[List[str]] = None


class ChatMessagesResponse(BaseModel):
    """Response for chat messages."""
    chat_id: str
    messages: List[MessageResponse]
    total: int
    page: int = 1
    page_size: int = 50


# ========== Parser Output Schemas ==========

class Transaction(BaseModel):
    """Bank statement transaction."""
    date: Optional[str] = None
    description: Optional[str] = None
    debit: Optional[float] = None
    credit: Optional[float] = None
    balance: Optional[float] = None
    reference: Optional[str] = None


class BankStatementParsed(BaseModel):
    """Parsed bank statement structure."""
    account_number: Optional[str] = None
    account_holder: Optional[str] = None
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    total_debits: Optional[float] = None
    total_credits: Optional[float] = None
    transactions: List[Transaction] = Field(default_factory=list)


class CDRRecord(BaseModel):
    """CDR/IPDR record."""
    timestamp: Optional[str] = None
    msisdn: Optional[str] = None
    imei: Optional[str] = None
    duration: Optional[float] = None
    call_type: Optional[str] = None
    cell_id: Optional[str] = None
    location: Optional[str] = None


class CDRParsed(BaseModel):
    """Parsed CDR/IPDR structure."""
    records: List[CDRRecord] = Field(default_factory=list)
    total_records: int = 0
    date_range: Optional[Dict[str, str]] = None


class OCRBlock(BaseModel):
    """OCR text block with bounding box."""
    text: str
    bbox: Dict[str, float]  # x1, y1, x2, y2
    confidence: Optional[float] = None
    page: Optional[int] = None


class TableRow(BaseModel):
    """Table row from PDF extraction."""
    row_index: int
    cells: List[str]
    page: Optional[int] = None


class OCRResult(BaseModel):
    """Complete OCR result structure."""
    document_id: str
    raw_text: str
    blocks: List[OCRBlock] = Field(default_factory=list)
    tables: List[TableRow] = Field(default_factory=list)
    parsed_data: Optional[Dict[str, Any]] = None  # BankStatementParsed or CDRParsed
    processing_time: Optional[float] = None


