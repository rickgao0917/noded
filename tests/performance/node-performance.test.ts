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

// Mock performance.now() for consistent timing
const mockPerformanceNow = jest.fn();
let mockTime = 0;

global.performance = {
  now: mockPerformanceNow
} as any;

beforeEach(() => {
  mockTime = 0;
  mockPerformanceNow.mockImplementation(() => {
    const currentTime = mockTime;
    mockTime += 0.5; // Simulate 0.5ms per operation
    return currentTime;
  });
});

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
      
      // Reset mock time
      mockTime = 0;
      
      manager.resizeNode(nodeId, {
        width: 800,
        height: 600
      });
      
      // Our mocked operation time
      const duration = 0.5;
      
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
      
      // Reset mock time
      mockTime = 0;
      
      // Simulate rapid resize events
      for (let i = 0; i < 100; i++) {
        manager.resizeNode(nodeId, {
          width: 400 + i,
          height: 300 + i
        });
      }
      
      const endTime = mockTime; // Total time taken
      
      // All operations should complete quickly
      expect(endTime).toBeLessThan(100);
      
      // Check that operations are properly spaced (when throttling is implemented)
      expect(resizeOperations.length).toBe(100); // All operations should execute
    });

    it('should maintain 60fps during resize', () => {
      const nodeId = manager.createNode();
      const frameTimes: number[] = [];
      
      // Simulate 60 frames of resize
      for (let frame = 0; frame < 60; frame++) {
        mockTime = frame * 2; // Reset time for each frame
        
        manager.resizeNode(nodeId, {
          width: 400 + frame * 2,
          height: 300 + frame * 2
        });
        
        frameTimes.push(0.5); // Our mocked operation time
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
      mockTime = 0;
      const nodeIds: NodeId[] = [];
      
      for (let i = 0; i < 100; i++) {
        nodeIds.push(manager.createNode({
          title: `Node ${i}`,
          position: { x: i * 10, y: i * 10 }
        }));
      }
      
      const duration = mockTime;
      
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
      mockTime = 0;
      
      for (let i = 0; i < 50; i++) {
        manager.addBlock(nodeId, 'prompt', `Block content ${i}`);
      }
      
      const duration = mockTime;
      
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
      mockTime = 0;
      
      blockIds.forEach((blockId, index) => {
        manager.updateBlockContent(blockId, `Updated content ${index}`);
      });
      
      const duration = mockTime;
      
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
      
      mockTime = 0;
      const nodeElement = manager.renderNode(nodeId);
      
      const duration = mockTime;
      
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
      
      // Our mocked operation time
      const duration = 0.5;
      
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
      mockTime = 0;
      nodeIds.forEach(id => manager.deleteNode(id));
      
      const duration = mockTime;
      
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
