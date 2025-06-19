import { Logger } from '../utils/logger.js';
import { ErrorFactory } from '../types/errors.js';

/**
 * Service for interacting with Google's Gemini Flash API
 * Handles chat completions with streaming support
 */
export class GeminiService {
  private logger: Logger;
  private errorFactory: ErrorFactory;
  private apiKey: string;
  private apiUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';

  constructor() {
    this.logger = new Logger('GeminiService');
    this.errorFactory = new ErrorFactory('gemini-service');
    
    // Try to get API key from environment variable (works in Node.js/build time)
    const envApiKey = typeof process !== 'undefined' && process.env?.GEMINI_API_KEY;
    
    // In browser environment, check for configuration object
    const configApiKey = typeof window !== 'undefined' && 
                        (window as any).NODE_EDITOR_CONFIG?.GEMINI_API_KEY;
    
    // Use environment variable first, then config object
    this.apiKey = envApiKey || configApiKey || '';
    
    if (!this.apiKey) {
      this.logger.logWarn(
        'No API key found. Please create config.js from config.example.js and add your Gemini API key.',
        'constructor'
      );
    }
  }

  /**
   * Send a chat message to Gemini and get a streaming response
   * 
   * @param message - The user's message
   * @param onChunk - Callback for each chunk of the response
   * @returns Promise that resolves when streaming is complete
   */
  public async sendMessage(
    message: string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const startTime = performance.now();
    this.logger.logFunctionEntry('sendMessage', { 
      messageLength: message.length 
    });

    try {
      // Validate input
      if (!message || !message.trim()) {
        throw this.errorFactory.createValidationError(
          'message',
          message,
          'non-empty string',
          'sendMessage'
        );
      }

      // Check API key
      if (!this.apiKey) {
        throw this.errorFactory.createNodeEditorError(
          'Gemini API key not configured',
          'API_KEY_MISSING',
          'Please create config.js from config.example.js and add your Gemini API key.',
          'sendMessage'
        );
      }

      // Prepare request
      const requestBody = {
        contents: [{
          parts: [{
            text: message
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048,
        }
      };

      this.logger.logInfo('Sending request to Gemini API', 'sendMessage', {
        messageLength: message.length
      });
      
      // Log to console for terminal visibility (this goes to terminal, not browser)
      console.log('\n' + '='.repeat(80));
      console.log('🚀 GEMINI API REQUEST');
      console.log('='.repeat(80));
      console.log('Timestamp:', new Date().toISOString());
      console.log('Message:', message);
      console.log('Length:', message.length, 'characters');
      console.log('Request Body:', JSON.stringify(requestBody, null, 2));
      console.log('='.repeat(80) + '\n');

      // Make request with streaming
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.logError(new Error(`API request failed: ${response.status}`), 'sendMessage', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });

        throw this.errorFactory.createNodeEditorError(
          `Gemini API request failed: ${response.statusText}`,
          'API_REQUEST_FAILED',
          'Failed to get response from AI. Please try again.',
          'sendMessage',
          { status: response.status, errorText }
        );
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      if (!reader) {
        throw this.errorFactory.createNodeEditorError(
          'Response body is not readable',
          'RESPONSE_NOT_READABLE',
          'Failed to read AI response.',
          'sendMessage'
        );
      }

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Try to find complete JSON objects in the buffer
        // The streaming response format is an array of JSON objects: [{...},{...}]
        let startIdx = 0;
        
        while (true) {
          // Find the start of a JSON object
          const objStart = buffer.indexOf('{', startIdx);
          if (objStart === -1) break;
          
          // Try to find the matching closing brace
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          let objEnd = -1;
          
          for (let i = objStart; i < buffer.length; i++) {
            const char = buffer[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"') {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') braceCount++;
              else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                  objEnd = i;
                  break;
                }
              }
            }
          }
          
          if (objEnd !== -1) {
            // We found a complete JSON object
            const jsonStr = buffer.substring(objStart, objEnd + 1);
            
            try {
              const data = JSON.parse(jsonStr);
              
              // Extract text from the response
              if (data.candidates && data.candidates[0]?.content?.parts) {
                const text = data.candidates[0].content.parts[0]?.text || '';
                if (text) {
                  fullResponse += text;
                  onChunk(text);
                  
                  this.logger.logDebug('Received chunk from Gemini', 'sendMessage', {
                    chunkLength: text.length,
                    totalLength: fullResponse.length
                  });
                  
                  // Log streaming progress periodically
                  if (fullResponse.length % 500 < text.length) {
                    console.log(`📦 Streaming progress: ${fullResponse.length} characters received...`);
                  }
                }
              }
            } catch (parseError) {
              this.logger.logDebug('Failed to parse JSON object', 'sendMessage', {
                error: String(parseError),
                jsonLength: jsonStr.length
              });
            }
            
            // Move past this object
            startIdx = objEnd + 1;
          } else {
            // No complete object found, keep the rest in buffer
            buffer = buffer.substring(startIdx);
            break;
          }
        }
        
        // If we've processed all complete objects, clear the processed part
        if (startIdx > 0 && startIdx < buffer.length) {
          buffer = buffer.substring(startIdx);
        } else if (startIdx >= buffer.length) {
          buffer = '';
        }
      }

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('sendMessage', 'api_request', executionTime);
      this.logger.logFunctionExit('sendMessage', { 
        responseLength: fullResponse.length 
      }, executionTime);

      // Log final response to terminal
      console.log('\n' + '='.repeat(80));
      console.log('✅ GEMINI API RESPONSE COMPLETE');
      console.log('='.repeat(80));
      console.log('Timestamp:', new Date().toISOString());
      console.log('Total length:', fullResponse.length, 'characters');
      console.log('Time taken:', (executionTime / 1000).toFixed(2), 'seconds');
      console.log('Full Response:');
      console.log('-'.repeat(80));
      console.log(fullResponse);
      console.log('='.repeat(80) + '\n');

      return fullResponse;

    } catch (error) {
      this.logger.logError(error as Error, 'sendMessage');
      
      if (error instanceof Error && error.name.includes('Error')) {
        throw error;
      }

      throw this.errorFactory.createNodeEditorError(
        'Failed to communicate with Gemini API',
        'API_COMMUNICATION_FAILED',
        'Unable to get AI response. Please check your connection and try again.',
        'sendMessage',
        { error: String(error) }
      );
    }
  }

  /**
   * Set the API key
   * 
   * @param apiKey - The Gemini API key
   */
  public setApiKey(apiKey: string): void {
    this.logger.logFunctionEntry('setApiKey');
    
    this.apiKey = apiKey;
    
    this.logger.logInfo('API key updated', 'setApiKey');
    this.logger.logFunctionExit('setApiKey');
  }
}

// Export singleton instance
export const geminiService = new GeminiService();