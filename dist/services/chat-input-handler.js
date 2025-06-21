/**
 * Service responsible for parsing and validating chat input commands.
 * Handles /prompt and /md commands with proper validation and sanitization.
 */
import { Logger } from '../utils/logger.js';
import { isChatCommand, CHAT_CONSTANTS } from '../types/chat.types.js';
/**
 * Handles parsing and validation of chat input commands.
 * Provides security sanitization and input validation for user commands.
 */
export class ChatInputHandler {
    constructor() {
        this.lastCommandTime = 0;
        /**
         * Regular expression for parsing chat commands.
         * Matches /prompt or /md followed by whitespace and content (including multi-line).
         */
        this.COMMAND_REGEX = /^(\/prompt|\/md)\s+([\s\S]+)$/;
        this.logger = new Logger('ChatInputHandler');
        this.logger.logFunctionEntry('constructor');
        this.logger.logFunctionExit('constructor');
    }
    /**
     * Parses raw input to extract chat commands and content.
     *
     * @param input - Raw user input from the chat interface
     * @returns Parsed command result with validation status
     */
    parseCommand(input) {
        this.logger.logFunctionEntry('parseCommand', { inputLength: input.length });
        try {
            // Trim input and check for empty string
            const trimmedInput = input.trim();
            if (!trimmedInput) {
                const result = {
                    command: null,
                    content: '',
                    isValid: false,
                    error: 'Input cannot be empty'
                };
                this.logger.logBranch('parseCommand', 'empty_input', true, { result });
                return result;
            }
            // Check if input starts with forward slash
            if (!trimmedInput.startsWith('/')) {
                const result = {
                    command: null,
                    content: trimmedInput,
                    isValid: false,
                    error: 'Commands must start with / (use /prompt or /md)'
                };
                this.logger.logBranch('parseCommand', 'no_slash', true, { result });
                return result;
            }
            // Parse command using regex
            const match = trimmedInput.match(this.COMMAND_REGEX);
            if (!match) {
                const result = {
                    command: null,
                    content: '',
                    isValid: false,
                    error: this.getParseErrorMessage(trimmedInput)
                };
                this.logger.logBranch('parseCommand', 'invalid_format', true, { result });
                return result;
            }
            const [, commandStr, content] = match;
            // Validate command is in allowed list
            if (!commandStr || !isChatCommand(commandStr)) {
                const result = {
                    command: null,
                    content: '',
                    isValid: false,
                    error: `Unknown command: ${commandStr}. Use /prompt or /md`
                };
                this.logger.logBranch('parseCommand', 'unknown_command', true, { commandStr, result });
                return result;
            }
            const command = commandStr;
            // Validate content requirements  
            const validationResult = this.validateContent(command, content || '');
            if (!validationResult.isValid) {
                const result = {
                    command,
                    content: '',
                    isValid: false,
                    error: validationResult.error || 'Validation failed'
                };
                this.logger.logBranch('parseCommand', 'content_validation_failed', true, { result });
                return result;
            }
            // Sanitize content
            const sanitizedContent = this.sanitizeContent(content || '');
            // Check rate limiting
            if (!this.checkRateLimit()) {
                const result = {
                    command,
                    content: sanitizedContent,
                    isValid: false,
                    error: 'Please wait a moment before sending another command'
                };
                this.logger.logBranch('parseCommand', 'rate_limited', true, { result });
                return result;
            }
            // Success
            const result = {
                command,
                content: sanitizedContent,
                isValid: true
            };
            this.logger.logInfo('command_parsed_successfully', 'parseCommand', {
                command,
                contentLength: sanitizedContent.length
            });
            return result;
        }
        finally {
            this.logger.logFunctionExit('parseCommand');
        }
    }
    /**
     * Validates content based on command-specific requirements.
     *
     * @param command - The parsed command type
     * @param content - The content to validate
     * @returns Validation result with error message if invalid
     */
    validateContent(command, content) {
        this.logger.logFunctionEntry('validateContent', { command, contentLength: content.length });
        try {
            // Check for empty content
            if (!content.trim()) {
                this.logger.logBranch('validateContent', 'empty_content', true);
                return {
                    isValid: false,
                    error: `${command} requires content after the command`
                };
            }
            // Check content doesn't start with slash (would be confusing)
            if (content.trim().startsWith('/')) {
                this.logger.logBranch('validateContent', 'content_starts_with_slash', true);
                return {
                    isValid: false,
                    error: 'Content cannot start with / (this would be interpreted as another command)'
                };
            }
            // Check maximum length
            const maxLength = CHAT_CONSTANTS.MAX_MESSAGE_LENGTH;
            if (content.length > maxLength) {
                this.logger.logBranch('validateContent', 'content_too_long', true, {
                    contentLength: content.length,
                    maxLength
                });
                return {
                    isValid: false,
                    error: `Content is too long (${content.length} characters, maximum is ${maxLength})`
                };
            }
            // Command-specific validation
            switch (command) {
                case '/prompt':
                    // Prompts need meaningful content
                    if (content.trim().length < 3) {
                        this.logger.logBranch('validateContent', 'prompt_too_short', true);
                        return {
                            isValid: false,
                            error: 'Prompts must be at least 3 characters long'
                        };
                    }
                    break;
                case '/md':
                    // Markdown content is more flexible, just needs to exist
                    if (content.trim().length < 1) {
                        this.logger.logBranch('validateContent', 'markdown_empty', true);
                        return {
                            isValid: false,
                            error: 'Markdown content cannot be empty'
                        };
                    }
                    break;
            }
            this.logger.logBranch('validateContent', 'validation_passed', true);
            return { isValid: true };
        }
        finally {
            this.logger.logFunctionExit('validateContent');
        }
    }
    /**
     * Sanitizes content to prevent XSS and normalize formatting.
     *
     * @param content - Raw content to sanitize
     * @returns Sanitized content safe for display
     */
    sanitizeContent(content) {
        this.logger.logFunctionEntry('sanitizeContent', { contentLength: content.length });
        try {
            // First, normalize whitespace
            // Note: We don't trim() here to preserve code block formatting
            let sanitized = content
                .replace(/\r\n/g, '\n') // Normalize line endings
                .replace(/\r/g, '\n') // Handle old Mac line endings
                .replace(/\t/g, '    '); // Convert tabs to spaces
            // For markdown content, we want to preserve most formatting
            // but still prevent XSS attacks
            if (content.includes('<script') || content.includes('javascript:')) {
                this.logger.logBranch('sanitizeContent', 'potential_xss_detected', true);
                // Use DOMPurify for HTML content that might contain scripts
                sanitized = DOMPurify.sanitize(sanitized, {
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre', 'blockquote',
                        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a'],
                    ALLOWED_ATTR: ['href', 'title'],
                    ALLOW_DATA_ATTR: false
                });
            }
            this.logger.logInfo('content_sanitized', 'sanitizeContent', {
                originalLength: content.length,
                sanitizedLength: sanitized.length
            });
            return sanitized;
        }
        finally {
            this.logger.logFunctionExit('sanitizeContent');
        }
    }
    /**
     * Checks if the user is sending commands too quickly.
     *
     * @returns True if enough time has passed since last command
     */
    checkRateLimit() {
        this.logger.logFunctionEntry('checkRateLimit');
        try {
            const now = Date.now();
            const timeSinceLastCommand = now - this.lastCommandTime;
            const rateLimit = CHAT_CONSTANTS.MESSAGE_RATE_LIMIT;
            if (timeSinceLastCommand < rateLimit) {
                this.logger.logBranch('checkRateLimit', 'rate_limit_exceeded', true, {
                    timeSinceLastCommand,
                    rateLimit
                });
                return false;
            }
            this.lastCommandTime = now;
            this.logger.logBranch('checkRateLimit', 'rate_limit_ok', true, { timeSinceLastCommand });
            return true;
        }
        finally {
            this.logger.logFunctionExit('checkRateLimit');
        }
    }
    /**
     * Generates a helpful error message for invalid command formats.
     *
     * @param input - The invalid input
     * @returns User-friendly error message
     */
    getParseErrorMessage(input) {
        this.logger.logFunctionEntry('getParseErrorMessage', { input });
        try {
            // Check if they tried to use a command but got the format wrong
            const commandWord = input.split(/\s+/)[0];
            if (commandWord === '/prompt' || commandWord === '/md') {
                this.logger.logBranch('getParseErrorMessage', 'missing_content', true);
                return `${commandWord} requires content after the command. Example: ${commandWord} Your text here`;
            }
            // Check if they used a slash but wrong command
            if (input.startsWith('/')) {
                this.logger.logBranch('getParseErrorMessage', 'unknown_slash_command', true);
                return `Unknown command. Valid commands are:\n/prompt - Create a new message\n/md - Add markdown to previous prompt`;
            }
            // Generic error
            this.logger.logBranch('getParseErrorMessage', 'generic_error', true);
            return 'Invalid command format. Use /prompt or /md followed by your content';
        }
        finally {
            this.logger.logFunctionExit('getParseErrorMessage');
        }
    }
    /**
     * Extracts the command type from raw input without full validation.
     * Useful for UI hints and autocomplete.
     *
     * @param input - Raw user input
     * @returns The command being typed, or null
     */
    getCommandHint(input) {
        this.logger.logFunctionEntry('getCommandHint', { input });
        try {
            const trimmed = input.trim();
            if (trimmed === '/p' || trimmed === '/pr' || trimmed === '/pro' ||
                trimmed === '/prom' || trimmed === '/promp') {
                this.logger.logBranch('getCommandHint', 'partial_prompt', true);
                return '/prompt';
            }
            if (trimmed === '/m') {
                this.logger.logBranch('getCommandHint', 'partial_md', true);
                return '/md';
            }
            if (trimmed.startsWith('/prompt')) {
                this.logger.logBranch('getCommandHint', 'full_prompt', true);
                return '/prompt';
            }
            if (trimmed.startsWith('/md')) {
                this.logger.logBranch('getCommandHint', 'full_md', true);
                return '/md';
            }
            this.logger.logBranch('getCommandHint', 'no_hint', false);
            return null;
        }
        finally {
            this.logger.logFunctionExit('getCommandHint');
        }
    }
    /**
     * Validates if a given string is a valid command format.
     * This is a quick check that doesn't parse content.
     *
     * @param input - Input to check
     * @returns True if input matches command format
     */
    isValidCommandFormat(input) {
        this.logger.logFunctionEntry('isValidCommandFormat', { input });
        try {
            const result = this.COMMAND_REGEX.test(input.trim());
            this.logger.logInfo('format_check', 'isValidCommandFormat', { input, result });
            return result;
        }
        finally {
            this.logger.logFunctionExit('isValidCommandFormat');
        }
    }
}
