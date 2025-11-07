"""
Unit tests for parser service.
"""
import pytest
from app.services.parser_service import ParserService


def test_parse_bank_statement():
    """Test bank statement parsing."""
    parser = ParserService()
    
    # Sample bank statement text
    ocr_text = """
    Account Number: 1234567890123456
    Account Holder: John Doe
    Statement Period: 01/09/2025 to 30/09/2025
    
    Opening Balance: 50,000.00
    Closing Balance: 45,234.50
    
    Date        Description              Debit      Credit     Balance
    01/09/2025  Salary Credit            -          50,000.00  50,000.00
    05/09/2025  ATM Withdrawal           5,000.00   -          45,000.00
    10/09/2025  Online Payment           234.50     -          44,765.50
    15/09/09/2025  Interest Credit       -          469.00     45,234.50
    
    Total Debits: 5,234.50
    Total Credits: 50,469.00
    """
    
    parsed = parser.parse_bank_statement(ocr_text)
    
    assert parsed["account_number"] is not None
    assert "1234567890123456" in parsed["account_number"]
    assert parsed["from_date"] is not None
    assert parsed["to_date"] is not None
    assert parsed["opening_balance"] == 50000.0
    assert parsed["closing_balance"] == 45234.5
    assert parsed["total_debits"] == 5234.5
    assert parsed["total_credits"] == 50469.0


def test_parse_cdr():
    """Test CDR parsing."""
    parser = ParserService()
    
    # Sample CDR text
    ocr_text = """
    Timestamp,MSISDN,IMEI,Duration,Type,Cell_ID
    2025-09-01 10:00:00,9876543210,123456789012345,120.5,VOICE,CELL001
    2025-09-01 11:30:00,9876543210,123456789012345,45.2,SMS,CELL002
    2025-09-01 14:15:00,9876543211,123456789012346,300.0,DATA,CELL003
    """
    
    parsed = parser.parse_cdr(ocr_text)
    
    assert parsed["total_records"] > 0
    assert len(parsed["records"]) > 0
    assert parsed["records"][0]["msisdn"] is not None
    assert parsed["date_range"] is not None


def test_parse_general():
    """Test general document parsing."""
    parser = ParserService()
    
    ocr_text = "This is a general document with some text."
    
    parsed = parser.parse("general", ocr_text)
    
    assert "raw_text" in parsed
    assert parsed["text_length"] > 0

