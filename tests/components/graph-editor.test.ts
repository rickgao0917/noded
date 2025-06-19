/**
 * Comprehensive test suite for GraphEditor component
 * 
 * Tests the main application class with comprehensive coverage of all
 * functionality including DOM manipulation, node management, tree operations,
 * chat interfaces, and API integration.
 */

import { GraphEditor } from '../../src/components/graph-editor';
import { createMockNode, createMockBlock, mockPerformance } from '../setup';
import { GraphNode, NodeBlock, Position } from '../../src/types/graph.types';

// Mock the fetch API for Gemini integration tests
global.fetch = jest.fn();

describe('GraphEditor Component', () => {
  let editor: GraphEditor;
  let mockCanvas: HTMLElement;
  let mockCanvasContent: HTMLElement;
  let mockConnections: SVGElement;

  beforeEach(() => {
    // Create mock DOM elements
    mockCanvas = document.createElement('div');
    mockCanvas.id = 'canvas';
    mockCanvasContent = document.createElement('div');
    mockCanvasContent.id = 'canvasContent';
    mockConnections = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mockConnections.id = 'connections';

    // Add elements to DOM
    document.body.appendChild(mockCanvas);
    document.body.appendChild(mockCanvasContent);
    document.body.appendChild(mockConnections);

    // Initialize GraphEditor
    editor = new GraphEditor();

    // Clear fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with empty nodes map', () => {
      expect(editor.getNodes().size).toBe(0);
    });

    it('should initialize with default canvas state', () => {
      const state = editor.getCanvasState();
      expect(state.selectedNodeId).toBeNull();
      expect(state.canvasOffset).toEqual({ x: 0, y: 0 });
      expect(state.zoom).toBe(1);
    });

    it('should initialize with empty chat and loading states', () => {
      // Access private properties for testing
      const chatStates = (editor as any).chatStates;
      const loadingStates = (editor as any).loadingStates;
      
      expect(chatStates.size).toBe(0);
      expect(loadingStates.size).toBe(0);
    });
  });

  describe('Node Management', () => {
    describe('createNode', () => {
      it('should create a root node with default position', () => {
        const nodeId = editor.createNode();
        
        expect(nodeId).toBeDefined();
        expect(typeof nodeId).toBe('string');
        
        const node = editor.getNode(nodeId);
        expect(node).toBeDefined();
        expect(node!.parentId).toBeNull();
        expect(node!.depth).toBe(0);
        expect(node!.children).toEqual([]);
        expect(node!.blocks).toHaveLength(1);
        expect(node!.blocks[0].type).toBe('chat');
      });

      it('should create a child node with specified parent', () => {
        const parentId = editor.createNode();
        const childId = editor.createNode(parentId);
        
        const parent = editor.getNode(parentId)!;
        const child = editor.getNode(childId)!;
        
        expect(child.parentId).toBe(parentId);
        expect(child.depth).toBe(1);
        expect(parent.children).toContain(childId);
      });

      it('should create node with custom position', () => {
        const position: Position = { x: 100, y: 200 };
        const nodeId = editor.createNode(null, position);
        
        const node = editor.getNode(nodeId)!;
        expect(node.position).toEqual(position);
      });

      it('should create node with custom name', () => {
        const name = 'Custom Node Name';
        const nodeId = editor.createNode(null, undefined, name);
        
        const node = editor.getNode(nodeId)!;
        expect(node.name).toBe(name);
      });

      it('should throw error for invalid parent ID', () => {
        expect(() => {
          editor.createNode('non-existent-parent');
        }).toThrow();
      });
    });

    describe('deleteNode', () => {
      it('should delete a single node', () => {
        const nodeId = editor.createNode();
        
        expect(editor.getNode(nodeId)).toBeDefined();
        
        editor.deleteNode(nodeId);
        
        expect(editor.getNode(nodeId)).toBeUndefined();
        expect(editor.getNodes().size).toBe(0);
      });

      it('should delete node and all descendants', () => {
        const rootId = editor.createNode();
        const child1Id = editor.createNode(rootId);
        const child2Id = editor.createNode(rootId);
        const grandchildId = editor.createNode(child1Id);
        
        expect(editor.getNodes().size).toBe(4);
        
        editor.deleteNode(rootId);
        
        expect(editor.getNodes().size).toBe(0);
      });

      it('should update parent children array when deleting child', () => {
        const parentId = editor.createNode();
        const child1Id = editor.createNode(parentId);
        const child2Id = editor.createNode(parentId);
        
        const parent = editor.getNode(parentId)!;
        expect(parent.children).toEqual([child1Id, child2Id]);
        
        editor.deleteNode(child1Id);
        
        const updatedParent = editor.getNode(parentId)!;
        expect(updatedParent.children).toEqual([child2Id]);
      });

      it('should throw error for non-existent node', () => {
        expect(() => {
          editor.deleteNode('non-existent-node');
        }).toThrow();
      });
    });

    describe('moveNode', () => {
      it('should update node position', () => {
        const nodeId = editor.createNode();
        const newPosition: Position = { x: 150, y: 250 };
        
        editor.moveNode(nodeId, newPosition);
        
        const node = editor.getNode(nodeId)!;
        expect(node.position).toEqual(newPosition);
      });

      it('should throw error for invalid position', () => {
        const nodeId = editor.createNode();
        
        expect(() => {
          editor.moveNode(nodeId, { x: NaN, y: 0 });
        }).toThrow();
      });

      it('should throw error for non-existent node', () => {
        expect(() => {
          editor.moveNode('non-existent', { x: 0, y: 0 });
        }).toThrow();
      });
    });
  });

  describe('Block Management', () => {
    let nodeId: string;

    beforeEach(() => {
      nodeId = editor.createNode();
    });

    describe('addBlock', () => {
      it('should add markdown block to node', () => {
        const blockId = editor.addBlock(nodeId, 'markdown', 'Test markdown content');
        
        const node = editor.getNode(nodeId)!;
        expect(node.blocks).toHaveLength(2); // Initial chat block + new markdown block
        
        const block = node.blocks.find(b => b.id === blockId);
        expect(block).toBeDefined();
        expect(block!.type).toBe('markdown');
        expect(block!.content).toBe('Test markdown content');
      });

      it('should add block with correct position', () => {
        const block1Id = editor.addBlock(nodeId, 'markdown', 'Block 1');
        const block2Id = editor.addBlock(nodeId, 'response', 'Block 2');
        
        const node = editor.getNode(nodeId)!;
        const block1 = node.blocks.find(b => b.id === block1Id)!;
        const block2 = node.blocks.find(b => b.id === block2Id)!;
        
        expect(block1.position).toBe(1); // After initial chat block (position 0)
        expect(block2.position).toBe(2);
      });

      it('should throw error for non-existent node', () => {
        expect(() => {
          editor.addBlock('non-existent', 'markdown', 'content');
        }).toThrow();
      });
    });

    describe('deleteBlock', () => {
      it('should delete specified block', () => {
        const blockId = editor.addBlock(nodeId, 'markdown', 'Test content');
        
        const nodeBefore = editor.getNode(nodeId)!;
        expect(nodeBefore.blocks).toHaveLength(2);
        
        editor.deleteBlock(nodeId, blockId);
        
        const nodeAfter = editor.getNode(nodeId)!;
        expect(nodeAfter.blocks).toHaveLength(1);
        expect(nodeAfter.blocks.find(b => b.id === blockId)).toBeUndefined();
      });

      it('should reorder remaining block positions', () => {
        const block1Id = editor.addBlock(nodeId, 'markdown', 'Block 1');
        const block2Id = editor.addBlock(nodeId, 'response', 'Block 2');
        const block3Id = editor.addBlock(nodeId, 'markdown', 'Block 3');
        
        // Delete middle block
        editor.deleteBlock(nodeId, block2Id);
        
        const node = editor.getNode(nodeId)!;
        const blocks = node.blocks.sort((a, b) => a.position - b.position);
        
        expect(blocks).toHaveLength(3); // Initial + 2 remaining
        expect(blocks[0].position).toBe(0); // Initial chat block
        expect(blocks[1].position).toBe(1); // block1
        expect(blocks[2].position).toBe(2); // block3 (reordered from 3 to 2)
      });

      it('should throw error for non-existent block', () => {
        expect(() => {
          editor.deleteBlock(nodeId, 'non-existent-block');
        }).toThrow();
      });
    });

    describe('updateBlockContent', () => {
      it('should update block content', () => {
        const blockId = editor.addBlock(nodeId, 'markdown', 'Original content');
        const newContent = 'Updated content';
        
        editor.updateBlockContent(nodeId, blockId, newContent);
        
        const node = editor.getNode(nodeId)!;
        const block = node.blocks.find(b => b.id === blockId)!;
        expect(block.content).toBe(newContent);
      });

      it('should throw error for non-existent block', () => {
        expect(() => {
          editor.updateBlockContent(nodeId, 'non-existent-block', 'content');
        }).toThrow();
      });
    });
  });

  describe('Chat Interface Methods', () => {
    let nodeId: string;

    beforeEach(() => {
      nodeId = editor.createNode();
    });

    describe('showLoadingIndicator', () => {
      it('should set loading state for node', () => {
        editor.showLoadingIndicator(nodeId);
        
        const loadingStates = (editor as any).loadingStates;
        const state = loadingStates.get(nodeId);
        
        expect(state).toBeDefined();
        expect(state.isLoading).toBe(true);
        expect(state.nodeId).toBe(nodeId);
      });

      it('should update existing loading state', () => {
        editor.showLoadingIndicator(nodeId);
        const firstTime = Date.now();
        
        // Wait a bit and update again
        setTimeout(() => {
          editor.showLoadingIndicator(nodeId);
          
          const loadingStates = (editor as any).loadingStates;
          const state = loadingStates.get(nodeId);
          
          expect(state.lastUpdated).toBeGreaterThan(firstTime);
        }, 10);
      });
    });

    describe('hideLoadingIndicator', () => {
      it('should remove loading state for node', () => {
        editor.showLoadingIndicator(nodeId);
        
        const loadingStates = (editor as any).loadingStates;
        expect(loadingStates.has(nodeId)).toBe(true);
        
        editor.hideLoadingIndicator(nodeId);
        
        expect(loadingStates.has(nodeId)).toBe(false);
      });

      it('should handle hiding non-existent loading state gracefully', () => {
        expect(() => {
          editor.hideLoadingIndicator(nodeId);
        }).not.toThrow();
      });
    });

    describe('addInlineChatContinuation', () => {
      it('should create chat continuation state', () => {
        editor.addInlineChatContinuation(nodeId);
        
        const chatStates = (editor as any).chatStates;
        const state = chatStates.get(nodeId);
        
        expect(state).toBeDefined();
        expect(state.nodeId).toBe(nodeId);
        expect(state.isExpanded).toBe(false);
        expect(state.isLoading).toBe(false);
        expect(state.hasError).toBe(false);
      });

      it('should not overwrite existing chat state', () => {
        // Create initial state
        editor.addInlineChatContinuation(nodeId);
        const chatStates = (editor as any).chatStates;
        const initialState = chatStates.get(nodeId);
        const initialTime = initialState.lastUpdated;
        
        // Try to add again
        editor.addInlineChatContinuation(nodeId);
        const finalState = chatStates.get(nodeId);
        
        expect(finalState.lastUpdated).toBe(initialTime);
      });
    });

    describe('expandChatContinuation', () => {
      it('should expand existing chat continuation', () => {
        editor.addInlineChatContinuation(nodeId);
        editor.expandChatContinuation(nodeId);
        
        const chatStates = (editor as any).chatStates;
        const state = chatStates.get(nodeId);
        
        expect(state.isExpanded).toBe(true);
      });

      it('should create and expand chat continuation if not exists', () => {
        editor.expandChatContinuation(nodeId);
        
        const chatStates = (editor as any).chatStates;
        const state = chatStates.get(nodeId);
        
        expect(state).toBeDefined();
        expect(state.isExpanded).toBe(true);
      });
    });

    describe('collapseChatContinuation', () => {
      it('should collapse expanded chat continuation', () => {
        editor.addInlineChatContinuation(nodeId);
        editor.expandChatContinuation(nodeId);
        editor.collapseChatContinuation(nodeId);
        
        const chatStates = (editor as any).chatStates;
        const state = chatStates.get(nodeId);
        
        expect(state.isExpanded).toBe(false);
      });

      it('should handle collapsing non-existent state gracefully', () => {
        expect(() => {
          editor.collapseChatContinuation(nodeId);
        }).not.toThrow();
      });
    });
  });

  describe('Gemini API Integration', () => {
    let nodeId: string;

    beforeEach(() => {
      nodeId = editor.createNode();
      // Add some content to the chat block
      const node = editor.getNode(nodeId)!;
      editor.updateBlockContent(nodeId, node.blocks[0].id, 'Test chat message');
    });

    describe('submitToGemini', () => {
      it('should make API call with correct payload', async () => {
        const mockResponse = {
          ok: true,
          json: async () => ({
            content: 'Gemini response content'
          })
        };
        (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

        await (editor as any).submitToGemini(nodeId);

        expect(global.fetch).toHaveBeenCalledWith('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"nodeId"')
        });
      });

      it('should add response block with API response content', async () => {
        const responseContent = 'This is the Gemini response';
        const mockResponse = {
          ok: true,
          json: async () => ({
            content: responseContent
          })
        };
        (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

        await (editor as any).submitToGemini(nodeId);

        const node = editor.getNode(nodeId)!;
        const responseBlocks = node.blocks.filter(b => b.type === 'response');
        
        expect(responseBlocks).toHaveLength(1);
        expect(responseBlocks[0].content).toBe(responseContent);
      });

      it('should handle API errors gracefully', async () => {
        const mockResponse = {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        };
        (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

        const result = await (editor as any).submitToGemini(nodeId);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle network errors', async () => {
        (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

        const result = await (editor as any).submitToGemini(nodeId);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Network error');
      });

      it('should show loading indicator during API call', async () => {
        const mockResponse = {
          ok: true,
          json: async () => ({ content: 'Response' })
        };
        (global.fetch as jest.Mock).mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
        );

        const submitPromise = (editor as any).submitToGemini(nodeId);
        
        // Check loading state is active
        const loadingStates = (editor as any).loadingStates;
        expect(loadingStates.has(nodeId)).toBe(true);
        
        await submitPromise;
        
        // Check loading state is cleared
        expect(loadingStates.has(nodeId)).toBe(false);
      });
    });
  });

  describe('Tree Layout and Rendering', () => {
    describe('calculateTreeLayout', () => {
      it('should position root node at origin', () => {
        const rootId = editor.createNode();
        
        editor.calculateTreeLayout();
        
        const root = editor.getNode(rootId)!;
        expect(root.position.x).toBeGreaterThanOrEqual(0);
        expect(root.position.y).toBeGreaterThanOrEqual(0);
      });

      it('should position child nodes below parent', () => {
        const rootId = editor.createNode();
        const childId = editor.createNode(rootId);
        
        editor.calculateTreeLayout();
        
        const root = editor.getNode(rootId)!;
        const child = editor.getNode(childId)!;
        
        expect(child.position.y).toBeGreaterThan(root.position.y);
      });

      it('should space sibling nodes horizontally', () => {
        const rootId = editor.createNode();
        const child1Id = editor.createNode(rootId);
        const child2Id = editor.createNode(rootId);
        
        editor.calculateTreeLayout();
        
        const child1 = editor.getNode(child1Id)!;
        const child2 = editor.getNode(child2Id)!;
        
        expect(Math.abs(child1.position.x - child2.position.x)).toBeGreaterThan(0);
      });
    });

    describe('renderConnections', () => {
      it('should create SVG paths for parent-child relationships', () => {
        const rootId = editor.createNode();
        const childId = editor.createNode(rootId);
        
        editor.renderConnections();
        
        const svg = document.getElementById('connections') as SVGElement;
        const paths = svg.querySelectorAll('path');
        
        expect(paths.length).toBeGreaterThan(0);
      });

      it('should handle nodes without children', () => {
        const rootId = editor.createNode();
        
        expect(() => {
          editor.renderConnections();
        }).not.toThrow();
      });
    });
  });

  describe('Canvas Operations', () => {
    describe('panCanvas', () => {
      it('should update canvas offset', () => {
        const deltaX = 50;
        const deltaY = 30;
        
        editor.panCanvas(deltaX, deltaY);
        
        const state = editor.getCanvasState();
        expect(state.canvasOffset.x).toBe(deltaX);
        expect(state.canvasOffset.y).toBe(deltaY);
      });

      it('should accumulate pan deltas', () => {
        editor.panCanvas(10, 20);
        editor.panCanvas(5, 10);
        
        const state = editor.getCanvasState();
        expect(state.canvasOffset.x).toBe(15);
        expect(state.canvasOffset.y).toBe(30);
      });
    });

    describe('setZoom', () => {
      it('should update zoom level within bounds', () => {
        editor.setZoom(1.5);
        
        const state = editor.getCanvasState();
        expect(state.zoom).toBe(1.5);
      });

      it('should clamp zoom to minimum value', () => {
        editor.setZoom(0.05); // Below minimum
        
        const state = editor.getCanvasState();
        expect(state.zoom).toBe(0.1); // Clamped to minimum
      });

      it('should clamp zoom to maximum value', () => {
        editor.setZoom(10); // Above maximum
        
        const state = editor.getCanvasState();
        expect(state.zoom).toBe(5); // Clamped to maximum
      });
    });

    describe('resetView', () => {
      it('should reset canvas offset and zoom', () => {
        editor.panCanvas(100, 200);
        editor.setZoom(2);
        
        editor.resetView();
        
        const state = editor.getCanvasState();
        expect(state.canvasOffset).toEqual({ x: 0, y: 0 });
        expect(state.zoom).toBe(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should validate node IDs in all operations', () => {
      expect(() => editor.getNode('invalid-id')).not.toThrow(); // Should return undefined
      expect(() => editor.deleteNode('invalid-id')).toThrow();
      expect(() => editor.moveNode('invalid-id', { x: 0, y: 0 })).toThrow();
      expect(() => editor.addBlock('invalid-id', 'markdown', 'content')).toThrow();
    });

    it('should validate positions', () => {
      const nodeId = editor.createNode();
      
      expect(() => {
        editor.moveNode(nodeId, { x: NaN, y: 0 });
      }).toThrow();
      
      expect(() => {
        editor.moveNode(nodeId, { x: Infinity, y: 0 });
      }).toThrow();
    });

    it('should maintain tree integrity after operations', () => {
      const rootId = editor.createNode();
      const child1Id = editor.createNode(rootId);
      const child2Id = editor.createNode(rootId);
      const grandchildId = editor.createNode(child1Id);
      
      // Verify tree structure
      const root = editor.getNode(rootId)!;
      const child1 = editor.getNode(child1Id)!;
      
      expect(root.children).toContain(child1Id);
      expect(root.children).toContain(child2Id);
      expect(child1.children).toContain(grandchildId);
      
      const grandchild = editor.getNode(grandchildId)!;
      expect(grandchild.parentId).toBe(child1Id);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track operation execution times', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Perform some operations
      const nodeId = editor.createNode();
      editor.addBlock(nodeId, 'markdown', 'Test content');
      
      // Verify performance logging occurred
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"TRACE"')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"executionTime"')
      );
      
      consoleSpy.mockRestore();
    });
  });
});