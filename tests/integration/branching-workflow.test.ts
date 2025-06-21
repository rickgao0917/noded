/**
 * Integration tests for the branching workflow
 * Tests end-to-end branching scenarios across GraphEditor and ChatInterface
 */

import { GraphEditor } from '../../src/components/graph-editor';
import { ChatInterface } from '../../src/components/chat-interface';
import { NodeBranchingService } from '../../src/services/node-branching-service';
import { BlockSizeManager } from '../../src/services/block-size-manager';
import { VersionHistoryManager } from '../../src/services/version-history-manager';
import { EditSource, BranchReason } from '../../src/types/branching.types';
import { NodeId, BlockId } from '../../src/types/branded.types';
import { GraphNode } from '../../src/types/graph.types';
import { originalConsole } from '../setup';

// Mock DOM elements
const createMockElement = (tagName: string, id?: string): HTMLElement => {
  const element = document.createElement(tagName);
  if (id) element.id = id;
  return element;
};

const createMockSVGElement = (): SVGElement => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGElement;
  if (!svg || typeof svg.appendChild !== 'function') {
    // Fallback for test environment - create a mock element with SVG-like methods
    const mockSvg = document.createElement('div') as any;
    mockSvg.appendChild = jest.fn();
    mockSvg.removeChild = jest.fn();
    mockSvg.setAttribute = jest.fn();
    // firstChild is read-only, so we'll just use the existing one
    return mockSvg as SVGElement;
  }
  return svg;
};

describe('Branching Workflow Integration', () => {
  let canvas: HTMLElement;
  let canvasContent: HTMLElement;
  let connections: SVGElement;
  let editorContainer: HTMLElement;
  let graphEditor: GraphEditor;
  let chatInterface: ChatInterface;
  
  beforeEach(() => {
    // Set up DOM structure
    document.body.innerHTML = '';
    
    canvas = createMockElement('div', 'canvas');
    canvasContent = createMockElement('div', 'canvasContent');
    connections = createMockSVGElement();
    connections.id = 'connections';
    editorContainer = createMockElement('div', 'editor-container');
    
    canvas.appendChild(canvasContent);
    canvas.appendChild(connections);
    document.body.appendChild(canvas);
    document.body.appendChild(editorContainer);
    
    // Create instances
    graphEditor = new GraphEditor(canvas, canvasContent, connections, false);
    chatInterface = new ChatInterface(editorContainer, graphEditor);
    graphEditor.setChatInterface(chatInterface);
    
    // Mock DOM-related methods to avoid errors in tests
    jest.spyOn(graphEditor as any, 'updateConnections').mockImplementation(() => {
      // Do nothing in tests
    });
    
    jest.spyOn(graphEditor as any, 'renderNode').mockImplementation(() => {
      // Do nothing in tests
    });
    
    // Add initial node with blocks
    graphEditor.addRootNode();
    const rootId = Array.from(graphEditor['nodes'].keys())[0]!;
    
    // The root node should already have a prompt block by default
    // Let's add a response block
    graphEditor.addBlock(rootId, 'response', 'Initial response content');
    
    // Add a markdown block
    graphEditor.addBlock(rootId, 'markdown', '# Initial markdown');
  });
  
  afterEach(() => {
    document.body.innerHTML = '';
  });
  
  describe('End-to-end branching from node blocks', () => {
    it('should create branch when editing prompt block directly', async () => {
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      const rootNode = graphEditor.getNode(rootId!);
      const promptBlock = rootNode?.blocks.find(b => b.type === 'prompt');
      
      expect(promptBlock).toBeDefined();
      
      // Edit the prompt content
      await graphEditor.updateBlockContent(rootId!, promptBlock!.id, 'Edited prompt content');
      
      // Verify a new branch was created
      const allNodes = Array.from(graphEditor['nodes'].values());
      expect(allNodes.length).toBe(2); // Root + new branch
      
      // Find the new branch
      const branchNode = allNodes.find(n => n.id !== rootId);
      expect(branchNode).toBeDefined();
      expect(branchNode!.blocks.length).toBe(rootNode!.blocks.length);
      
      // Verify the edited content
      const branchPromptBlock = branchNode!.blocks.find(b => b.type === 'prompt');
      expect(branchPromptBlock?.content).toBe('Edited prompt content');
      
      // Verify other blocks remain unchanged
      const branchResponseBlock = branchNode!.blocks.find(b => b.type === 'response');
      expect(branchResponseBlock?.content).toBe('Initial response content');
    });
    
    it('should create branch when editing response block', async () => {
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      const rootNode = graphEditor.getNode(rootId!);
      const responseBlock = rootNode?.blocks.find(b => b.type === 'response');
      
      expect(responseBlock).toBeDefined();
      
      // Edit the response content
      await graphEditor.updateBlockContent(rootId!, responseBlock!.id, 'Edited response content');
      
      // Verify branch was created
      const allNodes = Array.from(graphEditor['nodes'].values());
      const branchNode = allNodes.find(n => n.id !== rootId);
      
      expect(branchNode).toBeDefined();
      const branchResponseBlock = branchNode!.blocks.find(b => b.type === 'response');
      expect(branchResponseBlock?.content).toBe('Edited response content');
    });
    
    it('should NOT create branch when editing markdown block', async () => {
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      const rootNode = graphEditor.getNode(rootId!);
      const markdownBlock = rootNode?.blocks.find(b => b.type === 'markdown');
      
      expect(markdownBlock).toBeDefined();
      
      // Edit the markdown content
      await graphEditor.updateBlockContent(rootId!, markdownBlock!.id, '# Edited markdown');
      
      // Verify NO new branch was created
      const allNodes = Array.from(graphEditor['nodes'].values());
      expect(allNodes.length).toBe(1); // Only root node
      
      // Verify content was updated in place
      expect(markdownBlock!.content).toBe('# Edited markdown');
    });
  });
  
  describe('End-to-end branching from chat interface', () => {
    it('should create branch when editing prompt from chat', async () => {
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      
      // Open chat for the node
      await chatInterface.openChatForNode(rootId!);
      
      // Simulate editing a prompt message
      const branchingService = graphEditor.getBranchingService();
      const rootNode = graphEditor.getNode(rootId!);
      const promptBlock = rootNode?.blocks.find(b => b.type === 'prompt');
      
      const result = await branchingService.createBranchFromEdit(
        rootId! as NodeId,
        promptBlock!.id as BlockId,
        'Chat-edited prompt',
        EditSource.CHAT_INTERFACE
      );
      
      expect(result.success).toBe(true);
      expect(result.branchMetadata.branchReason).toBe(BranchReason.PROMPT_EDIT);
      
      // Verify the branch exists
      const branchNode = graphEditor.getNode(result.newNodeId);
      expect(branchNode).toBeDefined();
      expect(branchNode!.blocks.find(b => b.type === 'prompt')?.content).toBe('Chat-edited prompt');
    });
    
    it.skip('should maintain conversation thread after branching', async () => {
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      
      // Create initial conversation
      const childId = graphEditor.addChild(rootId!);
      const childNode = graphEditor.getNode(childId);
      if (childNode) {
        childNode.blocks = [
          { id: 'child-prompt' as BlockId, type: 'prompt', content: 'Follow-up question', position: 0 },
          { id: 'child-response' as BlockId, type: 'response', content: 'Follow-up answer', position: 1 }
        ];
      }
      
      // Create branch from root
      const branchingService = graphEditor.getBranchingService();
      const rootNode = graphEditor.getNode(rootId!);
      const promptBlock = rootNode?.blocks.find(b => b.type === 'prompt');
      
      const result = await branchingService.createBranchFromEdit(
        rootId! as NodeId,
        promptBlock!.id as BlockId,
        'Branched prompt',
        EditSource.CHAT_INTERFACE
      );
      
      // Verify branch is created as sibling to root
      const branchNode = graphEditor.getNode(result.newNodeId);
      expect(branchNode).toBeDefined();
      expect(branchNode!.children).toEqual([]); // Branch starts fresh
      
      // Verify original conversation thread remains intact
      expect(rootNode!.children).toContain(childId);
    });
  });
  
  describe('Size consistency during preview toggle', () => {
    it('should maintain block size when toggling preview mode', async () => {
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      const rootNode = graphEditor.getNode(rootId!);
      const responseBlock = rootNode?.blocks.find(b => b.type === 'response');
      
      // Mock block element
      const blockElement = document.createElement('div');
      blockElement.id = responseBlock!.id;
      blockElement.style.height = '200px';
      blockElement.style.width = '400px';
      Object.defineProperty(blockElement, 'offsetHeight', {
        value: 200,
        configurable: true
      });
      Object.defineProperty(blockElement, 'offsetWidth', {
        value: 400,
        configurable: true
      });
      document.body.appendChild(blockElement);
      
      // Get block size manager
      const blockSizeManager = graphEditor['blockSizeManager'];
      
      // Preserve size before toggle
      blockSizeManager.preserveBlockSize(responseBlock!.id as BlockId, 'rendered');
      
      // Verify size is locked
      expect(blockElement.style.height).toBe('200px');
      expect(blockElement.style.minHeight).toBe('200px');
      
      // Verify size constraints are cached
      const constraints = blockSizeManager.getSizeConstraints(responseBlock!.id as BlockId);
      expect(constraints.height).toBe(200);
      expect(constraints.width).toBe(400);
    });
    
    it('should maintain size consistency for markdown blocks', async () => {
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      const rootNode = graphEditor.getNode(rootId!);
      const markdownBlock = rootNode?.blocks.find(b => b.type === 'markdown');
      
      // Mock block element
      const blockElement = document.createElement('div');
      blockElement.id = markdownBlock!.id;
      blockElement.style.height = '150px';
      Object.defineProperty(blockElement, 'offsetHeight', {
        value: 150,
        configurable: true
      });
      document.body.appendChild(blockElement);
      
      const blockSizeManager = graphEditor['blockSizeManager'];
      
      // Preserve size
      blockSizeManager.preserveBlockSize(markdownBlock!.id as BlockId, 'raw');
      
      // Verify size is maintained
      expect(blockElement.style.height).toBe('150px');
    });
  });
  
  describe('Version history tracking', () => {
    it.skip('should record branch history for all operations', async () => {
      const versionHistoryManager = graphEditor.getVersionHistoryManager();
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      const rootNode = graphEditor.getNode(rootId!);
      
      // Create multiple branches
      const promptBlock = rootNode?.blocks.find(b => b.type === 'prompt');
      const responseBlock = rootNode?.blocks.find(b => b.type === 'response');
      
      // Branch 1: Edit prompt
      await graphEditor.updateBlockContent(rootId!, promptBlock!.id, 'Edit 1');
      
      // Branch 2: Edit response  
      await graphEditor.updateBlockContent(rootId!, responseBlock!.id, 'Edit 2');
      
      // Check version history
      const history = versionHistoryManager.getVersionChain(rootId! as NodeId);
      expect(history.length).toBe(2);
      
      // Verify branch metadata
      expect(history[0]!.branchReason).toBe(BranchReason.PROMPT_EDIT);
      expect(history[1]!.branchReason).toBe(BranchReason.RESPONSE_EDIT);
      
      // Get all branches from root
      const branches = versionHistoryManager.getBranches(rootId! as NodeId);
      expect(branches.length).toBe(2);
    });
    
    it.skip('should track complete version chain across multiple generations', async () => {
      const versionHistoryManager = graphEditor.getVersionHistoryManager();
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      const rootNode = graphEditor.getNode(rootId!);
      const promptBlock = rootNode?.blocks.find(b => b.type === 'prompt');
      
      // Create first generation branch
      await graphEditor.updateBlockContent(rootId!, promptBlock!.id, 'Generation 1');
      
      const gen1Nodes = Array.from(graphEditor['nodes'].values()).filter(n => n.id !== rootId);
      const gen1Node = gen1Nodes[0];
      expect(gen1Node).toBeDefined();
      
      // Create second generation branch from first generation
      const gen1PromptBlock = gen1Node!.blocks.find(b => b.type === 'prompt');
      await graphEditor.updateBlockContent(gen1Node!.id, gen1PromptBlock!.id, 'Generation 2');
      
      // Verify version chains
      const rootHistory = versionHistoryManager.getVersionChain(rootId! as NodeId);
      expect(rootHistory.length).toBe(1);
      
      const gen1History = versionHistoryManager.getVersionChain(gen1Node!.id as NodeId);
      expect(gen1History.length).toBe(2); // Its own creation + branch from it
    });
  });
  
  describe('Edge cases and error handling', () => {
    it('should handle concurrent edits gracefully', async () => {
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      const rootNode = graphEditor.getNode(rootId!);
      const promptBlock = rootNode?.blocks.find(b => b.type === 'prompt');
      const responseBlock = rootNode?.blocks.find(b => b.type === 'response');
      
      // Trigger concurrent edits
      const promises = [
        graphEditor.updateBlockContent(rootId!, promptBlock!.id, 'Concurrent edit 1'),
        graphEditor.updateBlockContent(rootId!, responseBlock!.id, 'Concurrent edit 2')
      ];
      
      await Promise.all(promises);
      
      // Should have created 2 branches
      const allNodes = Array.from(graphEditor['nodes'].values());
      expect(allNodes.length).toBe(3); // Root + 2 branches
    });
    
    it('should handle empty content edits', async () => {
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      const rootNode = graphEditor.getNode(rootId!);
      const promptBlock = rootNode?.blocks.find(b => b.type === 'prompt');
      
      // Edit with empty content
      await graphEditor.updateBlockContent(rootId!, promptBlock!.id, '');
      
      // Should still create branch
      const allNodes = Array.from(graphEditor['nodes'].values());
      expect(allNodes.length).toBe(2);
      
      const branchNode = allNodes.find(n => n.id !== rootId);
      expect(branchNode!.blocks.find(b => b.type === 'prompt')?.content).toBe('');
    });
    
    it('should maintain tree integrity after multiple branches', async () => {
      const rootId = Array.from(graphEditor['nodes'].keys())[0];
      const rootNode = graphEditor.getNode(rootId!);
      const promptBlock = rootNode?.blocks.find(b => b.type === 'prompt');
      
      // Create multiple branches
      for (let i = 0; i < 5; i++) {
        await graphEditor.updateBlockContent(rootId!, promptBlock!.id, `Edit ${i}`);
      }
      
      // Verify all branches are siblings
      const allNodes = Array.from(graphEditor['nodes'].values());
      expect(allNodes.length).toBe(6); // Root + 5 branches
      
      // All branches should have no children
      const branches = allNodes.filter(n => n.id !== rootId);
      branches.forEach(branch => {
        expect(branch.children).toEqual([]);
      });
    });
  });
});