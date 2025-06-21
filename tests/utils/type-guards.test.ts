/**
 * Comprehensive test suite for type guard utilities
 * 
 * Tests all type guards with 100% coverage as required by ts_readme.xml
 * for utility functions. Includes edge cases, error conditions, and
 * boundary testing.
 */

import {
  isNodeBlockType,
  isPosition,
  isGraphNode,
  isNodeBlock,
  Validator,
} from '../../src/utils/type-guards';
import { GraphNode } from '../../src/types/graph.types';
import { createMockNode, createMockBlock } from '../setup';

describe('Type Guards Utility Functions', () => {
  describe('isNodeBlockType', () => {
    it('should return true for valid chat block type', () => {
      expect(isNodeBlockType('chat')).toBe(true);
    });

    it('should return true for valid response block type', () => {
      expect(isNodeBlockType('response')).toBe(true);
    });

    it('should return true for valid markdown block type', () => {
      expect(isNodeBlockType('markdown')).toBe(true);
    });

    it('should return true for valid prompt block type', () => {
      expect(isNodeBlockType('prompt')).toBe(true);
    });

    it('should return false for invalid string values', () => {
      expect(isNodeBlockType('invalid')).toBe(false);
      expect(isNodeBlockType('unknown')).toBe(false);
      expect(isNodeBlockType('')).toBe(false);
      expect(isNodeBlockType(' ')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isNodeBlockType(null)).toBe(false);
      expect(isNodeBlockType(undefined)).toBe(false);
      expect(isNodeBlockType(123)).toBe(false);
      expect(isNodeBlockType({})).toBe(false);
      expect(isNodeBlockType([])).toBe(false);
      expect(isNodeBlockType(true)).toBe(false);
    });
  });

  describe('isPosition', () => {
    it('should return true for valid position objects', () => {
      expect(isPosition({ x: 0, y: 0 })).toBe(true);
      expect(isPosition({ x: 100, y: 200 })).toBe(true);
      expect(isPosition({ x: -50, y: -25 })).toBe(true);
      expect(isPosition({ x: 0.5, y: 1.5 })).toBe(true);
    });

    it('should return false for invalid position objects', () => {
      expect(isPosition({ x: NaN, y: 0 })).toBe(false);
      expect(isPosition({ x: 0, y: NaN })).toBe(false);
      expect(isPosition({ x: Infinity, y: 0 })).toBe(false);
      expect(isPosition({ x: 0, y: Infinity })).toBe(false);
      expect(isPosition({ x: -Infinity, y: 0 })).toBe(false);
    });

    it('should return false for missing properties', () => {
      expect(isPosition({ x: 0 })).toBe(false);
      expect(isPosition({ y: 0 })).toBe(false);
      expect(isPosition({})).toBe(false);
    });

    it('should return false for non-numeric properties', () => {
      expect(isPosition({ x: '0', y: 0 })).toBe(false);
      expect(isPosition({ x: 0, y: '0' })).toBe(false);
      expect(isPosition({ x: null, y: 0 })).toBe(false);
      expect(isPosition({ x: 0, y: undefined })).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isPosition(null)).toBe(false);
      expect(isPosition(undefined)).toBe(false);
      expect(isPosition('position')).toBe(false);
      expect(isPosition(123)).toBe(false);
      expect(isPosition([])).toBe(false);
    });
  });

  describe('isNodeBlock', () => {
    it('should return true for valid node blocks', () => {
      const validBlock = createMockBlock('test-1', 'chat');
      expect(isNodeBlock(validBlock)).toBe(true);
    });

    it('should return true for all valid block types', () => {
      const chatBlock = createMockBlock('test-1', 'chat');
      const responseBlock = createMockBlock('test-2', 'response');
      const markdownBlock = createMockBlock('test-3', 'markdown');
      
      expect(isNodeBlock(chatBlock)).toBe(true);
      expect(isNodeBlock(responseBlock)).toBe(true);
      expect(isNodeBlock(markdownBlock)).toBe(true);
    });

    it('should return false for missing required properties', () => {
      expect(isNodeBlock({ type: 'chat', content: 'test', position: 0 })).toBe(false); // missing id
      expect(isNodeBlock({ id: 'test', content: 'test', position: 0 })).toBe(false); // missing type
      expect(isNodeBlock({ id: 'test', type: 'chat', position: 0 })).toBe(false); // missing content
      expect(isNodeBlock({ id: 'test', type: 'chat', content: 'test' })).toBe(false); // missing position
    });

    it('should return false for invalid property types', () => {
      expect(isNodeBlock({
        id: 123, // should be string
        type: 'chat',
        content: 'test',
        position: 0,
      })).toBe(false);

      expect(isNodeBlock({
        id: 'test',
        type: 'invalid', // invalid type
        content: 'test',
        position: 0,
      })).toBe(false);

      expect(isNodeBlock({
        id: 'test',
        type: 'chat',
        content: 123, // should be string
        position: 0,
      })).toBe(false);

      expect(isNodeBlock({
        id: 'test',
        type: 'chat',
        content: 'test',
        position: 'invalid', // should be number
      })).toBe(false);
    });

    it('should return false for non-finite position values', () => {
      expect(isNodeBlock({
        id: 'test',
        type: 'chat',
        content: 'test',
        position: NaN,
      })).toBe(false);

      expect(isNodeBlock({
        id: 'test',
        type: 'chat',
        content: 'test',
        position: Infinity,
      })).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isNodeBlock(null)).toBe(false);
      expect(isNodeBlock(undefined)).toBe(false);
      expect(isNodeBlock('block')).toBe(false);
      expect(isNodeBlock(123)).toBe(false);
      expect(isNodeBlock([])).toBe(false);
    });
  });

  describe('isGraphNode', () => {
    it('should return true for valid graph nodes', () => {
      const validNode = createMockNode('test-1');
      expect(isGraphNode(validNode)).toBe(true);
    });

    it('should return true for nodes with children', () => {
      const nodeWithChildren = createMockNode('parent', {
        children: ['child-1', 'child-2'],
      });
      expect(isGraphNode(nodeWithChildren)).toBe(true);
    });

    it('should return true for nodes with blocks', () => {
      const nodeWithBlocks = createMockNode('test', {
        blocks: [createMockBlock('block-1', 'chat')],
      });
      expect(isGraphNode(nodeWithBlocks)).toBe(true);
    });

    it('should return true for nodes with parent', () => {
      const childNode = createMockNode('child', {
        parentId: 'parent-id',
        depth: 1,
      });
      expect(isGraphNode(childNode)).toBe(true);
    });

    it('should return false for missing required properties', () => {
      expect(isGraphNode({
        name: 'test',
        parentId: null,
        children: [],
        blocks: [],
        position: { x: 0, y: 0 },
        depth: 0,
      })).toBe(false); // missing id

      expect(isGraphNode({
        id: 'test',
        parentId: null,
        children: [],
        blocks: [],
        position: { x: 0, y: 0 },
        depth: 0,
      })).toBe(false); // missing name
    });

    it('should return false for invalid property types', () => {
      expect(isGraphNode({
        id: 123, // should be string
        name: 'test',
        parentId: null,
        children: [],
        blocks: [],
        position: { x: 0, y: 0 },
        depth: 0,
      })).toBe(false);

      expect(isGraphNode({
        id: 'test',
        name: 123, // should be string
        parentId: null,
        children: [],
        blocks: [],
        position: { x: 0, y: 0 },
        depth: 0,
      })).toBe(false);

      expect(isGraphNode({
        id: 'test',
        name: 'test',
        parentId: 123, // should be string or null
        children: [],
        blocks: [],
        position: { x: 0, y: 0 },
        depth: 0,
      })).toBe(false);
    });

    it('should return false for invalid children array', () => {
      expect(isGraphNode({
        id: 'test',
        name: 'test',
        parentId: null,
        children: 'not-array', // should be array
        blocks: [],
        position: { x: 0, y: 0 },
        depth: 0,
      })).toBe(false);

      expect(isGraphNode({
        id: 'test',
        name: 'test',
        parentId: null,
        children: [123], // should be string array
        blocks: [],
        position: { x: 0, y: 0 },
        depth: 0,
      })).toBe(false);
    });

    it('should return false for invalid blocks array', () => {
      expect(isGraphNode({
        id: 'test',
        name: 'test',
        parentId: null,
        children: [],
        blocks: 'not-array', // should be array
        position: { x: 0, y: 0 },
        depth: 0,
      })).toBe(false);

      expect(isGraphNode({
        id: 'test',
        name: 'test',
        parentId: null,
        children: [],
        blocks: [{ invalid: 'block' }], // should be valid NodeBlock
        position: { x: 0, y: 0 },
        depth: 0,
      })).toBe(false);
    });

    it('should return false for invalid position', () => {
      expect(isGraphNode({
        id: 'test',
        name: 'test',
        parentId: null,
        children: [],
        blocks: [],
        position: { x: NaN, y: 0 }, // invalid position
        depth: 0,
      })).toBe(false);
    });

    it('should return false for invalid depth', () => {
      expect(isGraphNode({
        id: 'test',
        name: 'test',
        parentId: null,
        children: [],
        blocks: [],
        position: { x: 0, y: 0 },
        depth: 'invalid', // should be number
      })).toBe(false);

      expect(isGraphNode({
        id: 'test',
        name: 'test',
        parentId: null,
        children: [],
        blocks: [],
        position: { x: 0, y: 0 },
        depth: NaN, // should be finite
      })).toBe(false);
    });
  });

  describe('Validator Class', () => {
    let validator: Validator;

    beforeEach(() => {
      validator = new Validator('test-correlation');
    });

    describe('validateNodeId', () => {
      it('should validate valid node IDs without throwing', () => {
        expect(() => {
          validator.validateNodeId('valid-id', 'testFunction');
        }).not.toThrow();

        expect(() => {
          validator.validateNodeId('another-valid-id', 'testFunction');
        }).not.toThrow();
      });

      it('should throw ValidationError for invalid node IDs', () => {
        expect(() => {
          validator.validateNodeId('', 'testFunction');
        }).toThrow();

        expect(() => {
          validator.validateNodeId('   ', 'testFunction');
        }).toThrow();

        expect(() => {
          validator.validateNodeId(null as any, 'testFunction');
        }).toThrow();

        expect(() => {
          validator.validateNodeId(undefined as any, 'testFunction');
        }).toThrow();

        expect(() => {
          validator.validateNodeId(123 as any, 'testFunction');
        }).toThrow();
      });
    });

    describe('validateGraphNode', () => {
      it('should validate valid graph nodes without throwing', () => {
        const validNode = createMockNode('test-1');
        
        expect(() => {
          validator.validateGraphNode(validNode, 'testFunction');
        }).not.toThrow();
      });

      it('should throw ValidationError for invalid graph nodes', () => {
        expect(() => {
          validator.validateGraphNode(null as any, 'testFunction');
        }).toThrow();

        expect(() => {
          validator.validateGraphNode({ invalid: 'node' } as any, 'testFunction');
        }).toThrow();
      });
    });

    describe('validatePosition', () => {
      it('should validate valid positions without throwing', () => {
        expect(() => {
          validator.validatePosition({ x: 0, y: 0 }, 'testFunction');
        }).not.toThrow();

        expect(() => {
          validator.validatePosition({ x: 100, y: 200 }, 'testFunction');
        }).not.toThrow();
      });

      it('should throw ValidationError for invalid positions', () => {
        expect(() => {
          validator.validatePosition(null as any, 'testFunction');
        }).toThrow();

        expect(() => {
          validator.validatePosition({ x: NaN, y: 0 }, 'testFunction');
        }).toThrow();
      });
    });

    describe('validateNodeBlock', () => {
      it('should validate valid node blocks without throwing', () => {
        const validBlock = createMockBlock('test-1', 'chat');
        
        expect(() => {
          validator.validateNodeBlock(validBlock, 'testFunction');
        }).not.toThrow();
      });

      it('should throw ValidationError for invalid node blocks', () => {
        expect(() => {
          validator.validateNodeBlock(null as any, 'testFunction');
        }).toThrow();

        expect(() => {
          validator.validateNodeBlock({ invalid: 'block' } as any, 'testFunction');
        }).toThrow();
      });
    });

    describe('validateDOMElement', () => {
      it('should validate valid DOM elements without throwing', () => {
        const element = document.createElement('div');
        
        expect(() => {
          validator.validateDOMElement(element, 'HTMLElement', 'testFunction');
        }).not.toThrow();
      });

      it('should throw DOMError for invalid DOM elements', () => {
        expect(() => {
          validator.validateDOMElement(null, 'HTMLElement', 'testFunction');
        }).toThrow();

        expect(() => {
          validator.validateDOMElement({} as any, 'HTMLElement', 'testFunction');
        }).toThrow();
      });
    });

    describe('validateNonEmptyArray', () => {
      it('should validate non-empty arrays without throwing', () => {
        expect(() => {
          validator.validateNonEmptyArray([1, 2, 3], 'testArray', 'testFunction');
        }).not.toThrow();

        expect(() => {
          validator.validateNonEmptyArray(['a'], 'testArray', 'testFunction');
        }).not.toThrow();
      });

      it('should throw ValidationError for empty or invalid arrays', () => {
        expect(() => {
          validator.validateNonEmptyArray([], 'testArray', 'testFunction');
        }).toThrow();

        expect(() => {
          validator.validateNonEmptyArray(null as any, 'testArray', 'testFunction');
        }).toThrow();

        expect(() => {
          validator.validateNonEmptyArray('not-array' as any, 'testArray', 'testFunction');
        }).toThrow();
      });
    });
    
    describe('validateTreeIntegrity', () => {
      it('should validate tree with regular parent-child relationships', () => {
        const nodes = new Map<string, GraphNode>();
        
        // Create a simple tree: root -> child1, child2
        const root = createMockNode('root');
        root.children = ['child1', 'child2'];
        nodes.set('root', root);
        
        const child1 = createMockNode('child1', { depth: 1, parentId: 'root' });
        nodes.set('child1', child1);
        
        const child2 = createMockNode('child2', { depth: 1, parentId: 'root' });
        nodes.set('child2', child2);
        
        expect(() => {
          validator.validateTreeIntegrity(nodes, 'testFunction');
        }).not.toThrow();
      });
      
      it('should validate tree with branch nodes (siblings)', () => {
        const nodes = new Map<string, GraphNode>();
        
        // Create a tree with branches
        const root = createMockNode('root');
        root.children = ['child1'];
        root.branches = ['branch1'];
        nodes.set('root', root);
        
        const child1 = createMockNode('child1', { depth: 1, parentId: 'root' });
        nodes.set('child1', child1);
        
        // Branch node - has parentId but is NOT in parent's children array
        const branch1: GraphNode = {
          ...createMockNode('branch1', { depth: 0, parentId: 'root' }),
          branchedFrom: 'root'
        };
        nodes.set('branch1', branch1);
        
        expect(() => {
          validator.validateTreeIntegrity(nodes, 'testFunction');
        }).not.toThrow();
      });
      
      it('should validate tree with children of branch nodes', () => {
        const nodes = new Map<string, GraphNode>();
        
        // Create a tree: root -> branch -> branchChild
        const root = createMockNode('root');
        root.branches = ['branch1'];
        nodes.set('root', root);
        
        // Branch node
        const branch1: GraphNode = {
          ...createMockNode('branch1', { depth: 0, parentId: 'root' }),
          branchedFrom: 'root',
          children: ['branchChild']
        };
        nodes.set('branch1', branch1);
        
        // Child of branch
        const branchChild = createMockNode('branchChild', { depth: 1, parentId: 'branch1' });
        nodes.set('branchChild', branchChild);
        
        expect(() => {
          validator.validateTreeIntegrity(nodes, 'testFunction');
        }).not.toThrow();
      });
      
      it('should throw error for missing parent references', () => {
        const nodes = new Map<string, GraphNode>();
        
        // Node with non-existent parent
        const orphan = createMockNode('orphan', { depth: 1, parentId: 'missing-parent' });
        nodes.set('orphan', orphan);
        
        expect(() => {
          validator.validateTreeIntegrity(nodes, 'testFunction');
        }).toThrow(/references non-existent parent/);
      });
      
      it('should throw error for inconsistent parent-child relationships', () => {
        const nodes = new Map<string, GraphNode>();
        
        // Parent doesn't list child in its children array
        const parent = createMockNode('parent');
        parent.children = []; // Empty children array
        nodes.set('parent', parent);
        
        // Child claims parent but parent doesn't know about it
        // AND it's not a branch node
        const child = createMockNode('child', { depth: 1, parentId: 'parent' });
        // No branchedFrom field, so it should be in parent's children
        nodes.set('child', child);
        
        expect(() => {
          validator.validateTreeIntegrity(nodes, 'testFunction');
        }).toThrow(/does not reference child/);
      });
    });
  });
});