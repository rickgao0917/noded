/**
 * Tests for expandable node core functionality
 */

import { ExpandableNodeManager } from '../../src/components/expandable-node-manager';
import { NodeResizeHandler } from '../../src/components/node-resize-handler';
import { Logger } from '../../src/utils/logger';
import { Validator } from '../../src/utils/validator';
import type { NodeId, BlockId } from '../../src/types/branded.types';
import type {
  ExpandableNode,
  BasicBlock,
  NodeDimensions,
  NodeCreationConfig,
  BlockType
} from '../../src/types/expandable-node.types';
import {
  NODE_DIMENSION_CONSTANTS,
  BLOCK_DIMENSION_CONSTANTS
} from '../../src/types/expandable-node.types';
import {
  NodeCreationError,
  NodeNotFoundError,
  BlockCreationError,
  BlockNotFoundError
} from '../../src/types/expandable-node-errors';
import {
  isExpandableNode,
  isBasicBlock,
  validateBlockType
} from '../../src/utils/expandable-node-guards';

// Mock Logger
jest.mock('../../src/utils/logger');

describe('ExpandableNodeManager', () => {
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

  describe('Node Creation', () => {
    it('should create node with default dimensions', () => {
      const nodeId = manager.createNode();
      const node = manager.getNode(nodeId);
      
      expect(node).toBeDefined();
      expect(node?.dimensions.width).toBe(NODE_DIMENSION_CONSTANTS.DEFAULT_WIDTH);
      expect(node?.dimensions.height).toBe(NODE_DIMENSION_CONSTANTS.DEFAULT_HEIGHT);
      expect(node?.title).toBe('Untitled Node');
      expect(node?.blocks).toHaveLength(1);
      expect(node?.blocks[0]?.type).toBe('prompt');
    });

    it('should create node with custom dimensions', () => {
      const config: NodeCreationConfig = {
        title: 'Custom Node',
        dimensions: {
          width: 600,
          height: 500
        },
        position: {
          x: 200,
          y: 300
        }
      };
      
      const nodeId = manager.createNode(config);
      const node = manager.getNode(nodeId);
      
      expect(node?.dimensions.width).toBe(600);
      expect(node?.dimensions.height).toBe(500);
      expect(node?.position.x).toBe(200);
      expect(node?.position.y).toBe(300);
      expect(node?.title).toBe('Custom Node');
    });

    it('should validate node title length', () => {
      const longTitle = 'a'.repeat(150);
      const nodeId = manager.createNode({ title: longTitle });
      const node = manager.getNode(nodeId);
      
      expect(node?.title.length).toBe(100);
    });

    it('should generate unique node IDs', () => {
      const nodeId1 = manager.createNode();
      const nodeId2 = manager.createNode();
      
      expect(nodeId1).not.toBe(nodeId2);
      expect(nodeId1).toMatch(/^node_[a-f0-9-]{36}$/);
      expect(nodeId2).toMatch(/^node_[a-f0-9-]{36}$/);
    });

    it('should throw error for invalid dimensions', () => {
      const config: NodeCreationConfig = {
        dimensions: {
          width: -100,
          height: 50
        }
      };
      
      const nodeId = manager.createNode(config);
      const node = manager.getNode(nodeId);
      
      // Should clamp to minimum values
      expect(node?.dimensions.width).toBe(NODE_DIMENSION_CONSTANTS.MIN_WIDTH);
      expect(node?.dimensions.height).toBe(NODE_DIMENSION_CONSTANTS.MIN_HEIGHT);
    });

    it('should log node creation events', () => {
      manager.createNode();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Creating new expandable node'),
        expect.any(Object),
        expect.any(String)
      );
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Node created successfully'),
        expect.any(Object),
        expect.any(String)
      );
    });

    it('should create node with custom blocks', () => {
      const config: NodeCreationConfig = {
        blocks: [
          { type: 'prompt', content: 'Test prompt' },
          { type: 'response', content: 'Test response' },
          { type: 'markdown', content: '# Test markdown', title: 'MD Block' }
        ]
      };
      
      const nodeId = manager.createNode(config);
      const node = manager.getNode(nodeId);
      
      expect(node?.blocks).toHaveLength(3);
      expect(node?.blocks[0]?.type).toBe('prompt');
      expect(node?.blocks[0]?.content).toBe('Test prompt');
      expect(node?.blocks[1]?.type).toBe('response');
      expect(node?.blocks[2]?.type).toBe('markdown');
      expect(node?.blocks[2]?.title).toBe('MD Block');
    });
  });

  describe('Node Resizing', () => {
    let nodeId: NodeId;
    
    beforeEach(() => {
      nodeId = manager.createNode();
    });

    it('should resize node within valid bounds', () => {
      const newDimensions: Partial<NodeDimensions> = {
        width: 800,
        height: 600
      };
      
      manager.resizeNode(nodeId, newDimensions);
      const node = manager.getNode(nodeId);
      
      expect(node?.dimensions.width).toBe(800);
      expect(node?.dimensions.height).toBe(600);
    });

    it('should prevent resize below minimum dimensions', () => {
      const newDimensions: Partial<NodeDimensions> = {
        width: 50,
        height: 50
      };
      
      manager.resizeNode(nodeId, newDimensions);
      const node = manager.getNode(nodeId);
      
      expect(node?.dimensions.width).toBe(NODE_DIMENSION_CONSTANTS.MIN_WIDTH);
      expect(node?.dimensions.height).toBe(NODE_DIMENSION_CONSTANTS.MIN_HEIGHT);
    });

    it('should prevent resize above maximum dimensions', () => {
      const newDimensions: Partial<NodeDimensions> = {
        width: 2000,
        height: 2000
      };
      
      manager.resizeNode(nodeId, newDimensions);
      const node = manager.getNode(nodeId);
      
      expect(node?.dimensions.width).toBe(NODE_DIMENSION_CONSTANTS.MAX_WIDTH);
      expect(node?.dimensions.height).toBe(NODE_DIMENSION_CONSTANTS.MAX_HEIGHT);
    });

    it('should update block scaling on resize', () => {
      const node = manager.getNode(nodeId);
      const originalBlockWidth = node?.blocks[0]?.dimensions.width || 0;
      
      manager.resizeNode(nodeId, { width: 800 });
      const resizedNode = manager.getNode(nodeId);
      
      const newBlockWidth = resizedNode?.blocks[0]?.dimensions.width || 0;
      const expectedRatio = 800 / NODE_DIMENSION_CONSTANTS.DEFAULT_WIDTH;
      
      expect(newBlockWidth).toBeCloseTo(originalBlockWidth * expectedRatio);
    });

    it('should handle resize error scenarios', () => {
      const invalidNodeId = 'node_invalid' as NodeId;
      
      expect(() => {
        manager.resizeNode(invalidNodeId, { width: 500 });
      }).toThrow(NodeNotFoundError);
    });

    it('should update metadata on resize', () => {
      const node = manager.getNode(nodeId);
      const originalVersion = node?.metadata.version || 0;
      const originalModified = node?.metadata.lastModified;
      
      // Wait a bit to ensure timestamp difference
      jest.advanceTimersByTime(100);
      
      manager.resizeNode(nodeId, { width: 600 });
      const resizedNode = manager.getNode(nodeId);
      
      expect(resizedNode?.metadata.version).toBe(originalVersion + 1);
      expect(resizedNode?.metadata.lastModified).not.toBe(originalModified);
    });
  });

  describe('Basic Block Management', () => {
    let nodeId: NodeId;
    
    beforeEach(() => {
      nodeId = manager.createNode();
    });

    it('should add blocks to node', () => {
      const blockId1 = manager.addBlock(nodeId, 'response', 'Test response');
      const blockId2 = manager.addBlock(nodeId, 'markdown', '# Test', 'Custom Title');
      
      const node = manager.getNode(nodeId);
      expect(node?.blocks).toHaveLength(3); // 1 default + 2 added
      
      const responseBlock = node?.blocks.find(b => b.id === blockId1);
      expect(responseBlock?.type).toBe('response');
      expect(responseBlock?.content).toBe('Test response');
      
      const mdBlock = node?.blocks.find(b => b.id === blockId2);
      expect(mdBlock?.type).toBe('markdown');
      expect(mdBlock?.title).toBe('Custom Title');
    });

    it('should update block content', () => {
      const blockId = manager.addBlock(nodeId, 'prompt', 'Original content');
      
      manager.updateBlockContent(blockId, 'Updated content');
      
      const node = manager.getNode(nodeId);
      const block = node?.blocks.find(b => b.id === blockId);
      
      expect(block?.content).toBe('Updated content');
    });

    it('should validate block content length', () => {
      const longContent = 'a'.repeat(60000);
      const blockId = manager.addBlock(nodeId, 'prompt', longContent);
      
      const node = manager.getNode(nodeId);
      const block = node?.blocks.find(b => b.id === blockId);
      
      expect(block?.content.length).toBe(50000);
    });

    it('should sanitize block content', () => {
      const unsafeContent = '<script>alert("xss")</script>';
      const blockId = manager.addBlock(nodeId, 'prompt', unsafeContent);
      
      const node = manager.getNode(nodeId);
      const block = node?.blocks.find(b => b.id === blockId);
      
      expect(block?.content).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should render block with proper dimensions', () => {
      const nodeElement = manager.renderNode(nodeId);
      const blockElements = nodeElement.querySelectorAll('.node-block');
      
      expect(blockElements.length).toBeGreaterThan(0);
      
      const firstBlock = blockElements[0] as HTMLElement;
      expect(firstBlock.style.width).toBeTruthy();
      expect(firstBlock.style.height).toBeTruthy();
    });

    it('should handle block creation errors', () => {
      expect(() => {
        manager.addBlock(nodeId, 'invalid' as BlockType);
      }).toThrow(BlockCreationError);
      
      const invalidNodeId = 'node_invalid' as NodeId;
      expect(() => {
        manager.addBlock(invalidNodeId, 'prompt');
      }).toThrow(NodeNotFoundError);
    });

    it('should handle block update errors', () => {
      const invalidBlockId = 'block_invalid' as BlockId;
      
      expect(() => {
        manager.updateBlockContent(invalidBlockId, 'content');
      }).toThrow(BlockNotFoundError);
    });
  });

  describe('Node Deletion', () => {
    it('should delete node and clean up mappings', () => {
      const nodeId = manager.createNode();
      const blockId = manager.addBlock(nodeId, 'response');
      
      manager.deleteNode(nodeId);
      
      expect(manager.getNode(nodeId)).toBeUndefined();
      
      // Block mapping should be cleaned up
      expect(() => {
        manager.updateBlockContent(blockId, 'new content');
      }).toThrow(BlockNotFoundError);
    });
    
    it('should handle deletion of non-existent node', () => {
      const invalidNodeId = 'node_invalid' as NodeId;
      
      expect(() => {
        manager.deleteNode(invalidNodeId);
      }).toThrow(NodeNotFoundError);
    });
  });

  describe('Node Rendering', () => {
    it('should render node with all components', () => {
      const nodeId = manager.createNode({
        title: 'Test Node',
        blocks: [
          { type: 'prompt', content: 'Test prompt' },
          { type: 'response', content: 'Test response' }
        ]
      });
      
      const nodeElement = manager.renderNode(nodeId);
      
      expect(nodeElement.classList.contains('expandable-node')).toBe(true);
      expect(nodeElement.id).toBe(`node-${nodeId}`);
      expect(nodeElement.getAttribute('data-node-id')).toBe(nodeId);
      
      // Check header
      const header = nodeElement.querySelector('.node-header');
      expect(header).toBeTruthy();
      expect(header?.querySelector('.node-title')?.textContent).toBe('Test Node');
      
      // Check blocks
      const blocks = nodeElement.querySelectorAll('.node-block');
      expect(blocks).toHaveLength(2);
    });
    
    it('should handle render errors', () => {
      const invalidNodeId = 'node_invalid' as NodeId;
      
      expect(() => {
        manager.renderNode(invalidNodeId);
      }).toThrow(NodeNotFoundError);
    });
  });
});

describe('Type Guards', () => {
  describe('validateBlockType', () => {
    it('should validate valid block types', () => {
      expect(validateBlockType('prompt')).toBe(true);
      expect(validateBlockType('response')).toBe(true);
      expect(validateBlockType('markdown')).toBe(true);
    });
    
    it('should reject invalid block types', () => {
      expect(validateBlockType('invalid')).toBe(false);
      expect(validateBlockType('')).toBe(false);
      expect(validateBlockType(123)).toBe(false);
      expect(validateBlockType(null)).toBe(false);
    });
  });
  
  describe('isExpandableNode', () => {
    it('should validate valid node structure', () => {
      const validNode = {
        id: 'node_12345678-1234-1234-1234-123456789012',
        title: 'Test Node',
        dimensions: {
          width: 400,
          height: 400,
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
      
      expect(isExpandableNode(validNode)).toBe(true);
    });
    
    it('should reject invalid node structures', () => {
      expect(isExpandableNode({})).toBe(false);
      expect(isExpandableNode({ id: 'invalid' })).toBe(false);
      expect(isExpandableNode(null)).toBe(false);
    });
  });
});
