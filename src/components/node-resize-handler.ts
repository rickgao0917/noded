/**
 * Node resize handler for expandable nodes
 * Manages resize operations with throttling and constraints
 */

import type { NodeId } from '../types/branded.types';
import type { 
  NodeDimensions, 
  ResizeDirection,
  ExpandableNode
} from '../types/expandable-node.types';
import { NODE_DIMENSION_CONSTANTS } from '../types/expandable-node.types';
import { 
  ResizeSetupError, 
  ResizeHandlerError, 
  ScalingUpdateError 
} from '../types/expandable-node-errors';
import { Logger } from '../utils/logger';
import { snapToGrid } from '../utils/expandable-node-guards';

/**
 * Interface for resize handler functionality
 */
export interface ResizeHandlerInterface {
  setupResizeHandles(nodeElement: HTMLElement, nodeId: NodeId): void;
  cleanupResizeHandles(nodeElement: HTMLElement): void;
  isCurrentlyResizing(): boolean;
}

/**
 * Handles node resizing with performance optimization
 */
export class NodeResizeHandler implements ResizeHandlerInterface {
  private isResizing: boolean = false;
  private resizeDirection: ResizeDirection | null = null;
  private startDimensions: NodeDimensions | null = null;
  private startMousePosition: { x: number; y: number } | null = null;
  private throttleTimer: number | null = null;
  private currentNodeId: NodeId | null = null;
  private readonly logger: Logger;
  private readonly onResize: (nodeId: NodeId, dimensions: Partial<NodeDimensions>) => void;
  private readonly getNode: (nodeId: NodeId) => ExpandableNode | undefined;

  constructor(
    logger: Logger,
    onResize: (nodeId: NodeId, dimensions: Partial<NodeDimensions>) => void,
    getNode: (nodeId: NodeId) => ExpandableNode | undefined
  ) {
    this.logger = logger;
    this.onResize = onResize;
    this.getNode = getNode;
  }

  /**
   * Sets up resize handles on a node element
   */
  public setupResizeHandles(nodeElement: HTMLElement, nodeId: NodeId): void {
    const correlationId = this.logger.startOperation('NodeResizeHandler.setupResizeHandles');
    
    try {
      this.logger.debug('Setting up resize handles', {
        nodeId,
        elementId: nodeElement.id
      }, correlationId);

      // Create horizontal resize handle
      const horizontalHandle = this.createResizeHandle('horizontal', nodeId);
      nodeElement.appendChild(horizontalHandle);

      // Create vertical resize handle
      const verticalHandle = this.createResizeHandle('vertical', nodeId);
      nodeElement.appendChild(verticalHandle);

      // Create corner resize handle
      const cornerHandle = this.createResizeHandle('both', nodeId);
      nodeElement.appendChild(cornerHandle);

      this.logger.debug('Resize handles created successfully', { nodeId }, correlationId);
    } catch (error) {
      this.logger.error('Failed to setup resize handles', error, { nodeId }, correlationId);
      throw new ResizeSetupError(
        'Failed to create resize handles',
        nodeId,
        nodeElement,
        error instanceof Error ? error : undefined
      );
    } finally {
      this.logger.endOperation(correlationId);
    }
  }

  /**
   * Removes resize handles from a node element
   */
  public cleanupResizeHandles(nodeElement: HTMLElement): void {
    const correlationId = this.logger.startOperation('NodeResizeHandler.cleanupResizeHandles');
    
    try {
      const handles = nodeElement.querySelectorAll('.node-resize-handle');
      handles.forEach(handle => handle.remove());
      
      this.logger.debug('Resize handles cleaned up', {
        handleCount: handles.length
      }, correlationId);
    } catch (error) {
      this.logger.error('Failed to cleanup resize handles', error, {}, correlationId);
    } finally {
      this.logger.endOperation(correlationId);
    }
  }

  /**
   * Returns whether a resize operation is in progress
   */
  public isCurrentlyResizing(): boolean {
    return this.isResizing;
  }

  /**
   * Creates a resize handle element
   */
  private createResizeHandle(direction: ResizeDirection, nodeId: NodeId): HTMLElement {
    const handle = document.createElement('div');
    handle.className = `node-resize-handle resize-${direction}`;
    handle.setAttribute('data-resize-direction', direction);
    
    // Style the handle based on direction
    this.styleResizeHandle(handle, direction);
    
    // Add event listeners
    handle.addEventListener('mousedown', (e) => this.handleMouseDown(e, nodeId, direction));
    
    return handle;
  }

  /**
   * Styles a resize handle based on its direction
   */
  private styleResizeHandle(handle: HTMLElement, direction: ResizeDirection): void {
    handle.style.position = 'absolute';
    handle.style.zIndex = '10';
    
    switch (direction) {
      case 'horizontal':
        handle.style.right = '0';
        handle.style.top = '0';
        handle.style.bottom = '0';
        handle.style.width = '8px';
        handle.style.cursor = 'ew-resize';
        break;
      case 'vertical':
        handle.style.bottom = '0';
        handle.style.left = '0';
        handle.style.right = '0';
        handle.style.height = '8px';
        handle.style.cursor = 'ns-resize';
        break;
      case 'both':
        handle.style.right = '0';
        handle.style.bottom = '0';
        handle.style.width = '16px';
        handle.style.height = '16px';
        handle.style.cursor = 'nwse-resize';
        break;
    }
  }

  /**
   * Handles mousedown event on resize handle
   */
  private handleMouseDown(event: MouseEvent, nodeId: NodeId, direction: ResizeDirection): void {
    event.preventDefault();
    event.stopPropagation();
    
    const correlationId = this.logger.startOperation('NodeResizeHandler.handleMouseDown');
    
    try {
      const node = this.getNode(nodeId);
      if (!node) {
        throw new ResizeHandlerError('Node not found', nodeId, direction);
      }
      
      this.isResizing = true;
      this.resizeDirection = direction;
      this.currentNodeId = nodeId;
      this.startDimensions = { ...node.dimensions };
      this.startMousePosition = { x: event.clientX, y: event.clientY };
      
      // Add global event listeners
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
      
      // Prevent text selection during resize
      document.body.style.userSelect = 'none';
      
      this.logger.debug('Started resize operation', {
        nodeId,
        direction,
        startDimensions: this.startDimensions
      }, correlationId);
    } catch (error) {
      this.logger.error('Failed to start resize', error, { nodeId, direction }, correlationId);
      this.cleanup();
      throw error;
    } finally {
      this.logger.endOperation(correlationId);
    }
  }

  /**
   * Handles mousemove event during resize
   */
  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.isResizing || !this.startDimensions || !this.startMousePosition || !this.currentNodeId) {
      return;
    }
    
    // Throttle resize updates
    if (this.throttleTimer) {
      return;
    }
    
    this.throttleTimer = window.setTimeout(() => {
      this.throttleTimer = null;
      this.performResize(event);
    }, NODE_DIMENSION_CONSTANTS.THROTTLE_MS);
  };

  /**
   * Performs the actual resize calculation
   */
  private performResize(event: MouseEvent): void {
    if (!this.startDimensions || !this.startMousePosition || !this.currentNodeId || !this.resizeDirection) {
      return;
    }
    
    const correlationId = this.logger.startOperation('NodeResizeHandler.performResize');
    
    try {
      const deltaX = event.clientX - this.startMousePosition.x;
      const deltaY = event.clientY - this.startMousePosition.y;
      
      const newDimensions: { width?: number; height?: number } = {};
      
      // Calculate new dimensions based on direction
      if (this.resizeDirection === 'horizontal' || this.resizeDirection === 'both') {
        const newWidth = this.startDimensions.width + deltaX;
        const snappedWidth = snapToGrid(newWidth);
        const clampedWidth = Math.max(
          NODE_DIMENSION_CONSTANTS.MIN_WIDTH,
          Math.min(NODE_DIMENSION_CONSTANTS.MAX_WIDTH, snappedWidth)
        );
        newDimensions.width = clampedWidth;
      }
      
      if (this.resizeDirection === 'vertical' || this.resizeDirection === 'both') {
        const newHeight = this.startDimensions.height + deltaY;
        const snappedHeight = snapToGrid(newHeight);
        const clampedHeight = Math.max(
          NODE_DIMENSION_CONSTANTS.MIN_HEIGHT,
          Math.min(NODE_DIMENSION_CONSTANTS.MAX_HEIGHT, snappedHeight)
        );
        newDimensions.height = clampedHeight;
      }
      
      // Apply resize
      this.onResize(this.currentNodeId, newDimensions);
      
      this.logger.debug('Resize performed', {
        nodeId: this.currentNodeId,
        newDimensions,
        delta: { x: deltaX, y: deltaY }
      }, correlationId);
    } catch (error) {
      this.logger.error('Failed to perform resize', error, {
        nodeId: this.currentNodeId,
        direction: this.resizeDirection
      }, correlationId);
    } finally {
      this.logger.endOperation(correlationId);
    }
  }

  /**
   * Handles mouseup event to end resize
   */
  private handleMouseUp = (): void => {
    const correlationId = this.logger.startOperation('NodeResizeHandler.handleMouseUp');
    
    try {
      if (this.currentNodeId) {
        this.logger.debug('Ended resize operation', {
          nodeId: this.currentNodeId,
          direction: this.resizeDirection
        }, correlationId);
      }
      
      this.cleanup();
    } finally {
      this.logger.endOperation(correlationId);
    }
  };

  /**
   * Cleans up resize state and event listeners
   */
  private cleanup(): void {
    this.isResizing = false;
    this.resizeDirection = null;
    this.startDimensions = null;
    this.startMousePosition = null;
    this.currentNodeId = null;
    
    // Clear throttle timer
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    
    // Remove global event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    // Restore text selection
    document.body.style.userSelect = '';
  }

  /**
   * Updates block scaling based on new node dimensions
   */
  public updateBlockScaling(nodeId: NodeId, newDimensions: NodeDimensions): void {
    const correlationId = this.logger.startOperation('NodeResizeHandler.updateBlockScaling');
    
    try {
      this.logger.debug('Updating block scaling', {
        nodeId,
        newDimensions
      }, correlationId);
      
      // This will be implemented in the ExpandableNodeManager
      // It will update all blocks within the node to scale appropriately
      
    } catch (error) {
      this.logger.error('Failed to update block scaling', error, { nodeId }, correlationId);
      throw new ScalingUpdateError(
        'Failed to update block scaling',
        nodeId,
        newDimensions,
        error instanceof Error ? error : undefined
      );
    } finally {
      this.logger.endOperation(correlationId);
    }
  }
}
