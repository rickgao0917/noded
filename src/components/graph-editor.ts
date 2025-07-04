/**
 * Graph Editor Component
 * 
 * Main component for managing interactive graph-based node editor with tree structure.
 * Handles DOM manipulation, event coordination, and tree layout calculation.
 * 
 * @example
 * ```typescript
 * const editor = new GraphEditor(canvasEl, contentEl, connectionsEl);
 * editor.addRootNode();
 * ```
 */

import { GraphNode, NodeBlock, Position } from '../types/graph.types.js';
import { Logger } from '../utils/logger.js';
import { Validator } from '../utils/type-guards.js';
import { ErrorFactory, NodeEditorError, TreeStructureError, ValidationError } from '../types/errors.js';
import { calculateTreeLayout } from '../utils/tree-layout.js';
import { geminiService } from '../services/gemini-service.js';
// import { LivePreviewManager } from '../services/live-preview-manager.js'; // Legacy - keeping for backward compatibility
import { PreviewToggleManager } from '../services/preview-toggle-manager.js';
import { MarkdownProcessor } from '../utils/markdown.js';
import type {
  InlineChatConfig
} from '../types/chat-interface.types.js';
import { NodeBranchingService } from '../services/node-branching-service.js';
import { BlockSizeManager } from '../services/block-size-manager.js';
import { VersionHistoryManager } from '../services/version-history-manager.js';
import { EditSource } from '../types/branching.types.js';
import { NodeId, BlockId } from '../types/branded.types.js';

// Mutable version of ChatContinuationState for internal state management
interface MutableChatContinuationState {
  nodeId: string;
  isExpanded: boolean;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  lastUpdated: number;
}

/**
 * Main graph editor class managing interactive node tree structure
 */
export class GraphEditor {
  private readonly logger: Logger;
  private readonly validator: Validator;
  private readonly errorFactory: ErrorFactory;
  // private readonly previewManager: LivePreviewManager; // Legacy - replaced by previewToggleManager
  private readonly previewToggleManager: PreviewToggleManager;
  private readonly branchingService: NodeBranchingService;
  private readonly blockSizeManager: BlockSizeManager;
  private readonly versionHistoryManager: VersionHistoryManager;
  
  // Node dimension constants (accounting for CSS max-width + padding + border)
  private readonly NODE_WIDTH = 436;  // max-width (400) + padding (32) + border (4)
  private readonly NODE_HEIGHT = 250; // Approximate height with content
  private readonly NODE_HALF_WIDTH = 218; // Half of NODE_WIDTH for centering
  
  private nodes: Map<string, GraphNode> = new Map();
  // Chat states and loading states are managed internally by components
  // private chatStates: Map<string, any> = new Map();
  // private loadingStates: Map<string, any> = new Map();
  private chatContinuationStates: Map<string, MutableChatContinuationState> = new Map();
  private selectedNode: GraphNode | null = null;
  private nodeCounter: number = 0;
  private scale: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private isDragging: boolean = false;
  private lastPanX: number = 0;
  private lastPanY: number = 0;
  
  // Read-only mode properties
  private isReadOnly: boolean = false;
  private shareInfo: { type: 'direct' | 'link'; owner: string } | null = null;
  
  private readonly chatConfig: InlineChatConfig = {
    maxLength: 2000,
    debounceMs: 300,
    autoExpandOnFocus: true,
    compactPlaceholder: 'Continue the conversation...',
    expandedPlaceholder: 'Type your follow-up question or request here...'
  };
  
  private readonly canvas: HTMLElement;
  private readonly canvasContent: HTMLElement;
  private readonly connectionsEl: SVGElement;
  private chatInterface: any | null = null; // Will be set after construction

  /**
   * Set the chat interface for double-click handling
   * 
   * @param chatInterface - The chat interface instance
   */
  public setChatInterface(chatInterface: any): void {
    this.chatInterface = chatInterface;
  }

  /**
   * Enable or disable read-only mode
   * 
   * @param readOnly - Whether to enable read-only mode
   * @param shareInfo - Optional share information (type and owner)
   */
  public setReadOnlyMode(
    readOnly: boolean, 
    shareInfo?: { type: 'direct' | 'link'; owner: string }
  ): void {
    this.logger.logFunctionEntry('setReadOnlyMode', { readOnly, shareInfo });
    
    this.isReadOnly = readOnly;
    this.shareInfo = shareInfo || null;
    
    if (readOnly) {
      // Add read-only class to canvas
      this.canvas?.classList.add('read-only');
      
      // Show read-only indicator
      this.showReadOnlyIndicator();
      
      // Disable all interactive elements
      this.disableEditingControls();
      
      // Update existing nodes to be read-only
      this.nodes.forEach(node => {
        this.updateNodeReadOnlyState(node.id);
      });
      
    } else {
      // Remove read-only mode
      this.canvas?.classList.remove('read-only');
      this.hideReadOnlyIndicator();
      this.enableEditingControls();
      
      // Update existing nodes to be editable
      this.nodes.forEach(node => {
        this.updateNodeEditableState(node.id);
      });
    }
    
    this.logger.logInfo('Read-only mode updated', 'setReadOnlyMode', {
      isReadOnly: this.isReadOnly,
      shareType: shareInfo?.type
    });
    
    this.logger.logFunctionExit('setReadOnlyMode', undefined);
  }

  /**
   * Get current read-only state
   * 
   * @returns Whether the editor is in read-only mode
   */
  public getIsReadOnly(): boolean {
    return this.isReadOnly;
  }

  /**
   * Initialize graph editor with DOM elements
   * 
   * @param canvas - Main canvas element for background interactions
   * @param canvasContent - Content container for transforms
   * @param connectionsEl - SVG element for rendering connections
   * @param initializeSampleData - Whether to create sample data (default: true)
   * 
   * @throws {DOMError} When required DOM elements are invalid
   * @throws {NodeEditorError} When initialization fails
   */
  constructor(canvas: HTMLElement, canvasContent: HTMLElement, connectionsEl: SVGElement, initializeSampleData: boolean = true) {
    const startTime = performance.now();
    
    this.logger = new Logger('GraphEditor');
    this.validator = new Validator('graph-editor-init');
    this.errorFactory = new ErrorFactory('graph-editor-init');
    // this.previewManager = new LivePreviewManager(); // Legacy - replaced by previewToggleManager
    this.previewToggleManager = new PreviewToggleManager(
      new MarkdownProcessor(),
      this.errorFactory
    );
    
    // Initialize branching services
    this.branchingService = new NodeBranchingService(this.nodes);
    this.blockSizeManager = new BlockSizeManager();
    this.versionHistoryManager = new VersionHistoryManager();
    
    this.logger.logFunctionEntry('constructor', {
      canvasTagName: canvas?.tagName,
      contentTagName: canvasContent?.tagName,
      connectionsTagName: connectionsEl?.tagName
    });

    try {
      // Validate DOM elements with comprehensive error handling
      this.validator.validateDOMElement<HTMLElement>(canvas, 'HTMLElement', 'constructor');
      this.validator.validateDOMElement<HTMLElement>(canvasContent, 'HTMLElement', 'constructor');
      this.validator.validateDOMElement<SVGElement>(connectionsEl, 'SVGElement', 'constructor');

      this.canvas = canvas;
      this.canvasContent = canvasContent;
      this.connectionsEl = connectionsEl;
      
      // Set SVG attributes for proper rendering
      this.connectionsEl.setAttribute('width', '100%');
      this.connectionsEl.setAttribute('height', '100%');
      this.connectionsEl.style.overflow = 'visible';
      
      this.logger.logVariableAssignment('constructor', 'canvas', canvas.id || 'unnamed');
      this.logger.logVariableAssignment('constructor', 'canvasContent', canvasContent.id || 'unnamed');
      this.logger.logVariableAssignment('constructor', 'connectionsEl', connectionsEl.id || 'unnamed');

      this.setupEventListeners();
      if (initializeSampleData) {
        this.createSampleData();
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('constructor', 'initialization', executionTime);
      this.logger.logFunctionExit('constructor', 'GraphEditor instance', executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'constructor', {
        canvasProvided: !!canvas,
        canvasContentProvided: !!canvasContent,
        connectionsElProvided: !!connectionsEl
      });
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw this.errorFactory.createNodeEditorError(
        'Failed to initialize GraphEditor',
        'INIT_FAILED',
        'Unable to initialize the graph editor. Please refresh the page.',
        'constructor',
        { error: String(error) },
        'critical'
      );
    }
  }

  /**
   * Set up DOM event listeners for user interactions
   * 
   * @private
   */
  private setupEventListeners(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('setupEventListeners');

    try {
      // Canvas panning event handlers
      this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
        this.logger.logUserInteraction('canvas_mousedown', this.canvas.id, {
          target: (e.target as Element)?.tagName,
          clientX: e.clientX,
          clientY: e.clientY
        });

        // Check if in read-only mode
        if (this.isReadOnly) {
          this.logger.logInfo('Canvas panning prevented in read-only mode', 'setupEventListeners');
          return;
        }

        const isBackgroundClick = e.target === this.canvas || e.target === this.canvasContent;
        this.logger.logBranch('setupEventListeners', 'isBackgroundClick', isBackgroundClick);

        if (isBackgroundClick) {
          this.isPanning = true;
          this.lastPanX = e.clientX;
          this.lastPanY = e.clientY;
          
          // Add panning class to disable transitions
          this.canvas.classList.add('panning');
          
          this.logger.logVariableAssignment('setupEventListeners', 'isPanning', true);
          this.logger.logVariableAssignment('setupEventListeners', 'lastPanX', e.clientX);
          this.logger.logVariableAssignment('setupEventListeners', 'lastPanY', e.clientY);
        }
      });

      document.addEventListener('mousemove', (e: MouseEvent) => {
        // Log cursor movement (will be filtered from terminal output)
        this.logger.logUserInteraction('mouse_move', undefined, {
          x: e.clientX,
          y: e.clientY,
          isPanning: this.isPanning,
          isDragging: this.isDragging
        });

        const shouldPan = this.isPanning && !this.isDragging && !this.isReadOnly;
        this.logger.logBranch('setupEventListeners', 'shouldPan', shouldPan, {
          isPanning: this.isPanning,
          isDragging: this.isDragging,
          isReadOnly: this.isReadOnly
        });

        if (shouldPan) {
          const deltaX = e.clientX - this.lastPanX;
          const deltaY = e.clientY - this.lastPanY;
          
          // Apply damping factor for smoother movement
          const DAMPING_FACTOR = 1.2;
          this.panX += deltaX * DAMPING_FACTOR;
          this.panY += deltaY * DAMPING_FACTOR;
          
          this.logger.logVariableAssignment('setupEventListeners', 'panX', this.panX);
          this.logger.logVariableAssignment('setupEventListeners', 'panY', this.panY);
          
          this.updateCanvasTransform();
          
          this.lastPanX = e.clientX;
          this.lastPanY = e.clientY;
        }
      });

      document.addEventListener('mouseup', () => {
        if (this.isPanning || this.isDragging) {
          this.logger.logUserInteraction('mouse_up', undefined, {
            wasPanning: this.isPanning,
            wasDragging: this.isDragging
          });
        }
        
        // Remove panning/dragging classes
        this.canvas.classList.remove('panning', 'dragging');
        
        this.isPanning = false;
        this.isDragging = false;
        
        this.logger.logVariableAssignment('setupEventListeners', 'isPanning', false);
        this.logger.logVariableAssignment('setupEventListeners', 'isDragging', false);
      });

      // Double-click event handler for opening chat (handled at node level now)
      // Kept for backward compatibility but nodes handle their own double-clicks

      // Zoom event handler
      this.canvas.addEventListener('wheel', (e: WheelEvent) => {
        // Check if the event target is inside a scrollable text element
        const target = e.target as Element;
        const isInsideTextBlock = target.closest('textarea, input, [contenteditable="true"], .ql-editor');
        
        if (isInsideTextBlock) {
          // Allow normal scrolling inside text blocks
          this.logger.logUserInteraction('text_block_scroll', target.tagName, {
            deltaY: e.deltaY,
            elementType: target.tagName.toLowerCase()
          });
          return; // Don't prevent default, allow normal scroll
        }
        
        e.preventDefault();
        
        this.logger.logUserInteraction('canvas_wheel', this.canvas.id, {
          deltaY: e.deltaY,
          currentScale: this.scale
        });
        
        const ZOOM_SPEED = 0.001;
        const deltaScale = -e.deltaY * ZOOM_SPEED;
        const newScale = Math.max(0.1, Math.min(5, this.scale + deltaScale));
        
        if (newScale !== this.scale) {
          // Get mouse position relative to canvas
          const rect = this.canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          // Calculate zoom center point
          const zoomPointX = (mouseX - this.panX) / this.scale;
          const zoomPointY = (mouseY - this.panY) / this.scale;
          
          // Update scale
          this.scale = newScale;
          
          // Adjust pan to keep zoom centered on mouse position
          this.panX = mouseX - zoomPointX * this.scale;
          this.panY = mouseY - zoomPointY * this.scale;
          
          this.logger.logVariableAssignment('setupEventListeners', 'scale', this.scale);
          this.logger.logVariableAssignment('setupEventListeners', 'panX', this.panX);
          this.logger.logVariableAssignment('setupEventListeners', 'panY', this.panY);
          
          this.updateCanvasTransform();
        }
      });

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('setupEventListeners', 'event_listener_setup', executionTime);
      this.logger.logFunctionExit('setupEventListeners', undefined, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'setupEventListeners');
      throw this.errorFactory.createNodeEditorError(
        'Failed to setup event listeners',
        'EVENT_SETUP_FAILED',
        'Unable to setup user interactions.',
        'setupEventListeners',
        { error: String(error) },
        'high'
      );
    }
  }

  /**
   * Update canvas content transform for panning and scaling
   * 
   * @private
   */
  private updateCanvasTransform(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('updateCanvasTransform', {
      panX: this.panX,
      panY: this.panY,
      scale: this.scale
    });

    try {
      const transformValue = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
      this.canvasContent.style.transform = transformValue;
      
      this.logger.logVariableAssignment('updateCanvasTransform', 'transform', transformValue);
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('updateCanvasTransform', 'dom_transform', executionTime);
      this.logger.logFunctionExit('updateCanvasTransform', undefined, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'updateCanvasTransform', {
        panX: this.panX,
        panY: this.panY,
        scale: this.scale
      });
      
      throw this.errorFactory.createDOMError(
        'Failed to update canvas transform',
        'TRANSFORM_FAILED',
        'Unable to update view. Please try refreshing.',
        'updateCanvasTransform'
      );
    }
  }

  /**
   * Create initial sample data for demonstration
   * 
   * @private
   * @throws {NodeEditorError} When sample data creation fails
   */
  private createSampleData(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('createSampleData');

    try {
      // Create root node with prompt, response, and markdown blocks
      const root = this.createNode(null, [
        { id: 'root_prompt', type: 'prompt', content: 'What is the capital of France?', position: 0 },
        { id: 'root_response', type: 'response', content: 'The capital of France is Paris, a major European city and global center for art, fashion, gastronomy, and culture.', position: 1 },
        { id: 'root_markdown', type: 'markdown', content: '# Additional Information\\n\\nParis is located in northern France, on the banks of the Seine River.', position: 2 }
      ]);
      
      this.logger.logInfo('Created root node', 'createSampleData', { nodeId: root });
      const rootNode = this.nodes.get(root)!;
      this.positionNode(rootNode, 400, 100);

      // Create child nodes representing edits/variations
      const child1Id = this.createNode(root, [
        { id: 'child1_prompt', type: 'prompt', content: 'Tell me more about the history of Paris.', position: 0 },
        { id: 'child1_response', type: 'response', content: 'Paris has a rich history dating back over 2,000 years. Originally a Celtic settlement called Lutetia, it became the capital of France in the 12th century.', position: 1 }
      ]);
      
      const child2Id = this.createNode(root, [
        { id: 'child2_prompt', type: 'prompt', content: 'What are the main attractions in Paris?', position: 0 },
        { id: 'child2_response', type: 'response', content: 'Major attractions include the Eiffel Tower, Louvre Museum, Notre-Dame Cathedral, Arc de Triomphe, and Champs-Élysées.', position: 1 }
      ]);
      
      this.logger.logInfo('Created child nodes', 'createSampleData', { 
        child1Id, 
        child2Id,
        totalNodes: this.nodes.size 
      });
      
      // Create grandchild nodes
      const grandchild1Id = this.createNode(child1Id, [
        { id: 'gc1_prompt', type: 'prompt', content: 'What role did Paris play in the French Revolution?', position: 0 },
        { id: 'gc1_response', type: 'response', content: 'Paris was the epicenter of the French Revolution (1789-1799). Key events like the storming of the Bastille took place here.', position: 1 },
        { id: 'gc1_markdown', type: 'markdown', content: '## Key Revolutionary Sites\\n\\n- **Bastille**: Prison stormed on July 14, 1789\\n- **Place de la Révolution**: Site of many executions\\n- **Tuileries Palace**: Royal residence during the revolution', position: 2 }
      ]);
      
      const grandchild2Id = this.createNode(child1Id, [
        { id: 'gc2_prompt', type: 'prompt', content: 'How did Paris develop during the Medieval period?', position: 0 },
        { id: 'gc2_response', type: 'response', content: 'During the Medieval period, Paris grew from a small island settlement to become the largest city in Europe by 1300, with impressive Gothic architecture.', position: 1 }
      ]);
      
      this.logger.logInfo('Created grandchild nodes', 'createSampleData', { 
        grandchild1Id,
        grandchild2Id,
        finalNodeCount: this.nodes.size
      });
      
      this.layoutTree();
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('createSampleData', 'sample_data_creation', executionTime);
      this.logger.logFunctionExit('createSampleData', { nodeCount: this.nodes.size }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'createSampleData');
      throw this.errorFactory.createNodeEditorError(
        'Failed to create sample data',
        'SAMPLE_DATA_FAILED',
        'Unable to initialize example content.',
        'createSampleData',
        { error: String(error) },
        'medium'
      );
    }
  }

  /**
   * Get a node by its ID
   * 
   * @param nodeId - The ID of the node to retrieve
   * @returns The node if found, undefined otherwise
   */
  public getNode(nodeId: string): GraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get the preview toggle manager instance
   * 
   * @returns The preview toggle manager
   */
  public getPreviewToggleManager(): PreviewToggleManager {
    return this.previewToggleManager;
  }

  /**
   * Force re-render of a specific node
   * 
   * @param nodeId - The ID of the node to re-render
   */
  public refreshNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      this.rerenderNode(node);
    }
  }

  /**
   * Create a new graph node with validation and error handling
   * 
   * @param parentId - ID of parent node, null for root nodes
   * @param blocks - Array of content blocks for the node
   * @returns The created GraphNode
   * 
   * @throws {ValidationError} When parameters are invalid
   * @throws {TreeStructureError} When tree structure would be violated
   * @throws {NodeEditorError} When node creation fails
   */
  public createNode(parentId: string | null = null, blocksOrPosition?: NodeBlock[] | Position, name?: string): string {
    const startTime = performance.now();
    
    // Handle different parameter types
    let blocks: NodeBlock[] = [];
    let position: Position | undefined;
    
    if (blocksOrPosition) {
      if (Array.isArray(blocksOrPosition)) {
        blocks = blocksOrPosition;
      } else {
        // It's a Position object
        position = blocksOrPosition;
      }
    }
    
    this.logger.logFunctionEntry('createNode', { parentId, blocksCount: blocks.length });

    try {
      // Validate input parameters
      if (parentId !== null) {
        this.validator.validateNodeId(parentId, 'createNode');
        
        const parentExists = this.nodes.has(parentId);
        this.logger.logBranch('createNode', 'parentExists', parentExists, { parentId });
        
        if (!parentExists) {
          throw this.errorFactory.createTreeStructureError(
            parentId,
            'create_child',
            `Parent node ${parentId} does not exist`,
            'createNode',
            { parentId, blocksCount: blocks.length }
          );
        }
      }

      // Validate blocks (only if blocks are provided)
      for (const [index, block] of blocks.entries()) {
        try {
          this.validator.validateNodeBlock(block, 'createNode');
        } catch (error) {
          this.logger.logError(error as Error, 'createNode', { blockIndex: index, block });
          throw error;
        }
      }

      const nodeId = `node_${++this.nodeCounter}`;
      this.logger.logVariableAssignment('createNode', 'nodeId', nodeId);

      const parentDepth = parentId ? (this.nodes.get(parentId)?.depth ?? 0) : 0;
      const nodeDepth = parentDepth + (parentId ? 1 : 0);
      
      this.logger.logVariableAssignment('createNode', 'nodeDepth', nodeDepth);

      const node: GraphNode = {
        id: nodeId,
        name: name || `Node ${this.nodeCounter}`,
        parentId,
        children: [],
        position: position || { x: 0, y: 0 },
        depth: nodeDepth,
        blocks: blocks.length > 0 ? blocks : [
          { id: `${nodeId}_prompt`, type: 'prompt', content: '', position: 0 }
          // Empty prompt block - will be populated when user submits
        ]
      };

      // Validate created node
      this.validator.validateGraphNode(node, 'createNode');

      this.nodes.set(nodeId, node);
      this.logger.logVariableAssignment('createNode', 'nodesMapSize', this.nodes.size);
      
      if (parentId) {
        const parent = this.nodes.get(parentId);
        if (parent) {
          parent.children.push(nodeId);
          this.logger.logVariableAssignment('createNode', 'parentChildrenCount', parent.children.length);
        }
      }

      this.renderNode(node);
      
      // Validate tree integrity after modification
      this.validator.validateTreeIntegrity(this.nodes, 'createNode');
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('createNode', 'node_creation', executionTime);
      this.logger.logFunctionExit('createNode', { nodeId, depth: nodeDepth }, executionTime);
      
      return nodeId;
      
    } catch (error) {
      this.logger.logError(error as Error, 'createNode', { parentId, blocksCount: blocks.length });
      
      if (error instanceof ValidationError || 
          error instanceof TreeStructureError ||
          error instanceof NodeEditorError) {
        throw error;
      }
      
      throw this.errorFactory.createNodeEditorError(
        'Failed to create node',
        'NODE_CREATION_FAILED',
        'Unable to create new node. Please try again.',
        'createNode',
        { parentId, blocksCount: blocks.length, error: String(error) },
        'medium'
      );
    }
  }

  /**
   * Add an existing node to the graph
   * Used by branching service to add nodes created externally
   * 
   * @param node - The GraphNode to add
   * @public
   */
  public addNodeToGraph(node: GraphNode): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('addNodeToGraph', { nodeId: node.id });
    
    try {
      // Validate the node
      this.validator.validateGraphNode(node, 'addNodeToGraph');
      
      // Add to nodes map
      this.nodes.set(node.id, node);
      
      // Only render if we're in a browser environment (not during tests)
      if (typeof window !== 'undefined' && this.canvasContent && typeof this.canvasContent.appendChild === 'function') {
        // Render the node
        this.renderNode(node);
        
        // Update connections if it has a parent
        if (node.parentId) {
          this.updateConnections();
        }
      } else {
        this.logger.logInfo('Skipping DOM rendering in test environment', 'addNodeToGraph', {
          nodeId: node.id
        });
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('addNodeToGraph', 'node_addition', executionTime);
      this.logger.logFunctionExit('addNodeToGraph', { nodeId: node.id }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'addNodeToGraph', { nodeId: node.id });
      throw error;
    }
  }

  /**
   * Render a node in the DOM with proper event handling
   * 
   * @param node - The GraphNode to render
   * @private
   * @throws {DOMError} When DOM manipulation fails
   */
  private renderNode(node: GraphNode): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('renderNode', { nodeId: node.id, blockCount: node.blocks.length });

    try {
      this.validator.validateGraphNode(node, 'renderNode');

      const nodeEl = document.createElement('div');
      nodeEl.className = 'node';
      nodeEl.id = node.id;
      nodeEl.style.left = node.position.x + 'px';
      nodeEl.style.top = node.position.y + 'px';

      this.logger.logVariableAssignment('renderNode', 'nodeElement', nodeEl.tagName);

      // Set initial collapsed state
      nodeEl.setAttribute('data-collapsed', 'false');
      
      nodeEl.innerHTML = `
        <div class="node-header">
          <div class="node-header-left">
            <button class="btn-collapse" data-action="toggleNode" data-node-id="${node.id}" title="Toggle collapse">
              <span class="collapse-icon">▼</span>
            </button>
            <input class="node-name" type="text" value="${node.name}" data-node-id="${node.id}" title="Click to rename">
          </div>
          <div class="node-actions">
            <button class="btn submit" data-action="submitToLLM" data-node-id="${node.id}">Submit to Gemini</button>
            <button class="btn add" data-action="addChild" data-node-id="${node.id}">Add Child</button>
            <button class="btn add" data-action="addMarkdown" data-node-id="${node.id}">+ MD</button>
            <button class="btn delete" data-action="deleteNode" data-node-id="${node.id}">Delete</button>
          </div>
        </div>
        <div class="node-blocks">
          ${node.blocks.map((block, index) => {
            let blockHtml = this.renderBlock(block, node.id, index);
            // Add chat continuation after response blocks
            if (block.type === 'response') {
              blockHtml += this.renderChatContinuation(node.id, block.id);
            }
            return blockHtml;
          }).join('')}
        </div>
        <div class="node-resize-handle" data-action="resizeNode" data-node-id="${node.id}" title="Drag to resize">⋮⋮</div>
      `;

      // Add event listeners with error handling
      nodeEl.addEventListener('click', (e: MouseEvent) => {
        try {
          let target = e.target as HTMLElement;
          this.logger.logUserInteraction('node_click', node.id, { 
            targetClass: target.className,
            action: target.getAttribute('data-action')
          });

          // Check if the clicked element or its parent is a button
          let buttonElement: HTMLElement | null = null;
          if (target.classList.contains('btn') || target.classList.contains('btn-minimize') || target.classList.contains('btn-collapse') || target.classList.contains('btn-preview') || target.classList.contains('btn-preview-toggle') || target.classList.contains('btn-toggle-mode') || target.classList.contains('btn-expand-chat') || target.classList.contains('submit-chat')) {
            buttonElement = target;
          } else if (target.parentElement && (target.parentElement.classList.contains('btn') || target.parentElement.classList.contains('btn-minimize') || target.parentElement.classList.contains('btn-collapse') || target.parentElement.classList.contains('btn-preview') || target.parentElement.classList.contains('btn-preview-toggle') || target.parentElement.classList.contains('btn-toggle-mode') || target.parentElement.classList.contains('btn-expand-chat') || target.parentElement.classList.contains('submit-chat'))) {
            buttonElement = target.parentElement;
          }

          const hasButtonClass = buttonElement !== null;
          this.logger.logBranch('renderNode', 'hasButtonClass', hasButtonClass);

          if (hasButtonClass && buttonElement) {
            const action = buttonElement.getAttribute('data-action');
            const nodeId = buttonElement.getAttribute('data-node-id');
            const blockId = buttonElement.getAttribute('data-block-id');
            
            this.logger.logVariableAssignment('renderNode', 'buttonAction', action);
            this.logger.logVariableAssignment('renderNode', 'buttonNodeId', nodeId);
            
            if (action === 'addChild' && nodeId) {
              this.addChild(nodeId, true); // Create empty node
            } else if (action === 'deleteNode' && nodeId) {
              this.deleteNode(nodeId);
            } else if (action === 'addMarkdown' && nodeId) {
              this.addMarkdownBlock(nodeId);
            } else if (action === 'toggleBlock' && blockId) {
              this.toggleBlockMinimize(blockId);
            } else if (action === 'toggleNode' && nodeId) {
              this.toggleNodeCollapse(nodeId);
            } else if (action === 'togglePreview' && blockId) {
              const mode = buttonElement.getAttribute('data-mode');
              this.handlePreviewToggle(blockId, mode as 'raw' | 'rendered');
            } else if (action === 'deleteBlock' && blockId && nodeId) {
              this.deleteBlock(nodeId, blockId);
            } else if (action === 'toggleChatExpand' && nodeId && blockId) {
              this.toggleChatExpansion(nodeId, blockId);
            } else if (action === 'submitChatContinuation' && nodeId && blockId) {
              this.submitChatContinuation(nodeId, blockId);
            }
          }
        } catch (error) {
          this.logger.logError(error as Error, 'renderNode.onClick', { nodeId: node.id });
        }
      });

      // Add double-click handler to open chat interface
      nodeEl.addEventListener('dblclick', (e: MouseEvent) => {
        try {
          const target = e.target as HTMLElement;
          
          // Don't trigger on buttons or interactive elements
          if (target.tagName === 'BUTTON' || 
              target.tagName === 'INPUT' || 
              target.tagName === 'TEXTAREA' ||
              target.closest('button') ||
              target.closest('input') ||
              target.closest('textarea') ||
              target.classList.contains('node-resize-handle') ||
              target.classList.contains('block-resize-handle')) {
            return;
          }
          
          this.logger.logUserInteraction('node_double_click', node.id, { 
            targetClass: target.className,
            targetTag: target.tagName
          });
          
          // Open chat interface if available
          if (this.chatInterface) {
            this.logger.logInfo('opening_chat_for_node', 'renderNode.onDblClick', { nodeId: node.id });
            this.chatInterface.openChatForNode(node.id);
          } else {
            this.logger.logWarn('Chat interface not available', 'renderNode.onDblClick', { nodeId: node.id });
          }
          
          // Prevent text selection
          e.preventDefault();
        } catch (error) {
          this.logger.logError(error as Error, 'renderNode.onDblClick', { nodeId: node.id });
        }
      });

      // Add mouse enter/leave handlers for conversation chain highlighting
      nodeEl.addEventListener('mouseenter', () => {
        try {
          this.handleNodeMouseEnter(node.id);
        } catch (error) {
          this.logger.logError(error as Error, 'renderNode.onMouseEnter', { nodeId: node.id });
        }
      });

      nodeEl.addEventListener('mouseleave', () => {
        try {
          this.handleNodeMouseLeave();
        } catch (error) {
          this.logger.logError(error as Error, 'renderNode.onMouseLeave', { nodeId: node.id });
        }
      });

      this.setupNodeDragging(nodeEl, node);
      try {
        this.setupBlockResizing(nodeEl);
        this.setupNodeResizing(nodeEl, node);
        this.setupNodeRenaming(nodeEl, node);
        this.canvasContent.appendChild(nodeEl);
        
        // Apply read-only mode if enabled
        if (this.isReadOnly) {
          // Add read-only class to node element
          nodeEl.classList.add('read-only');
          
          // Hide all action buttons
          const actionButtons = nodeEl.querySelectorAll(
            '.add-child-button, .add-markdown-button, .delete-button, .submit-button'
          );
          actionButtons.forEach(button => {
            (button as HTMLElement).style.display = 'none';
          });
          
          // Disable node header editing
          const nodeNameSpan = nodeEl.querySelector('.node-name');
          if (nodeNameSpan) {
            nodeNameSpan.removeAttribute('contenteditable');
          }
          
          // Disable resize handles
          const resizeHandles = nodeEl.querySelectorAll('.resize-handle, .block-resize-handle');
          resizeHandles.forEach(handle => {
            (handle as HTMLElement).style.display = 'none';
          });
        }
      } catch (domError) {
        this.logger.logError(domError as Error, 'renderNode.domOperations', {
          nodeId: node.id,
          operation: 'DOM setup'
        });
        throw domError;
      }
      
      this.logger.logInfo('Node rendered successfully', 'renderNode', { nodeId: node.id });
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('renderNode', 'node_rendering', executionTime);
      this.logger.logFunctionExit('renderNode', { nodeId: node.id }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'renderNode', { nodeId: node.id });
      
      throw this.errorFactory.createDOMError(
        `Failed to render node ${node.id}`,
        'NODE_RENDER_FAILED',
        'Unable to display the node.',
        'renderNode'
      );
    }
  }

  /**
   * Generate a default title for a block
   * 
   * @param block - The NodeBlock to generate title for
   * @param nodeId - ID of the containing node
   * @returns A descriptive title for the block
   * @private
   */
  private getBlockTitle(block: NodeBlock, nodeId: string): string {
    const node = this.nodes.get(nodeId);
    
    // Count markdown blocks to determine the number
    if (block.type === 'markdown' && node) {
      const mdBlocks = node.blocks.filter(b => b.type === 'markdown');
      const mdIndex = mdBlocks.findIndex(b => b.id === block.id) + 1;
      return `MD #${mdIndex}`;
    }
    
    // For prompt and response, just return the type
    return block.type.charAt(0).toUpperCase() + block.type.slice(1);
  }

  /**
   * Render a content block within a node
   * 
   * @param block - The NodeBlock to render
   * @param nodeId - ID of the containing node
   * @param blockIndex - Index of the block within the node
   * @returns HTML string for the block
   * @private
   */
  private renderBlock(block: NodeBlock, nodeId: string, blockIndex: number): string {
    this.logger.logFunctionEntry('renderBlock', { 
      blockId: block.id, 
      blockType: block.type, 
      nodeId, 
      blockIndex 
    });

    try {
      this.validator.validateNodeBlock(block, 'renderBlock');
      this.validator.validateNodeId(nodeId, 'renderBlock');

      // Generate a default title for the block
      const blockTitle = this.getBlockTitle(block, nodeId);
      
      // Add preview toggle for previewable blocks (markdown and response)
      const supportsPreview = block.type === 'markdown' || block.type === 'response';
      const previewState = supportsPreview ? this.previewToggleManager.getBlockPreviewState(block.id as any) : null;
      
      const previewToggleSection = supportsPreview ? `
        <div class="block-content-toggle">
          <button class="btn-toggle-mode ${previewState?.displayMode === 'raw' ? 'active' : ''}" 
                  data-action="togglePreview" 
                  data-block-id="${block.id}" 
                  data-mode="raw"
                  title="Show raw content">
            Raw
          </button>
          <button class="btn-toggle-mode ${previewState?.displayMode === 'rendered' ? 'active' : ''}" 
                  data-action="togglePreview" 
                  data-block-id="${block.id}" 
                  data-mode="rendered"
                  title="Show rendered preview">
            Preview
          </button>
        </div>
      ` : '';
      
      // Add delete button for markdown blocks
      const deleteButtonSection = block.type === 'markdown' ? `
        <button class="btn btn-delete-block" 
                data-action="deleteBlock" 
                data-node-id="${nodeId}"
                data-block-id="${block.id}" 
                title="Remove this markdown block">
          ×
        </button>
      ` : '';
      
      const html = `
        <div class="block ${block.type}-block" data-block-id="${block.id}" data-minimized="false" data-preview-mode="${previewState?.displayMode || 'raw'}">
          <div class="block-header">
            <div class="block-header-left">
              <button class="btn-minimize" data-action="toggleBlock" data-block-id="${block.id}" title="Toggle minimize">
                <span class="minimize-icon">▼</span>
              </button>
              <span class="block-title">${blockTitle}</span>
            </div>
            <div class="block-header-right">
              ${previewToggleSection}
              ${deleteButtonSection}
              <div class="block-type-badge">${block.type}</div>
            </div>
          </div>
          <div class="block-content">
            <textarea 
              id="${block.id}-textarea"
              name="${block.id}-content"
              placeholder="Enter ${block.type} content..."
              data-node-id="${nodeId}"
              data-block-id="${block.id}"
              data-block-index="${blockIndex}"
              autocomplete="off"
            >${block.content}</textarea>
            <div class="resize-handle" data-action="resizeBlock" data-block-id="${block.id}" title="Drag to resize">⋮⋮</div>
          </div>
        </div>
      `;

      this.logger.logFunctionExit('renderBlock', { blockId: block.id, htmlLength: html.length });
      return html;
      
    } catch (error) {
      this.logger.logError(error as Error, 'renderBlock', { 
        blockId: block.id, 
        nodeId, 
        blockIndex 
      });
      
      throw this.errorFactory.createNodeEditorError(
        `Failed to render block ${block.id}`,
        'BLOCK_RENDER_FAILED',
        'Unable to display content block.',
        'renderBlock',
        { blockId: block.id, nodeId, blockIndex }
      );
    }
  }

  /**
   * Render chat continuation UI for a response block
   * 
   * @param nodeId - The node ID containing the response block
   * @param blockId - The response block ID
   * @returns HTML string for chat continuation UI
   * @private
   */
  private renderChatContinuation(nodeId: string, blockId: string): string {
    this.logger.logFunctionEntry('renderChatContinuation', { nodeId, blockId });
    
    try {
      const stateKey = `${nodeId}_${blockId}`;
      let state = this.chatContinuationStates.get(stateKey);
      
      if (!state) {
        state = {
          nodeId,
          isExpanded: false,
          isLoading: false,
          hasError: false,
          lastUpdated: Date.now()
        };
        this.chatContinuationStates.set(stateKey, state);
      }
      
      const html = `
        <div class="chat-continuation" data-node-id="${nodeId}" data-block-id="${blockId}" data-expanded="${state.isExpanded}">
          <div class="chat-continuation-header">
            <button class="btn-expand-chat" data-action="toggleChatExpand" data-node-id="${nodeId}" data-block-id="${blockId}" title="Toggle chat input">
              <span class="expand-icon">${state.isExpanded ? '▼' : '▶'}</span>
              <span class="expand-text">${state.isExpanded ? 'Hide' : 'Continue'} conversation</span>
            </button>
          </div>
          <div class="chat-continuation-content" style="display: ${state.isExpanded ? 'block' : 'none'}">
            <div class="chat-input-wrapper">
              <textarea 
                class="chat-input"
                placeholder="${state.isExpanded ? this.chatConfig.expandedPlaceholder : this.chatConfig.compactPlaceholder}"
                maxlength="${this.chatConfig.maxLength}"
                data-node-id="${nodeId}"
                data-block-id="${blockId}"
                ${state.isLoading ? 'disabled' : ''}
              ></textarea>
              <div class="chat-actions">
                <button class="btn submit-chat" 
                        data-action="submitChatContinuation" 
                        data-node-id="${nodeId}" 
                        data-block-id="${blockId}"
                        ${state.isLoading ? 'disabled' : ''}>
                  ${state.isLoading ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
            ${state.hasError ? `
              <div class="chat-error">
                <span class="error-icon">⚠️</span>
                <span class="error-message">${state.errorMessage || 'An error occurred'}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
      
      this.logger.logFunctionExit('renderChatContinuation', { nodeId, blockId });
      return html;
      
    } catch (error) {
      this.logger.logError(error as Error, 'renderChatContinuation', { nodeId, blockId });
      return '';
    }
  }

  /**
   * Set up drag functionality for a node element
   * 
   * @param nodeEl - The DOM element to make draggable
   * @param node - The GraphNode associated with the element
   * @private
   */
  private setupNodeDragging(nodeEl: HTMLElement, node: GraphNode): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('setupNodeDragging', { nodeId: node.id });

    try {
      let isDragging = false;
      let startX: number, startY: number, startNodeX: number, startNodeY: number;

      nodeEl.addEventListener('mousedown', (e: MouseEvent) => {
        try {
          // Check if in read-only mode
          if (this.isReadOnly) {
            this.logger.logInfo('Node dragging prevented in read-only mode', 'setupNodeDragging', {
              nodeId: node.id
            });
            return;
          }

          const target = e.target as HTMLElement;
          const isInteractiveElement = target.closest('.btn') || target.closest('textarea');
          
          this.logger.logBranch('setupNodeDragging', 'isInteractiveElement', !!isInteractiveElement);
          
          if (isInteractiveElement) return;
          
          isDragging = true;
          this.isDragging = true;
          
          // Add dragging class to disable transitions
          this.canvas.classList.add('dragging');
          
          startX = e.clientX;
          startY = e.clientY;
          startNodeX = node.position.x;
          startNodeY = node.position.y;
          
          this.logger.logUserInteraction('node_drag_start', node.id, {
            startX, startY, startNodeX, startNodeY
          });
          
          this.selectNode(node);
          e.preventDefault();
          
        } catch (error) {
          this.logger.logError(error as Error, 'setupNodeDragging.mousedown', { nodeId: node.id });
        }
      });

      document.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isDragging) return;
        
        // Also check read-only mode during dragging
        if (this.isReadOnly) {
          isDragging = false;
          this.isDragging = false;
          this.logger.logInfo('Node dragging stopped due to read-only mode', 'setupNodeDragging', {
            nodeId: node.id
          });
          return;
        }
        
        try {
          const deltaX = (e.clientX - startX) / this.scale;
          const deltaY = (e.clientY - startY) / this.scale;
          
          // Apply slight acceleration for more responsive dragging
          const ACCELERATION_FACTOR = 1.1;
          const adjustedDeltaX = deltaX * ACCELERATION_FACTOR;
          const adjustedDeltaY = deltaY * ACCELERATION_FACTOR;
          
          // Log node dragging action
          this.logger.logUserInteraction('node_drag', node.id, {
            deltaX: adjustedDeltaX,
            deltaY: adjustedDeltaY,
            newX: startNodeX + adjustedDeltaX,
            newY: startNodeY + adjustedDeltaY
          });
          
          node.position.x = startNodeX + adjustedDeltaX;
          node.position.y = startNodeY + adjustedDeltaY;
          
          this.logger.logVariableAssignment('setupNodeDragging', 'nodePositionX', node.position.x);
          this.logger.logVariableAssignment('setupNodeDragging', 'nodePositionY', node.position.y);
          
          this.positionNode(node, node.position.x, node.position.y);
          this.updateConnections();
          
        } catch (error) {
          this.logger.logError(error as Error, 'setupNodeDragging.mousemove', { nodeId: node.id });
        }
      });

      document.addEventListener('mouseup', () => {
        if (isDragging) {
          this.logger.logUserInteraction('node_drag_end', node.id, {
            finalX: node.position.x,
            finalY: node.position.y
          });
        }
        
        isDragging = false;
        this.isDragging = false;
      });

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('setupNodeDragging', 'drag_setup', executionTime);
      this.logger.logFunctionExit('setupNodeDragging', { nodeId: node.id }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'setupNodeDragging', { nodeId: node.id });
      
      throw this.errorFactory.createNodeEditorError(
        `Failed to setup dragging for node ${node.id}`,
        'DRAG_SETUP_FAILED',
        'Unable to enable node dragging.',
        'setupNodeDragging',
        { nodeId: node.id }
      );
    }
  }

  /**
   * Position a node at specific coordinates with optional animation
   * 
   * @param node - The GraphNode to position
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param animated - Whether to animate the position change
   * @private
   */
  private positionNode(node: GraphNode, x: number, y: number, animated: boolean = false): void {
    this.logger.logFunctionEntry('positionNode', { nodeId: node.id, x, y });

    try {
      this.validator.validateGraphNode(node, 'positionNode');
      this.validator.validateRange(x, -10000, 10000, 'x', 'positionNode');
      this.validator.validateRange(y, -10000, 10000, 'y', 'positionNode');

      node.position.x = x;
      node.position.y = y;
      
      const nodeEl = document.getElementById(node.id);
      const nodeElementExists = !!nodeEl;
      this.logger.logBranch('positionNode', 'nodeElementExists', nodeElementExists);
      
      if (nodeEl) {
        if (animated) {
          // Add transition for smooth animation
          nodeEl.style.transition = 'left 0.5s ease, top 0.5s ease';
          
          // Force browser to compute the style change
          void nodeEl.offsetHeight;
          
          this.logger.logInfo('Animating node position', 'positionNode', {
            nodeId: node.id,
            animated: true
          });
        } else {
          // Remove transition for instant positioning
          nodeEl.style.transition = '';
        }
        
        nodeEl.style.left = x + 'px';
        nodeEl.style.top = y + 'px';
        
        if (animated) {
          // Remove transition after animation completes
          setTimeout(() => {
            if (nodeEl) {
              nodeEl.style.transition = '';
            }
          }, 500);
        }
        
        this.logger.logVariableAssignment('positionNode', 'elementLeft', nodeEl.style.left);
        this.logger.logVariableAssignment('positionNode', 'elementTop', nodeEl.style.top);
      }
      
      this.logger.logFunctionExit('positionNode', { nodeId: node.id, x, y });
      
    } catch (error) {
      this.logger.logError(error as Error, 'positionNode', { nodeId: node.id, x, y });
      
      throw this.errorFactory.createNodeEditorError(
        `Failed to position node ${node.id}`,
        'NODE_POSITION_FAILED',
        'Unable to update node position.',
        'positionNode',
        { nodeId: node.id, x, y }
      );
    }
  }

  /**
   * Select a node and update visual feedback
   * 
   * @param node - The GraphNode to select
   * @private
   */
  private selectNode(node: GraphNode): void {
    this.logger.logFunctionEntry('selectNode', { nodeId: node.id });

    try {
      this.validator.validateGraphNode(node, 'selectNode');

      // Remove previous selection
      if (this.selectedNode) {
        const prevEl = document.getElementById(this.selectedNode.id);
        const prevElementExists = !!prevEl;
        this.logger.logBranch('selectNode', 'prevElementExists', prevElementExists);
        
        if (prevEl) {
          prevEl.classList.remove('selected');
          this.logger.logInfo('Removed selection from previous node', 'selectNode', { 
            previousNodeId: this.selectedNode.id 
          });
        }
      }
      
      this.selectedNode = node;
      this.logger.logVariableAssignment('selectNode', 'selectedNode', node.id);
      
      const nodeEl = document.getElementById(node.id);
      const nodeElementExists = !!nodeEl;
      this.logger.logBranch('selectNode', 'nodeElementExists', nodeElementExists);
      
      if (nodeEl) {
        nodeEl.classList.add('selected');
        this.logger.logInfo('Added selection to node', 'selectNode', { nodeId: node.id });
        
        // Highlight the conversation chain for the selected node
        const chain = this.getConversationChain(node.id);
        this.highlightConversationChain(chain, 'full');
      }
      
      this.logger.logFunctionExit('selectNode', { selectedNodeId: node.id });
      
    } catch (error) {
      this.logger.logError(error as Error, 'selectNode', { nodeId: node.id });
      
      throw this.errorFactory.createNodeEditorError(
        `Failed to select node ${node.id}`,
        'NODE_SELECT_FAILED',
        'Unable to select the node.',
        'selectNode',
        { nodeId: node.id }
      );
    }
  }

  /**
   * Get the conversation chain (path) from a node back to root
   * 
   * @param nodeId - The target node ID
   * @returns Array of node IDs from root to target node
   * @private
   */
  private getConversationChain(nodeId: string): string[] {
    this.logger.logFunctionEntry('getConversationChain', { nodeId });
    
    try {
      const chain: string[] = [];
      let currentNode = this.nodes.get(nodeId);
      const startNode = currentNode;
      
      // Keep track of nodes we should skip (original nodes that were branched from)
      const nodesToSkip = new Set<string>();
      
      while (currentNode) {
        chain.unshift(currentNode.id);
        
        // If this node was branched from another, mark the original to skip
        if (currentNode.branchedFrom) {
          nodesToSkip.add(currentNode.branchedFrom);
          this.logger.logInfo('Marking original node to skip', 'getConversationChain', {
            branchId: currentNode.id,
            originalId: currentNode.branchedFrom
          });
        }
        
        if (currentNode.parentId) {
          currentNode = this.nodes.get(currentNode.parentId);
          // Skip nodes that were replaced by branches
          while (currentNode && nodesToSkip.has(currentNode.id)) {
            this.logger.logInfo('Skipping original node in favor of branch', 'getConversationChain', {
              skippedId: currentNode.id
            });
            if (currentNode.parentId) {
              currentNode = this.nodes.get(currentNode.parentId);
            } else {
              currentNode = undefined;
            }
          }
        } else {
          currentNode = undefined;
        }
      }
      
      this.logger.logInfo('Conversation chain built', 'getConversationChain', {
        startNodeId: nodeId,
        isBranch: !!startNode?.branchedFrom,
        branchedFrom: startNode?.branchedFrom,
        chain: chain
      });
      
      this.logger.logFunctionExit('getConversationChain', { 
        nodeId, 
        chainLength: chain.length 
      });
      
      return chain;
    } catch (error) {
      this.logger.logError(error as Error, 'getConversationChain', { nodeId });
      return [];
    }
  }

  /**
   * Highlight nodes in a conversation chain
   * 
   * @param nodeIds - Array of node IDs to highlight
   * @param highlightType - Type of highlighting ('light' or 'full')
   * @private
   */
  private highlightConversationChain(nodeIds: string[], highlightType: 'light' | 'full'): void {
    this.logger.logFunctionEntry('highlightConversationChain', { 
      nodeIds, 
      highlightType 
    });
    
    try {
      // Clear any existing chain highlights
      this.clearChainHighlights();
      
      // Apply highlight to each node in the chain
      const className = highlightType === 'light' ? 'chain-highlight-light' : 'chain-highlight-full';
      
      for (const nodeId of nodeIds) {
        const nodeEl = document.getElementById(nodeId);
        if (nodeEl) {
          nodeEl.classList.add(className);
          this.logger.logDebug('Applied highlight to node', 'highlightConversationChain', {
            nodeId,
            className
          });
        }
      }
      
      this.logger.logFunctionExit('highlightConversationChain', { 
        highlightedCount: nodeIds.length 
      });
      
    } catch (error) {
      this.logger.logError(error as Error, 'highlightConversationChain', { nodeIds });
    }
  }

  /**
   * Clear all conversation chain highlights
   * 
   * @private
   */
  private clearChainHighlights(): void {
    this.logger.logFunctionEntry('clearChainHighlights');
    
    try {
      const highlightedNodes = document.querySelectorAll('.chain-highlight-light, .chain-highlight-full');
      highlightedNodes.forEach(node => {
        node.classList.remove('chain-highlight-light', 'chain-highlight-full');
      });
      
      this.logger.logFunctionExit('clearChainHighlights', { 
        clearedCount: highlightedNodes.length 
      });
      
    } catch (error) {
      this.logger.logError(error as Error, 'clearChainHighlights');
    }
  }

  /**
   * Handle mouse enter event for node hover highlighting
   * 
   * @param nodeId - The node being hovered
   * @private
   */
  private handleNodeMouseEnter(nodeId: string): void {
    this.logger.logFunctionEntry('handleNodeMouseEnter', { nodeId });
    
    try {
      const chain = this.getConversationChain(nodeId);
      this.highlightConversationChain(chain, 'light');
      
      this.logger.logFunctionExit('handleNodeMouseEnter');
    } catch (error) {
      this.logger.logError(error as Error, 'handleNodeMouseEnter', { nodeId });
    }
  }

  /**
   * Handle mouse leave event to clear hover highlighting
   * 
   * @private
   */
  private handleNodeMouseLeave(): void {
    this.logger.logFunctionEntry('handleNodeMouseLeave');
    
    try {
      // Clear light highlights but preserve full highlights if a node is selected
      const lightHighlights = document.querySelectorAll('.chain-highlight-light');
      lightHighlights.forEach(node => {
        node.classList.remove('chain-highlight-light');
      });
      
      // Re-apply full highlights if there's a selected node
      if (this.selectedNode) {
        const chain = this.getConversationChain(this.selectedNode.id);
        this.highlightConversationChain(chain, 'full');
      }
      
      this.logger.logFunctionExit('handleNodeMouseLeave');
    } catch (error) {
      this.logger.logError(error as Error, 'handleNodeMouseLeave');
    }
  }

  /**
   * Add a child node to an existing parent node
   * 
   * @param parentId - ID of the parent node
   * @param isEmpty - Whether to create an empty node without default content
   * @returns The newly created child GraphNode object
   * @throws {ValidationError} When parentId is invalid
   * @throws {TreeStructureError} When parent doesn't exist
   */
  public addChild(parentId: string, isEmpty: boolean = false): GraphNode {
    const startTime = performance.now();
    this.logger.logFunctionEntry('addChild', { parentId });

    try {
      this.validator.validateNodeId(parentId, 'addChild');
      
      const parent = this.nodes.get(parentId);
      const parentExists = !!parent;
      this.logger.logBranch('addChild', 'parentExists', parentExists, { parentId });
      
      if (!parent) {
        throw this.errorFactory.createTreeStructureError(
          parentId,
          'add_child',
          `Parent node ${parentId} does not exist`,
          'addChild',
          { parentId }
        );
      }
      
      const childId = this.createNode(parentId, isEmpty ? [
        { id: `${parentId}_child_prompt_${Date.now()}`, type: 'prompt', content: '', position: 0 }
        // Response will be auto-generated after LLM submission
      ] : [
        { id: `${parentId}_child_prompt_${Date.now()}`, type: 'prompt', content: 'Enter your prompt here...', position: 0 }
        // Response will be auto-generated after LLM submission
      ]);
      
      const childNode = this.nodes.get(childId);
      if (!childNode) {
        throw new Error('Failed to retrieve created child node');
      }
      
      this.logger.logInfo('Child node created successfully', 'addChild', { 
        parentId, 
        childId,
        totalNodes: this.nodes.size
      });
      
      this.layoutTree();
      this.updateConnections();
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('addChild', 'child_creation', executionTime);
      this.logger.logFunctionExit('addChild', { parentId, childId }, executionTime);
      
      this.emitGraphChanged();
      
      return childNode;
      
    } catch (error) {
      this.logger.logError(error as Error, 'addChild', { parentId });
      
      if (error instanceof ValidationError || error instanceof TreeStructureError) {
        throw error;
      }
      
      throw this.errorFactory.createNodeEditorError(
        `Failed to add child to node ${parentId}`,
        'ADD_CHILD_FAILED',
        'Unable to create new variation.',
        'addChild',
        { parentId, error: String(error) }
      );
    }
  }

  /**
   * Add a markdown block to an existing node
   * 
   * @param nodeId - ID of the node to add the block to
   * @throws {ValidationError} When nodeId is invalid  
   * @throws {NodeEditorError} When node doesn't exist or operation fails
   */
  public addMarkdownBlock(nodeId: string): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('addMarkdownBlock', { nodeId });

    try {
      this.validator.validateNodeId(nodeId, 'addMarkdownBlock');
      
      const node = this.nodes.get(nodeId);
      const nodeExists = !!node;
      this.logger.logBranch('addMarkdownBlock', 'nodeExists', nodeExists, { nodeId });
      
      if (node) {
        const newBlock: NodeBlock = {
          id: `${nodeId}_markdown_${Date.now()}`,
          type: 'markdown',
          content: '# New markdown block\n\nAdd your content here...',
          position: node.blocks.length
        };
        
        this.validator.validateNodeBlock(newBlock, 'addMarkdownBlock');
        
        node.blocks.push(newBlock);
        this.logger.logVariableAssignment('addMarkdownBlock', 'blocksCount', node.blocks.length);
        
        // Ensure all blocks are expanded (not minimized) when adding new markdown
        this.ensureBlocksExpanded(nodeId);
        
        this.rerenderNode(node);
        
        this.logger.logInfo('Markdown block added successfully', 'addMarkdownBlock', {
          nodeId,
          blockId: newBlock.id,
          totalBlocks: node.blocks.length
        });
        
        const executionTime = performance.now() - startTime;
        this.logger.logPerformance('addMarkdownBlock', 'block_addition', executionTime);
        this.logger.logFunctionExit('addMarkdownBlock', { nodeId, blockId: newBlock.id }, executionTime);
        
        this.emitGraphChanged();
        
      } else {
        throw this.errorFactory.createNodeEditorError(
          `Node ${nodeId} does not exist`,
          'NODE_NOT_FOUND',
          'The selected node could not be found.',
          'addMarkdownBlock',
          { nodeId }
        );
      }
      
    } catch (error) {
      this.logger.logError(error as Error, 'addMarkdownBlock', { nodeId });
      
      if (error instanceof ValidationError || error instanceof NodeEditorError) {
        throw error;
      }
      
      throw this.errorFactory.createNodeEditorError(
        `Failed to add markdown block to node ${nodeId}`,
        'ADD_MARKDOWN_FAILED',
        'Unable to add markdown content.',
        'addMarkdownBlock',
        { nodeId, error: String(error) }
      );
    }
  }

  /**
   * Ensure all blocks in a node are expanded (not minimized)
   * This helps when adding new content to make sure everything is visible
   * 
   * @param nodeId - ID of the node to expand blocks for
   * @private
   */
  private ensureBlocksExpanded(nodeId: string): void {
    this.logger.logFunctionEntry('ensureBlocksExpanded', { nodeId });
    
    try {
      // Find the node element in the DOM
      const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
      
      if (nodeElement) {
        // Find all block elements within this node
        const blockElements = nodeElement.querySelectorAll('.block[data-minimized="true"]');
        
        this.logger.logInfo('Expanding minimized blocks', 'ensureBlocksExpanded', {
          nodeId,
          minimizedBlockCount: blockElements.length
        });
        
        // Expand each minimized block
        blockElements.forEach((blockElement: Element) => {
          const blockId = blockElement.getAttribute('data-block-id');
          if (blockId) {
            this.expandBlock(blockId);
          }
        });
        
        // Also ensure the node itself is not collapsed
        const nodeEl = nodeElement as HTMLElement;
        if (nodeEl.classList.contains('collapsed')) {
          const nodeId = nodeEl.getAttribute('data-node-id');
          if (nodeId) {
            this.expandNode(nodeId);
          }
        }
      }
      
      this.logger.logFunctionExit('ensureBlocksExpanded', { nodeId });
      
    } catch (error) {
      this.logger.logError(error as Error, 'ensureBlocksExpanded', { nodeId });
      // Don't throw - this is a helper method for improving UX
    }
  }

  /**
   * Expand a specific block (make it not minimized)
   * 
   * @param blockId - ID of the block to expand
   * @private
   */
  private expandBlock(blockId: string): void {
    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
    
    if (blockElement) {
      blockElement.setAttribute('data-minimized', 'false');
      
      // Update the minimize button icon
      const minimizeIcon = blockElement.querySelector('.minimize-icon') as HTMLElement;
      if (minimizeIcon) {
        minimizeIcon.textContent = '▼';
      }
      
      // Show the block content
      const blockContent = blockElement.querySelector('.block-content') as HTMLElement;
      if (blockContent) {
        blockContent.style.display = 'block';
      }
    }
  }

  /**
   * Expand a specific node (make it not collapsed)
   * 
   * @param nodeId - ID of the node to expand
   * @private
   */
  private expandNode(nodeId: string): void {
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
    
    if (nodeElement) {
      nodeElement.classList.remove('collapsed');
      
      // Update the collapse button icon
      const collapseIcon = nodeElement.querySelector('.collapse-icon') as HTMLElement;
      if (collapseIcon) {
        collapseIcon.textContent = '▼';
      }
      
      // Show the node blocks
      const nodeBlocks = nodeElement.querySelector('.node-blocks') as HTMLElement;
      if (nodeBlocks) {
        nodeBlocks.style.display = 'block';
      }
    }
  }

  /**
   * Build conversation context from a node's chain
   * 
   * @param nodeId - The target node ID
   * @returns Formatted conversation context string
   * @private
   */
  private buildConversationContext(nodeId: string): string {
    this.logger.logFunctionEntry('buildConversationContext', { nodeId });
    
    try {
      const chain = this.getConversationChain(nodeId);
      const contextParts: string[] = [];
      
      // Build context from all nodes in the chain
      for (const chainNodeId of chain) {
        const chainNode = this.nodes.get(chainNodeId);
        if (!chainNode) continue;
        
        // Only include prompt and response blocks (not markdown)
        for (const block of chainNode.blocks) {
          if (block.type === 'prompt' && block.content.trim()) {
            contextParts.push(`User: ${block.content}`);
          } else if (block.type === 'response' && block.content.trim()) {
            contextParts.push(`Assistant: ${block.content}`);
          }
        }
      }
      
      const context = contextParts.join('\n\n');
      
      this.logger.logInfo('Conversation context built', 'buildConversationContext', {
        nodeId,
        chainLength: chain.length,
        contextLength: context.length,
        messageCount: contextParts.length,
        chainNodes: chain,
        contextPreview: context.substring(0, 200) + (context.length > 200 ? '...' : '')
      });
      
      this.logger.logFunctionExit('buildConversationContext', { 
        contextLength: context.length 
      });
      
      return context;
    } catch (error) {
      this.logger.logError(error as Error, 'buildConversationContext', { nodeId });
      return '';
    }
  }

  /**
   * Submit prompt to LLM and create response block
   * 
   * @param nodeId - ID of node containing the prompt
   * @param onStreamingUpdate - Optional callback for streaming updates
   * @throws {ValidationError} When nodeId is invalid
   * @throws {NodeEditorError} When submission fails
   */
  public async submitToLLM(nodeId: string, onStreamingUpdate?: (content: string) => void): Promise<void> {
    const startTime = performance.now();
    this.logger.logFunctionEntry('submitToLLM', { nodeId });
    

    try {
      this.validator.validateNodeId(nodeId, 'submitToLLM');
      
      const node = this.nodes.get(nodeId);
      const nodeExists = !!node;
      this.logger.logBranch('submitToLLM', 'nodeExists', nodeExists, { nodeId });
      
      if (!nodeExists) {
        throw this.errorFactory.createValidationError(
          'nodeId',
          nodeId,
          'existing node ID',
          'submitToLLM'
        );
      }

      // Extract prompt content
      const promptBlock = node.blocks.find(block => block.type === 'prompt');
      const promptFound = !!promptBlock;
      this.logger.logBranch('submitToLLM', 'promptFound', promptFound, { nodeId });
      
      if (!promptFound || !promptBlock.content.trim()) {
        throw this.errorFactory.createValidationError(
          'promptContent',
          promptBlock?.content,
          'non-empty prompt',
          'submitToLLM'
        );
      }

      // Build conversation context
      const conversationContext = this.buildConversationContext(nodeId);
      
      // Construct the full prompt with context
      let fullPrompt = promptBlock.content;
      if (conversationContext) {
        // Only prepend context if there's conversation history
        fullPrompt = conversationContext + '\n\nUser: ' + promptBlock.content;
      }
      
      this.logger.logInfo('Submitting prompt with context', 'submitToLLM', {
        nodeId,
        contextLength: conversationContext.length,
        promptLength: promptBlock.content.length,
        fullPromptLength: fullPrompt.length
      });

      // Show loading indicator
      this.showLoadingIndicator(nodeId);
      
      try {
        // Submit to Gemini service with streaming
        let responseContent = '';
        let responseBlockId: string | null = null;
        
        await geminiService.sendMessage(
          fullPrompt,
          (chunk: string) => {
            // Create response block on first chunk
            if (!responseBlockId) {
              responseBlockId = this.createResponseBlock(nodeId, '');
            }
            
            responseContent += chunk;
            this.updateStreamingResponse(nodeId, responseContent, responseBlockId);
            // Call the external streaming callback if provided
            if (onStreamingUpdate) {
              onStreamingUpdate(responseContent);
            }
          }
        );
        
        // Response block completed - initialize preview mode if we created one
        if (responseBlockId) {
          await this.previewToggleManager.initializeResponseBlockPreview(responseBlockId as any);
        }
        
        this.logger.logInfo('LLM submission completed successfully', 'submitToLLM', {
          nodeId,
          responseLength: responseContent.length
        });
        

      } finally {
        this.hideLoadingIndicator(nodeId);
      }

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('submitToLLM', 'llm_submission', executionTime);
      this.logger.logFunctionExit('submitToLLM', { 
        nodeId, 
        responseGenerated: true 
      }, executionTime);

    } catch (error) {
      this.logger.logError(error as Error, 'submitToLLM', { nodeId });
      this.hideLoadingIndicator(nodeId);
      
      if (error instanceof ValidationError || error instanceof NodeEditorError) {
        throw error;
      }
      
      throw this.errorFactory.createNodeEditorError(
        'Failed to submit to LLM',
        'LLM_SUBMISSION_FAILED',
        'Unable to get AI response. Please try again.',
        'submitToLLM',
        { nodeId, error: String(error) }
      );
    }
  }

  /**
   * Create response block for LLM-generated content
   * 
   * @param nodeId - ID of the parent node
   * @param responseContent - LLM-generated response text
   * @returns ID of the created response block
   * @private
   */
  private createResponseBlock(nodeId: string, responseContent: string): string {
    const startTime = performance.now();
    this.logger.logFunctionEntry('createResponseBlock', { 
      nodeId, 
      contentLength: responseContent.length 
    });

    try {
      const node = this.nodes.get(nodeId);
      if (!node) {
        throw this.errorFactory.createNodeEditorError(
          `Node ${nodeId} not found`,
          'NODE_NOT_FOUND',
          'Unable to add response.',
          'createResponseBlock',
          { nodeId }
        );
      }

      const responseBlock: NodeBlock = {
        id: `${nodeId}_response_${Date.now()}`,
        type: 'response',
        content: responseContent,
        position: node.blocks.length
      };

      this.validator.validateNodeBlock(responseBlock, 'createResponseBlock');
      
      node.blocks.push(responseBlock);
      this.logger.logVariableAssignment('createResponseBlock', 'blocksCount', node.blocks.length);
      
      this.rerenderNode(node);
      this.updateConnections();

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('createResponseBlock', 'response_creation', executionTime);
      this.logger.logFunctionExit('createResponseBlock', { 
        nodeId, 
        blockId: responseBlock.id 
      }, executionTime);
      
      return responseBlock.id;

    } catch (error) {
      this.logger.logError(error as Error, 'createResponseBlock', { nodeId });
      throw error;
    }
  }

  /**
   * Show loading indicator on a node
   * 
   * @param nodeId - ID of the node to show loading state
   * @private
   */
  private showLoadingIndicator(nodeId: string): void {
    this.logger.logFunctionEntry('showLoadingIndicator', { nodeId });
    
    try {
      const nodeEl = document.getElementById(nodeId);
      if (nodeEl) {
        nodeEl.classList.add('loading');
        
        // Disable submit button
        const submitBtn = nodeEl.querySelector('button[data-action="submitToLLM"]') as HTMLButtonElement;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Loading...';
        }
        
        this.logger.logInfo('Loading indicator shown', 'showLoadingIndicator', { nodeId });
      }
      
      this.logger.logFunctionExit('showLoadingIndicator', { nodeId });
    } catch (error) {
      this.logger.logError(error as Error, 'showLoadingIndicator', { nodeId });
    }
  }

  /**
   * Hide loading indicator on a node
   * 
   * @param nodeId - ID of the node to hide loading state
   * @private
   */
  private hideLoadingIndicator(nodeId: string): void {
    this.logger.logFunctionEntry('hideLoadingIndicator', { nodeId });
    
    try {
      const nodeEl = document.getElementById(nodeId);
      if (nodeEl) {
        nodeEl.classList.remove('loading');
        
        // Re-enable submit button
        const submitBtn = nodeEl.querySelector('button[data-action="submitToLLM"]') as HTMLButtonElement;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit to Gemini';
        }
        
        this.logger.logInfo('Loading indicator hidden', 'hideLoadingIndicator', { nodeId });
      }
      
      this.logger.logFunctionExit('hideLoadingIndicator', { nodeId });
    } catch (error) {
      this.logger.logError(error as Error, 'hideLoadingIndicator', { nodeId });
    }
  }

  /**
   * Display read-only mode indicator
   * 
   * @private
   */
  private showReadOnlyIndicator(): void {
    this.logger.logFunctionEntry('showReadOnlyIndicator', {});
    
    // Remove existing indicator if any
    this.hideReadOnlyIndicator();
    
    // Create indicator element
    const indicator = document.createElement('div');
    indicator.className = 'read-only-indicator';
    indicator.innerHTML = `
      <div class="read-only-banner">
        <svg class="read-only-icon" width="16" height="16" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span class="read-only-text">
          View-only mode
          ${this.shareInfo ? ` · Shared by ${this.shareInfo.owner}` : ''}
        </span>
      </div>
    `;
    
    // Add to canvas container
    const canvasContainer = this.canvas?.parentElement;
    if (canvasContainer) {
      canvasContainer.insertBefore(indicator, canvasContainer.firstChild);
    }
    
    this.logger.logInfo('Read-only indicator displayed', 'showReadOnlyIndicator', {
      shareInfo: this.shareInfo
    });
    
    this.logger.logFunctionExit('showReadOnlyIndicator', undefined);
  }

  /**
   * Hide read-only mode indicator
   * 
   * @private
   */
  private hideReadOnlyIndicator(): void {
    const indicator = document.querySelector('.read-only-indicator');
    indicator?.remove();
  }

  /**
   * Disable all editing controls in read-only mode
   * 
   * @private
   */
  private disableEditingControls(): void {
    this.logger.logFunctionEntry('disableEditingControls', {});
    
    // Hide control buttons
    const controlButtons = document.querySelectorAll(
      '.add-root-button, .auto-layout-button, .export-button'
    );
    controlButtons.forEach(button => {
      (button as HTMLElement).style.display = 'none';
    });
    
    // Disable canvas interactions
    if (this.canvas) {
      // Remove drag and drop event listeners
      this.canvas.style.pointerEvents = 'none';
      this.canvasContent.style.pointerEvents = 'auto';
    }
    
    // Update cursor
    if (this.canvasContent) {
      this.canvasContent.style.cursor = 'default';
    }
    
    this.logger.logInfo('Editing controls disabled', 'disableEditingControls');
    this.logger.logFunctionExit('disableEditingControls', undefined);
  }

  /**
   * Re-enable editing controls
   * 
   * @private
   */
  private enableEditingControls(): void {
    this.logger.logFunctionEntry('enableEditingControls', {});
    
    // Show control buttons
    const controlButtons = document.querySelectorAll(
      '.add-root-button, .auto-layout-button, .export-button'
    );
    controlButtons.forEach(button => {
      (button as HTMLElement).style.display = '';
    });
    
    // Enable canvas interactions
    if (this.canvas) {
      this.canvas.style.pointerEvents = 'auto';
    }
    
    // Restore cursor
    if (this.canvasContent) {
      this.canvasContent.style.cursor = 'grab';
    }
    
    this.logger.logInfo('Editing controls enabled', 'enableEditingControls');
    this.logger.logFunctionExit('enableEditingControls', undefined);
  }

  /**
   * Update a specific node to be read-only
   * 
   * @param nodeId - ID of the node to update
   * @private
   */
  private updateNodeReadOnlyState(nodeId: string): void {
    this.logger.logFunctionEntry('updateNodeReadOnlyState', { nodeId });
    
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) {
      return;
    }
    
    // Add read-only class
    nodeElement.classList.add('read-only');
    
    // Disable all interactive elements
    const interactiveElements = nodeElement.querySelectorAll(
      'button, textarea, input, .add-child-button, .add-markdown-button, ' +
      '.delete-button, .submit-button, .resize-handle, .block-resize-handle'
    );
    
    interactiveElements.forEach(element => {
      if (element instanceof HTMLElement) {
        element.style.display = 'none';
      } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.readOnly = true;
        element.disabled = true;
      }
    });
    
    // Disable dragging
    const nodeHeader = nodeElement.querySelector('.node-header');
    if (nodeHeader instanceof HTMLElement) {
      nodeHeader.style.cursor = 'default';
      nodeHeader.classList.add('no-drag');
    }
    
    this.logger.logInfo('Node updated to read-only', 'updateNodeReadOnlyState', { nodeId });
    this.logger.logFunctionExit('updateNodeReadOnlyState', undefined);
  }

  /**
   * Update a specific node to be editable
   * 
   * @param nodeId - ID of the node to update
   * @private
   */
  private updateNodeEditableState(nodeId: string): void {
    this.logger.logFunctionEntry('updateNodeEditableState', { nodeId });
    
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) {
      return;
    }
    
    // Remove read-only class
    nodeElement.classList.remove('read-only');
    
    // Re-enable interactive elements
    const interactiveElements = nodeElement.querySelectorAll(
      'button, textarea, input, .add-child-button, .add-markdown-button, ' +
      '.delete-button, .submit-button, .resize-handle, .block-resize-handle'
    );
    
    interactiveElements.forEach(element => {
      if (element instanceof HTMLElement) {
        element.style.display = '';
      } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.readOnly = false;
        element.disabled = false;
      }
    });
    
    // Enable dragging
    const nodeHeader = nodeElement.querySelector('.node-header');
    if (nodeHeader instanceof HTMLElement) {
      nodeHeader.style.cursor = 'move';
      nodeHeader.classList.remove('no-drag');
    }
    
    this.logger.logInfo('Node updated to editable', 'updateNodeEditableState', { nodeId });
    this.logger.logFunctionExit('updateNodeEditableState', undefined);
  }

  /**
   * Update streaming response content in real-time
   * 
   * @param nodeId - ID of the node being updated
   * @param partialContent - Partial response content received so far
   * @param responseBlockId - Optional ID of the specific response block to update
   * @private
   */
  private updateStreamingResponse(nodeId: string, partialContent: string, responseBlockId?: string): void {
    this.logger.logFunctionEntry('updateStreamingResponse', { 
      nodeId, 
      contentLength: partialContent.length 
    });
    
    try {
      const node = this.nodes.get(nodeId);
      if (!node) return;
      
      // Find the response block by ID or look for existing response block
      let responseBlock = responseBlockId 
        ? node.blocks.find(block => block.id === responseBlockId)
        : node.blocks.find(block => block.type === 'response');
      
      if (!responseBlock) {
        this.logger.logWarn('Response block not found for streaming', 'updateStreamingResponse', { nodeId, responseBlockId });
        return;
      }
      
      // Update block content
      responseBlock.content = partialContent;
      
      // Update the textarea directly for smooth streaming
      const blockEl = document.querySelector(`textarea[data-node-id="${nodeId}"][data-block-id="${responseBlock.id}"]`) as HTMLTextAreaElement;
      if (blockEl) {
        blockEl.value = partialContent;
        // Auto-resize textarea
        blockEl.style.height = 'auto';
        blockEl.style.height = Math.min(blockEl.scrollHeight, 400) + 'px';
        
        // Scroll to bottom to show latest content
        blockEl.scrollTop = blockEl.scrollHeight;
      }
      
      this.logger.logDebug('Streaming response updated', 'updateStreamingResponse', { 
        nodeId,
        streamingBlockId: responseBlock.id
      });
      
      this.logger.logFunctionExit('updateStreamingResponse', { nodeId });
    } catch (error) {
      this.logger.logError(error as Error, 'updateStreamingResponse', { nodeId });
    }
  }

  /**
   * Update the content of a specific block
   * 
   * @param nodeId - ID of the containing node
   * @param blockIndex - Index of the block to update
   * @param content - New content for the block
   */
  public async updateBlockContent(nodeId: string, blockIdOrIndex: string | number, content: string): Promise<void> {
    let blockIndex: number;
    let blockId: string;
    
    // Determine if we're dealing with blockId or blockIndex
    if (typeof blockIdOrIndex === 'string') {
      blockId = blockIdOrIndex;
      const node = this.nodes.get(nodeId);
      blockIndex = node?.blocks.findIndex(b => b.id === blockId) ?? -1;
    } else {
      blockIndex = blockIdOrIndex;
      const node = this.nodes.get(nodeId);
      blockId = node?.blocks[blockIndex]?.id ?? '';
    }
    
    this.logger.logFunctionEntry('updateBlockContent', { nodeId, blockIndex, blockId, contentLength: content.length });

    try {
      this.validator.validateNodeId(nodeId, 'updateBlockContent');
      if (typeof blockIdOrIndex === 'number') {
        this.validator.validateRange(blockIndex, 0, 1000, 'blockIndex', 'updateBlockContent');
      }

      const node = this.nodes.get(nodeId);
      const nodeExists = !!node;
      this.logger.logBranch('updateBlockContent', 'nodeExists', nodeExists, { nodeId });
      
      if (node && blockIndex >= 0 && blockIndex < node.blocks.length) {
        const block = node.blocks[blockIndex]!;
        const oldContent = block.content;
        
        // Check if we should create a branch
        // Only branch if:
        // 1. It's a prompt/response block AND
        // 2. The block already has content (not first-time entry) AND
        // 3. For prompts: the node has a response block (editing after getting response)
        const isFirstTimeEntry = !oldContent || oldContent.trim() === '';
        const hasResponse = node.blocks.some(b => b.type === 'response' && b.content.trim() !== '');
        const shouldBranch = this.branchingService.shouldCreateBranch(block.type, EditSource.NODE_BLOCK_DIRECT) 
          && !isFirstTimeEntry
          && (block.type === 'response' || (block.type === 'prompt' && hasResponse));
        
        // Debug logging
        console.log('[DEBUG] Branch decision:', {
          blockType: block.type,
          isFirstTimeEntry,
          hasResponse,
          oldContent: oldContent?.substring(0, 50) + '...',
          shouldBranch
        });
          
        if (shouldBranch) {
          this.logger.logInfo('Creating branch for block edit', 'updateBlockContent', {
            nodeId,
            blockId: block.id,
            blockType: block.type,
            isFirstTimeEntry,
            hasResponse
          });
          
          try {
            // Create a branch instead of updating in place
            const branchResult = await this.branchingService.createBranchFromEdit(
              nodeId as NodeId,
              block.id as BlockId,
              content,
              EditSource.NODE_BLOCK_DIRECT
            );
            
            if (branchResult.success) {
              // Get the new node from the branching service
              const newNode = this.branchingService.getNode(branchResult.newNodeId);
              if (newNode) {
                // Add the node to the graph editor
                this.addNodeToGraph(newNode);
              }
              
              // Record branch in version history
              this.versionHistoryManager.recordBranch(branchResult.branchMetadata);
              
              this.logger.logInfo('Branch created successfully', 'updateBlockContent', {
                originalNodeId: nodeId,
                newNodeId: branchResult.newNodeId
              });
              
              // Return early - branching completed successfully
              this.logger.logFunctionExit('updateBlockContent', undefined);
              return;
            }
          } catch (branchError) {
            this.logger.logError(branchError as Error, 'updateBlockContent.branching', {
              nodeId,
              blockId,
              blockType: block.type,
              errorMessage: (branchError as Error).message
            });
            // Fall through to regular update if branching fails
            throw branchError;
          }
        } else {
          // For markdown blocks, update in place
          block.content = content;
          
          this.logger.logVariableAssignment('updateBlockContent', 'blockContent', content.substring(0, 100));
          this.logger.logInfo('Block content updated in place', 'updateBlockContent', {
            nodeId,
            blockIndex,
            blockId: block.id,
            blockType: block.type,
            oldLength: oldContent.length,
            newLength: content.length
          });
        }
        
        this.logger.logFunctionExit('updateBlockContent', { nodeId, blockIndex, contentLength: content.length });
        
      } else {
        const errorMsg = node ? 'Block not found' : 'Node not found';
        this.logger.logWarn(errorMsg, 'updateBlockContent', { nodeId, blockIndex, blockId });
      }
      
    } catch (error) {
      this.logger.logError(error as Error, 'updateBlockContent', { nodeId, blockIndex, blockId });
      
      throw this.errorFactory.createNodeEditorError(
        `Failed to update block content`,
        'UPDATE_CONTENT_FAILED',
        'Unable to save your changes.',
        'updateBlockContent',
        { nodeId, blockIndex, blockId, error: String(error) }
      );
    }
  }

  /**
   * Delete a node and handle tree structure updates
   * 
   * @param nodeId - ID of the node to delete
   * @throws {ValidationError} When nodeId is invalid
   * @throws {TreeStructureError} When node has children or doesn't exist
   */
  public deleteNode(nodeId: string): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('deleteNode', { nodeId });

    try {
      this.validator.validateNodeId(nodeId, 'deleteNode');
      
      const node = this.nodes.get(nodeId);
      const nodeExists = !!node;
      this.logger.logBranch('deleteNode', 'nodeExists', nodeExists, { nodeId });
      
      if (!node) {
        throw this.errorFactory.createTreeStructureError(
          nodeId,
          'delete',
          `Node ${nodeId} does not exist`,
          'deleteNode',
          { nodeId }
        );
      }

      // Don't delete if it has children
      const hasChildren = node.children.length > 0;
      this.logger.logBranch('deleteNode', 'hasChildren', hasChildren, { 
        nodeId, 
        childrenCount: node.children.length 
      });
      
      if (hasChildren) {
        this.logger.logWarn('Cannot delete node with children', 'deleteNode', {
          nodeId,
          childrenCount: node.children.length,
          children: node.children
        });
        
        throw this.errorFactory.createTreeStructureError(
          nodeId,
          'delete',
          'Cannot delete node with children. Delete children first.',
          'deleteNode',
          { nodeId, childrenCount: node.children.length }
        );
      }

      // Remove from parent's children list
      if (node.parentId) {
        const parent = this.nodes.get(node.parentId);
        if (parent) {
          const originalChildrenCount = parent.children.length;
          parent.children = parent.children.filter(id => id !== nodeId);
          
          this.logger.logVariableAssignment('deleteNode', 'parentChildrenCount', parent.children.length);
          this.logger.logInfo('Removed node from parent children list', 'deleteNode', {
            nodeId,
            parentId: node.parentId,
            originalChildrenCount,
            newChildrenCount: parent.children.length
          });
        }
      }

      // Remove from DOM and nodes map
      const nodeEl = document.getElementById(nodeId);
      const nodeElementExists = !!nodeEl;
      this.logger.logBranch('deleteNode', 'nodeElementExists', nodeElementExists);
      
      if (nodeEl) {
        nodeEl.remove();
        this.logger.logInfo('Removed node element from DOM', 'deleteNode', { nodeId });
      }
      
      this.nodes.delete(nodeId);
      this.logger.logVariableAssignment('deleteNode', 'totalNodes', this.nodes.size);

      this.updateConnections();
      
      // Validate tree integrity after deletion
      this.validator.validateTreeIntegrity(this.nodes, 'deleteNode');
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('deleteNode', 'node_deletion', executionTime);
      this.logger.logFunctionExit('deleteNode', { nodeId, remainingNodes: this.nodes.size }, executionTime);
      
      this.emitGraphChanged();
      
    } catch (error) {
      this.logger.logError(error as Error, 'deleteNode', { nodeId });
      
      if (error instanceof ValidationError || error instanceof TreeStructureError) {
        throw error;
      }
      
      throw this.errorFactory.createNodeEditorError(
        `Failed to delete node ${nodeId}`,
        'DELETE_NODE_FAILED',
        'Unable to delete the node.',
        'deleteNode',
        { nodeId, error: String(error) }
      );
    }
  }

  /**
   * Re-render a node after content changes
   * 
   * @param node - The GraphNode to re-render
   * @private
   */
  private rerenderNode(node: GraphNode): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('rerenderNode', { nodeId: node.id });

    try {
      this.validator.validateGraphNode(node, 'rerenderNode');
      
      const nodeEl = document.getElementById(node.id);
      const nodeElementExists = !!nodeEl;
      this.logger.logBranch('rerenderNode', 'nodeElementExists', nodeElementExists);
      
      if (nodeEl) {
        nodeEl.remove();
        this.logger.logInfo('Removed old node element', 'rerenderNode', { nodeId: node.id });
      }
      
      this.renderNode(node);
      this.updateConnections();
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('rerenderNode', 'node_rerender', executionTime);
      this.logger.logFunctionExit('rerenderNode', { nodeId: node.id }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'rerenderNode', { nodeId: node.id });
      
      throw this.errorFactory.createDOMError(
        `Failed to re-render node ${node.id}`,
        'NODE_RERENDER_FAILED',
        'Unable to update the display.',
        'rerenderNode'
      );
    }
  }

  /**
   * Calculate and apply tree layout to all nodes
   * 
   * @private
   */
  private layoutTree(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('layoutTree', { totalNodes: this.nodes.size });

    try {
      // Get all root nodes
      const rootNodes = Array.from(this.nodes.values()).filter(n => !n.parentId);
      this.logger.logVariableAssignment('layoutTree', 'rootNodesCount', rootNodes.length);
      
      let rootOffset = 100;
      let layoutedNodes = 0;
      
      this.logger.logLoop('layoutTree', 'root_nodes_processing', rootNodes.length);
      
      for (const [index, root] of rootNodes.entries()) {
        this.logger.logInfo(`Processing root node ${index + 1}/${rootNodes.length}`, 'layoutTree', {
          rootNodeId: root.id,
          currentOffset: rootOffset
        });
        
        const subtreeWidth = this.calculateSubtreeWidth(root);
        this.layoutSubtree(root, rootOffset + subtreeWidth / 2, 100);
        rootOffset += subtreeWidth + 150;
        layoutedNodes++;
        
        this.logger.logVariableAssignment('layoutTree', 'rootOffset', rootOffset);
      }
      
      this.updateConnections();
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('layoutTree', 'tree_layout', executionTime);
      this.logger.logFunctionExit('layoutTree', { 
        totalNodes: this.nodes.size, 
        rootNodes: rootNodes.length,
        layoutedNodes 
      }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'layoutTree');
      
      throw this.errorFactory.createNodeEditorError(
        'Failed to layout tree',
        'LAYOUT_FAILED',
        'Unable to arrange nodes properly.',
        'layoutTree',
        { totalNodes: this.nodes.size, error: String(error) }
      );
    }
  }

  /**
   * Calculate the width required for a node's subtree
   * 
   * @param node - The root node of the subtree
   * @returns The calculated width in pixels
   * @private
   */
  private calculateSubtreeWidth(node: GraphNode): number {
    this.logger.logFunctionEntry('calculateSubtreeWidth', { nodeId: node.id });

    try {
      const nodeWidth = this.NODE_WIDTH;
      const HORIZONTAL_SPACING = 150;
      
      const hasChildren = node.children.length > 0;
      this.logger.logBranch('calculateSubtreeWidth', 'hasChildren', hasChildren, {
        nodeId: node.id,
        childrenCount: node.children.length
      });
      
      if (!hasChildren) {
        this.logger.logFunctionExit('calculateSubtreeWidth', { nodeId: node.id, width: nodeWidth });
        return nodeWidth;
      }
      
      let totalChildrenWidth = 0;
      
      this.logger.logLoop('calculateSubtreeWidth', 'children_processing', node.children.length);
      
      for (const childId of node.children) {
        const child = this.nodes.get(childId);
        if (child) {
          const childWidth = this.calculateSubtreeWidth(child);
          totalChildrenWidth += childWidth;
          
          this.logger.logVariableAssignment('calculateSubtreeWidth', 'totalChildrenWidth', totalChildrenWidth);
        }
      }
      
      const spacingWidth = (node.children.length - 1) * HORIZONTAL_SPACING;
      const finalWidth = Math.max(nodeWidth, totalChildrenWidth + spacingWidth);
      
      this.logger.logVariableAssignment('calculateSubtreeWidth', 'finalWidth', finalWidth);
      this.logger.logFunctionExit('calculateSubtreeWidth', { nodeId: node.id, width: finalWidth });
      
      return finalWidth;
      
    } catch (error) {
      this.logger.logError(error as Error, 'calculateSubtreeWidth', { nodeId: node.id });
      
      throw this.errorFactory.createNodeEditorError(
        `Failed to calculate subtree width for node ${node.id}`,
        'SUBTREE_WIDTH_FAILED',
        'Unable to calculate layout.',
        'calculateSubtreeWidth',
        { nodeId: node.id }
      );
    }
  }

  /**
   * Position a subtree starting from a root node
   * 
   * @param node - The root node of the subtree
   * @param centerX - X coordinate for the center of this subtree
   * @param y - Y coordinate for this depth level
   * @private
   */
  private layoutSubtree(node: GraphNode, centerX: number, y: number): void {
    this.logger.logFunctionEntry('layoutSubtree', { nodeId: node.id, centerX, y });

    try {
      const VERTICAL_SPACING = 300;
      const HORIZONTAL_SPACING = 150;
      
      // Position current node
      this.positionNode(node, centerX - this.NODE_HALF_WIDTH, y);
      
      const hasChildren = node.children.length > 0;
      this.logger.logBranch('layoutSubtree', 'hasChildren', hasChildren, {
        nodeId: node.id,
        childrenCount: node.children.length
      });
      
      if (!hasChildren) {
        this.logger.logFunctionExit('layoutSubtree', { nodeId: node.id, positioned: true });
        return;
      }
      
      // Calculate positions for children
      const childWidths: number[] = [];
      for (const childId of node.children) {
        const child = this.nodes.get(childId);
        if (child) {
          childWidths.push(this.calculateSubtreeWidth(child));
        }
      }
      
      const totalChildWidth = childWidths.reduce((sum, width) => sum + width, 0);
      const totalSpacing = (node.children.length - 1) * HORIZONTAL_SPACING;
      const totalWidth = totalChildWidth + totalSpacing;
      
      this.logger.logVariableAssignment('layoutSubtree', 'totalWidth', totalWidth);
      
      let currentX = centerX - totalWidth / 2;
      
      this.logger.logLoop('layoutSubtree', 'children_layout', node.children.length);
      
      for (const [index, childId] of node.children.entries()) {
        const child = this.nodes.get(childId);
        if (child) {
          const childWidth = childWidths[index] ?? this.NODE_WIDTH;
          const childCenterX = currentX + childWidth / 2;
          
          this.logger.logInfo(`Positioning child ${index + 1}/${node.children.length}`, 'layoutSubtree', {
            parentId: node.id,
            childId,
            childCenterX,
            childY: y + VERTICAL_SPACING
          });
          
          this.layoutSubtree(child, childCenterX, y + VERTICAL_SPACING);
          currentX += childWidth + HORIZONTAL_SPACING;
          
          this.logger.logVariableAssignment('layoutSubtree', 'currentX', currentX);
        }
      }
      
      this.logger.logFunctionExit('layoutSubtree', { 
        nodeId: node.id, 
        childrenProcessed: node.children.length 
      });
      
    } catch (error) {
      this.logger.logError(error as Error, 'layoutSubtree', { nodeId: node.id, centerX, y });
      
      throw this.errorFactory.createNodeEditorError(
        `Failed to layout subtree for node ${node.id}`,
        'SUBTREE_LAYOUT_FAILED',
        'Unable to position child nodes.',
        'layoutSubtree',
        { nodeId: node.id, centerX, y }
      );
    }
  }

  /**
   * Update SVG connections between parent and child nodes
   * 
   * @private
   */
  private updateConnections(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('updateConnections', { totalNodes: this.nodes.size });

    try {
      // Check if we're in a test environment or SVG element is not properly initialized
      if (typeof window === 'undefined' || !this.connectionsEl || typeof this.connectionsEl.appendChild !== 'function') {
        this.logger.logInfo('Skipping connections update in test environment', 'updateConnections', {
          hasWindow: typeof window !== 'undefined',
          hasConnectionsEl: !!this.connectionsEl,
          hasAppendChild: this.connectionsEl && typeof this.connectionsEl.appendChild === 'function'
        });
        this.logger.logFunctionExit('updateConnections', { skipped: true });
        return;
      }
      
      // Clear existing connections
      while (this.connectionsEl.firstChild) {
        this.connectionsEl.removeChild(this.connectionsEl.firstChild);
      }
      this.logger.logInfo('Cleared existing connections', 'updateConnections');
      
      let connectionsCreated = 0;
      
      this.logger.logLoop('updateConnections', 'nodes_processing', this.nodes.size);
      
      for (const [nodeId, node] of this.nodes) {
        // Draw parent-child connections
        const hasParent = !!node.parentId;
        this.logger.logBranch('updateConnections', 'hasParent', hasParent, { nodeId });
        
        if (hasParent) {
          const parent = this.nodes.get(node.parentId!);
          const parentExists = !!parent;
          this.logger.logBranch('updateConnections', 'parentExists', parentExists, {
            nodeId,
            parentId: node.parentId
          });
          
          if (parent) {
            this.drawConnection(parent, node);
            connectionsCreated++;
            
            this.logger.logVariableAssignment('updateConnections', 'connectionsCreated', connectionsCreated);
          }
        }
        
        // Draw branch connections (sibling relationships)
        if (node.branches && node.branches.length > 0) {
          this.logger.logBranch('updateConnections', 'hasBranches', true, { 
            nodeId, 
            branchCount: node.branches.length 
          });
          
          for (const branchId of node.branches) {
            const branchNode = this.nodes.get(branchId);
            if (branchNode) {
              this.drawBranchConnection(node, branchNode);
              connectionsCreated++;
            }
          }
        }
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('updateConnections', 'connections_update', executionTime);
      this.logger.logFunctionExit('updateConnections', { 
        connectionsCreated,
        totalNodes: this.nodes.size
      }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'updateConnections');
      
      throw this.errorFactory.createDOMError(
        'Failed to update connections',
        'CONNECTIONS_UPDATE_FAILED',
        'Unable to update connection lines.',
        'updateConnections'
      );
    }
  }


  /**
   * Draw an SVG connection line between parent and child nodes
   * 
   * @param parent - The parent GraphNode
   * @param child - The child GraphNode
   * @private
   */
  private drawConnection(parent: GraphNode, child: GraphNode): void {
    this.logger.logFunctionEntry('drawConnection', { 
      parentId: parent.id, 
      childId: child.id 
    });

    try {
      this.validator.validateGraphNode(parent, 'drawConnection');
      this.validator.validateGraphNode(child, 'drawConnection');

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      
      // Get actual node elements to determine real dimensions
      const parentEl = document.getElementById(parent.id);
      const childEl = document.getElementById(child.id);
      
      let parentWidth = this.NODE_WIDTH;
      let parentHeight = this.NODE_HEIGHT;
      let childWidth = this.NODE_WIDTH;
      
      if (parentEl) {
        parentWidth = parentEl.offsetWidth || this.NODE_WIDTH;
        parentHeight = parentEl.offsetHeight || this.NODE_HEIGHT;
      }
      
      if (childEl) {
        childWidth = childEl.offsetWidth || this.NODE_WIDTH;
      }
      
      const parentCenterX = parent.position.x + parentWidth / 2;
      const parentCenterY = parent.position.y + parentHeight - 10; // Bottom of parent
      const childCenterX = child.position.x + childWidth / 2;
      const childCenterY = child.position.y + 10; // Top of child
      
      this.logger.logVariableAssignment('drawConnection', 'parentCenterX', parentCenterX);
      this.logger.logVariableAssignment('drawConnection', 'parentCenterY', parentCenterY);
      this.logger.logVariableAssignment('drawConnection', 'childCenterX', childCenterX);
      this.logger.logVariableAssignment('drawConnection', 'childCenterY', childCenterY);
      
      // Create a curved path
      const midY = (parentCenterY + childCenterY) / 2;
      const pathData = `M ${parentCenterX} ${parentCenterY} C ${parentCenterX} ${midY} ${childCenterX} ${midY} ${childCenterX} ${childCenterY}`;
      
      line.setAttribute('d', pathData);
      line.setAttribute('class', 'connection-line');
      
      // Check if appendChild is available before using it
      if (this.connectionsEl && typeof this.connectionsEl.appendChild === 'function') {
        this.connectionsEl.appendChild(line);
      } else {
        this.logger.logWarn('SVG appendChild not available, skipping connection rendering', 'drawConnection');
      }
      
      this.logger.logInfo('Connection drawn successfully', 'drawConnection', {
        parentId: parent.id,
        childId: child.id,
        pathLength: pathData.length
      });
      
      this.logger.logFunctionExit('drawConnection', { 
        parentId: parent.id, 
        childId: child.id 
      });
      
    } catch (error) {
      this.logger.logError(error as Error, 'drawConnection', { 
        parentId: parent.id, 
        childId: child.id 
      });
      
      throw this.errorFactory.createDOMError(
        `Failed to draw connection between ${parent.id} and ${child.id}`,
        'CONNECTION_DRAW_FAILED',
        'Unable to draw connection line.',
        'drawConnection'
      );
    }
  }

  /**
   * Draw an SVG connection line between sibling branch nodes
   * 
   * @param original - The original GraphNode
   * @param branch - The branch GraphNode
   * @private
   */
  private drawBranchConnection(original: GraphNode, branch: GraphNode): void {
    this.logger.logFunctionEntry('drawBranchConnection', { 
      originalId: original.id, 
      branchId: branch.id 
    });

    try {
      this.validator.validateGraphNode(original, 'drawBranchConnection');
      this.validator.validateGraphNode(branch, 'drawBranchConnection');

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      
      // Get actual node elements to determine real dimensions
      const originalEl = document.getElementById(original.id);
      const branchEl = document.getElementById(branch.id);
      
      let originalWidth = this.NODE_WIDTH;
      let originalHeight = this.NODE_HEIGHT;
      let branchHeight = this.NODE_HEIGHT;
      
      if (originalEl) {
        originalWidth = originalEl.offsetWidth || this.NODE_WIDTH;
        originalHeight = originalEl.offsetHeight || this.NODE_HEIGHT;
      }
      
      if (branchEl) {
        branchHeight = branchEl.offsetHeight || this.NODE_HEIGHT;
      }
      
      // Calculate connection points - horizontal connection from right of original to left of branch
      const originalRightX = original.position.x + originalWidth;
      const originalCenterY = original.position.y + originalHeight / 2;
      const branchLeftX = branch.position.x;
      const branchCenterY = branch.position.y + branchHeight / 2;
      
      // Create a curved path for branch connection
      const midX = (originalRightX + branchLeftX) / 2;
      const pathData = `M ${originalRightX} ${originalCenterY} C ${midX} ${originalCenterY} ${midX} ${branchCenterY} ${branchLeftX} ${branchCenterY}`;
      
      line.setAttribute('d', pathData);
      line.setAttribute('class', 'connection-line branch-connection');
      line.setAttribute('stroke-dasharray', '5,5'); // Dashed line to distinguish from parent-child connections
      
      // Check if appendChild is available before using it
      if (this.connectionsEl && typeof this.connectionsEl.appendChild === 'function') {
        this.connectionsEl.appendChild(line);
      } else {
        this.logger.logWarn('SVG appendChild not available, skipping branch connection rendering', 'drawBranchConnection');
      }
      
      this.logger.logInfo('Branch connection drawn successfully', 'drawBranchConnection', {
        originalId: original.id,
        branchId: branch.id,
        pathLength: pathData.length
      });
      
      this.logger.logFunctionExit('drawBranchConnection', { 
        originalId: original.id, 
        branchId: branch.id 
      });
      
    } catch (error) {
      this.logger.logError(error as Error, 'drawBranchConnection', { 
        originalId: original.id, 
        branchId: branch.id 
      });
      
      throw this.errorFactory.createDOMError(
        `Failed to draw branch connection between ${original.id} and ${branch.id}`,
        'BRANCH_CONNECTION_DRAW_FAILED',
        'Unable to draw branch connection line.',
        'drawBranchConnection'
      );
    }
  }

  /**
   * Add a new root node to the graph
   * 
   * @returns The created GraphNode object
   * @throws {NodeEditorError} When root node creation fails
   */
  public addRootNode(): GraphNode {
    const startTime = performance.now();
    this.logger.logFunctionEntry('addRootNode');
    
    // Debug logging
    console.log('[DEBUG] addRootNode called, current node count:', this.nodes.size);

    try {
      const rootId = this.createNode(null, [
        { id: `root_${Date.now()}_prompt`, type: 'prompt', content: '', position: 0 }
        // Empty prompt - will be populated when user submits via chat
      ]);
      
      const rootNode = this.nodes.get(rootId);
      if (!rootNode) {
        throw new Error('Failed to retrieve created root node');
      }
      
      this.logger.logInfo('Root node created successfully', 'addRootNode', {
        rootId,
        totalNodes: this.nodes.size
      });
      
      // Debug logging
      console.log('[DEBUG] addRootNode completed, new node count:', this.nodes.size, 'created node:', rootId);
      
      this.layoutTree();
      
      // Update the collapse toggle button since we added a new node
      this.updateCollapseToggleButton();
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('addRootNode', 'root_creation', executionTime);
      this.logger.logFunctionExit('addRootNode', { rootId }, executionTime);
      
      this.emitGraphChanged();
      
      return rootNode;
      
    } catch (error) {
      this.logger.logError(error as Error, 'addRootNode');
      
      throw this.errorFactory.createNodeEditorError(
        'Failed to add root node',
        'ADD_ROOT_FAILED',
        'Unable to create new root node.',
        'addRootNode',
        { error: String(error) }
      );
    }
  }

  /**
   * Zoom in the canvas view
   */
  public zoomIn(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('zoomIn', { currentScale: this.scale });

    try {
      const zoomStep = 0.2;
      const newScale = Math.min(5, this.scale + zoomStep);
      
      if (newScale !== this.scale) {
        // Zoom towards center of canvas
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const zoomPointX = (centerX - this.panX) / this.scale;
        const zoomPointY = (centerY - this.panY) / this.scale;
        
        this.scale = newScale;
        
        this.panX = centerX - zoomPointX * this.scale;
        this.panY = centerY - zoomPointY * this.scale;
        
        this.logger.logVariableAssignment('zoomIn', 'scale', this.scale);
        this.updateCanvasTransform();
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('zoomIn', 'zoom_in', executionTime);
      this.logger.logFunctionExit('zoomIn', { newScale: this.scale }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'zoomIn');
      throw this.errorFactory.createNodeEditorError(
        'Failed to zoom in',
        'ZOOM_IN_FAILED',
        'Unable to zoom in.',
        'zoomIn',
        { error: String(error) }
      );
    }
  }

  /**
   * Zoom out the canvas view
   */
  public zoomOut(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('zoomOut', { currentScale: this.scale });

    try {
      const zoomStep = 0.2;
      const newScale = Math.max(0.1, this.scale - zoomStep);
      
      if (newScale !== this.scale) {
        // Zoom from center of canvas
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const zoomPointX = (centerX - this.panX) / this.scale;
        const zoomPointY = (centerY - this.panY) / this.scale;
        
        this.scale = newScale;
        
        this.panX = centerX - zoomPointX * this.scale;
        this.panY = centerY - zoomPointY * this.scale;
        
        this.logger.logVariableAssignment('zoomOut', 'scale', this.scale);
        this.updateCanvasTransform();
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('zoomOut', 'zoom_out', executionTime);
      this.logger.logFunctionExit('zoomOut', { newScale: this.scale }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'zoomOut');
      throw this.errorFactory.createNodeEditorError(
        'Failed to zoom out',
        'ZOOM_OUT_FAILED',
        'Unable to zoom out.',
        'zoomOut',
        { error: String(error) }
      );
    }
  }

  /**
   * Set zoom level to a specific value
   * 
   * @param zoomLevel - The zoom level (1.0 = 100%)
   */
  public setZoom(zoomLevel: number): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('setZoom', { zoomLevel, currentScale: this.scale });

    try {
      const newScale = Math.min(5, Math.max(0.1, zoomLevel));
      
      const scaleChanged = newScale !== this.scale;
      this.logger.logBranch('setZoom', 'scaleChanged', scaleChanged, {
        oldScale: this.scale,
        newScale
      });
      
      if (scaleChanged) {
        this.scale = newScale;
        this.logger.logVariableAssignment('setZoom', 'scale', this.scale);
        this.updateCanvasTransform();
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('setZoom', 'set_zoom', executionTime);
      this.logger.logFunctionExit('setZoom', { newScale: this.scale }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'setZoom');
      throw this.errorFactory.createNodeEditorError(
        'Failed to set zoom level',
        'SET_ZOOM_FAILED',
        'Unable to set zoom level.',
        'setZoom',
        { zoomLevel, error: String(error) }
      );
    }
  }

  /**
   * Get current scale/zoom level
   * 
   * @returns The current scale value
   */
  public getScale(): number {
    return this.scale;
  }

  /**
   * Update the collapse/expand toggle button text based on current node states
   */
  public updateCollapseToggleButton(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('updateCollapseToggleButton', { totalNodes: this.nodes.size });

    try {
      const toggleBtn = document.getElementById('toggleCollapseBtn');
      if (!toggleBtn) {
        this.logger.logWarn('Toggle collapse button not found', 'updateCollapseToggleButton');
        return;
      }

      let collapsedCount = 0;
      let totalNodes = 0;

      this.logger.logLoop('updateCollapseToggleButton', 'nodes_checking', this.nodes.size);

      for (const [nodeId] of this.nodes.entries()) {
        const nodeEl = document.getElementById(nodeId);
        if (nodeEl) {
          totalNodes++;
          const isCollapsed = nodeEl.getAttribute('data-collapsed') === 'true';
          if (isCollapsed) {
            collapsedCount++;
          }
        }
      }

      const allCollapsed = collapsedCount === totalNodes && totalNodes > 0;
      const buttonText = allCollapsed ? 'Expand All' : 'Collapse All';
      
      this.logger.logBranch('updateCollapseToggleButton', 'allCollapsed', allCollapsed, {
        collapsedCount,
        totalNodes,
        newButtonText: buttonText
      });

      toggleBtn.textContent = buttonText;

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('updateCollapseToggleButton', 'button_update', executionTime);
      this.logger.logFunctionExit('updateCollapseToggleButton', { 
        buttonText,
        collapsedCount,
        totalNodes 
      }, executionTime);

    } catch (error) {
      this.logger.logError(error as Error, 'updateCollapseToggleButton');
    }
  }

  /**
   * Collapse all nodes in the graph
   */
  public collapseAllNodes(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('collapseAllNodes', { totalNodes: this.nodes.size });

    try {
      let collapsedCount = 0;
      
      this.logger.logLoop('collapseAllNodes', 'nodes_processing', this.nodes.size);
      
      for (const [nodeId] of this.nodes.entries()) {
        const nodeEl = document.getElementById(nodeId);
        const isCurrentlyCollapsed = nodeEl?.getAttribute('data-collapsed') === 'true';
        
        this.logger.logBranch('collapseAllNodes', 'isCurrentlyCollapsed', isCurrentlyCollapsed, {
          nodeId
        });
        
        if (!isCurrentlyCollapsed && nodeEl) {
          const blocksEl = nodeEl.querySelector('.node-blocks') as HTMLElement;
          const iconEl = nodeEl.querySelector('.collapse-icon') as HTMLElement;
          
          if (blocksEl && iconEl) {
            blocksEl.style.display = 'none';
            iconEl.textContent = '▶';
            nodeEl.setAttribute('data-collapsed', 'true');
            collapsedCount++;
            
            this.logger.logInfo('Node collapsed', 'collapseAllNodes', { nodeId });
          }
        }
      }
      
      this.updateConnections();
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('collapseAllNodes', 'collapse_all', executionTime);
      this.logger.logFunctionExit('collapseAllNodes', { 
        totalNodes: this.nodes.size,
        collapsedCount 
      }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'collapseAllNodes');
      throw this.errorFactory.createNodeEditorError(
        'Failed to collapse all nodes',
        'COLLAPSE_ALL_FAILED',
        'Unable to collapse all nodes.',
        'collapseAllNodes',
        { totalNodes: this.nodes.size, error: String(error) }
      );
    }
  }

  /**
   * Expand all nodes in the graph
   */
  public expandAllNodes(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('expandAllNodes', { totalNodes: this.nodes.size });

    try {
      let expandedCount = 0;
      
      this.logger.logLoop('expandAllNodes', 'nodes_processing', this.nodes.size);
      
      for (const [nodeId] of this.nodes.entries()) {
        const nodeEl = document.getElementById(nodeId);
        const isCurrentlyCollapsed = nodeEl?.getAttribute('data-collapsed') === 'true';
        
        this.logger.logBranch('expandAllNodes', 'isCurrentlyCollapsed', isCurrentlyCollapsed, {
          nodeId
        });
        
        if (isCurrentlyCollapsed && nodeEl) {
          const blocksEl = nodeEl.querySelector('.node-blocks') as HTMLElement;
          const iconEl = nodeEl.querySelector('.collapse-icon') as HTMLElement;
          
          if (blocksEl && iconEl) {
            blocksEl.style.display = 'block';
            iconEl.textContent = '▼';
            nodeEl.setAttribute('data-collapsed', 'false');
            expandedCount++;
            
            this.logger.logInfo('Node expanded', 'expandAllNodes', { nodeId });
          }
        }
      }
      
      this.updateConnections();
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('expandAllNodes', 'expand_all', executionTime);
      this.logger.logFunctionExit('expandAllNodes', { 
        totalNodes: this.nodes.size,
        expandedCount 
      }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'expandAllNodes');
      throw this.errorFactory.createNodeEditorError(
        'Failed to expand all nodes',
        'EXPAND_ALL_FAILED',
        'Unable to expand all nodes.',
        'expandAllNodes',
        { totalNodes: this.nodes.size, error: String(error) }
      );
    }
  }

  /**
   * Reset canvas view to default position and scale
   */
  public resetView(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('resetView', {
      currentPanX: this.panX,
      currentPanY: this.panY,
      currentScale: this.scale
    });

    try {
      this.panX = 0;
      this.panY = 0;
      this.scale = 1;
      
      this.logger.logVariableAssignment('resetView', 'panX', this.panX);
      this.logger.logVariableAssignment('resetView', 'panY', this.panY);
      this.logger.logVariableAssignment('resetView', 'scale', this.scale);
      
      this.updateCanvasTransform();
      
      // Update zoom slider to reflect the reset
      const zoomSlider = document.getElementById('zoomSlider') as HTMLInputElement;
      const zoomValue = document.getElementById('zoomValue');
      if (zoomSlider && zoomValue) {
        zoomSlider.value = '100';
        zoomValue.textContent = '100%';
        this.logger.logInfo('Zoom slider reset to 100%', 'resetView');
      }
      
      this.logger.logInfo('View reset successfully', 'resetView');
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('resetView', 'view_reset', executionTime);
      this.logger.logFunctionExit('resetView', undefined, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'resetView');
      
      throw this.errorFactory.createNodeEditorError(
        'Failed to reset view',
        'RESET_VIEW_FAILED',
        'Unable to reset the view.',
        'resetView',
        { error: String(error) }
      );
    }
  }

  /**
   * Calculate the actual height of a node based on its content
   * 
   * @param nodeId - ID of the node to measure
   * @returns The actual height of the node element
   * @private
   */
  private getNodeHeight(nodeId: string): number {
    const nodeEl = document.getElementById(nodeId);
    if (nodeEl) {
      // For collapsed nodes, use a smaller height
      const isCollapsed = nodeEl.getAttribute('data-collapsed') === 'true';
      if (isCollapsed) {
        return 60; // Approximate height of just the header
      }
      return nodeEl.offsetHeight;
    }
    return this.NODE_HEIGHT; // Default fallback
  }

  /**
   * Adjust vertical positions based on actual node heights
   * 
   * @param layoutResults - Initial layout results to adjust
   * @param nodeHeights - Map of node IDs to their actual heights
   * @private
   */
  private adjustVerticalPositions(
    layoutResults: Array<{nodeId: string; position: {x: number; y: number}}>,
    nodeHeights: Map<string, number>
  ): void {
    this.logger.logFunctionEntry('adjustVerticalPositions');

    try {
      // Group nodes by depth level
      const nodesByDepth = new Map<number, Array<{nodeId: string; position: {x: number; y: number}}>>();
      
      for (const result of layoutResults) {
        const node = this.nodes.get(result.nodeId);
        if (node) {
          const depth = node.depth;
          if (!nodesByDepth.has(depth)) {
            nodesByDepth.set(depth, []);
          }
          nodesByDepth.get(depth)!.push(result);
        }
      }

      // Calculate cumulative Y positions for each depth level
      let currentY = 0;
      const depthYPositions = new Map<number, number>();
      
      // Process each depth level
      const sortedDepths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);
      
      for (const depth of sortedDepths) {
        depthYPositions.set(depth, currentY);
        
        // Find the maximum height in this depth level
        const nodesAtDepth = nodesByDepth.get(depth) || [];
        let maxHeight = 0;
        
        for (const nodeResult of nodesAtDepth) {
          const height = nodeHeights.get(nodeResult.nodeId) || this.NODE_HEIGHT;
          maxHeight = Math.max(maxHeight, height);
        }
        
        // Move to next depth level with spacing
        currentY += maxHeight + 150; // 150px vertical spacing between levels to ensure no overlap
      }

      // Update all node positions with the new Y coordinates
      for (const result of layoutResults) {
        const node = this.nodes.get(result.nodeId);
        if (node) {
          const newY = depthYPositions.get(node.depth) || result.position.y;
          result.position.y = newY;
        }
      }

      this.logger.logInfo('Vertical positions adjusted', 'adjustVerticalPositions', {
        depthLevels: sortedDepths.length,
        totalHeight: currentY
      });

      this.logger.logFunctionExit('adjustVerticalPositions');

    } catch (error) {
      this.logger.logError(error as Error, 'adjustVerticalPositions');
    }
  }

  /**
   * Apply automatic layout to all nodes in the graph
   * 
   * Repositions all nodes using an optimized tree layout algorithm
   * to ensure clear visual hierarchy and no overlapping.
   */
  public autoLayout(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('autoLayout', { totalNodes: this.nodes.size });

    try {
      // Get all nodes as an array
      const nodes = Array.from(this.nodes.values());
      
      this.logger.logInfo('Starting auto layout calculation', 'autoLayout', {
        nodeCount: nodes.length
      });

      // First pass: Calculate actual node heights
      const nodeHeights = new Map<string, number>();
      for (const node of nodes) {
        const height = this.getNodeHeight(node.id);
        nodeHeights.set(node.id, height);
      }

      // Use average height for initial calculation
      const avgHeight = Array.from(nodeHeights.values()).reduce((sum, h) => sum + h, 0) / nodes.length || this.NODE_HEIGHT;

      // Use the tree layout utility with dynamic sizing
      // Increase spacing to prevent collisions
      const layout = {
        nodeWidth: this.NODE_WIDTH,
        nodeHeight: avgHeight,
        horizontalSpacing: 250,  // Increased from 200 to ensure no horizontal overlap
        verticalSpacing: 50  // Base spacing, will be adjusted per node
      };

      // Use the tree layout algorithm for initial positions
      const layoutResults = calculateTreeLayout(this.nodes, layout);
      
      // Create mutable copy for adjustments
      const mutableResults = Array.from(layoutResults.values()).map(result => ({
        nodeId: result.id,
        position: { x: result.position.x, y: result.position.y }
      }));
      
      // Second pass: Adjust vertical positions based on actual heights
      this.adjustVerticalPositions(mutableResults, nodeHeights);

      // Apply the calculated positions to nodes
      for (const result of mutableResults) {
        const node = this.nodes.get(result.nodeId);
        if (node) {
          node.position = { ...result.position };
          this.positionNode(node, result.position.x, result.position.y, true); // Enable animation
          
          this.logger.logInfo('Node repositioned', 'autoLayout', {
            nodeId: result.nodeId,
            newPosition: result.position
          });
        }
      }

      // Update connections with a delay to sync with node animations
      setTimeout(() => {
        this.updateConnections();
      }, 50); // Small delay to ensure animations have started

      // Continuously update connections during animation
      const ANIMATION_DURATION = 500;
      const UPDATE_INTERVAL = 50;
      let elapsed = 0;
      
      const connectionUpdateInterval = setInterval(() => {
        elapsed += UPDATE_INTERVAL;
        this.updateConnections();
        
        if (elapsed >= ANIMATION_DURATION) {
          clearInterval(connectionUpdateInterval);
        }
      }, UPDATE_INTERVAL);

      // Center the view on the graph and adjust zoom to fit all nodes
      this.fitAllNodesInView();

      this.logger.logInfo('Auto layout completed successfully', 'autoLayout', {
        nodesPositioned: mutableResults.length
      });

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('autoLayout', 'layout_calculation', executionTime);
      this.logger.logFunctionExit('autoLayout', { nodesPositioned: mutableResults.length }, executionTime);

    } catch (error) {
      this.logger.logError(error as Error, 'autoLayout');

      throw this.errorFactory.createNodeEditorError(
        'Failed to apply auto layout',
        'AUTO_LAYOUT_FAILED',
        'Unable to automatically arrange nodes.',
        'autoLayout',
        { error: String(error) }
      );
    }
  }

  /**
   * Set up node renaming functionality
   * 
   * @param nodeEl - The node element
   * @param node - The GraphNode
   * @private
   */
  private setupNodeRenaming(nodeEl: HTMLElement, node: GraphNode): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('setupNodeRenaming', { nodeId: node.id });

    try {
      const nameInput = nodeEl.querySelector('.node-name') as HTMLInputElement;
      
      if (!nameInput) {
        this.logger.logWarn('Name input not found', 'setupNodeRenaming', { nodeId: node.id });
        return;
      }

      // Handle blur event to save changes
      nameInput.addEventListener('blur', () => {
        const newName = nameInput.value.trim();
        if (newName && newName !== node.name) {
          node.name = newName;
          this.logger.logInfo('Node renamed', 'setupNodeRenaming', {
            nodeId: node.id,
            oldName: node.name,
            newName
          });
        } else {
          nameInput.value = node.name; // Restore original if empty
        }
      });

      // Handle enter key to save and blur
      nameInput.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nameInput.blur();
        }
      });

      // Prevent node dragging when editing name
      nameInput.addEventListener('mousedown', (e: MouseEvent) => {
        e.stopPropagation();
      });

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('setupNodeRenaming', 'setup', executionTime);
      this.logger.logFunctionExit('setupNodeRenaming', undefined, executionTime);

    } catch (error) {
      this.logger.logError(error as Error, 'setupNodeRenaming', { nodeId: node.id });
    }
  }

  /**
   * Set up node resizing functionality
   * 
   * @param nodeEl - The node element
   * @param node - The GraphNode
   * @private
   */
  private setupNodeResizing(nodeEl: HTMLElement, node: GraphNode): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('setupNodeResizing', { nodeId: node.id });

    try {
      const resizeHandle = nodeEl.querySelector('.node-resize-handle') as HTMLElement;
      
      if (!resizeHandle) {
        this.logger.logWarn('Resize handle not found', 'setupNodeResizing', { nodeId: node.id });
        return;
      }

      let isResizing = false;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;

      resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if in read-only mode
        if (this.isReadOnly) {
          this.logger.logInfo('Node resizing prevented in read-only mode', 'setupNodeResizing', {
            nodeId: node.id
          });
          return;
        }
        
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = nodeEl.offsetWidth;
        startHeight = nodeEl.offsetHeight;
        
        this.logger.logUserInteraction('node_resize_start', 'node-resize-handle', { nodeId: node.id });
      });

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        
        // Also check read-only mode during resizing
        if (this.isReadOnly) {
          isResizing = false;
          this.logger.logInfo('Node resizing stopped due to read-only mode', 'setupNodeResizing', {
            nodeId: node.id
          });
          return;
        }
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newWidth = Math.max(300, Math.min(1200, startWidth + deltaX));
        const newHeight = Math.max(150, startHeight + deltaY);
        
        nodeEl.style.width = newWidth + 'px';
        nodeEl.style.minHeight = newHeight + 'px';
        
        // Scale blocks proportionally with node dimensions
        this.scaleBlocksWithNode(nodeEl, newWidth, newHeight);
        
        // Update connections as node size changes
        this.updateConnections();
      };

      const handleMouseUp = () => {
        if (isResizing) {
          isResizing = false;
          this.logger.logUserInteraction('node_resize_end', 'node-resize-handle', { nodeId: node.id });
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('setupNodeResizing', 'setup', executionTime);
      this.logger.logFunctionExit('setupNodeResizing', undefined, executionTime);

    } catch (error) {
      this.logger.logError(error as Error, 'setupNodeResizing', { nodeId: node.id });
    }
  }

  /**
   * Scale blocks proportionally with node dimensions
   * 
   * @param nodeEl - The node element
   * @param nodeWidth - New node width
   * @param nodeHeight - New node height
   * @private
   */
  private scaleBlocksWithNode(nodeEl: HTMLElement, nodeWidth: number, nodeHeight: number): void {
    try {
      // Calculate scaling factors based on node dimensions
      const baseWidth = 300; // Minimum node width
      const baseHeight = 150; // Minimum node height
      const baseBlockHeight = 120; // Default block height
      
      // Scale factor based on node width (affects all blocks)
      const widthScaleFactor = Math.max(1, nodeWidth / baseWidth);
      
      // Scale factor based on node height (affects response blocks more)
      const heightScaleFactor = Math.max(1, nodeHeight / baseHeight);
      
      // Find all textareas and rendered content in this node
      const textareas = nodeEl.querySelectorAll('textarea');
      const renderedContents = nodeEl.querySelectorAll('.rendered-content');
      
      textareas.forEach((textarea: HTMLTextAreaElement) => {
        // Identify block type from parent element
        const blockEl = textarea.closest('.block');
        const isResponseBlock = blockEl?.classList.contains('response-block');
        
        if (isResponseBlock) {
          // Response blocks scale more with height changes
          const scaledHeight = Math.max(60, Math.min(400, 
            baseBlockHeight * Math.pow(heightScaleFactor, 0.6) * Math.pow(widthScaleFactor, 0.3)
          ));
          textarea.style.height = scaledHeight + 'px';
        } else {
          // Other blocks scale primarily with width changes
          const scaledHeight = Math.max(60, Math.min(400, 
            baseBlockHeight * Math.pow(widthScaleFactor, 0.4)
          ));
          textarea.style.height = scaledHeight + 'px';
        }
      });
      
      // Apply same scaling to rendered content for consistency
      renderedContents.forEach((element: Element) => {
        const renderedContent = element as HTMLElement;
        const blockEl = renderedContent.closest('.block');
        const isResponseBlock = blockEl?.classList.contains('response-block');
        
        if (isResponseBlock) {
          const scaledHeight = Math.max(60, Math.min(400, 
            baseBlockHeight * Math.pow(heightScaleFactor, 0.6) * Math.pow(widthScaleFactor, 0.3)
          ));
          renderedContent.style.height = scaledHeight + 'px';
        } else {
          const scaledHeight = Math.max(60, Math.min(400, 
            baseBlockHeight * Math.pow(widthScaleFactor, 0.4)
          ));
          renderedContent.style.height = scaledHeight + 'px';
        }
      });
      
    } catch (error) {
      this.logger.logError(error as Error, 'scaleBlocksWithNode', { nodeWidth, nodeHeight });
    }
  }

  /**
   * Set up resize functionality for blocks within a node
   * 
   * @param nodeEl - The node element containing blocks
   * @private
   */
  private setupBlockResizing(nodeEl: HTMLElement): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('setupBlockResizing');

    try {
      const resizeHandles = nodeEl.querySelectorAll('.resize-handle');
      
      resizeHandles.forEach((handle) => {
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;
        let textarea: HTMLTextAreaElement | null = null;
        
        handle.addEventListener('mousedown', (e: Event) => {
          const mouseEvent = e as MouseEvent;
          e.preventDefault();
          e.stopPropagation();
          
          // Check if in read-only mode
          if (this.isReadOnly) {
            this.logger.logInfo('Block resizing prevented in read-only mode', 'setupBlockResizing');
            return;
          }
          
          isResizing = true;
          startY = mouseEvent.clientY;
          
          const block = (handle as HTMLElement).closest('.block');
          if (block) {
            textarea = block.querySelector('textarea');
            if (textarea) {
              startHeight = textarea.offsetHeight;
            }
          }
          
          this.logger.logUserInteraction('resize_start', 'resize-handle');
        });
        
        const handleMouseMove = (e: MouseEvent) => {
          if (!isResizing || !textarea) return;
          
          // Also check read-only mode during resizing
          if (this.isReadOnly) {
            isResizing = false;
            this.logger.logInfo('Block resizing stopped due to read-only mode', 'setupBlockResizing');
            return;
          }
          
          const deltaY = e.clientY - startY;
          const newHeight = Math.max(60, Math.min(400, startHeight + deltaY));
          textarea.style.height = newHeight + 'px';
        };
        
        const handleMouseUp = () => {
          if (isResizing) {
            isResizing = false;
            this.logger.logUserInteraction('resize_end', 'resize-handle');
          }
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      });
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('setupBlockResizing', 'setup', executionTime);
      this.logger.logFunctionExit('setupBlockResizing', { handlesCount: resizeHandles.length }, executionTime);

    } catch (error) {
      this.logger.logError(error as Error, 'setupBlockResizing');
    }
  }

  /**
   * Toggle collapse state of a node
   * 
   * @param nodeId - ID of the node to toggle
   * @private
   */
  private toggleNodeCollapse(nodeId: string): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('toggleNodeCollapse', { nodeId });

    try {
      const nodeEl = document.getElementById(nodeId);
      
      if (!nodeEl) {
        this.logger.logWarn('Node element not found', 'toggleNodeCollapse', { nodeId });
        return;
      }

      const isCollapsed = nodeEl.getAttribute('data-collapsed') === 'true';
      const newState = !isCollapsed;
      
      nodeEl.setAttribute('data-collapsed', String(newState));
      
      const blocksEl = nodeEl.querySelector('.node-blocks') as HTMLElement;
      const iconEl = nodeEl.querySelector('.collapse-icon') as HTMLElement;
      
      if (blocksEl && iconEl) {
        if (newState) {
          blocksEl.style.display = 'none';
          iconEl.textContent = '▶';
          nodeEl.classList.add('collapsed');
        } else {
          blocksEl.style.display = 'block';
          iconEl.textContent = '▼';
          nodeEl.classList.remove('collapsed');
        }
      }
      
      this.logger.logInfo('Node collapse toggled', 'toggleNodeCollapse', {
        nodeId,
        collapsed: newState
      });

      // Update the collapse toggle button to reflect current state
      this.updateCollapseToggleButton();

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('toggleNodeCollapse', 'toggle', executionTime);
      this.logger.logFunctionExit('toggleNodeCollapse', { collapsed: newState }, executionTime);

    } catch (error) {
      this.logger.logError(error as Error, 'toggleNodeCollapse', { nodeId });
    }
  }

  /**
   * Toggle minimize state of a block
   * 
   * @param blockId - ID of the block to toggle
   * @private
   */
  private toggleBlockMinimize(blockId: string): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('toggleBlockMinimize', { blockId });

    try {
      const blockEl = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
      
      if (!blockEl) {
        this.logger.logWarn('Block element not found', 'toggleBlockMinimize', { blockId });
        return;
      }

      const isMinimized = blockEl.getAttribute('data-minimized') === 'true';
      const newState = !isMinimized;
      
      blockEl.setAttribute('data-minimized', String(newState));
      
      const contentEl = blockEl.querySelector('.block-content') as HTMLElement;
      const iconEl = blockEl.querySelector('.minimize-icon') as HTMLElement;
      
      if (contentEl && iconEl) {
        if (newState) {
          contentEl.style.display = 'none';
          iconEl.textContent = '▶';
        } else {
          contentEl.style.display = 'block';
          iconEl.textContent = '▼';
        }
      }
      
      this.logger.logInfo('Block minimize toggled', 'toggleBlockMinimize', {
        blockId,
        minimized: newState
      });

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('toggleBlockMinimize', 'toggle', executionTime);
      this.logger.logFunctionExit('toggleBlockMinimize', { minimized: newState }, executionTime);

    } catch (error) {
      this.logger.logError(error as Error, 'toggleBlockMinimize', { blockId });
    }
  }

  /**
   * Handle preview toggle for blocks supporting preview functionality
   * @param blockId - ID of the block to toggle preview for
   * @param mode - Specific mode to set (raw or rendered)
   * @private
   */
  private async handlePreviewToggle(blockId: string, mode?: 'raw' | 'rendered'): Promise<void> {
    const startTime = performance.now();
    this.logger.logFunctionEntry('handlePreviewToggle', { blockId, mode });

    try {
      // Preserve block size before toggling
      const targetMode = mode || 'rendered'; // Default to rendered if toggling
      this.blockSizeManager.preserveBlockSize(blockId as BlockId, targetMode);
      
      if (mode) {
        // Set specific mode
        await this.previewToggleManager.setBlockPreviewMode(blockId as any, mode, 'button');
      } else {
        // Toggle mode
        await this.previewToggleManager.toggleBlockPreview(blockId as any);
      }
      
      // Re-render the node to update the button state
      const blockEl = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
      if (blockEl) {
        const nodeEl = blockEl.closest('.node') as HTMLElement;
        if (nodeEl) {
          const nodeId = nodeEl.getAttribute('data-node-id');
          if (nodeId) {
            const node = this.nodes.get(nodeId);
            if (node) {
              this.renderNode(node);
            }
          }
        }
      }

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('handlePreviewToggle', 'toggle_operation', executionTime);
      
      this.logger.logFunctionExit('handlePreviewToggle', { 
        blockId,
        executionTime
      });

    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.logger.logError(error as Error, 'handlePreviewToggle', {
        blockId,
        executionTime
      });
      
      // Error is already logged, no need for additional user message
    }
  }

  /**
   * Toggle the expansion state of a chat continuation interface
   * 
   * @param nodeId - ID of the node containing the chat
   * @param blockId - ID of the response block
   * @private
   */
  private toggleChatExpansion(nodeId: string, blockId: string): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('toggleChatExpansion', { nodeId, blockId });
    
    try {
      const stateKey = `${nodeId}_${blockId}`;
      const state = this.chatContinuationStates.get(stateKey);
      
      if (!state) {
        this.logger.logWarn('Chat continuation state not found', 'toggleChatExpansion', { nodeId, blockId });
        return;
      }
      
      // Toggle expansion state
      state.isExpanded = !state.isExpanded;
      state.lastUpdated = Date.now();
      
      // Update DOM
      const chatEl = document.querySelector(`.chat-continuation[data-node-id="${nodeId}"][data-block-id="${blockId}"]`) as HTMLElement;
      if (chatEl) {
        chatEl.setAttribute('data-expanded', String(state.isExpanded));
        
        const expandIcon = chatEl.querySelector('.expand-icon') as HTMLElement;
        const expandText = chatEl.querySelector('.expand-text') as HTMLElement;
        const content = chatEl.querySelector('.chat-continuation-content') as HTMLElement;
        
        if (expandIcon) expandIcon.textContent = state.isExpanded ? '▼' : '▶';
        if (expandText) expandText.textContent = `${state.isExpanded ? 'Hide' : 'Continue'} conversation`;
        if (content) content.style.display = state.isExpanded ? 'block' : 'none';
        
        // Focus textarea if expanding
        if (state.isExpanded) {
          const textarea = content.querySelector('.chat-input') as HTMLTextAreaElement;
          if (textarea) {
            setTimeout(() => textarea.focus(), 100);
          }
        }
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('toggleChatExpansion', 'toggle', executionTime);
      this.logger.logFunctionExit('toggleChatExpansion', { nodeId, blockId, expanded: state.isExpanded }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'toggleChatExpansion', { nodeId, blockId });
    }
  }

  /**
   * Submit a chat continuation to the LLM
   * 
   * @param nodeId - ID of the node containing the chat
   * @param blockId - ID of the response block
   * @private
   */
  private async submitChatContinuation(nodeId: string, blockId: string): Promise<void> {
    const startTime = performance.now();
    this.logger.logFunctionEntry('submitChatContinuation', { nodeId, blockId });
    
    try {
      const stateKey = `${nodeId}_${blockId}`;
      const state = this.chatContinuationStates.get(stateKey);
      
      if (!state) {
        this.logger.logWarn('Chat continuation state not found', 'submitChatContinuation', { nodeId, blockId });
        return;
      }
      
      // Get chat input
      const chatEl = document.querySelector(`.chat-continuation[data-node-id="${nodeId}"][data-block-id="${blockId}"]`) as HTMLElement;
      const textarea = chatEl?.querySelector('.chat-input') as HTMLTextAreaElement;
      
      if (!textarea || !textarea.value.trim()) {
        this.logger.logWarn('No chat input provided', 'submitChatContinuation', { nodeId, blockId });
        return;
      }
      
      const chatInput = textarea.value.trim();
      
      // Update state to loading
      state.isLoading = true;
      state.hasError = false;
      delete state.errorMessage;
      state.lastUpdated = Date.now();
      
      // Update UI
      const submitBtn = chatEl.querySelector('.submit-chat') as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }
      textarea.disabled = true;
      
      try {
        // Get the full conversation context
        const node = this.nodes.get(nodeId);
        if (!node) {
          throw new Error(`Node ${nodeId} not found`);
        }
        
        // Build conversation history
        let conversationContext = '';
        for (const block of node.blocks) {
          if (block.type === 'prompt') {
            conversationContext += `User: ${block.content}\n\n`;
          } else if (block.type === 'response') {
            conversationContext += `Assistant: ${block.content}\n\n`;
          }
        }
        
        // Add the new chat input
        conversationContext += `User: ${chatInput}`;
        
        // Create a new response block
        const responseBlockId = this.createResponseBlock(nodeId, '');
        
        // Submit to Gemini with streaming
        let responseContent = '';
        await geminiService.sendMessage(
          conversationContext,
          (chunk: string) => {
            responseContent += chunk;
            this.updateStreamingResponse(nodeId, responseContent, responseBlockId);
          }
        );
        
        // Initialize preview mode for the new response
        await this.previewToggleManager.initializeResponseBlockPreview(responseBlockId as any);
        
        // Clear the chat input and collapse
        textarea.value = '';
        state.isExpanded = false;
        state.isLoading = false;
        
        // Update UI
        const newChatEl = document.querySelector(`.chat-continuation[data-node-id="${nodeId}"][data-block-id="${blockId}"]`) as HTMLElement;
        if (newChatEl) {
          newChatEl.setAttribute('data-expanded', 'false');
          const expandIcon = newChatEl.querySelector('.expand-icon') as HTMLElement;
          const expandText = newChatEl.querySelector('.expand-text') as HTMLElement;
          const content = newChatEl.querySelector('.chat-continuation-content') as HTMLElement;
          
          if (expandIcon) expandIcon.textContent = '▶';
          if (expandText) expandText.textContent = 'Continue conversation';
          if (content) content.style.display = 'none';
        }
        
        this.logger.logInfo('Chat continuation submitted successfully', 'submitChatContinuation', {
          nodeId,
          blockId,
          inputLength: chatInput.length,
          responseLength: responseContent.length
        });
        
      } catch (error) {
        // Update state with error
        state.hasError = true;
        state.errorMessage = error instanceof Error ? error.message : 'Failed to send message';
        state.isLoading = false;
        
        // Re-render to show error
        const errorNode = this.nodes.get(nodeId);
        if (errorNode) {
          this.rerenderNode(errorNode);
        }
        
        throw error;
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('submitChatContinuation', 'chat_submission', executionTime);
      this.logger.logFunctionExit('submitChatContinuation', { nodeId, blockId }, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'submitChatContinuation', { nodeId, blockId });
      
      // Re-enable UI on error
      const chatEl = document.querySelector(`.chat-continuation[data-node-id="${nodeId}"][data-block-id="${blockId}"]`) as HTMLElement;
      if (chatEl) {
        const submitBtn = chatEl.querySelector('.submit-chat') as HTMLButtonElement;
        const textarea = chatEl.querySelector('.chat-input') as HTMLTextAreaElement;
        
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send';
        }
        if (textarea) {
          textarea.disabled = false;
        }
      }
    }
  }

  // Removed handleResponseComplete method since auto-rendering is disabled


  /**
   * Fit all nodes in the canvas view by adjusting zoom and pan
   * 
   * @private
   */
  private fitAllNodesInView(): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('fitAllNodesInView');

    try {
      if (this.nodes.size === 0) {
        this.logger.logWarn('No nodes to fit in view', 'fitAllNodesInView');
        return;
      }

      // Calculate bounding box of all nodes
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (const node of this.nodes.values()) {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        const nodeEl = document.getElementById(node.id);
        const nodeWidth = nodeEl ? nodeEl.offsetWidth : this.NODE_WIDTH;
        const nodeHeight = nodeEl ? nodeEl.offsetHeight : this.NODE_HEIGHT;
        
        maxX = Math.max(maxX, node.position.x + nodeWidth);
        maxY = Math.max(maxY, node.position.y + nodeHeight);
      }

      // Add padding around the bounding box
      const padding = 50;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;

      // Calculate bounding box dimensions
      const graphWidth = maxX - minX;
      const graphHeight = maxY - minY;

      // Get canvas dimensions
      const canvasRect = this.canvas.getBoundingClientRect();
      const canvasWidth = canvasRect.width;
      const canvasHeight = canvasRect.height;

      // Calculate the scale needed to fit all nodes
      const scaleX = canvasWidth / graphWidth;
      const scaleY = canvasHeight / graphHeight;
      const newScale = Math.min(scaleX, scaleY, 1.0); // Don't zoom in more than 100%

      // Apply the new scale
      this.scale = Math.max(0.1, Math.min(5, newScale)); // Clamp between 0.1 and 5

      // Calculate center of bounding box
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Calculate pan to center the graph
      this.panX = (canvasWidth / 2) - (centerX * this.scale);
      this.panY = (canvasHeight / 2) - (centerY * this.scale);

      // Update the canvas transform
      this.updateCanvasTransform();

      // Update zoom slider UI
      const zoomSlider = document.getElementById('zoomSlider') as HTMLInputElement;
      const zoomValue = document.getElementById('zoomValue');
      if (zoomSlider && zoomValue) {
        const zoomPercent = Math.round(this.scale * 100);
        zoomSlider.value = zoomPercent.toString();
        zoomValue.textContent = `${zoomPercent}%`;
      }

      this.logger.logInfo('Fit all nodes in view', 'fitAllNodesInView', {
        boundingBox: { minX, minY, maxX, maxY },
        graphDimensions: { width: graphWidth, height: graphHeight },
        canvasDimensions: { width: canvasWidth, height: canvasHeight },
        newScale: this.scale,
        pan: { panX: this.panX, panY: this.panY }
      });

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('fitAllNodesInView', 'fit_view', executionTime);
      this.logger.logFunctionExit('fitAllNodesInView', { scale: this.scale }, executionTime);

    } catch (error) {
      this.logger.logError(error as Error, 'fitAllNodesInView');
      // Don't throw, this is a helper method
    }
  }

  /**
   * Export current graph data as JSON
   * 
   * @returns Serializable representation of the graph
   */
  public exportData(): object {
    const startTime = performance.now();
    this.logger.logFunctionEntry('exportData', { totalNodes: this.nodes.size });

    try {
      const data = {
        nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
          id,
          parentId: node.parentId,
          children: node.children,
          position: node.position,
          depth: node.depth,
          blocks: node.blocks
        })),
        metadata: {
          exportTimestamp: new Date().toISOString(),
          nodeCount: this.nodes.size,
          version: '1.0.0'
        }
      };
      
      this.logger.logInfo('Data exported successfully', 'exportData', {
        nodeCount: this.nodes.size,
        dataSize: JSON.stringify(data).length
      });
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('exportData', 'data_export', executionTime);
      this.logger.logFunctionExit('exportData', { nodeCount: this.nodes.size }, executionTime);
      
      return data;
      
    } catch (error) {
      this.logger.logError(error as Error, 'exportData');
      
      throw this.errorFactory.createNodeEditorError(
        'Failed to export data',
        'EXPORT_FAILED',
        'Unable to export your data.',
        'exportData',
        { error: String(error) }
      );
    }
  }

  // Additional public methods expected by tests

  /**
   * Get all nodes in the graph
   */
  public getNodes(): Map<string, GraphNode> {
    return new Map(this.nodes);
  }

  /**
   * Get current canvas state
   */
  public getCanvasState() {
    return {
      pan: { x: this.panX, y: this.panY },
      zoom: this.scale
    };
  }

  /**
   * Move a node to a new position
   */
  public moveNode(nodeId: string, position: { x: number; y: number }): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    if (isNaN(position.x) || isNaN(position.y) || !isFinite(position.x) || !isFinite(position.y)) {
      throw new Error('Invalid position coordinates');
    }
    node.position = position;
    this.renderNode(node);
    this.updateConnections();
  }

  /**
   * Add a block to a node
   */
  public addBlock(nodeId: string, type: string, content: string): string {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    // Add random suffix to ensure unique IDs even when called in quick succession
    const blockId = `${nodeId}_block_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const newBlock = {
      id: blockId,
      type: type as any,
      content,
      position: node.blocks.length
    };
    node.blocks.push(newBlock);
    this.renderNode(node);
    return blockId;
  }

  /**
   * Delete a block from a node
   */
  public deleteBlock(nodeId: string, blockId: string): void {
    this.logger.logFunctionEntry('deleteBlock', { nodeId, blockId });
    
    const node = this.nodes.get(nodeId);
    if (!node) {
      this.logger.logError(new Error(`Node ${nodeId} not found`), 'deleteBlock', { nodeId, blockId });
      throw new Error(`Node ${nodeId} not found`);
    }
    
    // Log all existing block IDs for debugging
    const existingBlockIds = node.blocks.map(b => b.id);
    this.logger.logInfo('Block deletion attempt', 'deleteBlock', {
      nodeId,
      blockId,
      existingBlockIds,
      blockCount: node.blocks.length
    });
    
    const index = node.blocks.findIndex(b => b.id === blockId);
    if (index === -1) {
      this.logger.logError(new Error(`Block ${blockId} not found`), 'deleteBlock', { 
        nodeId, 
        blockId, 
        existingBlockIds,
        availableBlocks: node.blocks.map(b => ({ id: b.id, type: b.type }))
      });
      throw new Error(`Block ${blockId} not found`);
    }
    
    // Clean up preview state for the deleted block
    this.previewToggleManager.cleanupDeletedBlocks([blockId as any]);
    
    // Remove the block from DOM first (before updating data model)
    this.removeBlockFromDOM(blockId);
    
    // Then update the data model
    node.blocks.splice(index, 1);
    // Update positions
    node.blocks.forEach((block, i) => {
      (block as any).position = i;
    });
    
    // Update connections since node content changed
    this.updateConnections();
    
    this.logger.logFunctionExit('deleteBlock', { 
      nodeId, 
      blockId, 
      remainingBlocks: node.blocks.length 
    });
    
    this.emitGraphChanged();
  }

  /**
   * Remove a block from the DOM without full node re-rendering
   * This provides in-place deletion for a better user experience
   * 
   * @param blockId - ID of the block to remove from DOM
   * @private
   */
  private removeBlockFromDOM(blockId: string): void {
    this.logger.logFunctionEntry('removeBlockFromDOM', { blockId });
    
    try {
      // Find the block element in the DOM
      const blockElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
      
      if (blockElement) {
        this.logger.logInfo('Removing block element from DOM', 'removeBlockFromDOM', { 
          blockId,
          elementFound: true 
        });
        
        // Add a smooth removal animation
        blockElement.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        blockElement.style.opacity = '0';
        blockElement.style.transform = 'translateX(-10px)';
        
        // Remove the element after animation
        setTimeout(() => {
          if (blockElement.parentNode) {
            blockElement.parentNode.removeChild(blockElement);
            this.logger.logInfo('Block element removed from DOM', 'removeBlockFromDOM', { blockId });
          }
        }, 200);
        
      } else {
        this.logger.logWarn('Block element not found in DOM', 'removeBlockFromDOM', { blockId });
      }
      
      this.logger.logFunctionExit('removeBlockFromDOM', { blockId });
      
    } catch (error) {
      this.logger.logError(error as Error, 'removeBlockFromDOM', { blockId });
      // Don't throw - fallback to the data model update
    }
  }

  /**
   * Pan the canvas
   */
  public panCanvas(deltaX: number, deltaY: number): void {
    this.panX += deltaX;
    this.panY += deltaY;
    this.updateCanvasTransform();
  }

  /**
   * Calculate tree layout (already exists internally, expose for tests)
   */
  public calculateTreeLayout(): void {
    this.autoLayout();
  }

  /**
   * Render connections (already exists internally, expose for tests)
   */
  public renderConnections(): void {
    this.updateConnections();
  }

  /**
   * Get the branching service instance
   * @returns The NodeBranchingService instance
   */
  public getBranchingService(): NodeBranchingService {
    return this.branchingService;
  }

  /**
   * Get the version history manager instance
   * @returns The VersionHistoryManager instance
   */
  public getVersionHistoryManager(): VersionHistoryManager {
    return this.versionHistoryManager;
  }

  /**
   * Export user data for persistence
   * @returns Array of GraphNode objects
   */
  public exportUserData(): GraphNode[] {
    this.logger.logFunctionEntry('exportUserData');
    
    try {
      const nodes = Array.from(this.nodes.values());
      this.logger.logInfo('User data exported', 'exportUserData', { nodeCount: nodes.length });
      return nodes;
    } catch (error) {
      this.logger.logError(error as Error, 'exportUserData');
      return [];
    } finally {
      this.logger.logFunctionExit('exportUserData');
    }
  }

  /**
   * Import user data from persistence
   * @param nodes - Array of GraphNode objects
   * @param canvasState - Optional canvas state to restore
   */
  public async importUserData(nodes: GraphNode[], canvasState?: any): Promise<void> {
    this.logger.logFunctionEntry('importUserData', { nodeCount: nodes.length });
    
    try {
      // Clear existing nodes
      this.nodes.clear();
      this.canvasContent.innerHTML = '';
      
      // Import nodes
      for (const nodeData of nodes) {
        const node: GraphNode = {
          ...nodeData
        };
        
        this.nodes.set(node.id, node);
        this.renderNode(node);
      }
      
      // Restore canvas state if provided
      if (canvasState) {
        if (canvasState.pan) {
          this.panX = canvasState.pan.x;
          this.panY = canvasState.pan.y;
        }
        if (canvasState.zoom) {
          this.scale = canvasState.zoom;
        }
        this.updateCanvasTransform();
      }
      
      // Update connections
      this.updateConnections();
      
      this.logger.logInfo('User data imported successfully', 'importUserData', { 
        nodeCount: nodes.length,
        hasCanvasState: !!canvasState 
      });
    } catch (error) {
      this.logger.logError(error as Error, 'importUserData');
      throw error;
    } finally {
      this.logger.logFunctionExit('importUserData');
    }
  }


  /**
   * Subscribe to graph changes for auto-save
   * @param callback - Callback to call when graph changes
   */
  public onGraphChange(callback: () => void): void {
    // Add listener for all graph modifications
    this.canvas.addEventListener('graphChanged', callback);
  }

  /**
   * Emit graph changed event
   * @private
   */
  private emitGraphChanged(): void {
    this.canvas.dispatchEvent(new CustomEvent('graphChanged'));
  }


}