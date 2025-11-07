/**
 * Parser Service
 * 
 * Provides rule-based parsers for bank statements, CDR, and IPDR documents.
 * 
 * TODO: Add ML-based parsers for better accuracy
 */

import { logger } from '../utils/logger';

export interface BankStatementParsed {
  account_number?: string;
  account_holder?: string;
  from_date?: string;
  to_date?: string;
  opening_balance?: number;
  closing_balance?: number;
  total_debits?: number;
  total_credits?: number;
  transactions?: Array<{
    date?: string;
    description?: string;
    debit?: number;
    credit?: number;
    balance?: number;
    reference?: string;
  }>;
}

export interface CDRParsed {
  records?: Array<{
    timestamp?: string;
    msisdn?: string;
    imei?: string;
    duration?: number;
    call_type?: string;
    cell_id?: string;
    location?: string;
  }>;
  total_records?: number;
  date_range?: { from?: string; to?: string };
}

/**
 * Parse bank statement from OCR text
 * 
 * This is a rule-based parser. For production, consider:
 * - ML-based extraction (spaCy, transformers)
 * - Structured document parsing (layout analysis)
 */
export function parseBankStatement(ocrText: string, tables?: any[]): BankStatementParsed {
  const result: BankStatementParsed = {
    transactions: [],
  };

  // Extract account number (common patterns)
  const accountMatch = ocrText.match(/account\s*(?:no|number|#)?\s*:?\s*([\d\s-]{8,})/i);
  if (accountMatch) {
    result.account_number = accountMatch[1].replace(/\s+/g, '');
  }

  // Extract date range
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
  const dates = ocrText.match(datePattern) || [];
  if (dates.length >= 2) {
    result.from_date = dates[0];
    result.to_date = dates[dates.length - 1];
  }

  // Extract balances
  const balanceMatch = ocrText.match(/balance\s*:?\s*[₹$]?\s*([\d,]+\.?\d*)/i);
  if (balanceMatch) {
    result.closing_balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
  }

  // Parse transactions from tables if available
  if (tables && tables.length > 0) {
    // Assume first table contains transactions
    const transactionTable = tables[0];
    if (transactionTable.cells && Array.isArray(transactionTable.cells)) {
      // Parse each row as a transaction
      // This is simplified - real parsing would need to identify columns
      transactionTable.cells.forEach((row: any, index: number) => {
        if (index === 0) return; // Skip header
        
        result.transactions?.push({
          date: row[0],
          description: row[1],
          debit: parseFloat(row[2]?.replace(/,/g, '')) || undefined,
          credit: parseFloat(row[3]?.replace(/,/g, '')) || undefined,
          balance: parseFloat(row[4]?.replace(/,/g, '')) || undefined,
        });
      });
    }
  }

  // Calculate totals
  if (result.transactions) {
    result.total_debits = result.transactions
      .reduce((sum, tx) => sum + (tx.debit || 0), 0);
    result.total_credits = result.transactions
      .reduce((sum, tx) => sum + (tx.credit || 0), 0);
  }

  logger.info({ 
    account_number: result.account_number,
    transaction_count: result.transactions?.length 
  }, 'Parsed bank statement');

  return result;
}

/**
 * Parse CDR/IPDR from OCR text
 */
export function parseCDR(ocrText: string, tables?: any[]): CDRParsed {
  const result: CDRParsed = {
    records: [],
  };

  // Extract records from tables
  if (tables && tables.length > 0) {
    tables.forEach((table) => {
      if (table.cells && Array.isArray(table.cells)) {
        table.cells.forEach((row: any, index: number) => {
          if (index === 0) return; // Skip header
          
          result.records?.push({
            timestamp: row[0],
            msisdn: row[1],
            imei: row[2],
            duration: parseFloat(row[3]) || undefined,
            call_type: row[4],
            cell_id: row[5],
            location: row[6],
          });
        });
      }
    });
  }

  result.total_records = result.records?.length || 0;

  // Extract date range
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
  const dates = ocrText.match(datePattern) || [];
  if (dates.length >= 2) {
    result.date_range = {
      from: dates[0],
      to: dates[dates.length - 1],
    };
  }

  logger.info({ record_count: result.total_records }, 'Parsed CDR');

  return result;
}

/**
 * Main parse function that routes to appropriate parser
 */
export function parse(
  docType: string,
  ocrText: string,
  tables?: any[]
): BankStatementParsed | CDRParsed | Record<string, any> {
  switch (docType) {
    case 'bank_statement':
      return parseBankStatement(ocrText, tables);
    case 'cdr':
    case 'ipdr':
      return parseCDR(ocrText, tables);
    default:
      // General parsing - return raw text as structured data
      return {
        raw_text: ocrText,
        text_length: ocrText.length,
        word_count: ocrText.split(/\s+/).length,
      };
  }
}

