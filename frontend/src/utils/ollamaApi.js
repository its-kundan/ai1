/**
 * Ollama API Service
 * Direct integration with Ollama API (models2 service)
 * No backend required - frontend calls Ollama directly
 */

// Ollama configuration
export const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434'
export const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'deepseek-chat:7b'
export const OLLAMA_SERVICE_URL = import.meta.env.VITE_OLLAMA_SERVICE_URL || 'http://localhost:5006'

// Use service (port 5006) or direct Ollama (port 11434)
export const USE_OLLAMA_SERVICE = import.meta.env.VITE_USE_OLLAMA_SERVICE !== 'false' // Default: true

/**
 * Check if Ollama is available
 */
export async function checkOllamaHealth() {
  try {
    const url = USE_OLLAMA_SERVICE 
      ? `${OLLAMA_SERVICE_URL}/health`
      : `${OLLAMA_BASE_URL}/api/tags`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    
    return response.ok
  } catch (error) {
    console.error('Ollama health check failed:', error)
    return false
  }
}

/**
 * Send chat message using Ollama
 * @param {string} prompt - User message
 * @param {Object} options - Additional options
 * @returns {Promise<{reply: string, usage: Object}>}
 */
export async function sendOllamaMessage(prompt, options = {}) {
  const {
    stream = false,
    temperature = 0.7,
    max_tokens = 512,
    model = OLLAMA_MODEL
  } = options

  if (USE_OLLAMA_SERVICE) {
    // Use the service (compatible API)
    return sendViaService(prompt, { stream, temperature, max_tokens, model })
  } else {
    // Direct Ollama API call
    return sendDirectOllama(prompt, { stream, temperature, max_tokens, model })
  }
}

/**
 * Send message via Ollama service (port 5006)
 */
async function sendViaService(prompt, options) {
  const { stream, temperature, max_tokens } = options
  
  if (stream) {
    // Streaming via service
    const response = await fetch(`${OLLAMA_SERVICE_URL}/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        max_tokens,
        temperature,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama service error: ${error}`)
    }

    return response // Return response for streaming
  } else {
    // Non-streaming via service
    const response = await fetch(`${OLLAMA_SERVICE_URL}/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        max_tokens,
        temperature,
        stream: false
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama service error: ${error}`)
    }

    const data = await response.json()
    return {
      reply: data.reply,
      usage: data.usage || {}
    }
  }
}

/**
 * Send message directly to Ollama API (port 11434)
 */
async function sendDirectOllama(prompt, options) {
  const { stream, temperature, max_tokens, model } = options
  
  if (stream) {
    // Streaming direct
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: {
          temperature,
          num_predict: max_tokens
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama API error: ${error}`)
    }

    return response // Return response for streaming
  } else {
    // Non-streaming direct
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_predict: max_tokens
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama API error: ${error}`)
    }

    const data = await response.json()
    return {
      reply: data.response || '',
      usage: {
        input_tokens: data.prompt_eval_count || 0,
        output_tokens: data.eval_count || 0
      }
    }
  }
}

/**
 * Stream chat response
 * @param {string} prompt - User message
 * @param {Function} onChunk - Callback for each chunk
 * @param {Object} options - Additional options
 */
export async function streamOllamaMessage(prompt, onChunk, options = {}) {
  const {
    temperature = 0.7,
    max_tokens = 512,
    model = OLLAMA_MODEL
  } = options

  try {
    let response
    if (USE_OLLAMA_SERVICE) {
      response = await fetch(`${OLLAMA_SERVICE_URL}/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_tokens,
          temperature,
          stream: true
        })
      })
    } else {
      response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: true,
          options: {
            temperature,
            num_predict: max_tokens
          }
        })
      })
    }

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (USE_OLLAMA_SERVICE) {
          // Service format: Server-Sent Events (SSE)
          // Format: "data: {text}\n\n" or "data: [DONE]\n\n"
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]' || data.startsWith('[USAGE:')) {
              continue
            }
            // Try to parse as JSON first
            try {
              const parsed = JSON.parse(data)
              // If it's valid JSON but not text, skip
              continue
            } catch {
              // It's plain text data
              if (data) {
                fullText += data
                onChunk(data)
              }
            }
          }
        } else {
          // Direct Ollama format: JSON lines
          try {
            const json = JSON.parse(line)
            if (json.response) {
              fullText += json.response
              onChunk(json.response)
            }
            if (json.done) {
              break
            }
          } catch (e) {
            // Skip invalid JSON lines
            continue
          }
        }
      }
    }

    return fullText
  } catch (error) {
    console.error('Streaming error:', error)
    throw error
  }
}

/**
 * List available Ollama models
 */
export async function listOllamaModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
    if (!response.ok) {
      throw new Error('Failed to list models')
    }
    const data = await response.json()
    return data.models || []
  } catch (error) {
    console.error('Failed to list models:', error)
    return []
  }
}

