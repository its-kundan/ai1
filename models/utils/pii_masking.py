"""
PII (Personally Identifiable Information) masking utilities.
Masks sensitive data like account numbers, phone numbers, SSN, etc.
"""
import re
import logging
from typing import Optional

logger = logging.getLogger("pii_masking")


def mask_account_number(text: str, keep_last: int = 4) -> str:
    """
    Mask account numbers, keeping only last N digits.
    
    Args:
        text: Input text containing account numbers
        keep_last: Number of digits to keep visible (default: 4)
        
    Returns:
        Text with account numbers masked
    """
    # Pattern for account numbers (8-20 digits, possibly with spaces/dashes)
    # Matches: 1234567890, 1234-5678-9012, 1234 5678 9012
    pattern = r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4,12}\b'
    
    def replace_match(match):
        account = re.sub(r'[\s-]', '', match.group())
        if len(account) >= keep_last:
            masked = '*' * (len(account) - keep_last) + account[-keep_last:]
            return masked
        return '*' * len(account)
    
    return re.sub(pattern, replace_match, text)


def mask_phone_number(text: str) -> str:
    """
    Mask phone numbers, keeping only last 4 digits.
    
    Args:
        text: Input text containing phone numbers
        
    Returns:
        Text with phone numbers masked
    """
    # Pattern for phone numbers (various formats)
    # Matches: +1-234-567-8900, (234) 567-8900, 234-567-8900, 2345678900
    patterns = [
        r'\+?\d{1,3}[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}',  # Standard formats
        r'\b\d{10}\b',  # 10-digit numbers
    ]
    
    for pattern in patterns:
        def replace_match(match):
            phone = re.sub(r'[\s\-\(\)\+]', '', match.group())
            if len(phone) >= 4:
                return '***-***-' + phone[-4:]
            return '***-***-****'
        
        text = re.sub(pattern, replace_match, text)
    
    return text


def mask_email(text: str) -> str:
    """
    Mask email addresses, keeping only domain.
    
    Args:
        text: Input text containing email addresses
        
    Returns:
        Text with emails masked
    """
    # Pattern for email addresses
    pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    
    def replace_match(match):
        email = match.group()
        parts = email.split('@')
        if len(parts) == 2:
            # Mask local part, keep domain
            local = parts[0]
            domain = parts[1]
            masked_local = local[0] + '*' * (len(local) - 1) if len(local) > 1 else '*'
            return f'{masked_local}@{domain}'
        return '***@***.***'
    
    return re.sub(pattern, replace_match, text)


def mask_ssn(text: str) -> str:
    """
    Mask Social Security Numbers (SSN).
    
    Args:
        text: Input text containing SSNs
        
    Returns:
        Text with SSNs masked
    """
    # Pattern for SSN (XXX-XX-XXXX or XXXXXXXXX)
    pattern = r'\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b'
    
    def replace_match(match):
        return '***-**-****'
    
    return re.sub(pattern, replace_match, text)


def mask_credit_card(text: str) -> str:
    """
    Mask credit card numbers, keeping only last 4 digits.
    
    Args:
        text: Input text containing credit card numbers
        
    Returns:
        Text with credit card numbers masked
    """
    # Pattern for credit cards (13-19 digits, possibly with spaces/dashes)
    pattern = r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b'
    
    def replace_match(match):
        card = re.sub(r'[\s-]', '', match.group())
        if len(card) >= 4:
            return '****-****-****-' + card[-4:]
        return '****-****-****-****'
    
    return re.sub(pattern, replace_match, text)


def mask_pii(text: str, 
             mask_accounts: bool = True,
             mask_phones: bool = True,
             mask_emails: bool = True,
             mask_ssns: bool = True,
             mask_cards: bool = True,
             account_keep_last: int = 4) -> str:
    """
    Mask all PII in text according to specified options.
    
    Args:
        text: Input text containing PII
        mask_accounts: Whether to mask account numbers
        mask_phones: Whether to mask phone numbers
        mask_emails: Whether to mask email addresses
        mask_ssns: Whether to mask SSNs
        mask_cards: Whether to mask credit card numbers
        account_keep_last: Number of account digits to keep visible
        
    Returns:
        Text with PII masked
    """
    if not text:
        return text
    
    result = text
    
    if mask_accounts:
        result = mask_account_number(result, keep_last=account_keep_last)
    
    if mask_phones:
        result = mask_phone_number(result)
    
    if mask_emails:
        result = mask_email(result)
    
    if mask_ssns:
        result = mask_ssn(result)
    
    if mask_cards:
        result = mask_credit_card(result)
    
    return result


def mask_iban(text: str) -> str:
    """
    Mask IBAN (International Bank Account Number).
    
    Args:
        text: Input text containing IBANs
        
    Returns:
        Text with IBANs masked
    """
    # Pattern for IBAN (2 letters + 2 digits + up to 30 alphanumeric)
    pattern = r'\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b'
    
    def replace_match(match):
        iban = match.group()
        if len(iban) >= 4:
            return iban[:4] + '*' * (len(iban) - 6) + iban[-2:] if len(iban) > 6 else '****'
        return '****'
    
    return re.sub(pattern, replace_match, text, flags=re.IGNORECASE)







