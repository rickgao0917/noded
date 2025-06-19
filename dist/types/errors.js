/**
 * Custom error classes for domain-specific error handling
 * Following comprehensive error handling requirements
 */
/**
 * Base error class with comprehensive context information
 */
export class BaseError extends Error {
    constructor(message, errorCode, userFriendlyMessage, context, severity = 'medium') {
        super(message);
        this.name = this.constructor.name;
        this.errorCode = errorCode;
        this.userFriendlyMessage = userFriendlyMessage;
        this.context = context;
        this.severity = severity;
        // Preserve stack trace (Node.js specific)
        if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    /**
     * Get error information for logging
     */
    getErrorInfo() {
        return {
            name: this.name,
            message: this.message,
            errorCode: this.errorCode,
            userFriendlyMessage: this.userFriendlyMessage,
            severity: this.severity,
            context: this.context,
            stack: this.stack
        };
    }
}
/**
 * Node editor specific errors
 */
export class NodeEditorError extends BaseError {
    constructor(message, errorCode, userFriendlyMessage, context, severity = 'medium') {
        super(message, `NODE_EDITOR_${errorCode}`, userFriendlyMessage, context, severity);
    }
}
/**
 * DOM manipulation errors
 */
export class DOMError extends BaseError {
    constructor(message, errorCode, userFriendlyMessage, context, severity = 'high') {
        super(message, `DOM_${errorCode}`, userFriendlyMessage, context, severity);
    }
}
/**
 * Validation errors
 */
export class ValidationError extends BaseError {
    constructor(field, receivedValue, expectedType, context) {
        const message = `Validation failed for field '${field}': expected ${expectedType}, received ${typeof receivedValue}`;
        const userMessage = `Invalid input for ${field}. Please check your data and try again.`;
        super(message, `VALIDATION_${field.toUpperCase()}_INVALID`, userMessage, context, 'medium');
        this.field = field;
        this.receivedValue = receivedValue;
    }
}
/**
 * Tree structure errors
 */
export class TreeStructureError extends BaseError {
    constructor(nodeId, operation, message, context) {
        const userMessage = `Unable to ${operation} node. The tree structure would become invalid.`;
        super(message, `TREE_STRUCTURE_${operation.toUpperCase()}_FAILED`, userMessage, context, 'high');
        this.nodeId = nodeId;
        this.operation = operation;
    }
}
/**
 * Performance errors
 */
export class PerformanceError extends BaseError {
    constructor(operation, duration, threshold, context) {
        const message = `Performance threshold exceeded for ${operation}: ${duration}ms > ${threshold}ms`;
        const userMessage = `The operation is taking longer than expected. Please try again.`;
        super(message, `PERFORMANCE_${operation.toUpperCase()}_SLOW`, userMessage, context, 'medium');
        this.operation = operation;
        this.duration = duration;
        this.threshold = threshold;
    }
}
/**
 * Resource errors
 */
export class ResourceError extends BaseError {
    constructor(resourceType, resourceId, operation, context) {
        const message = `Failed to ${operation} ${resourceType}: ${resourceId}`;
        const userMessage = `Unable to access the requested resource. Please refresh and try again.`;
        super(message, `RESOURCE_${resourceType.toUpperCase()}_${operation.toUpperCase()}_FAILED`, userMessage, context, 'high');
        this.resourceType = resourceType;
        this.resourceId = resourceId;
    }
}
/**
 * Error factory for creating errors with context
 */
export class ErrorFactory {
    constructor(correlationId) {
        this.correlationId = correlationId;
    }
    /**
     * Create error context
     */
    createContext(functionName, parameters) {
        return {
            functionName,
            parameters: parameters !== null && parameters !== void 0 ? parameters : undefined,
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId
        };
    }
    /**
     * Create node editor error
     */
    createNodeEditorError(message, errorCode, userMessage, functionName, parameters, severity = 'medium') {
        const context = this.createContext(functionName, parameters);
        return new NodeEditorError(message, errorCode, userMessage, context, severity);
    }
    /**
     * Create DOM error
     */
    createDOMError(message, errorCode, userMessage, functionName, parameters) {
        const context = this.createContext(functionName, parameters);
        return new DOMError(message, errorCode, userMessage, context);
    }
    /**
     * Create validation error
     */
    createValidationError(field, receivedValue, expectedType, functionName, parameters) {
        const context = this.createContext(functionName, parameters);
        return new ValidationError(field, receivedValue, expectedType, context);
    }
    /**
     * Create tree structure error
     */
    createTreeStructureError(nodeId, operation, message, functionName, parameters) {
        const context = this.createContext(functionName, parameters);
        return new TreeStructureError(nodeId, operation, message, context);
    }
}
