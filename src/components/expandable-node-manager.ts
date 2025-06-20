/**
 * Expandable Node Manager
 * Core manager for nodes with dynamic dimensions and block support
 */

import type { NodeId, BlockId, CorrelationId } from '../types/branded.types';
import { createNodeId, createBlockId } from '../utils/id-generator';
import type {
  ExpandableNode,
  BasicBlock,
  NodeDimensions,
  NodePosition,
  NodeMetadata,
  BlockType,
  BlockDimensions,
  BlockMetadata,
  NodeCreationConfig,
  BlockCreationConfig,
  DimensionConstraints
} from '../types/expandable-node.types';
import {
  NODE_DIMENSION_CONSTANTS
} from '../types/expandable-node.types';
import {
  NodeCreationError,
  NodeResizeError,
  BlockCreationError,
  BlockUpdateError,
  NodeNotFoundError,
  BlockNotFoundError,
  NodeRenderError
} from '../types/expandable-node-errors';
import { ValidationError, ErrorContext } from '../types/errors';
import { Logger } from '../utils/logger';
import { Validator } from '../utils/validator';
import { NodeResizeHandler } from './node-resize-handler';
import {
  isExpandableNode,
  isBasicBlock,
  validateBlockType,
  createDefaultNodeDimensions,
  createDefaultBlockDimensions,
  clampNodeDimensions
} from '../utils/expandable-node-guards';

/**
 * Interface for node manager functionality
 */
export interface NodeManagerInterface {
  createNode(config?: NodeCreationConfig): NodeId;
  deleteNode(nodeId: NodeId): void;
  getNode(nodeId: NodeId): ExpandableNode | undefined;
  getAllNodes(): ReadonlyMap<NodeId, ExpandableNode>;
  resizeNode(nodeId: NodeId, newDimensions: Partial<NodeDimensions>): void;
  addBlock(nodeId: NodeId, blockType: BlockType, content?: string, title?: string): BlockId;
  updateBlockContent(blockId: BlockId, newContent: string): void;
  renderNode(nodeId: NodeId): HTMLElement;
}

/**
 * Base class for node managers (to be extended if needed)
 */
export abstract class BaseNodeManager {
  protected abstract logger: Logger;
  protected abstract validator: Validator;
}

/**
 * Manages expandable nodes with comprehensive logging and error handling
 */
export class ExpandableNodeManager extends BaseNodeManager implements NodeManagerInterface {
  private readonly nodes: Map<NodeId, ExpandableNode> = new Map();
  private readonly blockNodeMap: Map<BlockId, NodeId> = new Map();
  private selectedNodeId: NodeId | null = null;
  private nodeCounter: number = 0;
  private readonly resizeHandler: NodeResizeHandler;
  protected readonly logger: Logger;
  protected readonly validator: Validator;

  constructor(logger: Logger, validator: Validator) {
    super();
    this.logger = logger;
    this.validator = validator;
    
    // Initialize resize handler
    this.resizeHandler = new NodeResizeHandler(
      logger,
      this.handleResize.bind(this),
      this.getNode.bind(this)
    );
  }

  /**
   * Creates a new expandable node
   */
  public createNode(config?: NodeCreationConfig): NodeId {
    const correlationId = this.logger.startOperation('ExpandableNodeManager.createNode');
    
    try {
      this.logger.info('Creating new expandable node', { config }, correlationId);
      
      // Generate node ID
      const nodeId = createNodeId();
      this.nodeCounter++;
      
      // Create node metadata
      const now = new Date();
      const metadata: NodeMetadata = {
        createdAt: now,
        lastModified: now,
        version: 1
      };
      
      // Create dimensions with defaults
      const dimensions: NodeDimensions = {
        ...createDefaultNodeDimensions(),
        ...clampNodeDimensions(config?.dimensions || {})
      };
      
      // Create position with defaults
      const position: NodePosition = {
        x: config?.position?.x ?? 100,
        y: config?.position?.y ?? 100,
        zIndex: config?.position?.zIndex ?? 1
      };
      
      // Validate title
      const title = this.validateNodeTitle(config?.title || 'Untitled Node', correlationId as CorrelationId);
      
      // Create initial blocks
      const blocks: BasicBlock[] = [];
      if (config?.blocks && config.blocks.length > 0) {
        for (const blockConfig of config.blocks) {
          const block = this.createBlock(nodeId, blockConfig, correlationId as CorrelationId);
          blocks.push(block);
        }
      } else {
        // Create default prompt block
        const defaultBlock = this.createBlock(nodeId, { type: 'prompt' }, correlationId as CorrelationId);
        blocks.push(defaultBlock);
      }
      
      // Create the node
      const node: ExpandableNode = {
        id: nodeId,
        title,
        dimensions,
        position,
        blocks,
        isCollapsed: false,
        isSelected: false,
        metadata
      };
      
      // Validate node structure
      if (!isExpandableNode(node)) {
        const context = createErrorContext('createNode', { nodeData: node });
        throw new NodeCreationError(
          'Invalid node structure',
          node,
          [new ValidationError('node', node, 'ExpandableNode', context)]
        );
      }
      
      // Store the node
      this.nodes.set(nodeId, node);
      
      this.logger.info('Node created successfully', {
        nodeId,
        title,
        blockCount: blocks.length,
        dimensions
      }, correlationId);
      
      return nodeId;
    } catch (error) {
      this.logger.error('Failed to create node', error, { config }, correlationId);
      throw error instanceof NodeCreationError ? error : new NodeCreationError(
        'Unexpected error during node creation',
        config,
        [],
        error instanceof Error ? error : undefined
      );
    } finally {
      this.logger.endOperation(correlationId);
    }
  }

  /**
   * Deletes a node
   */
  public deleteNode(nodeId: NodeId): void {
    const correlationId = this.logger.startOperation('ExpandableNodeManager.deleteNode');
    
    try {
      this.logger.info('Deleting node', { nodeId }, correlationId);
      
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new NodeNotFoundError(nodeId);
      }
      
      // Remove block mappings
      for (const block of node.blocks) {
        this.blockNodeMap.delete(block.id);
      }
      
      // Remove node
      this.nodes.delete(nodeId);
      
      // Clear selection if this node was selected
      if (this.selectedNodeId === nodeId) {
        this.selectedNodeId = null;
      }
      
      this.logger.info('Node deleted successfully', { nodeId }, correlationId);
    } catch (error) {
      this.logger.error('Failed to delete node', error, { nodeId }, correlationId);
      throw error;
    } finally {
      this.logger.endOperation(correlationId);
    }
  }

  /**
   * Gets a node by ID
   */
  public getNode(nodeId: NodeId): ExpandableNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Gets all nodes
   */
  public getAllNodes(): ReadonlyMap<NodeId, ExpandableNode> {
    return this.nodes;
  }

  /**
   * Resizes a node
   */
  public resizeNode(nodeId: NodeId, newDimensions: Partial<NodeDimensions>): void {
    const correlationId = this.logger.startOperation('ExpandableNodeManager.resizeNode');
    
    try {
      this.logger.info('Resizing node', { nodeId, newDimensions }, correlationId);
      
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new NodeNotFoundError(nodeId);
      }
      
      // Validate and clamp dimensions
      const clampedDimensions = clampNodeDimensions(newDimensions);
      
      // Update blocks to scale with node
      let updatedBlocks = node.blocks;
      if (clampedDimensions.width !== undefined) {
        const widthRatio = clampedDimensions.width / node.dimensions.width;
        updatedBlocks = node.blocks.map(block => ({
          ...block,
          dimensions: {
            ...block.dimensions,
            width: Math.round(block.dimensions.width * widthRatio)
          },
          metadata: {
            ...block.metadata,
            lastModified: new Date()
          }
        }));
      }
      
      // Create updated node
      const updatedNode: ExpandableNode = {
        ...node,
        dimensions: {
          ...node.dimensions,
          ...clampedDimensions
        },
        blocks: updatedBlocks,
        metadata: {
          ...node.metadata,
          lastModified: new Date(),
          version: node.metadata.version + 1
        }
      };
      
      // Store updated node
      this.nodes.set(nodeId, updatedNode);
      
      this.logger.info('Node resized successfully', {
        nodeId,
        oldDimensions: node.dimensions,
        newDimensions: updatedNode.dimensions
      }, correlationId);
    } catch (error) {
      this.logger.error('Failed to resize node', error, { nodeId, newDimensions }, correlationId);
      
      const constraints: DimensionConstraints = {
        minWidth: NODE_DIMENSION_CONSTANTS.MIN_WIDTH,
        maxWidth: NODE_DIMENSION_CONSTANTS.MAX_WIDTH,
        minHeight: NODE_DIMENSION_CONSTANTS.MIN_HEIGHT,
        maxHeight: NODE_DIMENSION_CONSTANTS.MAX_HEIGHT,
        snapToGrid: true,
        gridSize: NODE_DIMENSION_CONSTANTS.GRID_SIZE
      };
      
      throw error instanceof NodeNotFoundError ? error : new NodeResizeError(
        'Failed to resize node',
        nodeId,
        newDimensions,
        constraints,
        error instanceof Error ? error : undefined
      );
    } finally {
      this.logger.endOperation(correlationId);
    }
  }

  /**
   * Adds a block to a node
   */
  public addBlock(nodeId: NodeId, blockType: BlockType, content: string = '', title?: string): BlockId {
    const correlationId = this.logger.startOperation('ExpandableNodeManager.addBlock');
    
    try {
      this.logger.info('Adding block to node', { nodeId, blockType, hasContent: !!content }, correlationId);
      
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new NodeNotFoundError(nodeId);
      }
      
      // Validate block type
      if (!validateBlockType(blockType)) {
        throw new BlockCreationError(
          `Invalid block type: ${blockType}`,
          nodeId,
          { blockType }
        );
      }
      
      // Create block
      const blockConfig: BlockCreationConfig = { 
        type: blockType, 
        content,
        ...(title !== undefined && { title })
      };
      const block = this.createBlock(nodeId, blockConfig, correlationId as CorrelationId);
      
      // Update node with new block
      const updatedBlocks = [...node.blocks, block];
      const updatedNode: ExpandableNode = {
        ...node,
        blocks: updatedBlocks,
        metadata: {
          ...node.metadata,
          lastModified: new Date(),
          version: node.metadata.version + 1
        }
      };
      
      this.nodes.set(nodeId, updatedNode);
      
      this.logger.info('Block added successfully', {
        nodeId,
        blockId: block.id,
        blockType
      }, correlationId);
      
      return block.id;
    } catch (error) {
      this.logger.error('Failed to add block', error, { nodeId, blockType }, correlationId);
      throw error instanceof NodeNotFoundError || error instanceof BlockCreationError ? error :
        new BlockCreationError(
          'Unexpected error during block creation',
          nodeId,
          { blockType, content, title },
          error instanceof Error ? error : undefined
        );
    } finally {
      this.logger.endOperation(correlationId);
    }
  }

  /**
   * Updates block content
   */
  public updateBlockContent(blockId: BlockId, newContent: string): void {
    const correlationId = this.logger.startOperation('ExpandableNodeManager.updateBlockContent');
    
    try {
      this.logger.info('Updating block content', { blockId, contentLength: newContent.length }, correlationId);
      
      const nodeId = this.blockNodeMap.get(blockId);
      if (!nodeId) {
        throw new BlockNotFoundError(blockId);
      }
      
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new NodeNotFoundError(nodeId);
      }
      
      // Validate content
      const sanitizedContent = this.sanitizeContent(newContent, correlationId as CorrelationId);
      
      // Find and update block
      let blockFound = false;
      const updatedBlocks = node.blocks.map(block => {
        if (block.id === blockId) {
          blockFound = true;
          return {
            ...block,
            content: sanitizedContent,
            metadata: {
              ...block.metadata,
              lastModified: new Date()
            }
          };
        }
        return block;
      });
      
      if (!blockFound) {
        throw new BlockNotFoundError(blockId);
      }
      
      // Update node
      const updatedNode: ExpandableNode = {
        ...node,
        blocks: updatedBlocks,
        metadata: {
          ...node.metadata,
          lastModified: new Date(),
          version: node.metadata.version + 1
        }
      };
      
      this.nodes.set(nodeId, updatedNode);
      
      this.logger.info('Block content updated successfully', { blockId, nodeId }, correlationId);
    } catch (error) {
      this.logger.error('Failed to update block content', error, { blockId }, correlationId);
      throw error instanceof BlockNotFoundError || error instanceof NodeNotFoundError ? error :
        new BlockUpdateError(
          'Failed to update block content',
          blockId,
          { newContent },
          error instanceof Error ? error : undefined
        );
    } finally {
      this.logger.endOperation(correlationId);
    }
  }

  /**
   * Renders a node to DOM
   */
  public renderNode(nodeId: NodeId): HTMLElement {
    const correlationId = this.logger.startOperation('ExpandableNodeManager.renderNode');
    
    try {
      this.logger.info('Rendering node', { nodeId }, correlationId);
      
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new NodeNotFoundError(nodeId);
      }
      
      // Create node element
      const nodeElement = document.createElement('div');
      nodeElement.className = 'expandable-node';
      nodeElement.id = `node-${nodeId}`;
      nodeElement.setAttribute('data-node-id', nodeId);
      
      // Apply dimensions and position
      nodeElement.style.width = `${node.dimensions.width}px`;
      nodeElement.style.height = `${node.dimensions.height}px`;
      nodeElement.style.left = `${node.position.x}px`;
      nodeElement.style.top = `${node.position.y}px`;
      nodeElement.style.zIndex = `${node.position.zIndex}`;
      nodeElement.style.position = 'absolute';
      
      // Add collapsed class if needed
      if (node.isCollapsed) {
        nodeElement.classList.add('collapsed');
      }
      
      // Add selected class if needed
      if (node.isSelected) {
        nodeElement.classList.add('selected');
      }
      
      // Create header
      const header = this.createNodeHeader(node, correlationId as CorrelationId);
      nodeElement.appendChild(header);
      
      // Create blocks container
      const blocksContainer = document.createElement('div');
      blocksContainer.className = 'node-blocks';
      
      // Render blocks
      for (const block of node.blocks) {
        const blockElement = this.renderBlock(block, correlationId as CorrelationId);
        blocksContainer.appendChild(blockElement);
      }
      
      nodeElement.appendChild(blocksContainer);
      
      // Setup resize handles
      this.resizeHandler.setupResizeHandles(nodeElement, nodeId);
      
      this.logger.info('Node rendered successfully', { nodeId }, correlationId);
      
      return nodeElement;
    } catch (error) {
      this.logger.error('Failed to render node', error, { nodeId }, correlationId);
      throw error instanceof NodeNotFoundError ? error : new NodeRenderError(
        'Failed to render node',
        nodeId,
        error instanceof Error ? error : undefined
      );
    } finally {
      this.logger.endOperation(correlationId);
    }
  }

  /**
   * Creates a node header element
   */
  private createNodeHeader(node: ExpandableNode, _correlationId: CorrelationId): HTMLElement {
    const header = document.createElement('div');
    header.className = 'node-header';
    
    // Title
    const title = document.createElement('span');
    title.className = 'node-title';
    title.textContent = node.title;
    title.contentEditable = 'true';
    header.appendChild(title);
    
    // Node ID (small text)
    const idSpan = document.createElement('span');
    idSpan.className = 'node-id';
    idSpan.textContent = `(${node.id})`;
    header.appendChild(idSpan);
    
    // Collapse button
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'node-collapse-btn';
    collapseBtn.textContent = node.isCollapsed ? '▶' : '▼';
    collapseBtn.setAttribute('data-action', 'toggle-collapse');
    header.appendChild(collapseBtn);
    
    return header;
  }

  /**
   * Renders a block element
   */
  private renderBlock(block: BasicBlock, _correlationId: CorrelationId): HTMLElement {
    const blockElement = document.createElement('div');
    blockElement.className = `node-block block-${block.type}`;
    blockElement.id = `block-${block.id}`;
    blockElement.setAttribute('data-block-id', block.id);
    
    // Apply dimensions
    blockElement.style.width = `${block.dimensions.width}px`;
    blockElement.style.height = `${block.dimensions.height}px`;
    
    // Add minimized class if needed
    if (block.isMinimized) {
      blockElement.classList.add('minimized');
    }
    
    // Create block header
    const header = document.createElement('div');
    header.className = 'block-header';
    
    const title = document.createElement('span');
    title.className = 'block-title';
    title.textContent = block.title || this.getDefaultBlockTitle(block.type);
    header.appendChild(title);
    
    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'block-minimize-btn';
    minimizeBtn.textContent = block.isMinimized ? '▶' : '▼';
    minimizeBtn.setAttribute('data-action', 'toggle-minimize');
    header.appendChild(minimizeBtn);
    
    blockElement.appendChild(header);
    
    // Create content area
    if (!block.isMinimized) {
      const content = document.createElement('div');
      content.className = 'block-content';
      
      const textarea = document.createElement('textarea');
      textarea.className = 'block-textarea';
      textarea.value = block.content;
      textarea.style.height = `${block.dimensions.height - 40}px`; // Account for header
      
      content.appendChild(textarea);
      blockElement.appendChild(content);
    }
    
    return blockElement;
  }

  /**
   * Creates a block
   */
  private createBlock(nodeId: NodeId, config: BlockCreationConfig, correlationId: CorrelationId): BasicBlock {
    const blockId = createBlockId();
    const now = new Date();
    
    const dimensions: BlockDimensions = {
      ...createDefaultBlockDimensions(),
      ...config.dimensions
    };
    
    const metadata: BlockMetadata = {
      createdAt: now,
      lastModified: now
    };
    
    const block: BasicBlock = {
      id: blockId,
      type: config.type,
      ...(config.title !== undefined && { title: config.title }),
      content: this.sanitizeContent(config.content || '', correlationId),
      dimensions,
      isMinimized: false,
      metadata
    };
    
    // Validate block
    if (!isBasicBlock(block)) {
      throw new BlockCreationError(
        'Invalid block structure',
        nodeId,
        block
      );
    }
    
    // Map block to node
    this.blockNodeMap.set(blockId, nodeId);
    
    return block;
  }

  /**
   * Validates node title
   */
  private validateNodeTitle(title: string, correlationId: CorrelationId): string {
    const trimmed = title.trim();
    
    if (trimmed.length === 0) {
      return 'Untitled Node';
    }
    
    if (trimmed.length > 100) {
      this.logger.warn('Node title too long, truncating', { originalLength: trimmed.length }, correlationId);
      return trimmed.substring(0, 100);
    }
    
    // Validate pattern
    const pattern = /^[a-zA-Z0-9\s\-_\.]{1,100}$/;
    if (!pattern.test(trimmed)) {
      this.logger.warn('Node title contains invalid characters, sanitizing', { title: trimmed }, correlationId);
      return trimmed.replace(/[^a-zA-Z0-9\s\-_\.]/g, '');
    }
    
    return trimmed;
  }

  /**
   * Sanitizes content
   */
  private sanitizeContent(content: string, correlationId: CorrelationId): string {
    // Basic HTML escaping
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    // Check length
    if (escaped.length > 50000) {
      this.logger.warn('Content too long, truncating', { originalLength: escaped.length }, correlationId);
      return escaped.substring(0, 50000);
    }
    
    return escaped;
  }

  /**
   * Gets default block title
   */
  private getDefaultBlockTitle(type: BlockType): string {
    switch (type) {
      case 'prompt':
        return 'Prompt';
      case 'response':
        return 'Response';
      case 'markdown':
        return 'Markdown';
      default:
        return 'Block';
    }
  }

  /**
   * Handles resize from resize handler
   */
  private handleResize(nodeId: NodeId, dimensions: Partial<NodeDimensions>): void {
    this.resizeNode(nodeId, dimensions);
  }
}

/**
 * Creates error context for operations
 */
function createErrorContext(functionName: string, parameters?: Record<string, unknown>): ErrorContext {
  return {
    functionName,
    ...(parameters !== undefined && { parameters }),
    timestamp: new Date().toISOString(),
    correlationId: Math.random().toString(36).substring(7)
  };
}
