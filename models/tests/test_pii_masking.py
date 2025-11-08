"""
Unit tests for PII masking utilities.
"""
import pytest
from models.utils.pii_masking import (
    mask_account_number,
    mask_phone_number,
    mask_email,
    mask_ssn,
    mask_credit_card,
    mask_pii,
    mask_iban
)


class TestAccountNumberMasking:
    """Tests for account number masking."""
    
    def test_mask_account_keep_last_4(self):
        text = "Account number: 1234567890123456"
        result = mask_account_number(text, keep_last=4)
        assert "1234567890123456" not in result
        assert "3456" in result or "****3456" in result
    
    def test_mask_account_with_spaces(self):
        text = "Account: 1234 5678 9012 3456"
        result = mask_account_number(text)
        assert "1234 5678 9012 3456" not in result
    
    def test_mask_account_with_dashes(self):
        text = "Account: 1234-5678-9012-3456"
        result = mask_account_number(text)
        assert "1234-5678-9012-3456" not in result


class TestPhoneNumberMasking:
    """Tests for phone number masking."""
    
    def test_mask_phone_standard(self):
        text = "Call me at 234-567-8900"
        result = mask_phone_number(text)
        assert "234-567-8900" not in result
        assert "8900" in result or "***-***-8900" in result
    
    def test_mask_phone_with_parentheses(self):
        text = "Phone: (234) 567-8900"
        result = mask_phone_number(text)
        assert "(234) 567-8900" not in result
    
    def test_mask_phone_10_digits(self):
        text = "Contact: 2345678900"
        result = mask_phone_number(text)
        assert "2345678900" not in result


class TestEmailMasking:
    """Tests for email masking."""
    
    def test_mask_email(self):
        text = "Email: john.doe@example.com"
        result = mask_email(text)
        assert "john.doe" not in result
        assert "@example.com" in result or "j***@example.com" in result
    
    def test_mask_email_preserves_domain(self):
        text = "Contact: user@company.co.uk"
        result = mask_email(text)
        assert "@company.co.uk" in result


class TestSSNMasking:
    """Tests for SSN masking."""
    
    def test_mask_ssn(self):
        text = "SSN: 123-45-6789"
        result = mask_ssn(text)
        assert "123-45-6789" not in result
        assert "***-**-****" in result
    
    def test_mask_ssn_no_dashes(self):
        text = "SSN: 123456789"
        result = mask_ssn(text)
        assert "123456789" not in result


class TestCreditCardMasking:
    """Tests for credit card masking."""
    
    def test_mask_credit_card(self):
        text = "Card: 1234-5678-9012-3456"
        result = mask_credit_card(text)
        assert "1234-5678-9012-3456" not in result
        assert "3456" in result or "****-****-****-3456" in result


class TestPIIMasking:
    """Tests for comprehensive PII masking."""
    
    def test_mask_all_pii(self):
        text = """
        Account: 1234567890123456
        Phone: 234-567-8900
        Email: user@example.com
        SSN: 123-45-6789
        """
        result = mask_pii(text)
        assert "1234567890123456" not in result
        assert "234-567-8900" not in result
        assert "user@example.com" not in result
        assert "123-45-6789" not in result
    
    def test_mask_selective(self):
        text = "Account: 1234567890, Phone: 234-567-8900"
        result = mask_pii(text, mask_accounts=True, mask_phones=False)
        assert "1234567890" not in result
        assert "234-567-8900" in result  # Should not be masked
    
    def test_empty_text(self):
        assert mask_pii("") == ""
        assert mask_pii(None) is None or mask_pii("") == ""


class TestIBANMasking:
    """Tests for IBAN masking."""
    
    def test_mask_iban(self):
        text = "IBAN: GB82WEST12345698765432"
        result = mask_iban(text)
        assert "GB82WEST12345698765432" not in result
        assert "GB82" in result  # First 4 chars preserved


