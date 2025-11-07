/**
 * API request/response schemas using Zod for validation
 * These match the Python backend's Pydantic schemas
 */

import { z } from 'zod';

// ========== Upload Endpoint ==========

export const UploadResponseSchema = z.object({
  document_id: z.string(),
  status: z.string(),
  filename: z.string(),
});

export type UploadResponse = z.infer<typeof UploadResponseSchema>;

// ========== OCR Endpoint ==========

export const DocumentTypeSchema = z.enum(['bank_statement', 'cdr', 'ipdr', 'general']);

export const OCRRequestSchema = z.object({
  document_id: z.string().optional(),
  parse_tables: z.boolean().default(true),
});

export type OCRRequest = z.infer<typeof OCRRequestSchema>;

export const ParsedPreviewSchema = z.object({
  preview: z.record(z.any()),
});

export const OCRResponseSchema = z.object({
  document_id: z.string(),
  status: z.string(),
  parsed_preview: ParsedPreviewSchema.nullable().optional(),
  error: z.string().optional(),
});

export type OCRResponse = z.infer<typeof OCRResponseSchema>;

// ========== Search Endpoint ==========

export const SearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  top_k: z.number().int().min(1).max(50).default(5),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResultSchema = z.object({
  doc_id: z.string(),
  snippet: z.string(),
  score: z.number().min(0).max(1),
  bounding_box: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const SearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(SearchResultSchema),
  total_found: z.number().int(),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// ========== Chat Endpoint ==========

export const ChatRequestSchema = z.object({
  chat_id: z.string().min(1),
  user_message: z.string().min(1).max(5000),
  use_retrieval: z.boolean().default(true),
  top_k: z.number().int().min(1).max(10).default(3),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  chat_id: z.string(),
  reply: z.string(),
  used_docs: z.array(z.string()).default([]),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ========== Chat List Endpoint ==========

export const ChatMetadataSchema = z.object({
  chat_id: z.string(),
  last_active: z.date(),
  message_count: z.number().int(),
  title: z.string().nullable().optional(),
});

export const ChatListResponseSchema = z.object({
  chats: z.array(ChatMetadataSchema),
  total: z.number().int(),
});

export type ChatListResponse = z.infer<typeof ChatListResponseSchema>;

// ========== Chat Messages Endpoint ==========

export const MessageResponseSchema = z.object({
  id: z.number().int(),
  chat_id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  text: z.string(),
  timestamp: z.date(),
  used_docs: z.array(z.string()).nullable().optional(),
});

export const ChatMessagesResponseSchema = z.object({
  chat_id: z.string(),
  messages: z.array(MessageResponseSchema),
  total: z.number().int(),
  page: z.number().int().default(1),
  page_size: z.number().int().default(50),
});

export type ChatMessagesResponse = z.infer<typeof ChatMessagesResponseSchema>;

// ========== Cache Clear ==========

export const CacheClearResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
});

export type CacheClearResponse = z.infer<typeof CacheClearResponseSchema>;

