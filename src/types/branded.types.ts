/**
 * Branded types for domain-specific values
 * 
 * These types provide compile-time safety for values that are semantically
 * different but have the same underlying type (e.g., different kinds of IDs).
 */

// Brand utility type
declare const brand: unique symbol;
type Brand<K, T> = K & { [brand]: T };

/**
 * Unique identifier for a graph node
 * @example
 * const nodeId: NodeId = createNodeId('node_123');
 */
export type NodeId = Brand<string, 'NodeId'>;

/**
 * Unique identifier for a node block
 * @example
 * const blockId: BlockId = createBlockId('block_456');
 */
export type BlockId = Brand<string, 'BlockId'>;

/**
 * Unique identifier for a correlation ID used in logging
 * @example
 * const correlationId: CorrelationId = createCorrelationId('corr_789');
 */
export type CorrelationId = Brand<string, 'CorrelationId'>;

/**
 * Unique identifier for a session
 * @example
 * const sessionId: SessionId = createSessionId('session_abc');
 */
export type SessionId = Brand<string, 'SessionId'>;

// Type guard functions
export function isNodeId(value: unknown): value is NodeId {
  return typeof value === 'string' && value.startsWith('node_');
}

export function isBlockId(value: unknown): value is BlockId {
  return typeof value === 'string' && value.startsWith('block_');
}

export function isCorrelationId(value: unknown): value is CorrelationId {
  return typeof value === 'string' && value.startsWith('corr_');
}

export function isSessionId(value: unknown): value is SessionId {
  return typeof value === 'string' && value.startsWith('session_');
}

// Factory functions for creating branded types
export function createNodeId(id: string): NodeId {
  if (!id.startsWith('node_')) {
    throw new Error(`Invalid node ID format: ${id}. Must start with 'node_'`);
  }
  return id as NodeId;
}

export function createBlockId(id: string): BlockId {
  if (!id.startsWith('block_')) {
    throw new Error(`Invalid block ID format: ${id}. Must start with 'block_'`);
  }
  return id as BlockId;
}

export function createCorrelationId(id: string): CorrelationId {
  if (!id.startsWith('corr_')) {
    throw new Error(`Invalid correlation ID format: ${id}. Must start with 'corr_'`);
  }
  return id as CorrelationId;
}

export function createSessionId(id: string): SessionId {
  if (!id.startsWith('session_')) {
    throw new Error(`Invalid session ID format: ${id}. Must start with 'session_'`);
  }
  return id as SessionId;
}

// Utility function to generate new IDs
export function generateNodeId(): NodeId {
  return createNodeId(`node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}

export function generateBlockId(): BlockId {
  return createBlockId(`block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}

export function generateCorrelationId(): CorrelationId {
  return createCorrelationId(`corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}

export function generateSessionId(): SessionId {
  return createSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}