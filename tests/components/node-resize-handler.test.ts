/**
 * Tests for NodeResizeHandler
 */

import { NodeResizeHandler } from '../../src/components/node-resize-handler';
import { Logger } from '../../src/utils/logger';
import type { NodeId } from '../../src/types/branded.types';
import type { ExpandableNode, NodeDimensions } from '../../src/types/expandable-node.types';
import { NODE_DIMENSION_CONSTANTS } from '../../src/types/expandable-node.types';
import { ResizeSetupError, ResizeHandlerError } from '../../src/types/expandable-node-errors';

// Mock Logger
jest.mock('../../src/utils/logger');

// Enable fake timers
jest.useFakeTimers();

describe('NodeResizeHandler', () => {
  let handler: NodeResizeHandler;
  let mockLogger: jest.Mocked<Logger>;
  let mockOnResize: jest.Mock;
  let mockGetNode: jest.Mock;
  let mockNodeElement: HTMLElement;
  
  const testNodeId = 'node_12345678-1234-1234-1234-123456789012' as NodeId;
  const testNode: ExpandableNode = {
    id: testNodeId,
    title: 'Test Node',
    dimensions: {
      width: 400,
      height: 300,
      minWidth: 100,
      maxWidth: 1200,
      minHeight: 100,
      maxHeight: 1200
    },
    position: { x: 100, y: 100, zIndex: 1 },
    blocks: [],
    isCollapsed: false,
    isSelected: false,
    metadata: {
      createdAt: new Date(),
      lastModified: new Date(),
      version: 1
    }
  };

  beforeEach(() => {
    mockLogger = new Logger({} as any) as jest.Mocked<Logger>;
    mockLogger.startOperation.mockReturnValue('test-correlation-id');
    mockLogger.endOperation.mockReturnValue();
    
    mockOnResize = jest.fn();
    mockGetNode = jest.fn().mockReturnValue(testNode);
    
    handler = new NodeResizeHandler(mockLogger, mockOnResize, mockGetNode);
    
    // Create mock node element
    mockNodeElement = document.createElement('div');
    mockNodeElement.id = `node-${testNodeId}`;
    document.body.appendChild(mockNodeElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Resize Handle Setup', () => {
    it('should create resize handles', () => {
      handler.setupResizeHandles(mockNodeElement, testNodeId);
      
      const handles = mockNodeElement.querySelectorAll('.node-resize-handle');
      expect(handles).toHaveLength(3); // horizontal, vertical, corner
      
      const horizontalHandle = mockNodeElement.querySelector('.resize-horizontal');
      const verticalHandle = mockNodeElement.querySelector('.resize-vertical');
      const cornerHandle = mockNodeElement.querySelector('.resize-both');
      
      expect(horizontalHandle).toBeTruthy();
      expect(verticalHandle).toBeTruthy();
      expect(cornerHandle).toBeTruthy();
    });

    it('should position handles correctly', () => {
      handler.setupResizeHandles(mockNodeElement, testNodeId);
      
      const horizontalHandle = mockNodeElement.querySelector('.resize-horizontal') as HTMLElement;
      const verticalHandle = mockNodeElement.querySelector('.resize-vertical') as HTMLElement;
      const cornerHandle = mockNodeElement.querySelector('.resize-both') as HTMLElement;
      
      // Check positioning styles
      expect(horizontalHandle.style.position).toBe('absolute');
      expect(horizontalHandle.style.right).toBe('0px');
      expect(horizontalHandle.style.cursor).toBe('ew-resize');
      
      expect(verticalHandle.style.position).toBe('absolute');
      expect(verticalHandle.style.bottom).toBe('0px');
      expect(verticalHandle.style.cursor).toBe('ns-resize');
      
      expect(cornerHandle.style.position).toBe('absolute');
      expect(cornerHandle.style.right).toBe('0px');
      expect(cornerHandle.style.bottom).toBe('0px');
      expect(cornerHandle.style.cursor).toBe('nwse-resize');
    });

    it('should set proper cursor styles', () => {
      handler.setupResizeHandles(mockNodeElement, testNodeId);
      
      const handles = mockNodeElement.querySelectorAll('.node-resize-handle');
      handles.forEach((handle) => {
        const element = handle as HTMLElement;
        expect(element.style.cursor).toMatch(/resize$/);
      });
    });

    it('should handle DOM errors', () => {
      const invalidElement = null as any;
      
      expect(() => {
        handler.setupResizeHandles(invalidElement, testNodeId);
      }).toThrow();
    });
    
    it('should cleanup resize handles', () => {
      handler.setupResizeHandles(mockNodeElement, testNodeId);
      expect(mockNodeElement.querySelectorAll('.node-resize-handle')).toHaveLength(3);
      
      handler.cleanupResizeHandles(mockNodeElement);
      expect(mockNodeElement.querySelectorAll('.node-resize-handle')).toHaveLength(0);
    });
  });

  describe('Resize Operations', () => {
    beforeEach(() => {
      handler.setupResizeHandles(mockNodeElement, testNodeId);
    });

    it('should handle horizontal resize', () => {
      const horizontalHandle = mockNodeElement.querySelector('.resize-horizontal') as HTMLElement;
      
      // Simulate mousedown
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 400,
        clientY: 200,
        bubbles: true
      });
      horizontalHandle.dispatchEvent(mouseDownEvent);
      
      // Simulate mousemove
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 500,
        clientY: 200,
        bubbles: true
      });
      document.dispatchEvent(mouseMoveEvent);
      
      // Wait for throttle
      jest.runAllTimers();
      
      // Simulate mouseup
      document.dispatchEvent(new MouseEvent('mouseup'));
      
      // Check that resize was called with correct dimensions
      expect(mockOnResize).toHaveBeenCalledWith(
        testNodeId,
        expect.objectContaining({
          width: expect.any(Number)
        })
      );
    });

    it('should handle vertical resize', () => {
      const verticalHandle = mockNodeElement.querySelector('.resize-vertical') as HTMLElement;
      
      // Simulate mousedown
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 200,
        clientY: 300,
        bubbles: true
      });
      verticalHandle.dispatchEvent(mouseDownEvent);
      
      // Simulate mousemove
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 400,
        bubbles: true
      });
      document.dispatchEvent(mouseMoveEvent);
      
      // Wait for throttle
      jest.runAllTimers();
      
      // Simulate mouseup
      document.dispatchEvent(new MouseEvent('mouseup'));
      
      // Check that resize was called with correct dimensions
      expect(mockOnResize).toHaveBeenCalledWith(
        testNodeId,
        expect.objectContaining({
          height: expect.any(Number)
        })
      );
    });

    it('should snap to grid', () => {
      const horizontalHandle = mockNodeElement.querySelector('.resize-horizontal') as HTMLElement;
      
      // Simulate resize to non-grid-aligned value
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 400,
        clientY: 200,
        bubbles: true
      });
      horizontalHandle.dispatchEvent(mouseDownEvent);
      
      // Move to 417 (should snap to 420)
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 417,
        clientY: 200,
        bubbles: true
      });
      document.dispatchEvent(mouseMoveEvent);
      
      jest.runAllTimers();
      document.dispatchEvent(new MouseEvent('mouseup'));
      
      // Check snapped value
      const call = mockOnResize.mock.calls[0];
      expect(call[1].width).toBe(420); // 400 + 20 (snapped)
    });

    it('should preserve minimum dimensions', () => {
      const cornerHandle = mockNodeElement.querySelector('.resize-both') as HTMLElement;
      
      // Try to resize below minimum
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 400,
        clientY: 300,
        bubbles: true
      });
      cornerHandle.dispatchEvent(mouseDownEvent);
      
      // Move to create negative dimensions
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 0,
        clientY: 0,
        bubbles: true
      });
      document.dispatchEvent(mouseMoveEvent);
      
      jest.runAllTimers();
      document.dispatchEvent(new MouseEvent('mouseup'));
      
      // Check clamped values
      const call = mockOnResize.mock.calls[0];
      expect(call[1].width).toBe(NODE_DIMENSION_CONSTANTS.MIN_WIDTH);
      expect(call[1].height).toBe(NODE_DIMENSION_CONSTANTS.MIN_HEIGHT);
    });

    it('should update connections on resize', () => {
      // This is handled by the ExpandableNodeManager
      // Just verify the resize handler calls the callback
      const horizontalHandle = mockNodeElement.querySelector('.resize-horizontal') as HTMLElement;
      
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 400,
        clientY: 200,
        bubbles: true
      });
      horizontalHandle.dispatchEvent(mouseDownEvent);
      
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 500,
        clientY: 200,
        bubbles: true
      });
      document.dispatchEvent(mouseMoveEvent);
      
      jest.runAllTimers();
      document.dispatchEvent(new MouseEvent('mouseup'));
      
      expect(mockOnResize).toHaveBeenCalled();
    });
    
    it('should handle resize when node not found', () => {
      mockGetNode.mockReturnValue(undefined);
      
      const horizontalHandle = mockNodeElement.querySelector('.resize-horizontal') as HTMLElement;
      
      expect(() => {
        const mouseDownEvent = new MouseEvent('mousedown', {
          clientX: 400,
          clientY: 200,
          bubbles: true
        });
        horizontalHandle.dispatchEvent(mouseDownEvent);
      }).toThrow(ResizeHandlerError);
    });
  });

  describe('Resize State Management', () => {
    it('should track resize state correctly', () => {
      expect(handler.isCurrentlyResizing()).toBe(false);
      
      handler.setupResizeHandles(mockNodeElement, testNodeId);
      const handle = mockNodeElement.querySelector('.resize-horizontal') as HTMLElement;
      
      // Start resize
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 400,
        clientY: 200,
        bubbles: true
      });
      handle.dispatchEvent(mouseDownEvent);
      
      expect(handler.isCurrentlyResizing()).toBe(true);
      
      // End resize
      document.dispatchEvent(new MouseEvent('mouseup'));
      
      expect(handler.isCurrentlyResizing()).toBe(false);
    });
    
    it('should prevent text selection during resize', () => {
      handler.setupResizeHandles(mockNodeElement, testNodeId);
      const handle = mockNodeElement.querySelector('.resize-horizontal') as HTMLElement;
      
      // Start resize
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 400,
        clientY: 200,
        bubbles: true
      });
      handle.dispatchEvent(mouseDownEvent);
      
      expect(document.body.style.userSelect).toBe('none');
      
      // End resize
      document.dispatchEvent(new MouseEvent('mouseup'));
      
      expect(document.body.style.userSelect).toBe('');
    });
  });

  describe('Performance', () => {
    it('should throttle rapid resize events', () => {
      handler.setupResizeHandles(mockNodeElement, testNodeId);
      const handle = mockNodeElement.querySelector('.resize-horizontal') as HTMLElement;
      
      // Start resize
      handle.dispatchEvent(new MouseEvent('mousedown', {
        clientX: 400,
        clientY: 200,
        bubbles: true
      }));
      
      // Send multiple mousemove events rapidly
      for (let i = 0; i < 10; i++) {
        document.dispatchEvent(new MouseEvent('mousemove', {
          clientX: 400 + i * 10,
          clientY: 200,
          bubbles: true
        }));
      }
      
      // Should not have called resize yet (throttled)
      expect(mockOnResize).not.toHaveBeenCalled();
      
      // Advance timer to allow throttle
      jest.runAllTimers();
      
      // Now it should have been called once
      expect(mockOnResize).toHaveBeenCalledTimes(1);
      
      document.dispatchEvent(new MouseEvent('mouseup'));
    });
  });
});
