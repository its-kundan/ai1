/**
 * API Configuration
 * Centralized configuration for backend API endpoints
 */

// Backend API base URL
// Default to backend2 (Fastify) on port 8001
// Can be switched to Python backend on port 8000 if needed
// Supports FRONTEND_API_URL or VITE_API_BASE_URL for compatibility
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
                            import.meta.env.VITE_FRONTEND_API_URL || 
                            'http://localhost:8001'

// API version prefix
export const API_PREFIX = '/api/v1'

// Full API base URL
export const API_URL = `${API_BASE_URL}${API_PREFIX}`

// LLM Mode: 'backend' (uses backend API) or 'ollama' (uses Ollama directly)
export const LLM_MODE = import.meta.env.VITE_LLM_MODE || 'backend'

// Helper to build full endpoint URL
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  return `${API_URL}/${cleanEndpoint}`
}

