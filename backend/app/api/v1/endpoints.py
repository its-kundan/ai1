"""
API v1 endpoints for the ChatGPT-like demo backend.
"""
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from typing import Optional, List
from pathlib import Path
import json
from datetime import datetime

from app.db.init_db import get_session
from app.models.db_models import Document, DocumentStatus, DocumentType, ChatMessage, MessageRole, Chat, VectorIndex
from app.models.pydantic_schemas import (
    UploadResponse, OCRRequest, OCRResponse, ParsedPreview,
    SearchRequest, SearchResponse, SearchResult,
    ChatRequest, ChatResponse,
    ChatListResponse, ChatMetadata,
    ChatMessagesResponse, MessageResponse
)
from app.services.ocr_service import OCRService
from app.services.parser_service import ParserService
from app.services.embedding_service import EmbeddingService
from app.services.llm_client import LLMClient
from app.utils.file_utils import (
    save_uploaded_file, get_ocr_result_path, validate_file_type,
    validate_file_size, mask_account_number
)
from app.utils.logging import get_logger

logger = get_logger("api")

router = APIRouter()

# Initialize services (singleton pattern)
ocr_service = OCRService()
parser_service = ParserService()
embedding_service = EmbeddingService()
llm_client = LLMClient()


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    doc_type: Optional[str] = Form(None),
    session: Session = Depends(get_session)
):
    """
    Upload a file (PDF/image) for processing.
    
    Accepts: multipart file, optional doc_type (bank_statement | cdr | ipdr | general)
    """
    try:
        # Validate file type
        if not validate_file_type(file.filename):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Allowed: PDF, PNG, JPG, JPEG, TIFF, BMP"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Validate file size (50MB max)
        if not validate_file_size(file_content, max_size_mb=50):
            raise HTTPException(
                status_code=400,
                detail="File too large. Maximum size: 50MB"
            )
        
        # Save file
        file_path, document_id = save_uploaded_file(file_content, file.filename)
        
        # Determine document type
        doc_type_enum = DocumentType.GENERAL
        if doc_type:
            try:
                doc_type_enum = DocumentType(doc_type)
            except ValueError:
                logger.warning(f"Invalid doc_type: {doc_type}, using GENERAL")
        
        # Create document record
        document = Document(
            document_id=document_id,
            filename=file.filename,
            file_path=str(file_path),
            doc_type=doc_type_enum,
            status=DocumentStatus.UPLOADED
        )
        session.add(document)
        session.commit()
        session.refresh(document)
        
        logger.info(f"File uploaded: {document_id} ({file.filename}")
        
        return UploadResponse(
            document_id=document_id,
            status="uploaded",
            filename=file.filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/ocr", response_model=OCRResponse)
async def process_ocr(
    request: Optional[OCRRequest] = None,
    file: Optional[UploadFile] = File(None),
    document_id: Optional[str] = Form(None),
    parse_tables: bool = Form(True),
    session: Session = Depends(get_session)
):
    """
    Trigger OCR + parsing for a document.
    
    Can accept document_id (from upload) or raw file upload.
    """
    try:
        # Determine document_id and file_path
        doc_id = None
        file_path = None
        doc_type = DocumentType.GENERAL
        
        if request and request.document_id:
            doc_id = request.document_id
            parse_tables = request.parse_tables
        elif document_id:
            doc_id = document_id
        elif file:
            # Upload file first
            file_content = await file.read()
            if not validate_file_type(file.filename) or not validate_file_size(file_content):
                raise HTTPException(status_code=400, detail="Invalid file")
            file_path, doc_id = save_uploaded_file(file_content, file.filename)
            # Create document record
            document = Document(
                document_id=doc_id,
                filename=file.filename,
                file_path=str(file_path),
                status=DocumentStatus.UPLOADED
            )
            session.add(document)
            session.commit()
        else:
            raise HTTPException(status_code=400, detail="Either document_id or file required")
        
        # Get document from DB
        statement = select(Document).where(Document.document_id == doc_id)
        document = session.exec(statement).first()
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        file_path = Path(document.file_path)
        doc_type = document.doc_type
        
        # Update status
        document.status = DocumentStatus.PROCESSING
        session.add(document)
        session.commit()
        
        # Run OCR
        logger.info(f"Processing OCR for document {doc_id}")
        ocr_result = ocr_service.process_document(
            file_path=file_path,
            document_id=doc_id,
            parse_tables=parse_tables
        )
        
        # Parse based on document type
        parsed_data = parser_service.parse(
            doc_type=doc_type.value,
            ocr_text=ocr_result.raw_text,
            tables=ocr_result.tables
        )
        
        # Mask sensitive data in parsed output
        if isinstance(parsed_data, dict) and "account_number" in parsed_data:
            parsed_data["account_number"] = mask_account_number(parsed_data["account_number"])
        
        # Save OCR result
        ocr_result.parsed_data = parsed_data
        ocr_result_path = get_ocr_result_path(doc_id)
        with open(ocr_result_path, 'w') as f:
            json.dump(ocr_result.dict(), f, indent=2, default=str)
        
        # Generate embeddings and add to FAISS
        # Split text into chunks for embedding
        text_chunks = []
        metadata_list = []
        
        # Add OCR blocks as chunks
        for block in ocr_result.blocks[:50]:  # Limit to first 50 blocks
            text_chunks.append(block.text)
            metadata_list.append({
                "bbox": block.bbox,
                "page": block.page,
                "confidence": block.confidence
            })
        
        # Add table rows as chunks
        for table_row in ocr_result.tables[:20]:  # Limit to first 20 rows
            row_text = " | ".join(str(cell) for cell in table_row.cells)
            text_chunks.append(row_text)
            metadata_list.append({
                "type": "table",
                "row_index": table_row.row_index,
                "page": table_row.page
            })
        
        if text_chunks:
            vector_ids = embedding_service.add_documents(
                document_id=doc_id,
                text_snippets=text_chunks,
                metadata_list=metadata_list
            )
            # Save vector index mapping
            for vector_id, meta in zip(vector_ids, metadata_list):
                vector_record = VectorIndex(
                    vector_id=vector_id,
                    document_id=doc_id,
                    source_text=text_chunks[vector_ids.index(vector_id)],
                    metadata=json.dumps(meta)
                )
                session.add(vector_record)
        
        # Save FAISS index
        embedding_service.save_index()
        
        # Update document status
        document.status = DocumentStatus.PROCESSED
        document.ocr_result_path = str(ocr_result_path)
        session.add(document)
        session.commit()
        
        # Create preview (first 5 keys)
        preview_dict = {}
        if isinstance(parsed_data, dict):
            for i, (key, value) in enumerate(list(parsed_data.items())[:5]):
                preview_dict[key] = value
        
        return OCRResponse(
            document_id=doc_id,
            status="processed",
            parsed_preview=ParsedPreview(preview=preview_dict) if preview_dict else None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OCR processing failed: {e}", exc_info=True)
        # Update document status to failed
        if doc_id:
            statement = select(Document).where(Document.document_id == doc_id)
            document = session.exec(statement).first()
            if document:
                document.status = DocumentStatus.FAILED
                document.error_message = str(e)
                session.add(document)
                session.commit()
        
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@router.post("/search", response_model=SearchResponse)
async def semantic_search(
    request: SearchRequest,
    session: Session = Depends(get_session)
):
    """
    Semantic search across indexed documents.
    """
    try:
        # Perform search
        results = embedding_service.search(
            query=request.query,
            top_k=request.top_k
        )
        
        # Format results
        search_results = []
        for result in results:
            # Mask account numbers in snippets
            snippet = result["snippet"]
            # Simple heuristic: mask numbers that look like account numbers
            import re
            snippet = re.sub(r'\b\d{8,}\b', lambda m: mask_account_number(m.group()), snippet)
            
            search_results.append(SearchResult(
                doc_id=result["doc_id"],
                snippet=snippet,
                score=result["score"],
                bounding_box=result.get("bounding_box"),
                metadata=result.get("metadata")
            ))
        
        return SearchResponse(
            query=request.query,
            results=search_results,
            total_found=len(search_results)
        )
        
    except Exception as e:
        logger.error(f"Search failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    session: Session = Depends(get_session)
):
    """
    Chat endpoint with optional RAG retrieval.
    """
    try:
        # Get or create chat
        statement = select(Chat).where(Chat.chat_id == request.chat_id)
        chat = session.exec(statement).first()
        
        if not chat:
            chat = Chat(
                chat_id=request.chat_id,
                message_count=0
            )
            session.add(chat)
            session.commit()
        
        # Load last N messages (sliding window, e.g., last 6)
        statement = select(ChatMessage).where(
            ChatMessage.chat_id == request.chat_id
        ).order_by(ChatMessage.timestamp.desc()).limit(6)
        recent_messages = list(reversed(session.exec(statement).all()))
        
        # Build message history
        messages = []
        for msg in recent_messages:
            messages.append({
                "role": msg.role.value,
                "content": msg.text
            })
        
        # Add current user message
        messages.append({
            "role": "user",
            "content": request.user_message
        })
        
        # Retrieve context if requested
        retrieved_context = None
        used_docs = []
        
        if request.use_retrieval:
            try:
                search_results = embedding_service.search(
                    query=request.user_message,
                    top_k=request.top_k
                )
                
                if search_results:
                    context_parts = []
                    doc_ids = set()
                    for result in search_results:
                        context_parts.append(f"Document {result['doc_id']}: {result['snippet']}")
                        doc_ids.add(result['doc_id'])
                    
                    retrieved_context = "\n".join(context_parts)
                    used_docs = list(doc_ids)
            except Exception as e:
                logger.warning(f"Retrieval failed: {e}")
        
        # Generate response
        system_prompt = """You are a helpful assistant that answers questions based on provided context.
If the context contains relevant information, use it to answer. Otherwise, answer based on your knowledge.
Be concise and accurate."""
        
        try:
            assistant_reply = llm_client.generate_chat_response(
                system_prompt=system_prompt,
                messages=messages,
                retrieved_context=retrieved_context
            )
        except RuntimeError as e:
            logger.error(f"LLM generation failed: {e}")
            # Fallback response
            assistant_reply = "I'm sorry, the language model service is not available. Please ensure your local LLM server is running."
        
        # Save messages to DB
        user_msg = ChatMessage(
            chat_id=request.chat_id,
            role=MessageRole.USER,
            text=request.user_message,
            used_docs=json.dumps(used_docs) if used_docs else None
        )
        assistant_msg = ChatMessage(
            chat_id=request.chat_id,
            role=MessageRole.ASSISTANT,
            text=assistant_reply,
            used_docs=json.dumps(used_docs) if used_docs else None
        )
        
        session.add(user_msg)
        session.add(assistant_msg)
        
        # Update chat metadata
        chat.last_active = datetime.utcnow()
        chat.message_count += 2
        session.add(chat)
        session.commit()
        
        return ChatResponse(
            chat_id=request.chat_id,
            reply=assistant_reply,
            used_docs=used_docs
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.get("/chats", response_model=ChatListResponse)
async def list_chats(
    session: Session = Depends(get_session)
):
    """List all chat sessions."""
    try:
        statement = select(Chat).order_by(Chat.last_active.desc())
        chats = session.exec(statement).all()
        
        chat_list = [
            ChatMetadata(
                chat_id=chat.chat_id,
                last_active=chat.last_active,
                message_count=chat.message_count,
                title=chat.title
            )
            for chat in chats
        ]
        
        return ChatListResponse(
            chats=chat_list,
            total=len(chat_list)
        )
    except Exception as e:
        logger.error(f"List chats failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list chats: {str(e)}")


@router.get("/chats/{chat_id}/messages", response_model=ChatMessagesResponse)
async def get_chat_messages(
    chat_id: str,
    page: int = 1,
    page_size: int = 50,
    session: Session = Depends(get_session)
):
    """Get messages for a specific chat."""
    try:
        # Validate chat exists
        statement = select(Chat).where(Chat.chat_id == chat_id)
        chat = session.exec(statement).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Get messages with pagination
        offset = (page - 1) * page_size
        statement = (
            select(ChatMessage)
            .where(ChatMessage.chat_id == chat_id)
            .order_by(ChatMessage.timestamp.asc())
            .offset(offset)
            .limit(page_size)
        )
        messages = session.exec(statement).all()
        
        message_list = []
        for msg in messages:
            used_docs = None
            if msg.used_docs:
                try:
                    used_docs = json.loads(msg.used_docs)
                except:
                    pass
            
            message_list.append(MessageResponse(
                id=msg.id,
                chat_id=msg.chat_id,
                role=msg.role.value,
                text=msg.text,
                timestamp=msg.timestamp,
                used_docs=used_docs
            ))
        
        return ChatMessagesResponse(
            chat_id=chat_id,
            messages=message_list,
            total=chat.message_count,
            page=page,
            page_size=page_size
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get messages failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get messages: {str(e)}")


@router.post("/cache/clear")
async def clear_cache(
    session: Session = Depends(get_session)
):
    """Clear local caches (FAISS index reload, etc.)."""
    try:
        # Reload FAISS index (this will clear in-memory state)
        embedding_service._load_index()
        
        return {"status": "cache_cleared", "message": "FAISS index reloaded"}
    except Exception as e:
        logger.error(f"Cache clear failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Cache clear failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "python-backend",
        "services": {
            "ocr": ocr_service.easyocr_reader is not None,
            "embedding": embedding_service.model is not None,
            "llm": llm_client.available
        }
    }

