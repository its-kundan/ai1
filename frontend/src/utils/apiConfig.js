/**
 * API Configuration
 * Centralized configuration for backend API endpoints
 */

// Backend API base URL
// Default to backend2 (Fastify) on port 8001
// Can be switched to Python backend on port 8000 if needed
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001'

// API version prefix
export const API_PREFIX = '/api/v1'

// Full API base URL
export const API_URL = `${API_BASE_URL}${API_PREFIX}`

// Helper to build full endpoint URL
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  return `${API_URL}/${cleanEndpoint}`
}

