/**
 * Core type definitions for the chat system.
 * This file contains the fundamental types used throughout the chat interface
 * and conversation management components.
 */
/**
 * Represents the different types of messages that can appear in a chat conversation.
 */
export var ChatMessageType;
(function (ChatMessageType) {
    ChatMessageType["USER_PROMPT"] = "user_prompt";
    ChatMessageType["ASSISTANT_RESPONSE"] = "assistant_response";
    ChatMessageType["USER_MARKDOWN"] = "user_markdown";
})(ChatMessageType || (ChatMessageType = {}));
/**
 * Default configuration values for the chat interface.
 */
export const DEFAULT_CHAT_CONFIG = {
    panelWidth: 40,
    maxMessagesBeforeVirtualization: 100,
    autoFocusInput: true,
    inputDebounceDelay: 300,
    transitionDuration: 300
};
/**
 * Type guard to check if a value is a valid ChatCommand.
 */
export function isChatCommand(value) {
    return value === '/prompt' || value === '/md';
}
/**
 * Type guard to check if a message type is valid.
 */
export function isValidMessageType(type) {
    return Object.values(ChatMessageType).includes(type);
}
/**
 * Constants for chat system behavior.
 */
export const CHAT_CONSTANTS = {
    /** Maximum length for any single message content */
    MAX_MESSAGE_LENGTH: 10000,
    /** Maximum depth of conversation threads to prevent stack overflow */
    MAX_THREAD_DEPTH: 100,
    /** Regex pattern for validating chat commands */
    COMMAND_PATTERN: /^(\/prompt|\/md)\s+(.+)$/,
    /** Minimum content length after command */
    MIN_CONTENT_LENGTH: 1,
    /** Rate limit for sending messages (ms between messages) */
    MESSAGE_RATE_LIMIT: 500,
    /** Canvas width percentage when chat is open */
    CANVAS_WIDTH_WITH_CHAT: 60,
    /** Default panel width percentage */
    DEFAULT_PANEL_WIDTH: 40,
    /** Zoom reduction factor when chat opens (0.7 = 70% of current zoom) */
    ZOOM_REDUCTION_FACTOR: 0.65
};
