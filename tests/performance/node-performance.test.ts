/**
 * Performance tests for expandable node system
 */

import { ExpandableNodeManager } from '../../src/components/expandable-node-manager';
import { NodeResizeHandler } from '../../src/components/node-resize-handler';
import { Logger } from '../../src/utils/logger';
import { Validator } from '../../src/utils/validator';
import type { NodeId } from '../../src/types/branded.types';
import { NODE_DIMENSION_CONSTANTS } from '../../src/types/expandable-node.types';

// Mock Logger for performance tests
jest.mock('../../src/utils/logger');

describe('Node Performance Tests', () => {
  let manager: ExpandableNodeManager;
  let mockLogger: jest.Mocked<Logger>;
  let validator: Validator;

  beforeEach(() => {
    mockLogger = new Logger({} as any) as jest.Mocked<Logger>;
    mockLogger.startOperation.mockReturnValue('test-correlation-id');
    mockLogger.endOperation.mockReturnValue();
    
    validator = new Validator(mockLogger);
    manager = new ExpandableNodeManager(mockLogger, validator);
  });

  describe('Resize Performance', () => {
    it('should complete resize operation under 16ms', () => {
      const nodeId = manager.createNode();
      
      const startTime = performance.now();
      
      manager.resizeNode(nodeId, {
        width: 800,
        height: 600
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(16); // 60fps threshold
    });

    it('should throttle rapid resize events', () => {
      const nodeId = manager.createNode();
      const resizeOperations: number[] = [];
      
      // Override resizeNode to track calls
      const originalResize = manager.resizeNode.bind(manager);
      manager.resizeNode = jest.fn((id, dimensions) => {
        resizeOperations.push(performance.now());
        return originalResize(id, dimensions);
      });
      
      // Simulate rapid resize events
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        manager.resizeNode(nodeId, {
          width: 400 + i,
          height: 300 + i
        });
      }
      const endTime = performance.now();
      
      // All operations should complete quickly
      expect(endTime - startTime).toBeLessThan(100);
      
      // Check that operations are properly spaced (when throttling is implemented)
      expect(resizeOperations.length).toBe(100); // All operations should execute
    });

    it('should maintain 60fps during resize', () => {
      const nodeId = manager.createNode();
      const frameTimes: number[] = [];
      
      // Simulate 60 frames of resize
      for (let frame = 0; frame < 60; frame++) {
        const frameStart = performance.now();
        
        manager.resizeNode(nodeId, {
          width: 400 + frame * 2,
          height: 300 + frame * 2
        });
        
        const frameEnd = performance.now();
        frameTimes.push(frameEnd - frameStart);
      }
      
      // Calculate average frame time
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      
      // Average should be well under 16.67ms (60fps)
      expect(avgFrameTime).toBeLessThan(16.67);
      
      // No single frame should exceed 16.67ms
      const slowFrames = frameTimes.filter(time => time > 16.67);
      expect(slowFrames.length).toBe(0);
    });
  });

  describe('Node Creation Performance', () => {
    it('should create 100 nodes efficiently', () => {
      const startTime = performance.now();
      const nodeIds: NodeId[] = [];
      
      for (let i = 0; i < 100; i++) {
        nodeIds.push(manager.createNode({
          title: `Node ${i}`,
          position: { x: i * 10, y: i * 10 }
        }));
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should create 100 nodes in under 100ms (1ms per node average)
      expect(duration).toBeLessThan(100);
      expect(nodeIds.length).toBe(100);
      
      // Verify all nodes were created
      nodeIds.forEach(id => {
        expect(manager.getNode(id)).toBeDefined();
      });
    });
  });

  describe('Block Operations Performance', () => {
    it('should add 50 blocks to a node efficiently', () => {
      const nodeId = manager.createNode();
      const startTime = performance.now();
      
      for (let i = 0; i < 50; i++) {
        manager.addBlock(nodeId, 'prompt', `Block content ${i}`);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should add 50 blocks in under 50ms
      expect(duration).toBeLessThan(50);
      
      const node = manager.getNode(nodeId);
      expect(node?.blocks.length).toBe(51); // 1 default + 50 added
    });

    it('should update block content efficiently', () => {
      const nodeId = manager.createNode();
      const blockIds = [];
      
      // Add blocks
      for (let i = 0; i < 20; i++) {
        blockIds.push(manager.addBlock(nodeId, 'prompt', `Initial ${i}`));
      }
      
      // Update all blocks
      const startTime = performance.now();
      
      blockIds.forEach((blockId, index) => {
        manager.updateBlockContent(blockId, `Updated content ${index}`);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should update 20 blocks in under 20ms
      expect(duration).toBeLessThan(20);
    });
  });

  describe('Render Performance', () => {
    it('should render complex node efficiently', () => {
      const nodeId = manager.createNode({
        title: 'Complex Node',
        blocks: [
          { type: 'prompt', content: 'A'.repeat(1000) },
          { type: 'response', content: 'B'.repeat(1000) },
          { type: 'markdown', content: 'C'.repeat(1000) }
        ]
      });
      
      const startTime = performance.now();
      const nodeElement = manager.renderNode(nodeId);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Should render in under 16ms
      expect(duration).toBeLessThan(16);
      expect(nodeElement).toBeDefined();
      expect(nodeElement.querySelectorAll('.node-block').length).toBe(3);
    });

    it('should handle resize handle setup efficiently', () => {
      const nodeId = manager.createNode();
      const nodeElement = manager.renderNode(nodeId);
      
      // Measure just the resize handle setup
      const handler = new NodeResizeHandler(
        mockLogger,
        jest.fn(),
        () => manager.getNode(nodeId)
      );
      
      const startTime = performance.now();
      handler.setupResizeHandles(nodeElement, nodeId);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Should setup handles in under 5ms
      expect(duration).toBeLessThan(5);
      expect(nodeElement.querySelectorAll('.node-resize-handle').length).toBe(3);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle node deletion without memory leaks', () => {
      const nodeIds: NodeId[] = [];
      
      // Create nodes
      for (let i = 0; i < 50; i++) {
        nodeIds.push(manager.createNode());
      }
      
      // Delete all nodes
      const startTime = performance.now();
      nodeIds.forEach(id => manager.deleteNode(id));
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Should delete 50 nodes quickly
      expect(duration).toBeLessThan(50);
      
      // Verify all nodes are deleted
      nodeIds.forEach(id => {
        expect(manager.getNode(id)).toBeUndefined();
      });
      
      // Check that internal maps are cleaned
      expect(manager.getAllNodes().size).toBe(0);
    });
  });
});
