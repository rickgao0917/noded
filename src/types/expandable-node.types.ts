/**
 * Type definitions for expandable node system
 * Provides core interfaces and types for nodes with dynamic dimensions and blocks
 */

import type { NodeId, BlockId } from './branded.types';

/**
 * Dimensions configuration for expandable nodes
 */
export interface NodeDimensions {
  readonly width: number;
  readonly height: number;
  readonly minWidth: number;
  readonly maxWidth: number;
  readonly minHeight: number;
  readonly maxHeight: number;
}

/**
 * Position coordinates for nodes
 */
export interface NodePosition {
  readonly x: number;
  readonly y: number;
  readonly zIndex: number;
}

/**
 * Metadata for nodes including timestamps
 */
export interface NodeMetadata {
  readonly createdAt: Date;
  readonly lastModified: Date;
  readonly version: number;
}

/**
 * Block type enumeration
 */
export type BlockType = 'prompt' | 'response' | 'markdown';

/**
 * Dimensions configuration for blocks
 */
export interface BlockDimensions {
  readonly width: number;
  readonly height: number;
  readonly minHeight: number;
  readonly maxHeight: number;
  readonly autoHeight: boolean;
}

/**
 * Metadata for blocks
 */
export interface BlockMetadata {
  readonly createdAt: Date;
  readonly lastModified: Date;
}

/**
 * Base interface for blocks
 */
export interface BaseBlock {
  readonly id: BlockId;
  readonly type: BlockType;
}

/**
 * Basic block interface with content and dimensions
 */
export interface BasicBlock extends BaseBlock {
  readonly id: BlockId;
  readonly type: BlockType;
  readonly title?: string;
  readonly content: string;
  readonly dimensions: BlockDimensions;
  readonly isMinimized: boolean;
  readonly metadata: BlockMetadata;
}

/**
 * Base interface for nodes
 */
export interface BaseNode {
  readonly id: NodeId;
}

/**
 * Expandable node interface with full capabilities
 */
export interface ExpandableNode extends BaseNode {
  readonly id: NodeId;
  readonly title: string;
  readonly dimensions: NodeDimensions;
  readonly position: NodePosition;
  readonly blocks: readonly BasicBlock[];
  readonly isCollapsed: boolean;
  readonly isSelected: boolean;
  readonly metadata: NodeMetadata;
}

/**
 * Resize direction enumeration
 */
export type ResizeDirection = 'horizontal' | 'vertical' | 'both';

/**
 * Dimension constraints for validation
 */
export interface DimensionConstraints {
  readonly minWidth: number;
  readonly maxWidth: number;
  readonly minHeight: number;
  readonly maxHeight: number;
  readonly snapToGrid: boolean;
  readonly gridSize: number;
}

/**
 * Configuration for node creation
 */
export interface NodeCreationConfig {
  readonly title?: string;
  readonly position?: Partial<NodePosition>;
  readonly dimensions?: Partial<NodeDimensions>;
  readonly blocks?: Array<{
    readonly type: BlockType;
    readonly content?: string;
    readonly title?: string;
  }>;
}

/**
 * Configuration for block creation
 */
export interface BlockCreationConfig {
  readonly type: BlockType;
  readonly content?: string;
  readonly title?: string;
  readonly dimensions?: Partial<BlockDimensions>;
}

/**
 * Constants for dimension limits
 */
export const NODE_DIMENSION_CONSTANTS = {
  MIN_WIDTH: 100,
  MAX_WIDTH: 1200,
  DEFAULT_WIDTH: 400,
  MIN_HEIGHT: 100,
  MAX_HEIGHT: 1200,
  DEFAULT_HEIGHT: 400,
  RESIZE_INCREMENT: 20,
  GRID_SIZE: 20,
  THROTTLE_MS: 16
} as const;

export const BLOCK_DIMENSION_CONSTANTS = {
  MIN_HEIGHT: 60,
  MAX_HEIGHT: 400,
  DEFAULT_HEIGHT: 100,
  PADDING_HORIZONTAL: 32,
  PADDING_VERTICAL: 16,
  BASE_FONT_SIZE: 14,
  LINE_HEIGHT_RATIO: 1.5
} as const;
