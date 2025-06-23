import { Logger } from '../utils/logger.js';
import { ErrorFactory } from '../types/errors.js';
/**
 * Service for interacting with Google's Gemini Flash API
 * Handles chat completions with streaming support
 */
export class GeminiService {
    constructor(apiKey, logger, errorFactory) {
        var _a;
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';
        this.logger = logger || new Logger('GeminiService');
        this.errorFactory = errorFactory || new ErrorFactory('gemini-service');
        // Use injected API key first, then try environment/config
        if (apiKey !== undefined) {
            this.apiKey = apiKey;
        }
        else {
            // Try to get API key from environment variable (works in Node.js/build time)
            const envApiKey = false; // Disabled for browser environment
            // In browser environment, check for configuration object with safe access
            const configApiKey = typeof window !== 'undefined' &&
                ((_a = window === null || window === void 0 ? void 0 : window.NODE_EDITOR_CONFIG) === null || _a === void 0 ? void 0 : _a.GEMINI_API_KEY);
            // Use environment variable first, then config object
            this.apiKey = envApiKey || configApiKey || '';
        }
        // Only log warning if no API key found and not injected
        if (!this.apiKey && apiKey === undefined) {
            this.logger.logWarn('No API key found. Please create config.js from config.example.js and add your Gemini API key.', 'constructor');
        }
    }
    /**
     * Send a chat message to Gemini and get a streaming response
     *
     * @param message - The user's message
     * @param onChunk - Callback for each chunk of the response
     * @returns Promise that resolves when streaming is complete
     */
    async sendMessage(message, onChunk) {
        var _a, _b, _c, _d;
        const startTime = performance.now();
        this.logger.logFunctionEntry('sendMessage', {
            messageLength: message.length
        });
        try {
            // Validate input
            if (!message || !message.trim()) {
                throw this.errorFactory.createValidationError('message', message, 'non-empty string', 'sendMessage');
            }
            // Check API key at call time
            if (!this.apiKey) {
                throw this.errorFactory.createNodeEditorError('Gemini API key not configured', 'API_KEY_MISSING', 'Please create config.js from config.example.js and add your Gemini API key.', 'sendMessage');
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
                throw this.errorFactory.createNodeEditorError(`Gemini API request failed: ${response.statusText}`, 'GEMINI_API_ERROR', 'Failed to get response from AI. Please try again.', 'sendMessage', { status: response.status, errorText });
            }
            // Handle streaming response
            const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            if (!reader) {
                throw this.errorFactory.createNodeEditorError('Response body is not readable', 'GEMINI_STREAM_ERROR', 'Failed to read AI response.', 'sendMessage');
            }
            let buffer = '';
            try {
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
                        if (objStart === -1)
                            break;
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
                                if (char === '{')
                                    braceCount++;
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
                                if (data.candidates && ((_c = (_b = data.candidates[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts)) {
                                    const text = ((_d = data.candidates[0].content.parts[0]) === null || _d === void 0 ? void 0 : _d.text) || '';
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
                            }
                            catch (parseError) {
                                this.logger.logDebug('Failed to parse JSON object', 'sendMessage', {
                                    error: String(parseError),
                                    jsonLength: jsonStr.length
                                });
                            }
                            // Move past this object
                            startIdx = objEnd + 1;
                        }
                        else {
                            // No complete object found, keep the rest in buffer
                            buffer = buffer.substring(startIdx);
                            break;
                        }
                    }
                    // If we've processed all complete objects, clear the processed part
                    if (startIdx > 0 && startIdx < buffer.length) {
                        buffer = buffer.substring(startIdx);
                    }
                    else if (startIdx >= buffer.length) {
                        buffer = '';
                    }
                }
            }
            catch (streamError) {
                throw this.errorFactory.createNodeEditorError('Failed to read streaming response', 'GEMINI_STREAM_ERROR', 'Error reading AI response stream.', 'sendMessage', { error: String(streamError) });
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
        }
        catch (error) {
            this.logger.logError(error, 'sendMessage');
            // If it's already one of our custom errors, re-throw it
            if (error instanceof Error && (error.message.includes('API_KEY_MISSING') ||
                error.message.includes('GEMINI_API_ERROR') ||
                error.message.includes('GEMINI_STREAM_ERROR'))) {
                throw error;
            }
            // For other errors (network, etc.), wrap them
            throw this.errorFactory.createNodeEditorError('Failed to communicate with Gemini API', 'GEMINI_CONNECTION_ERROR', 'Unable to get AI response. Please check your connection and try again.', 'sendMessage', { error: String(error) });
        }
    }
    /**
     * Set the API key
     *
     * @param apiKey - The Gemini API key
     */
    setApiKey(apiKey) {
        this.logger.logFunctionEntry('setApiKey');
        this.apiKey = apiKey;
        this.logger.logInfo('API key updated', 'setApiKey');
        this.logger.logFunctionExit('setApiKey');
    }
}
// Export singleton instance
export const geminiService = new GeminiService();
