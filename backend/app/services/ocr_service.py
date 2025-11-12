"""
OCR service using EasyOCR (primary) and Tesseract (fallback).
Also handles table extraction from PDFs using Camelot/Tabula.
"""
from pathlib import Path
from typing import Dict, Any, List, Optional
import json
from app.utils.logging import get_logger
from app.models.pydantic_schemas import OCRResult, OCRBlock, TableRow

logger = get_logger("ocr_service")


class OCRService:
    """Service for OCR and table extraction."""
    
    def __init__(self):
        """Initialize OCR service.
        
        NOTE: EasyOCR will auto-download models on first use.
        Ensure you have installed: pip install easyocr
        For Tesseract fallback: Install Tesseract OCR system package.
        For table extraction: pip install camelot-py[cv] tabula-py
        """
        self.easyocr_reader = None
        self._initialize_easyocr()
    
    def _initialize_easyocr(self):
        """Lazy load EasyOCR reader."""
        try:
            import easyocr
            # Use small English model for faster startup
            # Full model list: https://github.com/JaidedAI/EasyOCR#supported-languages
            self.easyocr_reader = easyocr.Reader(['en'], gpu=False)
            logger.info("EasyOCR initialized successfully")
        except ImportError:
            logger.warning("EasyOCR not installed. Install with: pip install easyocr")
        except Exception as e:
            logger.error(f"Failed to initialize EasyOCR: {e}")
    
    def extract_text(self, image_path: Path) -> List[OCRBlock]:
        """
        Extract text from image using EasyOCR (fallback to Tesseract).
        
        Args:
            image_path: Path to image file
            
        Returns:
            List of OCR blocks with bounding boxes
        """
        blocks = []
        
        # Try EasyOCR first
        if self.easyocr_reader:
            try:
                results = self.easyocr_reader.readtext(str(image_path))
                for bbox, text, confidence in results:
                    # EasyOCR returns bbox as [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
                    if len(bbox) == 4:
                        x_coords = [p[0] for p in bbox]
                        y_coords = [p[1] for p in bbox]
                        blocks.append(OCRBlock(
                            text=text,
                            bbox={
                                "x1": min(x_coords),
                                "y1": min(y_coords),
                                "x2": max(x_coords),
                                "y2": max(y_coords)
                            },
                            confidence=float(confidence) if confidence else None
                        ))
                logger.info(f"Extracted {len(blocks)} text blocks using EasyOCR")
                return blocks
            except Exception as e:
                logger.warning(f"EasyOCR failed: {e}, trying Tesseract fallback")
        
        # Fallback to Tesseract
        try:
            import pytesseract
            from PIL import Image
            
            img = Image.open(image_path)
            data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
            
            for i in range(len(data['text'])):
                text = data['text'][i].strip()
                if text:
                    blocks.append(OCRBlock(
                        text=text,
                        bbox={
                            "x1": float(data['left'][i]),
                            "y1": float(data['top'][i]),
                            "x2": float(data['left'][i] + data['width'][i]),
                            "y2": float(data['top'][i] + data['height'][i])
                        },
                        confidence=float(data['conf'][i]) / 100.0 if data['conf'][i] != -1 else None
                    ))
            logger.info(f"Extracted {len(blocks)} text blocks using Tesseract")
        except ImportError:
            logger.error("Tesseract not available. Install pytesseract and Tesseract OCR")
        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}")
        
        return blocks
    
    def extract_tables_from_pdf(self, pdf_path: Path) -> List[TableRow]:
        """
        Extract tables from PDF using Camelot (primary) or Tabula (fallback).
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            List of table rows
        """
        tables = []
        
        # Try Camelot first
        try:
            import camelot
            
            # Extract tables from all pages
            camelot_tables = camelot.read_pdf(str(pdf_path), pages='all', flavor='lattice')
            
            for table_idx, table in enumerate(camelot_tables):
                df = table.df
                for row_idx, row in df.iterrows():
                    tables.append(TableRow(
                        row_index=row_idx,
                        cells=row.tolist(),
                        page=table.page if hasattr(table, 'page') else None
                    ))
            
            logger.info(f"Extracted {len(tables)} table rows using Camelot")
            return tables
            
        except ImportError:
            logger.warning("Camelot not installed. Install with: pip install camelot-py[cv]")
        except Exception as e:
            logger.warning(f"Camelot extraction failed: {e}, trying Tabula")
        
        # Fallback to Tabula
        try:
            import tabula
            
            dfs = tabula.read_pdf(str(pdf_path), pages='all', multiple_tables=True)
            
            for page_idx, df in enumerate(dfs):
                for row_idx, row in df.iterrows():
                    tables.append(TableRow(
                        row_index=row_idx,
                        cells=row.astype(str).tolist(),
                        page=page_idx + 1
                    ))
            
            logger.info(f"Extracted {len(tables)} table rows using Tabula")
        except ImportError:
            logger.warning("Tabula not installed. Install with: pip install tabula-py")
        except Exception as e:
            logger.error(f"Tabula extraction failed: {e}")
        
        return tables
    
    def process_document(
        self,
        file_path: Path,
        document_id: str,
        parse_tables: bool = True
    ) -> OCRResult:
        """
        Process document: extract text and optionally tables.
        
        Args:
            file_path: Path to document
            document_id: Document ID
            parse_tables: Whether to extract tables (for PDFs)
            
        Returns:
            OCRResult with extracted text and tables
        """
        import time
        start_time = time.time()
        
        blocks = []
        tables = []
        raw_text = ""
        
        file_ext = file_path.suffix.lower()
        
        # Extract text from images or PDF pages
        if file_ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
            blocks = self.extract_text(file_path)
            raw_text = " ".join([block.text for block in blocks])
        
        elif file_ext == '.pdf':
            # For PDFs, convert pages to images and OCR each
            # NOTE: This requires pdf2image. Install with: pip install pdf2image
            # Also requires poppler: https://github.com/oschwartz10612/poppler-windows/releases
            try:
                from pdf2image import convert_from_path
                images = convert_from_path(str(file_path))
                
                for page_num, image in enumerate(images):
                    # Save temp image
                    import tempfile
                    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
                        tmp_path = Path(tmp.name)
                        image.save(tmp_path)
                    
                    page_blocks = self.extract_text(tmp_path)
                    for block in page_blocks:
                        block.page = page_num + 1
                    blocks.extend(page_blocks)
                    
                    tmp_path.unlink()  # Cleanup
                
                raw_text = " ".join([block.text for block in blocks])
                
                # Extract tables if requested
                if parse_tables:
                    tables = self.extract_tables_from_pdf(file_path)
                    
            except ImportError:
                logger.warning("pdf2image not installed. Install with: pip install pdf2image")
                logger.warning("Also install poppler: https://github.com/oschwartz10612/poppler-windows/releases")
            except Exception as e:
                logger.error(f"PDF processing failed: {e}")
        
        processing_time = time.time() - start_time
        
        return OCRResult(
            document_id=document_id,
            raw_text=raw_text,
            blocks=blocks,
            tables=tables,
            processing_time=processing_time
        )





