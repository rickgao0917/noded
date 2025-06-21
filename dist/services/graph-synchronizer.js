/**
 * GraphSynchronizer Service
 *
 * Manages bidirectional synchronization between the chat interface
 * and the graph editor, ensuring consistency across both views.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Logger } from '../utils/logger.js';
import { ErrorFactory } from '../types/errors.js';
/**
 * Handles synchronization between chat state and graph nodes.
 * Ensures that changes in either view are reflected in the other.
 */
export class GraphSynchronizer {
    constructor(graphEditor) {
        this.chatInterface = null;
        // Sync state management
        this.isSyncing = false;
        this.syncQueue = [];
        this.logger = new Logger('GraphSynchronizer');
        this.errorFactory = new ErrorFactory('graph-synchronizer');
        this.graphEditor = graphEditor;
        this.logger.logFunctionEntry('constructor');
        this.setupGraphEventListeners();
        this.logger.logFunctionExit('constructor');
    }
    /**
     * Sets the chat interface reference for bidirectional communication.
     *
     * @param chatInterface - The chat interface instance
     */
    setChatInterface(chatInterface) {
        this.logger.logFunctionEntry('setChatInterface');
        this.chatInterface = chatInterface;
        this.logger.logInfo('Chat interface connected', 'setChatInterface');
        this.logger.logFunctionExit('setChatInterface');
    }
    /**
     * Synchronizes a newly created child node with the chat display.
     *
     * @param parentNodeId - The parent node ID
     * @param newNodeId - The newly created child node ID
     */
    syncNewChildNode(parentNodeId, newNodeId) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            this.logger.logFunctionEntry('syncNewChildNode', { parentNodeId, newNodeId });
            yield this.executeSyncOperation(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    // Ensure the node is rendered in the graph
                    const node = this.graphEditor.getNode(newNodeId);
                    if (!node) {
                        throw this.errorFactory.createValidationError(`New node ${newNodeId} not found`, 'NODE_NOT_FOUND', 'Failed to sync: node was not created properly.', 'syncNewChildNode', { newNodeId });
                    }
                    // Update connections by re-rendering the node
                    // The GraphEditor will handle connection updates internally
                    // If chat is open, refresh the thread display
                    if (this.chatInterface && this.chatInterface.isVisible()) {
                        const currentThread = this.chatInterface.getCurrentThread();
                        if (currentThread && currentThread.nodePath.includes(parentNodeId)) {
                            // The new node is part of the active conversation
                            this.logger.logInfo('Refreshing chat thread with new node', 'syncNewChildNode', {
                                threadId: currentThread.id,
                                newNodeId
                            });
                            // Re-open chat for the new node to show updated thread
                            yield this.chatInterface.openChatForNode(newNodeId);
                        }
                    }
                    // Auto-layout when nodes are added from conversation
                    this.graphEditor.autoLayout();
                    this.logger.logInfo('Auto-layout applied after node creation', 'syncNewChildNode');
                }
                catch (error) {
                    this.logger.logError(error, 'syncNewChildNode', {
                        parentNodeId,
                        newNodeId
                    });
                    throw error;
                }
            }));
            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('syncNewChildNode', 'sync_operation', executionTime);
            this.logger.logFunctionExit('syncNewChildNode', undefined, executionTime);
        });
    }
    /**
     * Synchronizes when a markdown block is added to a node.
     *
     * @param nodeId - The node that received the markdown block
     * @param blockId - The ID of the new markdown block
     */
    syncNodeBlockAddition(nodeId, blockId) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            this.logger.logFunctionEntry('syncNodeBlockAddition', { nodeId, blockId });
            yield this.executeSyncOperation(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    // Re-render the node to show the new block
                    const node = this.graphEditor.getNode(nodeId);
                    if (!node) {
                        this.logger.logWarn('Node not found for block addition sync', 'syncNodeBlockAddition', {
                            nodeId,
                            blockId
                        });
                        return;
                    }
                    // The graph editor should already have rendered the new block
                    // We just need to update the chat display if it's showing this node
                    if (this.chatInterface && this.chatInterface.isVisible()) {
                        const currentThread = this.chatInterface.getCurrentThread();
                        if (currentThread && currentThread.nodePath.includes(nodeId)) {
                            this.logger.logInfo('Refreshing chat thread with new block', 'syncNodeBlockAddition', {
                                threadId: currentThread.id,
                                nodeId,
                                blockId
                            });
                            // Refresh the thread to show the new markdown
                            yield this.chatInterface.openChatForNode(currentThread.targetNodeId);
                        }
                    }
                }
                catch (error) {
                    this.logger.logError(error, 'syncNodeBlockAddition', {
                        nodeId,
                        blockId
                    });
                    throw error;
                }
            }));
            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('syncNodeBlockAddition', 'sync_operation', executionTime);
            this.logger.logFunctionExit('syncNodeBlockAddition', undefined, executionTime);
        });
    }
    /**
     * Synchronizes response block updates during streaming.
     *
     * @param nodeId - The node containing the response
     * @param blockId - The response block ID
     * @param content - The updated content
     */
    syncResponseBlock(nodeId, blockId, content) {
        return __awaiter(this, void 0, void 0, function* () {
            // For streaming responses, we might want to throttle updates
            // For now, the graph editor handles its own updates during streaming
            // and the chat will refresh when needed
            this.logger.logDebug('Response block sync called', 'syncResponseBlock', {
                nodeId,
                blockId,
                contentLength: content.length
            });
        });
    }
    /**
     * Handles when a node is deleted externally.
     * TODO: Connect this to GraphEditor events when implemented
     *
     * @param deletedNodeId - The ID of the deleted node
     */
    // @ts-ignore - Will be used when GraphEditor events are implemented
    handleNodeDeletion(deletedNodeId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('handleNodeDeletion', { deletedNodeId });
            try {
                if (this.chatInterface && this.chatInterface.isVisible()) {
                    const currentThread = this.chatInterface.getCurrentThread();
                    if (currentThread && currentThread.nodePath.includes(deletedNodeId)) {
                        // The deleted node was part of the active conversation
                        this.logger.logWarn('Active thread node deleted', 'handleNodeDeletion', {
                            deletedNodeId,
                            threadId: currentThread.id
                        });
                        // If the deleted node was the target, close the chat
                        if (currentThread.targetNodeId === deletedNodeId) {
                            this.chatInterface.closeChat();
                        }
                        else {
                            // Try to rebuild the thread with the remaining nodes
                            const remainingNodes = currentThread.nodePath.filter(id => id !== deletedNodeId);
                            if (remainingNodes.length > 0) {
                                const newTargetId = remainingNodes[remainingNodes.length - 1];
                                if (newTargetId) {
                                    yield this.chatInterface.openChatForNode(newTargetId);
                                }
                            }
                            else {
                                this.chatInterface.closeChat();
                            }
                        }
                    }
                }
            }
            catch (error) {
                this.logger.logError(error, 'handleNodeDeletion', { deletedNodeId });
            }
            this.logger.logFunctionExit('handleNodeDeletion');
        });
    }
    /**
     * Handles when node content is modified externally.
     * TODO: Connect this to GraphEditor events when implemented
     *
     * @param nodeId - The modified node ID
     * @param blockId - The modified block ID (if specific block)
     */
    // @ts-ignore - Will be used when GraphEditor events are implemented
    handleNodeModification(nodeId, blockId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('handleNodeModification', { nodeId, blockId });
            try {
                if (this.chatInterface && this.chatInterface.isVisible()) {
                    const currentThread = this.chatInterface.getCurrentThread();
                    if (currentThread && currentThread.nodePath.includes(nodeId)) {
                        // The modified node is part of the active conversation
                        this.logger.logInfo('Active thread node modified', 'handleNodeModification', {
                            nodeId,
                            blockId,
                            threadId: currentThread.id
                        });
                        // Refresh the thread to show updated content
                        yield this.chatInterface.openChatForNode(currentThread.targetNodeId);
                    }
                }
            }
            catch (error) {
                this.logger.logError(error, 'handleNodeModification', { nodeId, blockId });
            }
            this.logger.logFunctionExit('handleNodeModification');
        });
    }
    /**
     * Sets up event listeners for graph editor changes.
     */
    setupGraphEventListeners() {
        this.logger.logFunctionEntry('setupGraphEventListeners');
        // TODO: The GraphEditor doesn't currently emit events for external changes
        // This would need to be implemented in GraphEditor for full bidirectional sync
        // For now, we rely on the chat interface driving most changes
        this.logger.logInfo('Graph event listeners setup complete', 'setupGraphEventListeners');
        this.logger.logFunctionExit('setupGraphEventListeners');
    }
    /**
     * Executes a sync operation, ensuring operations are serialized.
     */
    executeSyncOperation(operation) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isSyncing) {
                // Queue the operation
                this.logger.logInfo('Queueing sync operation', 'executeSyncOperation', {
                    queueLength: this.syncQueue.length
                });
                return new Promise((resolve, reject) => {
                    this.syncQueue.push(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            yield operation();
                            resolve();
                        }
                        catch (error) {
                            reject(error);
                        }
                    }));
                });
            }
            this.isSyncing = true;
            try {
                yield operation();
                // Process any queued operations
                while (this.syncQueue.length > 0) {
                    const nextOp = this.syncQueue.shift();
                    if (nextOp) {
                        yield nextOp();
                    }
                }
            }
            finally {
                this.isSyncing = false;
            }
        });
    }
}
