/**
 * PII masking utilities
 */

/**
 * Mask account numbers: show only last 4 digits
 * Example: "1234567890123456" -> "****3456"
 */
export function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) return '****';
  const str = String(accountNumber).trim();
  if (str.length <= 4) return '****';
  return '****' + str.slice(-4);
}

/**
 * Mask phone numbers: show only last 4 digits
 * Example: "+919876543210" -> "****3210"
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '****';
  const str = String(phone).trim();
  if (str.length <= 4) return '****';
  return '****' + str.slice(-4);
}

/**
 * Mask sensitive numbers in text (account numbers, long numeric sequences)
 */
export function maskSensitiveNumbers(text: string): string {
  // Match sequences of 8+ digits that might be account numbers
  return text.replace(/\b\d{8,}\b/g, (match) => {
    if (match.length <= 4) return match;
    return '****' + match.slice(-4);
  });
}

/**
 * Apply masking to parsed data object
 */
export function maskParsedData(data: Record<string, any>): Record<string, any> {
  const masked = { ...data };
  
  if (masked.account_number) {
    masked.account_number = maskAccountNumber(masked.account_number);
  }
  
  if (masked.msisdn) {
    masked.msisdn = maskPhoneNumber(masked.msisdn);
  }
  
  // Mask in nested objects
  if (masked.transactions && Array.isArray(masked.transactions)) {
    masked.transactions = masked.transactions.map((tx: any) => {
      if (tx.account_number) {
        tx.account_number = maskAccountNumber(tx.account_number);
      }
      return tx;
    });
  }
  
  return masked;
}

