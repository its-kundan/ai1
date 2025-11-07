/**
 * API Service
 * Handles all HTTP requests to the backend2 Fastify API
 */

import { API_URL, getApiUrl } from './apiConfig'

/**
 * Generic fetch wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = getApiUrl(endpoint)
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, config)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error)
    throw error
  }
}

/**
 * Upload a document file
 * @param {File} file - File to upload
 * @param {string} docType - Document type (bank_statement, cdr, ipdr, general)
 * @returns {Promise<{document_id: string, status: string, filename: string}>}
 */
export async function uploadDocument(file, docType = 'general') {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('doc_type', docType)

  const response = await fetch(getApiUrl('upload'), {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header - browser will set it with boundary
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(errorData.error || `Upload failed: ${response.status}`)
  }

  return await response.json()
}

/**
 * Process document with OCR
 * @param {string} documentId - Document ID from upload
 * @param {boolean} parseTables - Whether to parse tables
 * @returns {Promise<{document_id: string, status: string, parsed_preview: object}>}
 */
export async function processOCR(documentId, parseTables = true) {
  return apiRequest('ocr', {
    method: 'POST',
    body: JSON.stringify({
      document_id: documentId,
      parse_tables: parseTables,
    }),
  })
}

/**
 * Search documents
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return (default: 5)
 * @returns {Promise<{query: string, results: Array, total_found: number}>}
 */
export async function searchDocuments(query, topK = 5) {
  return apiRequest('search', {
    method: 'POST',
    body: JSON.stringify({
      query,
      top_k: topK,
    }),
  })
}

/**
 * Send chat message
 * @param {string} chatId - Chat ID
 * @param {string} userMessage - User message
 * @param {boolean} useRetrieval - Whether to use document retrieval
 * @param {number} topK - Number of documents to retrieve
 * @returns {Promise<{chat_id: string, reply: string, used_docs: Array<string>}>}
 */
export async function sendChatMessage(chatId, userMessage, useRetrieval = true, topK = 3) {
  return apiRequest('chat', {
    method: 'POST',
    body: JSON.stringify({
      chat_id: chatId,
      user_message: userMessage,
      use_retrieval: useRetrieval,
      top_k: topK,
    }),
  })
}

/**
 * Get list of all chats
 * @returns {Promise<{chats: Array, total: number}>}
 */
export async function getChats() {
  return apiRequest('chats', {
    method: 'GET',
  })
}

/**
 * Get messages for a specific chat
 * @param {string} chatId - Chat ID
 * @param {number} page - Page number (default: 1)
 * @param {number} pageSize - Page size (default: 50)
 * @returns {Promise<{chat_id: string, messages: Array, total: number, page: number, page_size: number}>}
 */
export async function getChatMessages(chatId, page = 1, pageSize = 50) {
  return apiRequest(`chats/${chatId}/messages?page=${page}&page_size=${pageSize}`, {
    method: 'GET',
  })
}

/**
 * Clear embeddings cache
 * @returns {Promise<{status: string, message: string}>}
 */
export async function clearCache() {
  return apiRequest('cache/clear', {
    method: 'POST',
  })
}

/**
 * Health check
 * @returns {Promise<{status: string, timestamp: string}>}
 */
export async function healthCheck() {
  const response = await fetch(`${API_URL.replace('/api/v1', '')}/health`)
  if (!response.ok) {
    throw new Error('Health check failed')
  }
  return await response.json()
}

