"""
Database models using SQLModel for SQLite persistence.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from enum import Enum


class DocumentStatus(str, Enum):
    """Document processing status."""
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class DocumentType(str, Enum):
    """Document type classification."""
    BANK_STATEMENT = "bank_statement"
    CDR = "cdr"
    IPDR = "ipdr"
    GENERAL = "general"


class Document(SQLModel, table=True):
    """Document record in database."""
    __tablename__ = "documents"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: str = Field(unique=True, index=True)  # e.g., "doc_12345"
    filename: str
    file_path: str  # Path to file in data/uploads/
    doc_type: DocumentType = DocumentType.GENERAL
    status: DocumentStatus = DocumentStatus.UPLOADED
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    ocr_result_path: Optional[str] = None  # Path to data/ocr_results/{document_id}.json
    error_message: Optional[str] = None


class MessageRole(str, Enum):
    """Chat message role."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(SQLModel, table=True):
    """Chat message record."""
    __tablename__ = "chat_messages"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    chat_id: str = Field(index=True)  # e.g., "chat_1"
    role: MessageRole
    text: str
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    used_docs: Optional[str] = None  # JSON array of document_ids, e.g., '["doc_12345"]'


class Chat(SQLModel, table=True):
    """Chat session metadata."""
    __tablename__ = "chats"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    chat_id: str = Field(unique=True, index=True)  # e.g., "chat_1"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: datetime = Field(default_factory=datetime.utcnow, index=True)
    message_count: int = Field(default=0)
    title: Optional[str] = None  # Optional chat title


class VectorIndex(SQLModel, table=True):
    """Mapping from FAISS vector ID to document metadata."""
    __tablename__ = "vector_index"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    vector_id: int = Field(index=True)  # FAISS index ID
    document_id: str = Field(index=True)  # Reference to Document
    source_text: str  # Text snippet that was embedded
    metadata: Optional[str] = None  # JSON metadata (bounding box, page, etc.)

