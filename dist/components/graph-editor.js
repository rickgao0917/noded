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
import { Logger } from '../utils/logger.js';
import { Validator } from '../utils/type-guards.js';
import { ErrorFactory, NodeEditorError, TreeStructureError, ValidationError } from '../types/errors.js';
/**
 * Main graph editor class managing interactive node tree structure
 */
export class GraphEditor {
    /**
     * Initialize graph editor with DOM elements
     *
     * @param canvas - Main canvas element for background interactions
     * @param canvasContent - Content container for transforms
     * @param connectionsEl - SVG element for rendering connections
     *
     * @throws {DOMError} When required DOM elements are invalid
     * @throws {NodeEditorError} When initialization fails
     */
    constructor(canvas, canvasContent, connectionsEl) {
        this.nodes = new Map();
        this.selectedNode = null;
        this.nodeCounter = 0;
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.isDragging = false;
        this.lastPanX = 0;
        this.lastPanY = 0;
        const startTime = performance.now();
        this.logger = new Logger('GraphEditor');
        this.validator = new Validator('graph-editor-init');
        this.errorFactory = new ErrorFactory('graph-editor-init');
        this.logger.logFunctionEntry('constructor', {
            canvasTagName: canvas === null || canvas === void 0 ? void 0 : canvas.tagName,
            contentTagName: canvasContent === null || canvasContent === void 0 ? void 0 : canvasContent.tagName,
            connectionsTagName: connectionsEl === null || connectionsEl === void 0 ? void 0 : connectionsEl.tagName
        });
        try {
            // Validate DOM elements with comprehensive error handling
            this.validator.validateDOMElement(canvas, 'HTMLElement', 'constructor');
            this.validator.validateDOMElement(canvasContent, 'HTMLElement', 'constructor');
            this.validator.validateDOMElement(connectionsEl, 'SVGElement', 'constructor');
            this.canvas = canvas;
            this.canvasContent = canvasContent;
            this.connectionsEl = connectionsEl;
            this.logger.logVariableAssignment('constructor', 'canvas', canvas.id || 'unnamed');
            this.logger.logVariableAssignment('constructor', 'canvasContent', canvasContent.id || 'unnamed');
            this.logger.logVariableAssignment('constructor', 'connectionsEl', connectionsEl.id || 'unnamed');
            this.setupEventListeners();
            this.createSampleData();
            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('constructor', 'initialization', executionTime);
            this.logger.logFunctionExit('constructor', 'GraphEditor instance', executionTime);
        }
        catch (error) {
            this.logger.logError(error, 'constructor', {
                canvasProvided: !!canvas,
                canvasContentProvided: !!canvasContent,
                connectionsElProvided: !!connectionsEl
            });
            if (error instanceof Error) {
                throw error;
            }
            throw this.errorFactory.createNodeEditorError('Failed to initialize GraphEditor', 'INIT_FAILED', 'Unable to initialize the graph editor. Please refresh the page.', 'constructor', { error: String(error) }, 'critical');
        }
    }
    /**
     * Set up DOM event listeners for user interactions
     *
     * @private
     */
    setupEventListeners() {
        const startTime = performance.now();
        this.logger.logFunctionEntry('setupEventListeners');
        try {
            // Canvas panning event handlers
            this.canvas.addEventListener('mousedown', (e) => {
                var _a;
                this.logger.logUserInteraction('canvas_mousedown', this.canvas.id, {
                    target: (_a = e.target) === null || _a === void 0 ? void 0 : _a.tagName,
                    clientX: e.clientX,
                    clientY: e.clientY
                });
                const isBackgroundClick = e.target === this.canvas || e.target === this.canvasContent;
                this.logger.logBranch('setupEventListeners', 'isBackgroundClick', isBackgroundClick);
                if (isBackgroundClick) {
                    this.isPanning = true;
                    this.lastPanX = e.clientX;
                    this.lastPanY = e.clientY;
                    this.logger.logVariableAssignment('setupEventListeners', 'isPanning', true);
                    this.logger.logVariableAssignment('setupEventListeners', 'lastPanX', e.clientX);
                    this.logger.logVariableAssignment('setupEventListeners', 'lastPanY', e.clientY);
                }
            });
            document.addEventListener('mousemove', (e) => {
                // Log cursor movement (will be filtered from terminal output)
                this.logger.logUserInteraction('mouse_move', undefined, {
                    x: e.clientX,
                    y: e.clientY,
                    isPanning: this.isPanning,
                    isDragging: this.isDragging
                });
                const shouldPan = this.isPanning && !this.isDragging;
                this.logger.logBranch('setupEventListeners', 'shouldPan', shouldPan, {
                    isPanning: this.isPanning,
                    isDragging: this.isDragging
                });
                if (shouldPan) {
                    const deltaX = e.clientX - this.lastPanX;
                    const deltaY = e.clientY - this.lastPanY;
                    this.panX += deltaX;
                    this.panY += deltaY;
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
                this.isPanning = false;
                this.isDragging = false;
                this.logger.logVariableAssignment('setupEventListeners', 'isPanning', false);
                this.logger.logVariableAssignment('setupEventListeners', 'isDragging', false);
            });
            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('setupEventListeners', 'event_listener_setup', executionTime);
            this.logger.logFunctionExit('setupEventListeners', undefined, executionTime);
        }
        catch (error) {
            this.logger.logError(error, 'setupEventListeners');
            throw this.errorFactory.createNodeEditorError('Failed to setup event listeners', 'EVENT_SETUP_FAILED', 'Unable to setup user interactions.', 'setupEventListeners', { error: String(error) }, 'high');
        }
    }
    /**
     * Update canvas content transform for panning and scaling
     *
     * @private
     */
    updateCanvasTransform() {
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
        }
        catch (error) {
            this.logger.logError(error, 'updateCanvasTransform', {
                panX: this.panX,
                panY: this.panY,
                scale: this.scale
            });
            throw this.errorFactory.createDOMError('Failed to update canvas transform', 'TRANSFORM_FAILED', 'Unable to update view. Please try refreshing.', 'updateCanvasTransform');
        }
    }
    /**
     * Create initial sample data for demonstration
     *
     * @private
     * @throws {NodeEditorError} When sample data creation fails
     */
    createSampleData() {
        const startTime = performance.now();
        this.logger.logFunctionEntry('createSampleData');
        try {
            // Create root node with prompt, response, and markdown blocks
            const root = this.createNode(null, [
                { id: 'root_prompt', type: 'prompt', content: 'What is the capital of France?', position: 0 },
                { id: 'root_response', type: 'response', content: 'The capital of France is Paris, a major European city and global center for art, fashion, gastronomy, and culture.', position: 1 },
                { id: 'root_markdown', type: 'markdown', content: '# Additional Information\\n\\nParis is located in northern France, on the banks of the Seine River.', position: 2 }
            ]);
            this.logger.logInfo('Created root node', 'createSampleData', { nodeId: root.id });
            this.positionNode(root, 400, 100);
            // Create child nodes representing edits/variations
            const child1 = this.createNode(root.id, [
                { id: 'child1_prompt', type: 'prompt', content: 'Tell me more about the history of Paris.', position: 0 },
                { id: 'child1_response', type: 'response', content: 'Paris has a rich history dating back over 2,000 years. Originally a Celtic settlement called Lutetia, it became the capital of France in the 12th century.', position: 1 }
            ]);
            const child2 = this.createNode(root.id, [
                { id: 'child2_prompt', type: 'prompt', content: 'What are the main attractions in Paris?', position: 0 },
                { id: 'child2_response', type: 'response', content: 'Major attractions include the Eiffel Tower, Louvre Museum, Notre-Dame Cathedral, Arc de Triomphe, and Champs-Élysées.', position: 1 }
            ]);
            this.logger.logInfo('Created child nodes', 'createSampleData', {
                child1Id: child1.id,
                child2Id: child2.id,
                totalNodes: this.nodes.size
            });
            // Create grandchild nodes
            const grandchild1 = this.createNode(child1.id, [
                { id: 'gc1_prompt', type: 'prompt', content: 'What role did Paris play in the French Revolution?', position: 0 },
                { id: 'gc1_response', type: 'response', content: 'Paris was the epicenter of the French Revolution (1789-1799). Key events like the storming of the Bastille took place here.', position: 1 },
                { id: 'gc1_markdown', type: 'markdown', content: '## Key Revolutionary Sites\\n\\n- **Bastille**: Prison stormed on July 14, 1789\\n- **Place de la Révolution**: Site of many executions\\n- **Tuileries Palace**: Royal residence during the revolution', position: 2 }
            ]);
            const grandchild2 = this.createNode(child1.id, [
                { id: 'gc2_prompt', type: 'prompt', content: 'How did Paris develop during the Medieval period?', position: 0 },
                { id: 'gc2_response', type: 'response', content: 'During the Medieval period, Paris grew from a small island settlement to become the largest city in Europe by 1300, with impressive Gothic architecture.', position: 1 }
            ]);
            this.logger.logInfo('Created grandchild nodes', 'createSampleData', {
                grandchild1Id: grandchild1.id,
                grandchild2Id: grandchild2.id,
                finalNodeCount: this.nodes.size
            });
            this.layoutTree();
            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('createSampleData', 'sample_data_creation', executionTime);
            this.logger.logFunctionExit('createSampleData', { nodeCount: this.nodes.size }, executionTime);
        }
        catch (error) {
            this.logger.logError(error, 'createSampleData');
            throw this.errorFactory.createNodeEditorError('Failed to create sample data', 'SAMPLE_DATA_FAILED', 'Unable to initialize example content.', 'createSampleData', { error: String(error) }, 'medium');
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
    createNode(parentId = null, blocks = []) {
        var _a, _b;
        const startTime = performance.now();
        this.logger.logFunctionEntry('createNode', { parentId, blocksCount: blocks.length });
        try {
            // Validate input parameters
            if (parentId !== null) {
                this.validator.validateNodeId(parentId, 'createNode');
                const parentExists = this.nodes.has(parentId);
                this.logger.logBranch('createNode', 'parentExists', parentExists, { parentId });
                if (!parentExists) {
                    throw this.errorFactory.createTreeStructureError(parentId, 'create_child', `Parent node ${parentId} does not exist`, 'createNode', { parentId, blocksCount: blocks.length });
                }
            }
            // Validate blocks
            this.validator.validateNonEmptyArray(blocks, 'blocks', 'createNode');
            for (const [index, block] of blocks.entries()) {
                try {
                    this.validator.validateNodeBlock(block, 'createNode');
                }
                catch (error) {
                    this.logger.logError(error, 'createNode', { blockIndex: index, block });
                    throw error;
                }
            }
            const nodeId = `node_${++this.nodeCounter}`;
            this.logger.logVariableAssignment('createNode', 'nodeId', nodeId);
            const parentDepth = parentId ? ((_b = (_a = this.nodes.get(parentId)) === null || _a === void 0 ? void 0 : _a.depth) !== null && _b !== void 0 ? _b : 0) : 0;
            const nodeDepth = parentDepth + (parentId ? 1 : 0);
            this.logger.logVariableAssignment('createNode', 'nodeDepth', nodeDepth);
            const node = {
                id: nodeId,
                parentId,
                children: [],
                position: { x: 0, y: 0 },
                depth: nodeDepth,
                blocks: blocks.length > 0 ? blocks : [
                    { id: `${nodeId}_prompt`, type: 'prompt', content: 'Enter your prompt here...', position: 0 },
                    { id: `${nodeId}_response`, type: 'response', content: 'Response will appear here...', position: 1 }
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
            return node;
        }
        catch (error) {
            this.logger.logError(error, 'createNode', { parentId, blocksCount: blocks.length });
            if (error instanceof ValidationError ||
                error instanceof TreeStructureError ||
                error instanceof NodeEditorError) {
                throw error;
            }
            throw this.errorFactory.createNodeEditorError('Failed to create node', 'NODE_CREATION_FAILED', 'Unable to create new node. Please try again.', 'createNode', { parentId, blocksCount: blocks.length, error: String(error) }, 'medium');
        }
    }
    /**
     * Render a node in the DOM with proper event handling
     *
     * @param node - The GraphNode to render
     * @private
     * @throws {DOMError} When DOM manipulation fails
     */
    renderNode(node) {
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
            nodeEl.innerHTML = `
        <div class="node-header">
          <span class="node-id">${node.id} (depth: ${node.depth})</span>
          <div class="node-actions">
            <button class="btn add" data-action="addChild" data-node-id="${node.id}">Add Child</button>
            <button class="btn delete" data-action="deleteNode" data-node-id="${node.id}">Delete</button>
          </div>
        </div>
        <div class="node-blocks">
          ${node.blocks.map((block, index) => this.renderBlock(block, node.id, index)).join('')}
        </div>
      `;
            // Add event listeners with error handling
            nodeEl.addEventListener('click', (e) => {
                try {
                    const target = e.target;
                    this.logger.logUserInteraction('node_click', node.id, {
                        targetClass: target.className,
                        action: target.getAttribute('data-action')
                    });
                    const hasButtonClass = target.classList.contains('btn');
                    this.logger.logBranch('renderNode', 'hasButtonClass', hasButtonClass);
                    if (hasButtonClass) {
                        const action = target.getAttribute('data-action');
                        const nodeId = target.getAttribute('data-node-id');
                        this.logger.logVariableAssignment('renderNode', 'buttonAction', action);
                        this.logger.logVariableAssignment('renderNode', 'buttonNodeId', nodeId);
                        if (action === 'addChild' && nodeId) {
                            this.addChild(nodeId);
                        }
                        else if (action === 'deleteNode' && nodeId) {
                            this.deleteNode(nodeId);
                        }
                    }
                }
                catch (error) {
                    this.logger.logError(error, 'renderNode.onClick', { nodeId: node.id });
                }
            });
            this.setupNodeDragging(nodeEl, node);
            this.canvasContent.appendChild(nodeEl);
            this.logger.logInfo('Node rendered successfully', 'renderNode', { nodeId: node.id });
            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('renderNode', 'node_rendering', executionTime);
            this.logger.logFunctionExit('renderNode', { nodeId: node.id }, executionTime);
        }
        catch (error) {
            this.logger.logError(error, 'renderNode', { nodeId: node.id });
            throw this.errorFactory.createDOMError(`Failed to render node ${node.id}`, 'NODE_RENDER_FAILED', 'Unable to display the node.', 'renderNode');
        }
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
    renderBlock(block, nodeId, blockIndex) {
        this.logger.logFunctionEntry('renderBlock', {
            blockId: block.id,
            blockType: block.type,
            nodeId,
            blockIndex
        });
        try {
            this.validator.validateNodeBlock(block, 'renderBlock');
            this.validator.validateNodeId(nodeId, 'renderBlock');
            const html = `
        <div class="block ${block.type}-block">
          <div class="block-header">
            ${block.type}
            <button class="btn" data-action="addMarkdown" data-node-id="${nodeId}">+ MD</button>
          </div>
          <div class="block-content">
            <textarea 
              id="${block.id}-textarea"
              name="${block.id}-content"
              placeholder="Enter ${block.type} content..."
              data-node-id="${nodeId}"
              data-block-index="${blockIndex}"
              autocomplete="off"
            >${block.content}</textarea>
          </div>
        </div>
      `;
            this.logger.logFunctionExit('renderBlock', { blockId: block.id, htmlLength: html.length });
            return html;
        }
        catch (error) {
            this.logger.logError(error, 'renderBlock', {
                blockId: block.id,
                nodeId,
                blockIndex
            });
            throw this.errorFactory.createNodeEditorError(`Failed to render block ${block.id}`, 'BLOCK_RENDER_FAILED', 'Unable to display content block.', 'renderBlock', { blockId: block.id, nodeId, blockIndex });
        }
    }
    /**
     * Set up drag functionality for a node element
     *
     * @param nodeEl - The DOM element to make draggable
     * @param node - The GraphNode associated with the element
     * @private
     */
    setupNodeDragging(nodeEl, node) {
        const startTime = performance.now();
        this.logger.logFunctionEntry('setupNodeDragging', { nodeId: node.id });
        try {
            let isDragging = false;
            let startX, startY, startNodeX, startNodeY;
            nodeEl.addEventListener('mousedown', (e) => {
                try {
                    const target = e.target;
                    const isInteractiveElement = target.closest('.btn') || target.closest('textarea');
                    this.logger.logBranch('setupNodeDragging', 'isInteractiveElement', !!isInteractiveElement);
                    if (isInteractiveElement)
                        return;
                    isDragging = true;
                    this.isDragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startNodeX = node.position.x;
                    startNodeY = node.position.y;
                    this.logger.logUserInteraction('node_drag_start', node.id, {
                        startX, startY, startNodeX, startNodeY
                    });
                    this.selectNode(node);
                    e.preventDefault();
                }
                catch (error) {
                    this.logger.logError(error, 'setupNodeDragging.mousedown', { nodeId: node.id });
                }
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging)
                    return;
                try {
                    const deltaX = (e.clientX - startX) / this.scale;
                    const deltaY = (e.clientY - startY) / this.scale;
                    // Log node dragging action
                    this.logger.logUserInteraction('node_drag', node.id, {
                        deltaX,
                        deltaY,
                        newX: startNodeX + deltaX,
                        newY: startNodeY + deltaY
                    });
                    node.position.x = startNodeX + deltaX;
                    node.position.y = startNodeY + deltaY;
                    this.logger.logVariableAssignment('setupNodeDragging', 'nodePositionX', node.position.x);
                    this.logger.logVariableAssignment('setupNodeDragging', 'nodePositionY', node.position.y);
                    this.positionNode(node, node.position.x, node.position.y);
                    this.updateConnections();
                }
                catch (error) {
                    this.logger.logError(error, 'setupNodeDragging.mousemove', { nodeId: node.id });
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
        }
        catch (error) {
            this.logger.logError(error, 'setupNodeDragging', { nodeId: node.id });
            throw this.errorFactory.createNodeEditorError(`Failed to setup dragging for node ${node.id}`, 'DRAG_SETUP_FAILED', 'Unable to enable node dragging.', 'setupNodeDragging', { nodeId: node.id });
        }
    }
    /**
     * Position a node at specific coordinates
     *
     * @param node - The GraphNode to position
     * @param x - X coordinate
     * @param y - Y coordinate
     * @private
     */
    positionNode(node, x, y) {
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
                nodeEl.style.left = x + 'px';
                nodeEl.style.top = y + 'px';
                this.logger.logVariableAssignment('positionNode', 'elementLeft', nodeEl.style.left);
                this.logger.logVariableAssignment('positionNode', 'elementTop', nodeEl.style.top);
            }
            this.logger.logFunctionExit('positionNode', { nodeId: node.id, x, y });
        }
        catch (error) {
            this.logger.logError(error, 'positionNode', { nodeId: node.id, x, y });
            throw this.errorFactory.createNodeEditorError(`Failed to position node ${node.id}`, 'NODE_POSITION_FAILED', 'Unable to update node position.', 'positionNode', { nodeId: node.id, x, y });
        }
    }
    /**
     * Select a node and update visual feedback
     *
     * @param node - The GraphNode to select
     * @private
     */
    selectNode(node) {
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
            }
            this.logger.logFunctionExit('selectNode', { selectedNodeId: node.id });
        }
        catch (error) {
            this.logger.logError(error, 'selectNode', { nodeId: node.id });
            throw this.errorFactory.createNodeEditorError(`Failed to select node ${node.id}`, 'NODE_SELECT_FAILED', 'Unable to select the node.', 'selectNode', { nodeId: node.id });
        }
    }
    /**
     * Add a child node to an existing parent node
     *
     * @param parentId - ID of the parent node
     * @throws {ValidationError} When parentId is invalid
     * @throws {TreeStructureError} When parent doesn't exist
     */
    addChild(parentId) {
        const startTime = performance.now();
        this.logger.logFunctionEntry('addChild', { parentId });
        try {
            this.validator.validateNodeId(parentId, 'addChild');
            const parent = this.nodes.get(parentId);
            const parentExists = !!parent;
            this.logger.logBranch('addChild', 'parentExists', parentExists, { parentId });
            if (!parent) {
                throw this.errorFactory.createTreeStructureError(parentId, 'add_child', `Parent node ${parentId} does not exist`, 'addChild', { parentId });
            }
            const child = this.createNode(parentId, [
                { id: `${parentId}_child_prompt_${Date.now()}`, type: 'prompt', content: 'New prompt - edit this content...', position: 0 },
                { id: `${parentId}_child_response_${Date.now()}`, type: 'response', content: 'New response - this represents an edit or variation of the parent node...', position: 1 }
            ]);
            this.logger.logInfo('Child node created successfully', 'addChild', {
                parentId,
                childId: child.id,
                totalNodes: this.nodes.size
            });
            this.layoutTree();
            this.updateConnections();
            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('addChild', 'child_creation', executionTime);
            this.logger.logFunctionExit('addChild', { parentId, childId: child.id }, executionTime);
        }
        catch (error) {
            this.logger.logError(error, 'addChild', { parentId });
            if (error instanceof ValidationError || error instanceof TreeStructureError) {
                throw error;
            }
            throw this.errorFactory.createNodeEditorError(`Failed to add child to node ${parentId}`, 'ADD_CHILD_FAILED', 'Unable to create new variation.', 'addChild', { parentId, error: String(error) });
        }
    }
    /**
     * Add a markdown block to an existing node
     *
     * @param nodeId - ID of the node to add the block to
     * @throws {ValidationError} When nodeId is invalid
     * @throws {NodeEditorError} When node doesn't exist or operation fails
     */
    addMarkdownBlock(nodeId) {
        const startTime = performance.now();
        this.logger.logFunctionEntry('addMarkdownBlock', { nodeId });
        try {
            this.validator.validateNodeId(nodeId, 'addMarkdownBlock');
            const node = this.nodes.get(nodeId);
            const nodeExists = !!node;
            this.logger.logBranch('addMarkdownBlock', 'nodeExists', nodeExists, { nodeId });
            if (node) {
                const newBlock = {
                    id: `${nodeId}_markdown_${Date.now()}`,
                    type: 'markdown',
                    content: '# New markdown block\\n\\nAdd your content here...',
                    position: node.blocks.length
                };
                this.validator.validateNodeBlock(newBlock, 'addMarkdownBlock');
                node.blocks.push(newBlock);
                this.logger.logVariableAssignment('addMarkdownBlock', 'blocksCount', node.blocks.length);
                this.rerenderNode(node);
                this.logger.logInfo('Markdown block added successfully', 'addMarkdownBlock', {
                    nodeId,
                    blockId: newBlock.id,
                    totalBlocks: node.blocks.length
                });
                const executionTime = performance.now() - startTime;
                this.logger.logPerformance('addMarkdownBlock', 'block_addition', executionTime);
                this.logger.logFunctionExit('addMarkdownBlock', { nodeId, blockId: newBlock.id }, executionTime);
            }
            else {
                throw this.errorFactory.createNodeEditorError(`Node ${nodeId} does not exist`, 'NODE_NOT_FOUND', 'The selected node could not be found.', 'addMarkdownBlock', { nodeId });
            }
        }
        catch (error) {
            this.logger.logError(error, 'addMarkdownBlock', { nodeId });
            if (error instanceof ValidationError || error instanceof NodeEditorError) {
                throw error;
            }
            throw this.errorFactory.createNodeEditorError(`Failed to add markdown block to node ${nodeId}`, 'ADD_MARKDOWN_FAILED', 'Unable to add markdown content.', 'addMarkdownBlock', { nodeId, error: String(error) });
        }
    }
    /**
     * Update the content of a specific block
     *
     * @param nodeId - ID of the containing node
     * @param blockIndex - Index of the block to update
     * @param content - New content for the block
     */
    updateBlockContent(nodeId, blockIndex, content) {
        this.logger.logFunctionEntry('updateBlockContent', { nodeId, blockIndex, contentLength: content.length });
        try {
            this.validator.validateNodeId(nodeId, 'updateBlockContent');
            this.validator.validateRange(blockIndex, 0, 1000, 'blockIndex', 'updateBlockContent');
            const node = this.nodes.get(nodeId);
            const nodeExists = !!node;
            this.logger.logBranch('updateBlockContent', 'nodeExists', nodeExists, { nodeId });
            if (node && node.blocks[blockIndex]) {
                const oldContent = node.blocks[blockIndex].content;
                node.blocks[blockIndex].content = content;
                this.logger.logVariableAssignment('updateBlockContent', 'blockContent', content.substring(0, 100));
                this.logger.logInfo('Block content updated', 'updateBlockContent', {
                    nodeId,
                    blockIndex,
                    blockId: node.blocks[blockIndex].id,
                    oldLength: oldContent.length,
                    newLength: content.length
                });
                this.logger.logFunctionExit('updateBlockContent', { nodeId, blockIndex, contentLength: content.length });
            }
            else {
                const errorMsg = node ? 'Block index out of range' : 'Node not found';
                this.logger.logWarn(errorMsg, 'updateBlockContent', { nodeId, blockIndex });
            }
        }
        catch (error) {
            this.logger.logError(error, 'updateBlockContent', { nodeId, blockIndex });
            throw this.errorFactory.createNodeEditorError(`Failed to update block content`, 'UPDATE_CONTENT_FAILED', 'Unable to save your changes.', 'updateBlockContent', { nodeId, blockIndex, error: String(error) });
        }
    }
    /**
     * Delete a node and handle tree structure updates
     *
     * @param nodeId - ID of the node to delete
     * @throws {ValidationError} When nodeId is invalid
     * @throws {TreeStructureError} When node has children or doesn't exist
     */
    deleteNode(nodeId) {
        const startTime = performance.now();
        this.logger.logFunctionEntry('deleteNode', { nodeId });
        try {
            this.validator.validateNodeId(nodeId, 'deleteNode');
            const node = this.nodes.get(nodeId);
            const nodeExists = !!node;
            this.logger.logBranch('deleteNode', 'nodeExists', nodeExists, { nodeId });
            if (!node) {
                throw this.errorFactory.createTreeStructureError(nodeId, 'delete', `Node ${nodeId} does not exist`, 'deleteNode', { nodeId });
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
                throw this.errorFactory.createTreeStructureError(nodeId, 'delete', 'Cannot delete node with children. Delete children first.', 'deleteNode', { nodeId, childrenCount: node.children.length });
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
        }
        catch (error) {
            this.logger.logError(error, 'deleteNode', { nodeId });
            if (error instanceof ValidationError || error instanceof TreeStructureError) {
                throw error;
            }
            throw this.errorFactory.createNodeEditorError(`Failed to delete node ${nodeId}`, 'DELETE_NODE_FAILED', 'Unable to delete the node.', 'deleteNode', { nodeId, error: String(error) });
        }
    }
    /**
     * Re-render a node after content changes
     *
     * @param node - The GraphNode to re-render
     * @private
     */
    rerenderNode(node) {
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
        }
        catch (error) {
            this.logger.logError(error, 'rerenderNode', { nodeId: node.id });
            throw this.errorFactory.createDOMError(`Failed to re-render node ${node.id}`, 'NODE_RERENDER_FAILED', 'Unable to update the display.', 'rerenderNode');
        }
    }
    /**
     * Calculate and apply tree layout to all nodes
     *
     * @private
     */
    layoutTree() {
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
        }
        catch (error) {
            this.logger.logError(error, 'layoutTree');
            throw this.errorFactory.createNodeEditorError('Failed to layout tree', 'LAYOUT_FAILED', 'Unable to arrange nodes properly.', 'layoutTree', { totalNodes: this.nodes.size, error: String(error) });
        }
    }
    /**
     * Calculate the width required for a node's subtree
     *
     * @param node - The root node of the subtree
     * @returns The calculated width in pixels
     * @private
     */
    calculateSubtreeWidth(node) {
        this.logger.logFunctionEntry('calculateSubtreeWidth', { nodeId: node.id });
        try {
            const nodeWidth = 350;
            const horizontalSpacing = 100;
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
            const spacingWidth = (node.children.length - 1) * horizontalSpacing;
            const finalWidth = Math.max(nodeWidth, totalChildrenWidth + spacingWidth);
            this.logger.logVariableAssignment('calculateSubtreeWidth', 'finalWidth', finalWidth);
            this.logger.logFunctionExit('calculateSubtreeWidth', { nodeId: node.id, width: finalWidth });
            return finalWidth;
        }
        catch (error) {
            this.logger.logError(error, 'calculateSubtreeWidth', { nodeId: node.id });
            throw this.errorFactory.createNodeEditorError(`Failed to calculate subtree width for node ${node.id}`, 'SUBTREE_WIDTH_FAILED', 'Unable to calculate layout.', 'calculateSubtreeWidth', { nodeId: node.id });
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
    layoutSubtree(node, centerX, y) {
        this.logger.logFunctionEntry('layoutSubtree', { nodeId: node.id, centerX, y });
        try {
            const verticalSpacing = 250;
            const horizontalSpacing = 100;
            // Position current node
            this.positionNode(node, centerX - 175, y); // 175 is half of node width
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
            const childWidths = [];
            for (const childId of node.children) {
                const child = this.nodes.get(childId);
                if (child) {
                    childWidths.push(this.calculateSubtreeWidth(child));
                }
            }
            const totalChildWidth = childWidths.reduce((sum, width) => sum + width, 0);
            const totalSpacing = (node.children.length - 1) * horizontalSpacing;
            const totalWidth = totalChildWidth + totalSpacing;
            this.logger.logVariableAssignment('layoutSubtree', 'totalWidth', totalWidth);
            let currentX = centerX - totalWidth / 2;
            this.logger.logLoop('layoutSubtree', 'children_layout', node.children.length);
            for (const [index, childId] of node.children.entries()) {
                const child = this.nodes.get(childId);
                if (child) {
                    const childWidth = childWidths[index];
                    const childCenterX = currentX + childWidth / 2;
                    this.logger.logInfo(`Positioning child ${index + 1}/${node.children.length}`, 'layoutSubtree', {
                        parentId: node.id,
                        childId,
                        childCenterX,
                        childY: y + verticalSpacing
                    });
                    this.layoutSubtree(child, childCenterX, y + verticalSpacing);
                    currentX += childWidth + horizontalSpacing;
                    this.logger.logVariableAssignment('layoutSubtree', 'currentX', currentX);
                }
            }
            this.logger.logFunctionExit('layoutSubtree', {
                nodeId: node.id,
                childrenProcessed: node.children.length
            });
        }
        catch (error) {
            this.logger.logError(error, 'layoutSubtree', { nodeId: node.id, centerX, y });
            throw this.errorFactory.createNodeEditorError(`Failed to layout subtree for node ${node.id}`, 'SUBTREE_LAYOUT_FAILED', 'Unable to position child nodes.', 'layoutSubtree', { nodeId: node.id, centerX, y });
        }
    }
    /**
     * Update SVG connections between parent and child nodes
     *
     * @private
     */
    updateConnections() {
        const startTime = performance.now();
        this.logger.logFunctionEntry('updateConnections', { totalNodes: this.nodes.size });
        try {
            this.connectionsEl.innerHTML = '';
            this.logger.logInfo('Cleared existing connections', 'updateConnections');
            let connectionsCreated = 0;
            this.logger.logLoop('updateConnections', 'nodes_processing', this.nodes.size);
            for (const [nodeId, node] of this.nodes) {
                const hasParent = !!node.parentId;
                this.logger.logBranch('updateConnections', 'hasParent', hasParent, { nodeId });
                if (hasParent) {
                    const parent = this.nodes.get(node.parentId);
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
            }
            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('updateConnections', 'connections_update', executionTime);
            this.logger.logFunctionExit('updateConnections', {
                connectionsCreated,
                totalNodes: this.nodes.size
            }, executionTime);
        }
        catch (error) {
            this.logger.logError(error, 'updateConnections');
            throw this.errorFactory.createDOMError('Failed to update connections', 'CONNECTIONS_UPDATE_FAILED', 'Unable to update connection lines.', 'updateConnections');
        }
    }
    /**
     * Draw an SVG connection line between parent and child nodes
     *
     * @param parent - The parent GraphNode
     * @param child - The child GraphNode
     * @private
     */
    drawConnection(parent, child) {
        this.logger.logFunctionEntry('drawConnection', {
            parentId: parent.id,
            childId: child.id
        });
        try {
            this.validator.validateGraphNode(parent, 'drawConnection');
            this.validator.validateGraphNode(child, 'drawConnection');
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const parentCenterX = parent.position.x + 200; // Approximate node width / 2
            const parentCenterY = parent.position.y + 100; // Approximate node height / 2
            const childCenterX = child.position.x + 200;
            const childCenterY = child.position.y + 50; // Connect to top of child
            this.logger.logVariableAssignment('drawConnection', 'parentCenterX', parentCenterX);
            this.logger.logVariableAssignment('drawConnection', 'parentCenterY', parentCenterY);
            this.logger.logVariableAssignment('drawConnection', 'childCenterX', childCenterX);
            this.logger.logVariableAssignment('drawConnection', 'childCenterY', childCenterY);
            // Create a curved path
            const midY = (parentCenterY + childCenterY) / 2;
            const pathData = `M ${parentCenterX} ${parentCenterY + 50} C ${parentCenterX} ${midY} ${childCenterX} ${midY} ${childCenterX} ${childCenterY}`;
            line.setAttribute('d', pathData);
            line.setAttribute('class', 'connection-line');
            this.connectionsEl.appendChild(line);
            this.logger.logInfo('Connection drawn successfully', 'drawConnection', {
                parentId: parent.id,
                childId: child.id,
                pathLength: pathData.length
            });
            this.logger.logFunctionExit('drawConnection', {
                parentId: parent.id,
                childId: child.id
            });
        }
        catch (error) {
            this.logger.logError(error, 'drawConnection', {
                parentId: parent.id,
                childId: child.id
            });
            throw this.errorFactory.createDOMError(`Failed to draw connection between ${parent.id} and ${child.id}`, 'CONNECTION_DRAW_FAILED', 'Unable to draw connection line.', 'drawConnection');
        }
    }
    /**
     * Add a new root node to the graph
     *
     * @throws {NodeEditorError} When root node creation fails
     */
    addRootNode() {
        const startTime = performance.now();
        this.logger.logFunctionEntry('addRootNode');
        try {
            const root = this.createNode(null, [
                { id: `root_${Date.now()}_prompt`, type: 'prompt', content: 'New root prompt...', position: 0 },
                { id: `root_${Date.now()}_response`, type: 'response', content: 'New root response...', position: 1 }
            ]);
            this.logger.logInfo('Root node created successfully', 'addRootNode', {
                rootId: root.id,
                totalNodes: this.nodes.size
            });
            this.layoutTree();
            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('addRootNode', 'root_creation', executionTime);
            this.logger.logFunctionExit('addRootNode', { rootId: root.id }, executionTime);
        }
        catch (error) {
            this.logger.logError(error, 'addRootNode');
            throw this.errorFactory.createNodeEditorError('Failed to add root node', 'ADD_ROOT_FAILED', 'Unable to create new root node.', 'addRootNode', { error: String(error) });
        }
    }
    /**
     * Reset canvas view to default position and scale
     */
    resetView() {
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
            this.logger.logInfo('View reset successfully', 'resetView');
            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('resetView', 'view_reset', executionTime);
            this.logger.logFunctionExit('resetView', undefined, executionTime);
        }
        catch (error) {
            this.logger.logError(error, 'resetView');
            throw this.errorFactory.createNodeEditorError('Failed to reset view', 'RESET_VIEW_FAILED', 'Unable to reset the view.', 'resetView', { error: String(error) });
        }
    }
    /**
     * Export current graph data as JSON
     *
     * @returns Serializable representation of the graph
     */
    exportData() {
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
        }
        catch (error) {
            this.logger.logError(error, 'exportData');
            throw this.errorFactory.createNodeEditorError('Failed to export data', 'EXPORT_FAILED', 'Unable to export your data.', 'exportData', { error: String(error) });
        }
    }
}
