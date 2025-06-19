var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Logger } from '../utils/logger.js';
import { ErrorFactory } from '../types/errors.js';
/**
 * Service for interacting with Google's Gemini Flash API
 * Handles chat completions with streaming support
 */
export class GeminiService {
    constructor() {
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';
        this.logger = new Logger('GeminiService');
        this.errorFactory = new ErrorFactory('gemini-service');
        // Temporary API key - replace with your actual key
        this.apiKey = 'AIzaSyBjgivUoXPF8QSz18fcKYtocSsL2Xjt2dI'; // Paste your API key here
    }
    /**
     * Send a chat message to Gemini and get a streaming response
     *
     * @param message - The user's message
     * @param onChunk - Callback for each chunk of the response
     * @returns Promise that resolves when streaming is complete
     */
    sendMessage(message, onChunk) {
        return __awaiter(this, void 0, void 0, function* () {
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
                // Check API key
                if (!this.apiKey || this.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
                    throw this.errorFactory.createNodeEditorError('Gemini API key not configured', 'API_KEY_MISSING', 'Please set a valid Gemini API key in the code.', 'sendMessage');
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
                const response = yield fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });
                if (!response.ok) {
                    const errorText = yield response.text();
                    this.logger.logError(new Error(`API request failed: ${response.status}`), 'sendMessage', {
                        status: response.status,
                        statusText: response.statusText,
                        errorText
                    });
                    throw this.errorFactory.createNodeEditorError(`Gemini API request failed: ${response.statusText}`, 'API_REQUEST_FAILED', 'Failed to get response from AI. Please try again.', 'sendMessage', { status: response.status, errorText });
                }
                // Handle streaming response
                const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
                const decoder = new TextDecoder();
                let fullResponse = '';
                if (!reader) {
                    throw this.errorFactory.createNodeEditorError('Response body is not readable', 'RESPONSE_NOT_READABLE', 'Failed to read AI response.', 'sendMessage');
                }
                let buffer = '';
                while (true) {
                    const { done, value } = yield reader.read();
                    if (done) {
                        break;
                    }
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    // Process complete JSON objects from buffer
                    const objects = buffer.split('\n');
                    // Keep the last incomplete line in the buffer
                    buffer = objects.pop() || '';
                    for (const objStr of objects) {
                        if (!objStr.trim())
                            continue;
                        let jsonStr = '';
                        try {
                            // Handle comma-separated JSON objects
                            jsonStr = objStr.startsWith(',') ? objStr.substring(1).trim() : objStr.trim();
                            if (!jsonStr || jsonStr === ']')
                                continue;
                            const data = JSON.parse(jsonStr);
                            // Extract text from the response
                            if (data.candidates && ((_c = (_b = data.candidates[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts)) {
                                const text = ((_d = data.candidates[0].content.parts[0]) === null || _d === void 0 ? void 0 : _d.text) || '';
                                if (text) {
                                    fullResponse += text;
                                    onChunk(text);
                                    this.logger.logInfo('Received chunk from Gemini', 'sendMessage', {
                                        chunkLength: text.length,
                                        totalLength: fullResponse.length
                                    });
                                    // Log streaming progress periodically (every 10 chunks)
                                    if (fullResponse.length % 500 < text.length) {
                                        console.log(`📦 Streaming progress: ${fullResponse.length} characters received...`);
                                    }
                                }
                            }
                        }
                        catch (parseError) {
                            // Log parse errors but continue processing
                            if (jsonStr && jsonStr !== '{' && jsonStr !== '}') {
                                this.logger.logInfo('Skipping non-JSON line', 'sendMessage', {
                                    line: objStr.substring(0, 50)
                                });
                            }
                        }
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
            }
            catch (error) {
                this.logger.logError(error, 'sendMessage');
                if (error instanceof Error && error.name.includes('Error')) {
                    throw error;
                }
                throw this.errorFactory.createNodeEditorError('Failed to communicate with Gemini API', 'API_COMMUNICATION_FAILED', 'Unable to get AI response. Please check your connection and try again.', 'sendMessage', { error: String(error) });
            }
        });
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
