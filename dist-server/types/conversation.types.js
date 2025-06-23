"use strict";
/**
 * Type definitions for conversation management and node association logic.
 * These types define how chat messages map to graph nodes and how
 * conversation flow is managed.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONVERSATION_CONSTANTS = exports.DEFAULT_ASSOCIATION_RULES = void 0;
exports.isCreateChildOperation = isCreateChildOperation;
exports.isAddMarkdownOperation = isAddMarkdownOperation;
exports.isAddResponseOperation = isAddResponseOperation;
/**
 * Default association rules for the chat system.
 */
exports.DEFAULT_ASSOCIATION_RULES = {
    markdownTargetsLastPrompt: true,
    promptCreatesNewChild: true,
    responseInSameNode: true
};
/**
 * Type guards for pending operations.
 */
function isCreateChildOperation(op) {
    return op.type === 'create_child';
}
function isAddMarkdownOperation(op) {
    return op.type === 'add_markdown';
}
function isAddResponseOperation(op) {
    return op.type === 'add_response';
}
/**
 * Constants for conversation management.
 */
exports.CONVERSATION_CONSTANTS = {
    /** Maximum number of pending operations to queue */
    MAX_PENDING_OPERATIONS: 50,
    /** Timeout for operations (ms) */
    OPERATION_TIMEOUT: 30000,
    /** Maximum context window size in tokens (approximate) */
    MAX_CONTEXT_TOKENS: 4000,
    /** Number of recent messages to include by default */
    DEFAULT_CONTEXT_MESSAGES: 10,
    /** Delay before retrying failed operations (ms) */
    RETRY_DELAY: 1000,
    /** Maximum number of retries for failed operations */
    MAX_RETRIES: 3
};
