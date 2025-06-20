/**
 * Custom error classes for expandable node system
 * Provides detailed error information for node operations
 */

import { NodeEditorError, ValidationError, ErrorContext } from './errors';
import type { NodeId, BlockId } from './branded.types';
import type { NodeDimensions, DimensionConstraints } from './expandable-node.types';

/**
 * Creates error context for node operations
 */
function createErrorContext(functionName: string, parameters?: Record<string, unknown>): ErrorContext {
  return {
    functionName,
    ...(parameters !== undefined && { parameters }),
    timestamp: new Date().toISOString(),
    correlationId: Math.random().toString(36).substring(7)
  };
}

/**
 * Error thrown when node creation fails
 */
export class NodeCreationError extends NodeEditorError {
  public readonly nodeData: unknown;
  public readonly validationErrors: ValidationError[];
  public readonly originalCause?: Error;

  constructor(
    message: string,
    nodeData: unknown,
    validationErrors: ValidationError[] = [],
    cause?: Error
  ) {
    const fullMessage = `Node creation failed: ${message}`;
    const userMessage = 'Failed to create node. Please check your input and try again.';
    const context = createErrorContext('NodeCreation', { nodeData });
    
    super(fullMessage, 'CREATION_FAILED', userMessage, context, 'medium');
    
    this.nodeData = nodeData;
    this.validationErrors = validationErrors;
    if (cause !== undefined) {
      this.originalCause = cause;
    }
  }
}

/**
 * Error thrown when node resize operation fails
 */
export class NodeResizeError extends NodeEditorError {
  public readonly nodeId: NodeId;
  public readonly attemptedDimensions: Partial<NodeDimensions>;
  public readonly constraints: DimensionConstraints;
  public readonly originalCause?: Error;

  constructor(
    message: string,
    nodeId: NodeId,
    attemptedDimensions: Partial<NodeDimensions>,
    constraints: DimensionConstraints,
    cause?: Error
  ) {
    const fullMessage = `Node resize failed: ${message}`;
    const userMessage = 'Failed to resize node. The dimensions may be outside allowed limits.';
    const context = createErrorContext('NodeResize', { nodeId, attemptedDimensions, constraints });
    
    super(fullMessage, 'RESIZE_FAILED', userMessage, context, 'medium');
    
    this.nodeId = nodeId;
    this.attemptedDimensions = attemptedDimensions;
    this.constraints = constraints;
    if (cause !== undefined) {
      this.originalCause = cause;
    }
  }
}

/**
 * Error thrown when block creation fails
 */
export class BlockCreationError extends NodeEditorError {
  public readonly nodeId: NodeId;
  public readonly blockData: unknown;
  public readonly originalCause?: Error;

  constructor(
    message: string,
    nodeId: NodeId,
    blockData: unknown,
    cause?: Error
  ) {
    const fullMessage = `Block creation failed: ${message}`;
    const userMessage = 'Failed to create block. Please check your input and try again.';
    const context = createErrorContext('BlockCreation', { nodeId, blockData });
    
    super(fullMessage, 'BLOCK_CREATION_FAILED', userMessage, context, 'medium');
    
    this.nodeId = nodeId;
    this.blockData = blockData;
    if (cause !== undefined) {
      this.originalCause = cause;
    }
  }
}

/**
 * Error thrown when block update fails
 */
export class BlockUpdateError extends NodeEditorError {
  public readonly blockId: BlockId;
  public readonly updateData: unknown;
  public readonly originalCause?: Error;

  constructor(
    message: string,
    blockId: BlockId,
    updateData: unknown,
    cause?: Error
  ) {
    const fullMessage = `Block update failed: ${message}`;
    const userMessage = 'Failed to update block. Please try again.';
    const context = createErrorContext('BlockUpdate', { blockId, updateData });
    
    super(fullMessage, 'BLOCK_UPDATE_FAILED', userMessage, context, 'medium');
    
    this.blockId = blockId;
    this.updateData = updateData;
    if (cause !== undefined) {
      this.originalCause = cause;
    }
  }
}

/**
 * Error thrown when node not found
 */
export class NodeNotFoundError extends NodeEditorError {
  public readonly nodeId: NodeId;
  public readonly originalCause?: Error;

  constructor(nodeId: NodeId, cause?: Error) {
    const message = `Node not found: ${nodeId}`;
    const userMessage = 'The requested node could not be found.';
    const context = createErrorContext('NodeLookup', { nodeId });
    
    super(message, 'NOT_FOUND', userMessage, context, 'low');
    
    this.nodeId = nodeId;
    if (cause !== undefined) {
      this.originalCause = cause;
    }
  }
}

/**
 * Error thrown when block not found
 */
export class BlockNotFoundError extends NodeEditorError {
  public readonly blockId: BlockId;
  public readonly originalCause?: Error;

  constructor(blockId: BlockId, cause?: Error) {
    const message = `Block not found: ${blockId}`;
    const userMessage = 'The requested block could not be found.';
    const context = createErrorContext('BlockLookup', { blockId });
    
    super(message, 'BLOCK_NOT_FOUND', userMessage, context, 'low');
    
    this.blockId = blockId;
    if (cause !== undefined) {
      this.originalCause = cause;
    }
  }
}

/**
 * Error thrown when node render fails
 */
export class NodeRenderError extends NodeEditorError {
  public readonly nodeId: NodeId;
  public readonly originalCause?: Error;

  constructor(message: string, nodeId: NodeId, cause?: Error) {
    const fullMessage = `Node render failed: ${message}`;
    const userMessage = 'Failed to render node. Please refresh and try again.';
    const context = createErrorContext('NodeRender', { nodeId });
    
    super(fullMessage, 'RENDER_FAILED', userMessage, context, 'high');
    
    this.nodeId = nodeId;
    if (cause !== undefined) {
      this.originalCause = cause;
    }
  }
}

/**
 * Error thrown when resize setup fails
 */
export class ResizeSetupError extends NodeEditorError {
  public readonly nodeId: NodeId;
  public readonly element: HTMLElement | null;
  public readonly originalCause?: Error;

  constructor(message: string, nodeId: NodeId, element: HTMLElement | null, cause?: Error) {
    const fullMessage = `Resize setup failed: ${message}`;
    const userMessage = 'Failed to set up resize handles.';
    const context = createErrorContext('ResizeSetup', { nodeId, hasElement: !!element });
    
    super(fullMessage, 'RESIZE_SETUP_FAILED', userMessage, context, 'medium');
    
    this.nodeId = nodeId;
    this.element = element;
    if (cause !== undefined) {
      this.originalCause = cause;
    }
  }
}

/**
 * Error thrown when resize handler fails
 */
export class ResizeHandlerError extends NodeEditorError {
  public readonly nodeId: NodeId;
  public readonly direction: string;
  public readonly originalCause?: Error;

  constructor(message: string, nodeId: NodeId, direction: string, cause?: Error) {
    const fullMessage = `Resize handler failed: ${message}`;
    const userMessage = 'Failed to handle resize operation.';
    const context = createErrorContext('ResizeHandler', { nodeId, direction });
    
    super(fullMessage, 'RESIZE_HANDLER_FAILED', userMessage, context, 'medium');
    
    this.nodeId = nodeId;
    this.direction = direction;
    if (cause !== undefined) {
      this.originalCause = cause;
    }
  }
}

/**
 * Error thrown when scaling update fails
 */
export class ScalingUpdateError extends NodeEditorError {
  public readonly nodeId: NodeId;
  public readonly newDimensions: NodeDimensions;
  public readonly originalCause?: Error;

  constructor(message: string, nodeId: NodeId, newDimensions: NodeDimensions, cause?: Error) {
    const fullMessage = `Scaling update failed: ${message}`;
    const userMessage = 'Failed to update block scaling.';
    const context = createErrorContext('ScalingUpdate', { nodeId, newDimensions });
    
    super(fullMessage, 'SCALING_UPDATE_FAILED', userMessage, context, 'medium');
    
    this.nodeId = nodeId;
    this.newDimensions = newDimensions;
    if (cause !== undefined) {
      this.originalCause = cause;
    }
  }
}
