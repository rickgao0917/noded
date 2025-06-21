/**
 * Unit tests for NodeBranchingService
 * Tests branching logic, node copying, and version history
 */

import { NodeBranchingService } from '../../src/services/node-branching-service';
import { GraphNode, NodeBlock } from '../../src/types/graph.types';
import { 
  EditSource, 
  BranchReason, 
  ChangeType,
  BranchingResult 
} from '../../src/types/branching.types';
import { NodeId, BlockId } from '../../src/types/branded.types';
import { ValidationError } from '../../src/types/errors';

describe('NodeBranchingService', () => {
  let service: NodeBranchingService;
  let nodes: Map<string, GraphNode>;
  
  beforeEach(() => {
    nodes = new Map();
    service = new NodeBranchingService(nodes);
    
    // Add test nodes
    const rootNode: GraphNode = {
      id: 'node-1',
      position: { x: 0, y: 0 },
      blocks: [
        { id: 'block-1' as BlockId, type: 'prompt', content: 'Original prompt', position: 0 },
        { id: 'block-2' as BlockId, type: 'response', content: 'Original response', position: 1 },
        { id: 'block-3' as BlockId, type: 'markdown', content: 'Original markdown', position: 2 }
      ],
      children: ['node-2'],
      name: 'Test Node',
      parentId: null,
      depth: 0
    };
    
    const childNode: GraphNode = {
      id: 'node-2',
      position: { x: 100, y: 100 },
      blocks: [
        { id: 'block-4' as BlockId, type: 'prompt', content: 'Child prompt', position: 0 }
      ],
      children: [],
      parentId: 'node-1',
      name: 'Child Node',
      depth: 1
    };
    
    nodes.set('node-1', rootNode);
    nodes.set('node-2', childNode);
  });
  
  describe('shouldCreateBranch', () => {
    it('should return true for prompt blocks', () => {
      const result = service.shouldCreateBranch('prompt', EditSource.NODE_BLOCK_DIRECT);
      expect(result).toBe(true);
    });
    
    it('should return true for response blocks', () => {
      const result = service.shouldCreateBranch('response', EditSource.CHAT_INTERFACE);
      expect(result).toBe(true);
    });
    
    it('should return false for markdown blocks', () => {
      const result = service.shouldCreateBranch('markdown', EditSource.NODE_BLOCK_DIRECT);
      expect(result).toBe(false);
    });
    
    it('should work with any edit source', () => {
      expect(service.shouldCreateBranch('prompt', EditSource.PROGRAMMATIC)).toBe(true);
      expect(service.shouldCreateBranch('response', EditSource.NODE_BLOCK_DIRECT)).toBe(true);
      expect(service.shouldCreateBranch('markdown', EditSource.CHAT_INTERFACE)).toBe(false);
    });
  });
  
  describe('createBranchFromEdit', () => {
    it('should create branch for prompt edit', async () => {
      const result = await service.createBranchFromEdit(
        'node-1' as NodeId,
        'block-1' as BlockId,
        'Updated prompt content',
        EditSource.NODE_BLOCK_DIRECT
      );
      
      expect(result.success).toBe(true);
      expect(result.originalNodeId).toBe('node-1' as NodeId);
      expect(result.newNodeId).toBeTruthy();
      expect(result.branchMetadata.branchReason).toBe(BranchReason.PROMPT_EDIT);
      expect(result.branchMetadata.changeContext.changeType).toBe(ChangeType.CONTENT_EDIT);
      expect(result.branchMetadata.changeContext.newContent).toBe('Updated prompt content');
      
      // Verify new node was created
      const newNode = nodes.get(result.newNodeId);
      expect(newNode).toBeDefined();
      expect(newNode!.blocks.length).toBe(3); // Should have all blocks copied
      expect(newNode!.blocks[0]?.content).toBe('Updated prompt content');
      expect(newNode!.children).toEqual([]); // No children copied
    });
    
    it('should create branch for response edit', async () => {
      const result = await service.createBranchFromEdit(
        'node-1' as NodeId,
        'block-2' as BlockId,
        'Updated response content',
        EditSource.CHAT_INTERFACE
      );
      
      expect(result.success).toBe(true);
      expect(result.branchMetadata.branchReason).toBe(BranchReason.RESPONSE_EDIT);
      expect(result.branchMetadata.changeContext.changedBlockId).toBe('block-2' as BlockId);
      
      const newNode = nodes.get(result.newNodeId);
      expect(newNode!.blocks[1]?.content).toBe('Updated response content');
    });
    
    it('should throw error for markdown block edit', async () => {
      await expect(
        service.createBranchFromEdit(
          'node-1' as NodeId,
          'block-3' as BlockId,
          'Updated markdown',
          EditSource.NODE_BLOCK_DIRECT
        )
      ).rejects.toThrow(ValidationError);
    });
    
    it('should throw error for invalid node ID', async () => {
      await expect(
        service.createBranchFromEdit(
          'invalid-node' as NodeId,
          'block-1' as BlockId,
          'Content',
          EditSource.NODE_BLOCK_DIRECT
        )
      ).rejects.toThrow(ValidationError);
    });
    
    it('should throw error for invalid block ID', async () => {
      await expect(
        service.createBranchFromEdit(
          'node-1' as NodeId,
          'invalid-block' as BlockId,
          'Content',
          EditSource.NODE_BLOCK_DIRECT
        )
      ).rejects.toThrow(ValidationError);
    });
    
    it('should set parent relationship correctly for child nodes', async () => {
      const result = await service.createBranchFromEdit(
        'node-2' as NodeId,
        'block-4' as BlockId,
        'Updated child prompt',
        EditSource.NODE_BLOCK_DIRECT
      );
      
      const newNode = nodes.get(result.newNodeId);
      expect(newNode!.parentId).toBe('node-1');
      
      const parentNode = nodes.get('node-1');
      expect(parentNode!.children).toContain(result.newNodeId);
    });
    
    it('should handle root node branching (no parent)', async () => {
      // node-1 already has parentId: null, so it's a root node
      const result = await service.createBranchFromEdit(
        'node-1' as NodeId,
        'block-1' as BlockId,
        'Updated root prompt',
        EditSource.NODE_BLOCK_DIRECT
      );
      
      const newNode = nodes.get(result.newNodeId);
      expect(newNode!.parentId).toBeNull();
    });
  });
  
  describe('copyNodeWithoutChildren', () => {
    it('should create deep copy of all blocks', () => {
      const copy = service.copyNodeWithoutChildren('node-1' as NodeId);
      
      expect(copy.id).not.toBe('node-1');
      expect(copy.blocks.length).toBe(3);
      expect(copy.children).toEqual([]);
      expect(copy.position).toEqual({ x: 0, y: 0 });
      expect(copy.name).toBe('Test Node (branch)');
      
      // Verify blocks are deep copied
      copy.blocks[0]!.content = 'Modified';
      const original = nodes.get('node-1')!;
      expect(original.blocks[0]!.content).toBe('Original prompt');
    });
    
    it('should generate unique IDs for blocks', () => {
      const copy = service.copyNodeWithoutChildren('node-1' as NodeId);
      const original = nodes.get('node-1')!;
      
      expect(copy.blocks[0]!.id).not.toBe(original.blocks[0]!.id);
      expect(copy.blocks[1]!.id).not.toBe(original.blocks[1]!.id);
      expect(copy.blocks[2]!.id).not.toBe(original.blocks[2]!.id);
    });
    
    it('should preserve block order and content', () => {
      const copy = service.copyNodeWithoutChildren('node-1' as NodeId);
      
      expect(copy.blocks[0]!.type).toBe('prompt');
      expect(copy.blocks[0]!.content).toBe('Original prompt');
      expect(copy.blocks[1]!.type).toBe('response');
      expect(copy.blocks[1]!.content).toBe('Original response');
      expect(copy.blocks[2]!.type).toBe('markdown');
      expect(copy.blocks[2]!.content).toBe('Original markdown');
    });
    
    it('should throw error for non-existent node', () => {
      expect(() => 
        service.copyNodeWithoutChildren('invalid-node' as NodeId)
      ).toThrow(ValidationError);
    });
    
    // Skip test for optional properties since they don't exist in GraphNode interface
  });
  
  describe('getBranchHistory', () => {
    it('should return empty array for nodes without history', () => {
      const history = service.getBranchHistory('node-1' as NodeId);
      expect(history).toEqual([]);
    });
    
    it('should return branch history after creating branches', async () => {
      // Create a branch
      const result = await service.createBranchFromEdit(
        'node-1' as NodeId,
        'block-1' as BlockId,
        'First edit',
        EditSource.NODE_BLOCK_DIRECT
      );
      
      // Check history for new node
      const newNodeHistory = service.getBranchHistory((result.newNodeId));
      expect(newNodeHistory.length).toBe(1);
      expect(newNodeHistory[0]!.originalNodeId).toBe('node-1' as NodeId);
      
      // Check history for original node (should also have the branch recorded)
      const originalNodeHistory = service.getBranchHistory('node-1' as NodeId);
      expect(originalNodeHistory.length).toBe(1);
      expect(originalNodeHistory[0]).toEqual(newNodeHistory[0]);
    });
    
    it('should return immutable history array', () => {
      const history = service.getBranchHistory('node-1' as NodeId);
      expect(() => {
        (history as any).push({} as any);
      }).toThrow();
    });
  });
  
  describe('error handling', () => {
    it('should handle concurrent branching operations', async () => {
      // Create multiple branches concurrently
      const promises = [
        service.createBranchFromEdit(
          'node-1' as NodeId,
          'block-1' as BlockId,
          'Edit 1',
          EditSource.NODE_BLOCK_DIRECT
        ),
        service.createBranchFromEdit(
          'node-1' as NodeId,
          'block-2' as BlockId,
          'Edit 2',
          EditSource.CHAT_INTERFACE
        )
      ];
      
      const results = await Promise.all(promises);
      
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(true);
      expect(results[0]!.newNodeId).not.toBe(results[1]!.newNodeId);
      
      // Both new nodes should exist
      expect(nodes.get(results[0]!.newNodeId)).toBeDefined();
      expect(nodes.get(results[1]!.newNodeId)).toBeDefined();
    });
    
    it('should handle empty content edit', async () => {
      const result = await service.createBranchFromEdit(
        'node-1' as NodeId,
        'block-1' as BlockId,
        '',
        EditSource.NODE_BLOCK_DIRECT
      );
      
      expect(result.success).toBe(true);
      const newNode = nodes.get(result.newNodeId);
      expect(newNode!.blocks[0]!.content).toBe('');
    });
    
    it('should handle large content edit', async () => {
      const largeContent = 'x'.repeat(10000);
      const result = await service.createBranchFromEdit(
        'node-1' as NodeId,
        'block-1' as BlockId,
        largeContent,
        EditSource.NODE_BLOCK_DIRECT
      );
      
      expect(result.success).toBe(true);
      const newNode = nodes.get(result.newNodeId);
      expect(newNode!.blocks[0]!.content).toBe(largeContent);
    });
  });
});