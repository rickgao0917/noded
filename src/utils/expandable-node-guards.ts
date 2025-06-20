/**
 * Type guards for expandable node system
 * Provides runtime validation for node and block structures
 */

import type {
  ExpandableNode,
  BasicBlock,
  NodeDimensions,
  BlockDimensions,
  BlockType,
  NodePosition,
  NodeMetadata,
  BlockMetadata
} from '../types/expandable-node.types';
import { NODE_DIMENSION_CONSTANTS, BLOCK_DIMENSION_CONSTANTS } from '../types/expandable-node.types';

/**
 * Checks if a value has a required property of a specific type
 */
function hasRequiredProperty<T>(
  value: unknown,
  property: string,
  validator: (val: unknown) => val is T
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    property in value &&
    validator((value as Record<string, unknown>)[property])
  );
}

/**
 * Checks if a value has a required string property
 */
function hasRequiredStringProperty(
  value: unknown,
  property: string
): value is Record<string, unknown> {
  return hasRequiredProperty(value, property, (val): val is string => typeof val === 'string');
}

/**
 * Checks if a value has a required number property
 */
function hasRequiredNumberProperty(
  value: unknown,
  property: string
): value is Record<string, unknown> {
  return hasRequiredProperty(value, property, (val): val is number => typeof val === 'number' && !isNaN(val));
}

/**
 * Checks if a value has a required boolean property
 */
function hasRequiredBooleanProperty(
  value: unknown,
  property: string
): value is Record<string, unknown> {
  return hasRequiredProperty(value, property, (val): val is boolean => typeof val === 'boolean');
}

/**
 * Checks if a value has a required object property
 */
function hasRequiredObjectProperty(
  value: unknown,
  property: string
): value is Record<string, unknown> {
  return hasRequiredProperty(value, property, (val): val is object => typeof val === 'object' && val !== null);
}

/**
 * Checks if a value has a required array property
 */
function hasRequiredArrayProperty(
  value: unknown,
  property: string
): value is Record<string, unknown> {
  return hasRequiredProperty(value, property, (val): val is unknown[] => Array.isArray(val));
}

/**
 * Validates a block type value
 */
export function validateBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && ['prompt', 'response', 'markdown'].includes(value);
}

/**
 * Type guard for NodeDimensions
 */
export function isNodeDimensions(value: unknown): value is NodeDimensions {
  if (!hasRequiredNumberProperty(value, 'width')) return false;
  if (!hasRequiredNumberProperty(value, 'height')) return false;
  if (!hasRequiredNumberProperty(value, 'minWidth')) return false;
  if (!hasRequiredNumberProperty(value, 'maxWidth')) return false;
  if (!hasRequiredNumberProperty(value, 'minHeight')) return false;
  if (!hasRequiredNumberProperty(value, 'maxHeight')) return false;

  const dimensions = value as {
    width: number;
    height: number;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
  };
  
  // Validate dimension constraints
  if (dimensions.width < dimensions.minWidth || dimensions.width > dimensions.maxWidth) return false;
  if (dimensions.height < dimensions.minHeight || dimensions.height > dimensions.maxHeight) return false;
  if (dimensions.minWidth < NODE_DIMENSION_CONSTANTS.MIN_WIDTH) return false;
  if (dimensions.maxWidth > NODE_DIMENSION_CONSTANTS.MAX_WIDTH) return false;
  if (dimensions.minHeight < NODE_DIMENSION_CONSTANTS.MIN_HEIGHT) return false;
  if (dimensions.maxHeight > NODE_DIMENSION_CONSTANTS.MAX_HEIGHT) return false;

  return true;
}

/**
 * Type guard for NodePosition
 */
export function isNodePosition(value: unknown): value is NodePosition {
  return (
    hasRequiredNumberProperty(value, 'x') &&
    hasRequiredNumberProperty(value, 'y') &&
    hasRequiredNumberProperty(value, 'zIndex')
  );
}

/**
 * Type guard for NodeMetadata
 */
export function isNodeMetadata(value: unknown): value is NodeMetadata {
  if (!hasRequiredObjectProperty(value, 'createdAt')) return false;
  if (!hasRequiredObjectProperty(value, 'lastModified')) return false;
  if (!hasRequiredNumberProperty(value, 'version')) return false;

  const metadata = value as Record<string, unknown>;
  
  // Validate dates
  if (!(metadata.createdAt instanceof Date)) return false;
  if (!(metadata.lastModified instanceof Date)) return false;
  
  return true;
}

/**
 * Type guard for BlockDimensions
 */
export function isBlockDimensions(value: unknown): value is BlockDimensions {
  if (!hasRequiredNumberProperty(value, 'width')) return false;
  if (!hasRequiredNumberProperty(value, 'height')) return false;
  if (!hasRequiredNumberProperty(value, 'minHeight')) return false;
  if (!hasRequiredNumberProperty(value, 'maxHeight')) return false;
  if (!hasRequiredBooleanProperty(value, 'autoHeight')) return false;

  const dimensions = value as Record<string, number | boolean>;
  
  // Validate dimension constraints
  const height = dimensions.height as number;
  const minHeight = dimensions.minHeight as number;
  const maxHeight = dimensions.maxHeight as number;
  
  if (height < minHeight || height > maxHeight) return false;
  if (minHeight < BLOCK_DIMENSION_CONSTANTS.MIN_HEIGHT) return false;
  if (maxHeight > BLOCK_DIMENSION_CONSTANTS.MAX_HEIGHT) return false;

  return true;
}

/**
 * Type guard for BlockMetadata
 */
export function isBlockMetadata(value: unknown): value is BlockMetadata {
  if (!hasRequiredObjectProperty(value, 'createdAt')) return false;
  if (!hasRequiredObjectProperty(value, 'lastModified')) return false;

  const metadata = value as Record<string, unknown>;
  
  // Validate dates
  if (!(metadata.createdAt instanceof Date)) return false;
  if (!(metadata.lastModified instanceof Date)) return false;
  
  return true;
}

/**
 * Type guard for BasicBlock
 */
export function isBasicBlock(value: unknown): value is BasicBlock {
  if (!hasRequiredStringProperty(value, 'id')) return false;
  if (!hasRequiredStringProperty(value, 'type')) return false;
  if (!hasRequiredStringProperty(value, 'content')) return false;
  if (!hasRequiredObjectProperty(value, 'dimensions')) return false;
  if (!hasRequiredBooleanProperty(value, 'isMinimized')) return false;
  if (!hasRequiredObjectProperty(value, 'metadata')) return false;

  const block = value as Record<string, unknown>;
  
  // Validate branded types
  if (!isValidBlockId(block.id as string)) return false;
  if (!validateBlockType(block.type)) return false;
  
  // Validate nested objects
  if (!isBlockDimensions(block.dimensions)) return false;
  if (!isBlockMetadata(block.metadata)) return false;
  
  // Validate optional title
  if ('title' in block && typeof block.title !== 'string') return false;
  
  return true;
}

/**
 * Type guard for ExpandableNode
 */
export function isExpandableNode(value: unknown): value is ExpandableNode {
  if (!hasRequiredStringProperty(value, 'id')) return false;
  if (!hasRequiredStringProperty(value, 'title')) return false;
  if (!hasRequiredObjectProperty(value, 'dimensions')) return false;
  if (!hasRequiredObjectProperty(value, 'position')) return false;
  if (!hasRequiredArrayProperty(value, 'blocks')) return false;
  if (!hasRequiredBooleanProperty(value, 'isCollapsed')) return false;
  if (!hasRequiredBooleanProperty(value, 'isSelected')) return false;
  if (!hasRequiredObjectProperty(value, 'metadata')) return false;

  const node = value as Record<string, unknown>;
  
  // Validate branded types
  if (!isValidNodeId(node.id as string)) return false;
  
  // Validate title length
  const title = node.title as string;
  if (title.length === 0 || title.length > 100) return false;
  
  // Validate nested objects
  if (!isNodeDimensions(node.dimensions)) return false;
  if (!isNodePosition(node.position)) return false;
  if (!isNodeMetadata(node.metadata)) return false;
  
  // Validate blocks array
  const blocks = node.blocks as unknown[];
  if (!blocks.every(isBasicBlock)) return false;
  
  return true;
}

/**
 * Creates a default NodeDimensions object
 */
export function createDefaultNodeDimensions(): NodeDimensions {
  return {
    width: NODE_DIMENSION_CONSTANTS.DEFAULT_WIDTH,
    height: NODE_DIMENSION_CONSTANTS.DEFAULT_HEIGHT,
    minWidth: NODE_DIMENSION_CONSTANTS.MIN_WIDTH,
    maxWidth: NODE_DIMENSION_CONSTANTS.MAX_WIDTH,
    minHeight: NODE_DIMENSION_CONSTANTS.MIN_HEIGHT,
    maxHeight: NODE_DIMENSION_CONSTANTS.MAX_HEIGHT
  };
}

/**
 * Creates a default BlockDimensions object
 */
export function createDefaultBlockDimensions(): BlockDimensions {
  return {
    width: NODE_DIMENSION_CONSTANTS.DEFAULT_WIDTH - BLOCK_DIMENSION_CONSTANTS.PADDING_HORIZONTAL,
    height: BLOCK_DIMENSION_CONSTANTS.DEFAULT_HEIGHT,
    minHeight: BLOCK_DIMENSION_CONSTANTS.MIN_HEIGHT,
    maxHeight: BLOCK_DIMENSION_CONSTANTS.MAX_HEIGHT,
    autoHeight: true
  };
}

/**
 * Validates and clamps node dimensions
 */
export function clampNodeDimensions(dimensions: Partial<NodeDimensions>): { width?: number; height?: number } {
  const result: { width?: number; height?: number } = {};
  
  if (dimensions.width !== undefined) {
    result.width = Math.max(
      NODE_DIMENSION_CONSTANTS.MIN_WIDTH,
      Math.min(NODE_DIMENSION_CONSTANTS.MAX_WIDTH, dimensions.width)
    );
  }
  
  if (dimensions.height !== undefined) {
    result.height = Math.max(
      NODE_DIMENSION_CONSTANTS.MIN_HEIGHT,
      Math.min(NODE_DIMENSION_CONSTANTS.MAX_HEIGHT, dimensions.height)
    );
  }
  
  return result;
}

/**
 * Snaps a value to grid
 */
export function snapToGrid(value: number, gridSize: number = NODE_DIMENSION_CONSTANTS.GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Validates a NodeId format
 */
function isValidNodeId(value: string): boolean {
  return /^node_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
}

/**
 * Validates a BlockId format
 */
function isValidBlockId(value: string): boolean {
  return /^block_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
}
