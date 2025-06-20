/**
 * Expandable Node Manager
 * Core manager for nodes with dynamic dimensions and block support
 */
import { createNodeId, createBlockId } from '../utils/id-generator.js';
import { NODE_DIMENSION_CONSTANTS } from '../types/expandable-node.types.js';
import { NodeCreationError, NodeResizeError, BlockCreationError, BlockUpdateError, NodeNotFoundError, BlockNotFoundError, NodeRenderError } from '../types/expandable-node-errors.js';
import { ValidationError } from '../types/errors.js';
import { NodeResizeHandler } from './node-resize-handler.js';
import { isExpandableNode, isBasicBlock, validateBlockType, createDefaultNodeDimensions, createDefaultBlockDimensions, clampNodeDimensions } from '../utils/expandable-node-guards.js';
/**
 * Base class for node managers (to be extended if needed)
 */
export class BaseNodeManager {
}
/**
 * Manages expandable nodes with comprehensive logging and error handling
 */
export class ExpandableNodeManager extends BaseNodeManager {
    constructor(logger, validator) {
        super();
        this.nodes = new Map();
        this.blockNodeMap = new Map();
        this.selectedNodeId = null;
        this.nodeCounter = 0;
        this.logger = logger;
        this.validator = validator;
        // Initialize resize handler
        this.resizeHandler = new NodeResizeHandler(logger, this.handleResize.bind(this), this.getNode.bind(this));
    }
    /**
     * Creates a new expandable node
     */
    createNode(config) {
        var _a, _b, _c, _d, _e, _f;
        const correlationId = this.logger.startOperation('ExpandableNodeManager.createNode');
        try {
            this.logger.info('Creating new expandable node', { config }, correlationId);
            // Generate node ID
            const nodeId = createNodeId();
            this.nodeCounter++;
            // Create node metadata
            const now = new Date();
            const metadata = {
                createdAt: now,
                lastModified: now,
                version: 1
            };
            // Create dimensions with defaults
            const dimensions = Object.assign(Object.assign({}, createDefaultNodeDimensions()), clampNodeDimensions((config === null || config === void 0 ? void 0 : config.dimensions) || {}));
            // Create position with defaults
            const position = {
                x: (_b = (_a = config === null || config === void 0 ? void 0 : config.position) === null || _a === void 0 ? void 0 : _a.x) !== null && _b !== void 0 ? _b : 100,
                y: (_d = (_c = config === null || config === void 0 ? void 0 : config.position) === null || _c === void 0 ? void 0 : _c.y) !== null && _d !== void 0 ? _d : 100,
                zIndex: (_f = (_e = config === null || config === void 0 ? void 0 : config.position) === null || _e === void 0 ? void 0 : _e.zIndex) !== null && _f !== void 0 ? _f : 1
            };
            // Validate title
            const title = this.validateNodeTitle((config === null || config === void 0 ? void 0 : config.title) || 'Untitled Node', correlationId);
            // Create initial blocks
            const blocks = [];
            if ((config === null || config === void 0 ? void 0 : config.blocks) && config.blocks.length > 0) {
                for (const blockConfig of config.blocks) {
                    const block = this.createBlock(nodeId, blockConfig, correlationId);
                    blocks.push(block);
                }
            }
            else {
                // Create default prompt block
                const defaultBlock = this.createBlock(nodeId, { type: 'prompt' }, correlationId);
                blocks.push(defaultBlock);
            }
            // Create the node
            const node = {
                id: nodeId,
                title,
                dimensions,
                position,
                blocks,
                isCollapsed: false,
                isSelected: false,
                metadata
            };
            // Validate node structure
            if (!isExpandableNode(node)) {
                const context = createErrorContext('createNode', { nodeData: node });
                throw new NodeCreationError('Invalid node structure', node, [new ValidationError('node', node, 'ExpandableNode', context)]);
            }
            // Store the node
            this.nodes.set(nodeId, node);
            this.logger.info('Node created successfully', {
                nodeId,
                title,
                blockCount: blocks.length,
                dimensions
            }, correlationId);
            return nodeId;
        }
        catch (error) {
            this.logger.error('Failed to create node', error, { config }, correlationId);
            throw error instanceof NodeCreationError ? error : new NodeCreationError('Unexpected error during node creation', config, [], error instanceof Error ? error : undefined);
        }
        finally {
            this.logger.endOperation(correlationId);
        }
    }
    /**
     * Deletes a node
     */
    deleteNode(nodeId) {
        const correlationId = this.logger.startOperation('ExpandableNodeManager.deleteNode');
        try {
            this.logger.info('Deleting node', { nodeId }, correlationId);
            const node = this.nodes.get(nodeId);
            if (!node) {
                throw new NodeNotFoundError(nodeId);
            }
            // Remove block mappings
            for (const block of node.blocks) {
                this.blockNodeMap.delete(block.id);
            }
            // Remove node
            this.nodes.delete(nodeId);
            // Clear selection if this node was selected
            if (this.selectedNodeId === nodeId) {
                this.selectedNodeId = null;
            }
            this.logger.info('Node deleted successfully', { nodeId }, correlationId);
        }
        catch (error) {
            this.logger.error('Failed to delete node', error, { nodeId }, correlationId);
            throw error;
        }
        finally {
            this.logger.endOperation(correlationId);
        }
    }
    /**
     * Gets a node by ID
     */
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }
    /**
     * Gets all nodes
     */
    getAllNodes() {
        return this.nodes;
    }
    /**
     * Resizes a node
     */
    resizeNode(nodeId, newDimensions) {
        const correlationId = this.logger.startOperation('ExpandableNodeManager.resizeNode');
        try {
            this.logger.info('Resizing node', { nodeId, newDimensions }, correlationId);
            const node = this.nodes.get(nodeId);
            if (!node) {
                throw new NodeNotFoundError(nodeId);
            }
            // Validate and clamp dimensions
            const clampedDimensions = clampNodeDimensions(newDimensions);
            // Update blocks to scale with node
            let updatedBlocks = node.blocks;
            if (clampedDimensions.width !== undefined) {
                const widthRatio = clampedDimensions.width / node.dimensions.width;
                updatedBlocks = node.blocks.map(block => (Object.assign(Object.assign({}, block), { dimensions: Object.assign(Object.assign({}, block.dimensions), { width: Math.round(block.dimensions.width * widthRatio) }), metadata: Object.assign(Object.assign({}, block.metadata), { lastModified: new Date() }) })));
            }
            // Create updated node
            const updatedNode = Object.assign(Object.assign({}, node), { dimensions: Object.assign(Object.assign({}, node.dimensions), clampedDimensions), blocks: updatedBlocks, metadata: Object.assign(Object.assign({}, node.metadata), { lastModified: new Date(), version: node.metadata.version + 1 }) });
            // Store updated node
            this.nodes.set(nodeId, updatedNode);
            this.logger.info('Node resized successfully', {
                nodeId,
                oldDimensions: node.dimensions,
                newDimensions: updatedNode.dimensions
            }, correlationId);
        }
        catch (error) {
            this.logger.error('Failed to resize node', error, { nodeId, newDimensions }, correlationId);
            const constraints = {
                minWidth: NODE_DIMENSION_CONSTANTS.MIN_WIDTH,
                maxWidth: NODE_DIMENSION_CONSTANTS.MAX_WIDTH,
                minHeight: NODE_DIMENSION_CONSTANTS.MIN_HEIGHT,
                maxHeight: NODE_DIMENSION_CONSTANTS.MAX_HEIGHT,
                snapToGrid: true,
                gridSize: NODE_DIMENSION_CONSTANTS.GRID_SIZE
            };
            throw error instanceof NodeNotFoundError ? error : new NodeResizeError('Failed to resize node', nodeId, newDimensions, constraints, error instanceof Error ? error : undefined);
        }
        finally {
            this.logger.endOperation(correlationId);
        }
    }
    /**
     * Adds a block to a node
     */
    addBlock(nodeId, blockType, content = '', title) {
        const correlationId = this.logger.startOperation('ExpandableNodeManager.addBlock');
        try {
            this.logger.info('Adding block to node', { nodeId, blockType, hasContent: !!content }, correlationId);
            const node = this.nodes.get(nodeId);
            if (!node) {
                throw new NodeNotFoundError(nodeId);
            }
            // Validate block type
            if (!validateBlockType(blockType)) {
                throw new BlockCreationError(`Invalid block type: ${blockType}`, nodeId, { blockType });
            }
            // Create block
            const blockConfig = Object.assign({ type: blockType, content }, (title !== undefined && { title }));
            const block = this.createBlock(nodeId, blockConfig, correlationId);
            // Update node with new block
            const updatedBlocks = [...node.blocks, block];
            const updatedNode = Object.assign(Object.assign({}, node), { blocks: updatedBlocks, metadata: Object.assign(Object.assign({}, node.metadata), { lastModified: new Date(), version: node.metadata.version + 1 }) });
            this.nodes.set(nodeId, updatedNode);
            this.logger.info('Block added successfully', {
                nodeId,
                blockId: block.id,
                blockType
            }, correlationId);
            return block.id;
        }
        catch (error) {
            this.logger.error('Failed to add block', error, { nodeId, blockType }, correlationId);
            throw error instanceof NodeNotFoundError || error instanceof BlockCreationError ? error :
                new BlockCreationError('Unexpected error during block creation', nodeId, { blockType, content, title }, error instanceof Error ? error : undefined);
        }
        finally {
            this.logger.endOperation(correlationId);
        }
    }
    /**
     * Updates block content
     */
    updateBlockContent(blockId, newContent) {
        const correlationId = this.logger.startOperation('ExpandableNodeManager.updateBlockContent');
        try {
            this.logger.info('Updating block content', { blockId, contentLength: newContent.length }, correlationId);
            const nodeId = this.blockNodeMap.get(blockId);
            if (!nodeId) {
                throw new BlockNotFoundError(blockId);
            }
            const node = this.nodes.get(nodeId);
            if (!node) {
                throw new NodeNotFoundError(nodeId);
            }
            // Validate content
            const sanitizedContent = this.sanitizeContent(newContent, correlationId);
            // Find and update block
            let blockFound = false;
            const updatedBlocks = node.blocks.map(block => {
                if (block.id === blockId) {
                    blockFound = true;
                    return Object.assign(Object.assign({}, block), { content: sanitizedContent, metadata: Object.assign(Object.assign({}, block.metadata), { lastModified: new Date() }) });
                }
                return block;
            });
            if (!blockFound) {
                throw new BlockNotFoundError(blockId);
            }
            // Update node
            const updatedNode = Object.assign(Object.assign({}, node), { blocks: updatedBlocks, metadata: Object.assign(Object.assign({}, node.metadata), { lastModified: new Date(), version: node.metadata.version + 1 }) });
            this.nodes.set(nodeId, updatedNode);
            this.logger.info('Block content updated successfully', { blockId, nodeId }, correlationId);
        }
        catch (error) {
            this.logger.error('Failed to update block content', error, { blockId }, correlationId);
            throw error instanceof BlockNotFoundError || error instanceof NodeNotFoundError ? error :
                new BlockUpdateError('Failed to update block content', blockId, { newContent }, error instanceof Error ? error : undefined);
        }
        finally {
            this.logger.endOperation(correlationId);
        }
    }
    /**
     * Renders a node to DOM
     */
    renderNode(nodeId) {
        const correlationId = this.logger.startOperation('ExpandableNodeManager.renderNode');
        try {
            this.logger.info('Rendering node', { nodeId }, correlationId);
            const node = this.nodes.get(nodeId);
            if (!node) {
                throw new NodeNotFoundError(nodeId);
            }
            // Create node element
            const nodeElement = document.createElement('div');
            nodeElement.className = 'expandable-node';
            nodeElement.id = `node-${nodeId}`;
            nodeElement.setAttribute('data-node-id', nodeId);
            // Apply dimensions and position
            nodeElement.style.width = `${node.dimensions.width}px`;
            nodeElement.style.height = `${node.dimensions.height}px`;
            nodeElement.style.left = `${node.position.x}px`;
            nodeElement.style.top = `${node.position.y}px`;
            nodeElement.style.zIndex = `${node.position.zIndex}`;
            nodeElement.style.position = 'absolute';
            // Add collapsed class if needed
            if (node.isCollapsed) {
                nodeElement.classList.add('collapsed');
            }
            // Add selected class if needed
            if (node.isSelected) {
                nodeElement.classList.add('selected');
            }
            // Create header
            const header = this.createNodeHeader(node, correlationId);
            nodeElement.appendChild(header);
            // Create blocks container
            const blocksContainer = document.createElement('div');
            blocksContainer.className = 'node-blocks';
            // Render blocks
            for (const block of node.blocks) {
                const blockElement = this.renderBlock(block, correlationId);
                blocksContainer.appendChild(blockElement);
            }
            nodeElement.appendChild(blocksContainer);
            // Setup resize handles
            this.resizeHandler.setupResizeHandles(nodeElement, nodeId);
            this.logger.info('Node rendered successfully', { nodeId }, correlationId);
            return nodeElement;
        }
        catch (error) {
            this.logger.error('Failed to render node', error, { nodeId }, correlationId);
            throw error instanceof NodeNotFoundError ? error : new NodeRenderError('Failed to render node', nodeId, error instanceof Error ? error : undefined);
        }
        finally {
            this.logger.endOperation(correlationId);
        }
    }
    /**
     * Creates a node header element
     */
    createNodeHeader(node, _correlationId) {
        const header = document.createElement('div');
        header.className = 'node-header';
        // Title
        const title = document.createElement('span');
        title.className = 'node-title';
        title.textContent = node.title;
        title.contentEditable = 'true';
        header.appendChild(title);
        // Node ID (small text)
        const idSpan = document.createElement('span');
        idSpan.className = 'node-id';
        idSpan.textContent = `(${node.id})`;
        header.appendChild(idSpan);
        // Collapse button
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'node-collapse-btn';
        collapseBtn.textContent = node.isCollapsed ? '▶' : '▼';
        collapseBtn.setAttribute('data-action', 'toggle-collapse');
        header.appendChild(collapseBtn);
        return header;
    }
    /**
     * Renders a block element
     */
    renderBlock(block, _correlationId) {
        const blockElement = document.createElement('div');
        blockElement.className = `node-block block-${block.type}`;
        blockElement.id = `block-${block.id}`;
        blockElement.setAttribute('data-block-id', block.id);
        // Apply dimensions
        blockElement.style.width = `${block.dimensions.width}px`;
        blockElement.style.height = `${block.dimensions.height}px`;
        // Add minimized class if needed
        if (block.isMinimized) {
            blockElement.classList.add('minimized');
        }
        // Create block header
        const header = document.createElement('div');
        header.className = 'block-header';
        const title = document.createElement('span');
        title.className = 'block-title';
        title.textContent = block.title || this.getDefaultBlockTitle(block.type);
        header.appendChild(title);
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'block-minimize-btn';
        minimizeBtn.textContent = block.isMinimized ? '▶' : '▼';
        minimizeBtn.setAttribute('data-action', 'toggle-minimize');
        header.appendChild(minimizeBtn);
        blockElement.appendChild(header);
        // Create content area
        if (!block.isMinimized) {
            const content = document.createElement('div');
            content.className = 'block-content';
            const textarea = document.createElement('textarea');
            textarea.className = 'block-textarea';
            textarea.value = block.content;
            textarea.style.height = `${block.dimensions.height - 40}px`; // Account for header
            content.appendChild(textarea);
            blockElement.appendChild(content);
        }
        return blockElement;
    }
    /**
     * Creates a block
     */
    createBlock(nodeId, config, correlationId) {
        const blockId = createBlockId();
        const now = new Date();
        const dimensions = Object.assign(Object.assign({}, createDefaultBlockDimensions()), config.dimensions);
        const metadata = {
            createdAt: now,
            lastModified: now
        };
        const block = Object.assign(Object.assign({ id: blockId, type: config.type }, (config.title !== undefined && { title: config.title })), { content: this.sanitizeContent(config.content || '', correlationId), dimensions, isMinimized: false, metadata });
        // Validate block
        if (!isBasicBlock(block)) {
            throw new BlockCreationError('Invalid block structure', nodeId, block);
        }
        // Map block to node
        this.blockNodeMap.set(blockId, nodeId);
        return block;
    }
    /**
     * Validates node title
     */
    validateNodeTitle(title, correlationId) {
        const trimmed = title.trim();
        if (trimmed.length === 0) {
            return 'Untitled Node';
        }
        if (trimmed.length > 100) {
            this.logger.warn('Node title too long, truncating', { originalLength: trimmed.length }, correlationId);
            return trimmed.substring(0, 100);
        }
        // Validate pattern
        const pattern = /^[a-zA-Z0-9\s\-_\.]{1,100}$/;
        if (!pattern.test(trimmed)) {
            this.logger.warn('Node title contains invalid characters, sanitizing', { title: trimmed }, correlationId);
            return trimmed.replace(/[^a-zA-Z0-9\s\-_\.]/g, '');
        }
        return trimmed;
    }
    /**
     * Sanitizes content
     */
    sanitizeContent(content, correlationId) {
        // Basic HTML escaping
        const escaped = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        // Check length
        if (escaped.length > 50000) {
            this.logger.warn('Content too long, truncating', { originalLength: escaped.length }, correlationId);
            return escaped.substring(0, 50000);
        }
        return escaped;
    }
    /**
     * Gets default block title
     */
    getDefaultBlockTitle(type) {
        switch (type) {
            case 'prompt':
                return 'Prompt';
            case 'response':
                return 'Response';
            case 'markdown':
                return 'Markdown';
            default:
                return 'Block';
        }
    }
    /**
     * Handles resize from resize handler
     */
    handleResize(nodeId, dimensions) {
        this.resizeNode(nodeId, dimensions);
    }
}
/**
 * Creates error context for operations
 */
function createErrorContext(functionName, parameters) {
    return Object.assign(Object.assign({ functionName }, (parameters !== undefined && { parameters })), { timestamp: new Date().toISOString(), correlationId: Math.random().toString(36).substring(7) });
}
