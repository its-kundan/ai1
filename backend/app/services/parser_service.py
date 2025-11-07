"""
Parser service for extracting structured data from OCR text.
Supports bank statements, CDR, and IPDR formats.
"""
import re
from typing import Dict, Any, Optional, List
from datetime import datetime
from app.utils.logging import get_logger
from app.models.pydantic_schemas import (
    BankStatementParsed, Transaction, CDRParsed, CDRRecord
)

logger = get_logger("parser_service")


class ParserService:
    """Service for parsing structured data from OCR text."""
    
    def __init__(self):
        """Initialize parser service."""
        pass
    
    def parse_bank_statement(self, ocr_text: str, tables: Optional[List] = None) -> Dict[str, Any]:
        """
        Parse bank statement from OCR text and tables.
        
        This is a rule-based parser. For production, consider ML-based extraction.
        
        Args:
            ocr_text: Raw OCR text
            tables: Extracted table rows (if available)
            
        Returns:
            Dictionary with parsed bank statement fields
        """
        parsed = {
            "account_number": None,
            "account_holder": None,
            "from_date": None,
            "to_date": None,
            "opening_balance": None,
            "closing_balance": None,
            "total_debits": None,
            "total_credits": None,
            "transactions": []
        }
        
        text = ocr_text.lower()
        
        # Extract account number (various patterns)
        account_patterns = [
            r'account\s*(?:no|number|#)[\s:]*([0-9x\*\-]{8,20})',
            r'acc\s*(?:no|number)[\s:]*([0-9x\*\-]{8,20})',
            r'account[\s:]*([0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4})',
        ]
        for pattern in account_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                parsed["account_number"] = match.group(1).strip()
                break
        
        # Extract date range
        date_patterns = [
            r'from\s+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\s+to\s+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})',
            r'period[\s:]+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\s+to\s+(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})',
        ]
        for pattern in date_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                parsed["from_date"] = match.group(1).strip()
                parsed["to_date"] = match.group(2).strip()
                break
        
        # Extract balances
        balance_patterns = [
            r'opening\s+balance[\s:]+([\d,]+\.?\d*)',
            r'closing\s+balance[\s:]+([\d,]+\.?\d*)',
            r'total\s+debit[s]?[\s:]+([\d,]+\.?\d*)',
            r'total\s+credit[s]?[\s:]+([\d,]+\.?\d*)',
        ]
        for pattern in balance_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                value_str = match.group(1).replace(',', '')
                try:
                    value = float(value_str)
                    if 'opening' in pattern:
                        parsed["opening_balance"] = value
                    elif 'closing' in pattern:
                        parsed["closing_balance"] = value
                    elif 'debit' in pattern:
                        parsed["total_debits"] = value
                    elif 'credit' in pattern:
                        parsed["total_credits"] = value
                except ValueError:
                    pass
        
        # Parse transactions from tables if available
        if tables:
            for table_row in tables:
                cells = table_row.cells if hasattr(table_row, 'cells') else table_row
                if len(cells) >= 3:
                    # Try to identify transaction pattern
                    # Common: Date, Description, Debit, Credit, Balance
                    transaction = {}
                    try:
                        # Date in first column
                        if re.match(r'\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}', str(cells[0])):
                            transaction["date"] = str(cells[0])
                        
                        # Description in second column
                        if len(cells) > 1:
                            transaction["description"] = str(cells[1])
                        
                        # Amounts in subsequent columns
                        for cell in cells[2:]:
                            cell_str = str(cell).replace(',', '').replace('₹', '').replace('$', '').strip()
                            try:
                                amount = float(cell_str)
                                if amount > 0:
                                    # Heuristic: negative or "dr" = debit, positive or "cr" = credit
                                    if 'dr' in cell_str.lower() or amount < 0:
                                        transaction["debit"] = abs(amount)
                                    else:
                                        transaction["credit"] = amount
                            except ValueError:
                                pass
                        
                        if transaction:
                            parsed["transactions"].append(transaction)
                    except Exception as e:
                        logger.debug(f"Failed to parse transaction row: {e}")
        
        logger.info(f"Parsed bank statement: {len(parsed['transactions'])} transactions found")
        return parsed
    
    def parse_cdr(self, ocr_text: str, tables: Optional[List] = None) -> Dict[str, Any]:
        """
        Parse CDR (Call Detail Record) from text or CSV-like tables.
        
        Args:
            ocr_text: Raw OCR text
            tables: Extracted table rows
            
        Returns:
            Dictionary with parsed CDR records
        """
        parsed = {
            "records": [],
            "total_records": 0,
            "date_range": None
        }
        
        records = []
        
        # If tables available, parse as structured data
        if tables:
            for table_row in tables:
                cells = table_row.cells if hasattr(table_row, 'cells') else table_row
                if len(cells) >= 3:
                    record = {}
                    # Common CDR format: Timestamp, MSISDN, IMEI, Duration, Type, Cell_ID
                    try:
                        if len(cells) > 0:
                            record["timestamp"] = str(cells[0])
                        if len(cells) > 1:
                            record["msisdn"] = str(cells[1])
                        if len(cells) > 2:
                            record["imei"] = str(cells[2])
                        if len(cells) > 3:
                            try:
                                record["duration"] = float(str(cells[3]))
                            except ValueError:
                                pass
                        if len(cells) > 4:
                            record["call_type"] = str(cells[4])
                        if len(cells) > 5:
                            record["cell_id"] = str(cells[5])
                        
                        if record:
                            records.append(record)
                    except Exception as e:
                        logger.debug(f"Failed to parse CDR row: {e}")
        
        # Also try to extract from raw text (CSV-like patterns)
        lines = ocr_text.split('\n')
        for line in lines:
            # CSV pattern: timestamp,msisdn,imei,duration,type,cell_id
            parts = [p.strip() for p in re.split(r'[,\t]', line)]
            if len(parts) >= 3:
                record = {}
                try:
                    record["timestamp"] = parts[0]
                    record["msisdn"] = parts[1]
                    if len(parts) > 2:
                        record["imei"] = parts[2]
                    if len(parts) > 3:
                        try:
                            record["duration"] = float(parts[3])
                        except ValueError:
                            pass
                    if len(parts) > 4:
                        record["call_type"] = parts[4]
                    if len(parts) > 5:
                        record["cell_id"] = parts[5]
                    
                    if record.get("timestamp") and record.get("msisdn"):
                        records.append(record)
                except Exception as e:
                    logger.debug(f"Failed to parse CDR line: {e}")
        
        parsed["records"] = records
        parsed["total_records"] = len(records)
        
        # Extract date range if available
        if records:
            timestamps = [r.get("timestamp") for r in records if r.get("timestamp")]
            if timestamps:
                parsed["date_range"] = {
                    "from": min(timestamps),
                    "to": max(timestamps)
                }
        
        logger.info(f"Parsed CDR: {len(records)} records found")
        return parsed
    
    def parse_ipdr(self, ocr_text: str, tables: Optional[List] = None) -> Dict[str, Any]:
        """
        Parse IPDR (IP Detail Record) - similar to CDR but for data usage.
        
        Args:
            ocr_text: Raw OCR text
            tables: Extracted table rows
            
        Returns:
            Dictionary with parsed IPDR records
        """
        # IPDR parsing is similar to CDR but may include data volume fields
        # For now, reuse CDR parser and extend if needed
        parsed = self.parse_cdr(ocr_text, tables)
        
        # Add IPDR-specific fields if found
        text = ocr_text.lower()
        for record in parsed["records"]:
            # Look for data volume patterns
            volume_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:mb|gb|kb)', text, re.IGNORECASE)
            if volume_match:
                record["data_volume"] = volume_match.group(1)
        
        return parsed
    
    def parse(
        self,
        doc_type: str,
        ocr_text: str,
        tables: Optional[List] = None
    ) -> Dict[str, Any]:
        """
        Main parse method that routes to specific parser based on doc_type.
        
        Args:
            doc_type: Type of document (bank_statement, cdr, ipdr, general)
            ocr_text: Raw OCR text
            tables: Extracted table rows
            
        Returns:
            Parsed data dictionary
        """
        if doc_type == "bank_statement":
            return self.parse_bank_statement(ocr_text, tables)
        elif doc_type == "cdr":
            return self.parse_cdr(ocr_text, tables)
        elif doc_type == "ipdr":
            return self.parse_ipdr(ocr_text, tables)
        else:
            # General: return raw text with minimal structure
            return {
                "raw_text": ocr_text,
                "text_length": len(ocr_text),
                "blocks_count": len(tables) if tables else 0
            }

