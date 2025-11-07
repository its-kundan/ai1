/**
 * LLM Client Adapter
 * 
 * Provides two modes:
 * 1. http (preferred): Calls local LLM HTTP endpoint (e.g., text-generation-webui at http://localhost:5005/infer)
 * 2. subprocess (optional): Spawns local LLM binary directly (e.g., llama.cpp)
 * 
 * The HTTP mode is preferred for easier integration with existing LLM servers.
 */

import { logger } from '../utils/logger';
import { spawn } from 'child_process';

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || process.env.LLM_HOST || 'http://localhost:5005/infer';
const LLM_TIMEOUT_MS = parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10);
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '512', 10);

export type LLMMode = 'http' | 'subprocess';

export interface LLMRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  stop_sequences?: string[];
}

export interface LLMResponse {
  text: string;
  finish_reason?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

/**
 * Call LLM via HTTP endpoint
 * 
 * Expected request format (text-generation-webui style):
 * POST http://localhost:5005/infer
 * {
 *   "prompt": "User: Hello\nAssistant:",
 *   "max_tokens": 512,
 *   "temperature": 0.7,
 *   "stop": ["User:", "\n\n"]
 * }
 * 
 * Expected response format:
 * {
 *   "text": "Hello! How can I help you?",
 *   "finish_reason": "stop",
 *   "usage": {
 *     "prompt_tokens": 5,
 *     "completion_tokens": 8
 *   }
 * }
 * 
 * Alternative format (OpenAI-compatible):
 * {
 *   "choices": [{
 *     "message": {
 *       "content": "Hello! How can I help you?"
 *     },
 *     "finish_reason": "stop"
 *   }],
 *   "usage": {...}
 * }
 */
async function callLLMHTTP(request: LLMRequest): Promise<LLMResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(LLM_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        max_tokens: request.max_tokens || LLM_MAX_TOKENS,
        temperature: request.temperature || 0.7,
        stop: request.stop_sequences || ['User:', '\n\n'],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM service error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Handle different response formats
    if (result.text) {
      return {
        text: result.text,
        finish_reason: result.finish_reason,
        usage: result.usage,
      };
    } else if (result.choices && result.choices[0]) {
      // OpenAI-compatible format
      const choice = result.choices[0];
      return {
        text: choice.message?.content || choice.text || '',
        finish_reason: choice.finish_reason,
        usage: result.usage,
      };
    } else {
      throw new Error('Invalid LLM service response format');
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`LLM request timeout after ${LLM_TIMEOUT_MS}ms`);
    }
    logger.error({ error }, 'LLM HTTP call failed');
    throw error;
  }
}

/**
 * Call LLM via subprocess (e.g., llama.cpp)
 * 
 * NOTE: This is a stub. To enable:
 * 1. Ensure llama.cpp binary is available (e.g., ./llama.cpp/main)
 * 2. Implement subprocess spawning logic
 * 
 * Expected binary interface:
 * ./llama.cpp/main -m model.gguf -p "prompt" -n 512 -t 4
 * 
 * Output: text response on stdout
 */
async function callLLMSubprocess(request: LLMRequest): Promise<LLMResponse> {
  // TODO: Implement subprocess call
  // Example:
  // const llamaPath = process.env.LLAMA_CPP_PATH || './llama.cpp/main';
  // const modelPath = process.env.LLM_MODEL_PATH || './models/llama.gguf';
  // 
  // return new Promise((resolve, reject) => {
  //   const proc = spawn(llamaPath, [
  //     '-m', modelPath,
  //     '-p', request.prompt,
  //     '-n', String(request.max_tokens || LLM_MAX_TOKENS),
  //     '-t', '4', // threads
  //   ]);
  //   
  //   let stdout = '';
  //   let stderr = '';
  //   
  //   proc.stdout.on('data', (data) => { stdout += data.toString(); });
  //   proc.stderr.on('data', (data) => { stderr += data.toString(); });
  //   
  //   proc.on('close', (code) => {
  //     if (code === 0) {
  //       resolve({ text: stdout.trim() });
  //     } else {
  //       reject(new Error(`LLM subprocess failed: ${stderr}`));
  //     }
  //   });
  //   
  //   proc.on('error', reject);
  //   
  //   // Timeout
  //   setTimeout(() => {
  //     proc.kill();
  //     reject(new Error('LLM subprocess timeout'));
  //   }, LLM_TIMEOUT_MS);
  // });

  throw new Error(
    'Subprocess LLM not implemented. Please use HTTP LLM service or implement llama.cpp integration.'
  );
}

/**
 * Generate chat response
 */
export async function generateChatResponse(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  retrievedContext?: string,
  mode: LLMMode = 'http'
): Promise<string> {
  // Build prompt
  let prompt = '';
  
  if (systemPrompt) {
    prompt += `System: ${systemPrompt}\n\n`;
  }

  if (retrievedContext) {
    prompt += `Context:\n${retrievedContext}\n\n`;
  }

  // Add message history
  messages.forEach((msg) => {
    const role = msg.role === 'assistant' ? 'Assistant' : 'User';
    prompt += `${role}: ${msg.content}\n`;
  });

  prompt += 'Assistant:';

  logger.info({ promptLength: prompt.length, mode }, 'Generating LLM response');

  try {
    const response = await callLLMHTTP({
      prompt,
      max_tokens: LLM_MAX_TOKENS,
      temperature: 0.7,
      stop_sequences: ['User:', '\n\n'],
    });

    return response.text.trim();
  } catch (error: any) {
    logger.error({ error }, 'LLM generation failed');
    throw new Error(`LLM generation failed: ${error.message}`);
  }
}

/**
 * Check if LLM service is available
 */
export async function checkLLMHealth(): Promise<boolean> {
  try {
    const healthUrl = LLM_SERVICE_URL.replace('/infer', '/health');
    const response = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    // Try the infer endpoint with a minimal request
    try {
      const response = await fetch(LLM_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'test', max_tokens: 1 }),
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

