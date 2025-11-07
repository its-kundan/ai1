/**
 * Unit tests for LLM client
 */

import { generateChatResponse, checkLLMHealth } from '../../src/services/llmClient';

// Mock fetch globally
global.fetch = jest.fn();

describe('llmClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateChatResponse', () => {
    it('should generate response from LLM service', async () => {
      const mockLLMResponse = {
        text: 'This is a test response from the LLM.',
        finish_reason: 'stop',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockLLMResponse,
      } as Response);

      const response = await generateChatResponse(
        'You are a helpful assistant.',
        [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        undefined,
        'http'
      );

      expect(response).toBe('This is a test response from the LLM.');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/infer'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should include retrieved context in prompt', async () => {
      const mockLLMResponse = {
        text: 'Response with context',
        finish_reason: 'stop',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockLLMResponse,
      } as Response);

      await generateChatResponse(
        'System prompt',
        [{ role: 'user', content: 'Question' }],
        'Retrieved context: Some document content',
        'http'
      );

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.prompt).toContain('Retrieved context');
      expect(callBody.prompt).toContain('Some document content');
    });

    it('should handle OpenAI-compatible response format', async () => {
      const mockLLMResponse = {
        choices: [
          {
            message: {
              content: 'OpenAI format response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 3,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockLLMResponse,
      } as Response);

      const response = await generateChatResponse(
        'System',
        [{ role: 'user', content: 'Test' }],
        undefined,
        'http'
      );

      expect(response).toBe('OpenAI format response');
    });

    it('should throw error when LLM service fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Service unavailable',
      } as Response);

      await expect(
        generateChatResponse('System', [{ role: 'user', content: 'Test' }], undefined, 'http')
      ).rejects.toThrow('LLM generation failed');
    });
  });

  describe('checkLLMHealth', () => {
    it('should return true when service is healthy', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      } as Response);

      const isHealthy = await checkLLMHealth();
      expect(isHealthy).toBe(true);
    });

    it('should return false when service is unavailable', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      const isHealthy = await checkLLMHealth();
      expect(isHealthy).toBe(false);
    });
  });
});

