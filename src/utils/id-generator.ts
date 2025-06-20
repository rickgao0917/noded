/**
 * ID generator utilities for branded types
 * Creates properly formatted IDs for nodes and blocks
 */

import type { NodeId, BlockId } from '../types/branded.types';

/**
 * Generates a UUID v4
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates a new NodeId
 */
export function createNodeId(): NodeId {
  return `node_${generateUUID()}` as NodeId;
}

/**
 * Creates a new BlockId
 */
export function createBlockId(): BlockId {
  return `block_${generateUUID()}` as BlockId;
}

/**
 * Creates a new CorrelationId
 */
export function createCorrelationId(): string {
  return generateUUID();
}

/**
 * Creates a new SessionId
 */
export function createSessionId(): string {
  return `session_${generateUUID()}`;
}
