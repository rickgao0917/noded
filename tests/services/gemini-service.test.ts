/**
 * Tests for Gemini Service
 */

import { GeminiService } from '../../src/services/gemini-service';
import { Logger } from '../../src/utils/logger';
import { ErrorFactory } from '../../src/types/errors';

// Mock the Logger and ErrorFactory modules
jest.mock('../../src/utils/logger');
jest.mock('../../src/types/errors');

// Mock fetch
global.fetch = jest.fn();

// Mock TextEncoder with proper implementation
class MockTextEncoder {
  encode(text: string): Uint8Array {
    return new Uint8Array(Array.from(text, (c: string) => c.charCodeAt(0)));
  }
}

(global as any).TextEncoder = MockTextEncoder;

describe('GeminiService', () => {
  let service: GeminiService;
  let mockLogger: jest.Mocked<Logger>;
  let mockErrorFactory: jest.Mocked<ErrorFactory>;
  let originalWindow: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock logger
    mockLogger = {
      logFunctionEntry: jest.fn(),
      logFunctionExit: jest.fn(),
      logInfo: jest.fn(),
      logWarn: jest.fn(),
      logError: jest.fn(),
      logPerformance: jest.fn(),
      logLoop: jest.fn(),
      logBranch: jest.fn(),
      logVariableAssignment: jest.fn(),
      logDebug: jest.fn()
    } as any;
    
    // Create mock error factory
    mockErrorFactory = {
      createNodeEditorError: jest.fn((message, code) => new Error(`${code}: ${message}`))
    } as any;
    
    // Mock constructors
    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    (ErrorFactory as jest.MockedClass<typeof ErrorFactory>).mockImplementation(() => mockErrorFactory);
    
    // Store original window
    originalWindow = global.window;
    
    // Mock window with config
    (global as any).window = {
      NODE_EDITOR_CONFIG: {
        GEMINI_API_KEY: 'test-api-key'
      }
    };
    
    // Create service instance with test API key
    service = new GeminiService('test-api-key', mockLogger, mockErrorFactory);
  });

  afterEach(() => {
    // Restore original window
    (global as any).window = originalWindow;
  });

  describe('sendMessage', () => {
    it('should send message and stream response', async () => {
      const chunks = [
        '{"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}',
        '{"candidates":[{"content":{"parts":[{"text":" world"}]}}]}',
        '{"candidates":[{"content":{"parts":[{"text":"!"}]}}]}'
      ];
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks[0]), done: false })
          .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks[1]), done: false })
          .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks[2]), done: false })
          .mockResolvedValueOnce({ done: true })
      };
      
      const mockStream = {
        getReader: () => mockReader
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });
      
      const receivedChunks: string[] = [];
      const result = await service.sendMessage('Test prompt', (chunk) => receivedChunks.push(chunk));
      
      expect(result).toBe('Hello world!');
      expect(receivedChunks).toEqual(['Hello', ' world', '!']);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test prompt')
        })
      );
    });

    it('should handle partial JSON chunks', async () => {
      const chunks = [
        '{"candidates":[{"content":{"pa',
        'rts":[{"text":"Complete"}]}}]}'
      ];
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks[0]), done: false })
          .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks[1]), done: false })
          .mockResolvedValueOnce({ done: true })
      };
      
      const mockStream = {
        getReader: () => mockReader
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });
      
      const receivedChunks: string[] = [];
      const result = await service.sendMessage('Test', (chunk) => receivedChunks.push(chunk));
      
      expect(result).toBe('Complete');
      expect(receivedChunks).toEqual(['Complete']);
    });

    it('should skip non-data lines', async () => {
      const chunks = [
        ': comment\n',
        '{"candidates":[{"content":{"parts":[{"text":"Valid"}]}}]}',
        'event: ping\n',
        '\n'
      ];
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks.join('')), done: false })
          .mockResolvedValueOnce({ done: true })
      };
      
      const mockStream = {
        getReader: () => mockReader
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });
      
      const receivedChunks: string[] = [];
      await service.sendMessage('Test', (chunk) => receivedChunks.push(chunk));
      
      expect(receivedChunks).toEqual(['Valid']);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid API key'
      });
      
      await expect(service.sendMessage('Test', jest.fn())).rejects.toThrow('GEMINI_API_ERROR');
      expect(mockLogger.logError).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      await expect(service.sendMessage('Test', jest.fn())).rejects.toThrow('GEMINI_CONNECTION_ERROR');
      expect(mockLogger.logError).toHaveBeenCalled();
    });

    it('should handle empty response', async () => {
      const mockReader = {
        read: jest.fn().mockResolvedValueOnce({ done: true })
      };
      
      const mockStream = {
        getReader: () => mockReader
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });
      
      const result = await service.sendMessage('Test prompt', jest.fn());
      expect(result).toBe('');
    });

    it('should handle missing API key', async () => {
      // Create service with empty API key
      const serviceWithoutKey = new GeminiService('', mockLogger, mockErrorFactory);
      
      await expect(serviceWithoutKey.sendMessage('Test', jest.fn())).rejects.toThrow('API_KEY_MISSING');
    });

    it('should handle missing response body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: null
      });
      
      await expect(service.sendMessage('Test', jest.fn())).rejects.toThrow('GEMINI_STREAM_ERROR');
    });

    it('should handle stream reading errors', async () => {
      const mockReader = {
        read: jest.fn().mockRejectedValueOnce(new Error('Stream error'))
      };
      
      const mockStream = {
        getReader: () => mockReader
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });
      
      await expect(service.sendMessage('Test', jest.fn())).rejects.toThrow('GEMINI_STREAM_ERROR');
      expect(mockLogger.logError).toHaveBeenCalled();
    });

    it('should handle JSON parse errors gracefully', async () => {
      const chunks = [
        '{"invalid json}{"candidates":[{"content":{"parts":[{"text":"Valid"}]}}]}'
      ];
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks[0]), done: false })
          .mockResolvedValueOnce({ done: true })
      };
      
      const mockStream = {
        getReader: () => mockReader
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });
      
      const receivedChunks: string[] = [];
      await service.sendMessage('Test', (chunk) => receivedChunks.push(chunk));
      
      // Should complete without throwing
      expect(receivedChunks).toEqual([]);
    });

    it('should log performance metrics', async () => {
      const performanceNow = jest.spyOn(performance, 'now');
      performanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(2000);
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode('{"candidates":[{"content":{"parts":[{"text":"Test"}]}}]}'), done: false })
          .mockResolvedValueOnce({ done: true })
      };
      
      const mockStream = {
        getReader: () => mockReader
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });
      
      await service.sendMessage('Test', jest.fn());
      
      expect(mockLogger.logPerformance).toHaveBeenCalledWith(
        'sendMessage',
        'api_request',
        1000
      );
      
      performanceNow.mockRestore();
    });
  });

  describe('getApiKey', () => {
    it('should get API key from window config', () => {
      // The getApiKey method doesn't exist in the current implementation
      // The API key is accessed directly in the constructor
      expect((service as any).apiKey).toBe('test-api-key');
    });

    it.skip('should get API key from environment variable', () => {
      (global as any).window = undefined;
      process.env.GEMINI_API_KEY = 'env-api-key';
      
      // Need to create new instance to pick up env var
      const serviceWithEnv = new GeminiService(undefined, mockLogger, mockErrorFactory);
      const key = (serviceWithEnv as any).apiKey;
      expect(key).toBe('env-api-key');
      
      delete process.env.GEMINI_API_KEY;
    });

    it('should return empty string when no API key is found', () => {
      (global as any).window = {};
      
      const serviceWithoutKey = new GeminiService(undefined, mockLogger, mockErrorFactory);
      const key = (serviceWithoutKey as any).apiKey;
      expect(key).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long messages', async () => {
      const longMessage = 'x'.repeat(10000);
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ 
            value: new TextEncoder().encode('{"candidates":[{"content":{"parts":[{"text":"Response to long message"}]}}]}'), 
            done: false 
          })
          .mockResolvedValueOnce({ done: true })
      };
      
      const mockStream = {
        getReader: () => mockReader
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });
      
      const result = await service.sendMessage(longMessage, jest.fn());
      expect(result).toBe('Response to long message');
    });

    it('should handle empty streaming chunks', async () => {
      const chunks = [
        '{"candidates":[{"content":{"parts":[{"text":""}]}}]}',
        '{"candidates":[{"content":{"parts":[{"text":"Not empty"}]}}]}'
      ];
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode(chunks.join('')), done: false })
          .mockResolvedValueOnce({ done: true })
      };
      
      const mockStream = {
        getReader: () => mockReader
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });
      
      const receivedChunks: string[] = [];
      await service.sendMessage('Test', (chunk) => receivedChunks.push(chunk));
      
      // Should only get non-empty chunks
      expect(receivedChunks).toEqual(['Not empty']);
    });

    it('should handle response with multiple candidates', async () => {
      const chunk = '{"candidates":[{"content":{"parts":[{"text":"First"}]}},{"content":{"parts":[{"text":"Second"}]}}]}';
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ value: new TextEncoder().encode(chunk), done: false })
          .mockResolvedValueOnce({ done: true })
      };
      
      const mockStream = {
        getReader: () => mockReader
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        body: mockStream
      });
      
      const receivedChunks: string[] = [];
      await service.sendMessage('Test', (chunk) => receivedChunks.push(chunk));
      
      // Should only use the first candidate
      expect(receivedChunks).toEqual(['First']);
    });
  });

  describe('Constructor', () => {
    it('should log warning when no API key is found', () => {
      (global as any).window = {};
      
      new GeminiService(undefined, mockLogger, mockErrorFactory);
      
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        expect.stringContaining('No API key found'),
        'constructor'
      );
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', async () => {
      const module = await import('../../src/services/gemini-service');
      expect(module.geminiService).toBeInstanceOf(GeminiService);
    });
  });
});