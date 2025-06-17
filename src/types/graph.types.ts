/**
 * Core type definitions for the graph-based node editor
 * 
 * Defines the structure for nodes, blocks, and layout configuration
 * used throughout the graph editor application.
 */

/**
 * Types of content blocks that can be contained within a node
 * 
 * @public
 */
export type NodeBlockType = 'prompt' | 'response' | 'markdown';

/**
 * Individual content block within a graph node
 * 
 * Each block represents a distinct piece of content (prompt, response, or markdown)
 * that can be edited independently.
 * 
 * @public
 */
export interface NodeBlock {
  /** Unique identifier for the block */
  readonly id: string;
  /** Type of content this block contains */
  readonly type: NodeBlockType;
  /** Editable text content of the block */
  content: string;
  /** Position index within the node (0-based) */
  readonly position: number;
}

/**
 * A node in the graph editor representing a conversation turn or document section
 * 
 * Nodes form a tree structure where each node can have multiple children
 * representing different conversation branches or document variations.
 * 
 * @public
 */
export interface GraphNode {
  /** Unique identifier for the node */
  readonly id: string;
  /** ID of parent node, null for root nodes */
  readonly parentId: string | null;
  /** Array of child node IDs */
  children: string[];
  /** Content blocks contained within this node */
  blocks: NodeBlock[];
  /** Visual position on the canvas */
  position: Position;
  /** Depth level in the tree (0 = root) */
  readonly depth: number;
}

/**
 * 2D coordinates for positioning elements
 * 
 * @public
 */
export interface Position {
  /** Horizontal position in pixels */
  x: number;
  /** Vertical position in pixels */
  y: number;
}

/**
 * Current state of the canvas and editor
 * 
 * @public
 */
export interface CanvasState {
  /** All nodes currently in the editor */
  readonly nodes: readonly GraphNode[];
  /** ID of the currently selected node, null if none */
  readonly selectedNodeId: string | null;
  /** Current pan offset of the canvas */
  readonly canvasOffset: Position;
  /** Current zoom level (1.0 = 100%) */
  readonly zoom: number;
}

/**
 * Configuration for tree layout algorithm
 * 
 * Defines dimensions and spacing used when automatically positioning nodes
 * in the tree structure.
 * 
 * @public
 */
export interface TreeLayout {
  /** Width of each node in pixels */
  readonly nodeWidth: number;
  /** Height of each node in pixels */
  readonly nodeHeight: number;
  /** Horizontal spacing between sibling nodes */
  readonly horizontalSpacing: number;
  /** Vertical spacing between parent and child levels */
  readonly verticalSpacing: number;
}
