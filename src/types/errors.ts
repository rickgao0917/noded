/**
 * Custom error classes for domain-specific error handling
 * Following comprehensive error handling requirements
 */

export interface ErrorContext {
  readonly functionName: string;
  readonly parameters?: Record<string, unknown>;
  readonly userSession?: string;
  readonly timestamp: string;
  readonly correlationId: string;
}

/**
 * Base error class with comprehensive context information
 */
export abstract class BaseError extends Error {
  public readonly errorCode: string;
  public readonly context: ErrorContext;
  public readonly userFriendlyMessage: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(
    message: string,
    errorCode: string,
    userFriendlyMessage: string,
    context: ErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.userFriendlyMessage = userFriendlyMessage;
    this.context = context;
    this.severity = severity;

    // Preserve stack trace (Node.js specific)
    if ('captureStackTrace' in Error && typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get error information for logging
   */
  public getErrorInfo(): Record<string, unknown> {
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
  constructor(
    message: string,
    errorCode: string,
    userFriendlyMessage: string,
    context: ErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    super(message, `NODE_EDITOR_${errorCode}`, userFriendlyMessage, context, severity);
  }
}

/**
 * DOM manipulation errors
 */
export class DOMError extends BaseError {
  constructor(
    message: string,
    errorCode: string,
    userFriendlyMessage: string,
    context: ErrorContext,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'high'
  ) {
    super(message, `DOM_${errorCode}`, userFriendlyMessage, context, severity);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends BaseError {
  public readonly field: string;
  public readonly receivedValue: unknown;

  constructor(
    field: string,
    receivedValue: unknown,
    expectedType: string,
    context: ErrorContext
  ) {
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
  public readonly nodeId: string;
  public readonly operation: string;

  constructor(
    nodeId: string,
    operation: string,
    message: string,
    context: ErrorContext
  ) {
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
  public readonly operation: string;
  public readonly duration: number;
  public readonly threshold: number;

  constructor(
    operation: string,
    duration: number,
    threshold: number,
    context: ErrorContext
  ) {
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
  public readonly resourceType: string;
  public readonly resourceId: string;

  constructor(
    resourceType: string,
    resourceId: string,
    operation: string,
    context: ErrorContext
  ) {
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
  private readonly correlationId: string;

  constructor(correlationId: string) {
    this.correlationId = correlationId;
  }

  /**
   * Create error context
   */
  public createContext(functionName: string, parameters?: Record<string, unknown>): ErrorContext {
    return {
      functionName,
      parameters,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId
    };
  }

  /**
   * Create node editor error
   */
  public createNodeEditorError(
    message: string,
    errorCode: string,
    userMessage: string,
    functionName: string,
    parameters?: Record<string, unknown>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): NodeEditorError {
    const context = this.createContext(functionName, parameters);
    return new NodeEditorError(message, errorCode, userMessage, context, severity);
  }

  /**
   * Create DOM error
   */
  public createDOMError(
    message: string,
    errorCode: string,
    userMessage: string,
    functionName: string,
    parameters?: Record<string, unknown>
  ): DOMError {
    const context = this.createContext(functionName, parameters);
    return new DOMError(message, errorCode, userMessage, context);
  }

  /**
   * Create validation error
   */
  public createValidationError(
    field: string,
    receivedValue: unknown,
    expectedType: string,
    functionName: string,
    parameters?: Record<string, unknown>
  ): ValidationError {
    const context = this.createContext(functionName, parameters);
    return new ValidationError(field, receivedValue, expectedType, context);
  }

  /**
   * Create tree structure error
   */
  public createTreeStructureError(
    nodeId: string,
    operation: string,
    message: string,
    functionName: string,
    parameters?: Record<string, unknown>
  ): TreeStructureError {
    const context = this.createContext(functionName, parameters);
    return new TreeStructureError(nodeId, operation, message, context);
  }
}