/**
 * GraphSynchronizer Service
 * 
 * Manages bidirectional synchronization between the chat interface
 * and the graph editor, ensuring consistency across both views.
 */

import { Logger } from '../utils/logger.js';
import { ErrorFactory } from '../types/errors.js';
import type { GraphEditor } from '../components/graph-editor.js';
import type { ChatInterface } from '../components/chat-interface.js';

/**
 * Handles synchronization between chat state and graph nodes.
 * Ensures that changes in either view are reflected in the other.
 */
export class GraphSynchronizer {
  private readonly logger: Logger;
  private readonly errorFactory: ErrorFactory;
  private readonly graphEditor: GraphEditor;
  private chatInterface: ChatInterface | null = null;
  
  // Sync state management
  private isSyncing: boolean = false;
  private syncQueue: Array<() => Promise<void>> = [];
  
  constructor(graphEditor: GraphEditor) {
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
  public setChatInterface(chatInterface: ChatInterface): void {
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
  public async syncNewChildNode(parentNodeId: string, newNodeId: string): Promise<void> {
    const startTime = performance.now();
    this.logger.logFunctionEntry('syncNewChildNode', { parentNodeId, newNodeId });
    
    await this.executeSyncOperation(async () => {
      try {
        // Ensure the node is rendered in the graph
        const node = this.graphEditor.getNode(newNodeId);
        if (!node) {
          throw this.errorFactory.createValidationError(
            `New node ${newNodeId} not found`,
            'NODE_NOT_FOUND',
            'Failed to sync: node was not created properly.',
            'syncNewChildNode',
            { newNodeId }
          );
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
            await this.chatInterface.openChatForNode(newNodeId);
          }
        }
        
        // Auto-layout when nodes are added from conversation
        this.graphEditor.autoLayout();
        this.logger.logInfo('Auto-layout applied after node creation', 'syncNewChildNode');
        
      } catch (error) {
        this.logger.logError(error as Error, 'syncNewChildNode', { 
          parentNodeId, 
          newNodeId 
        });
        throw error;
      }
    });
    
    const executionTime = performance.now() - startTime;
    this.logger.logPerformance('syncNewChildNode', 'sync_operation', executionTime);
    this.logger.logFunctionExit('syncNewChildNode', undefined, executionTime);
  }
  
  /**
   * Synchronizes when a markdown block is added to a node.
   * 
   * @param nodeId - The node that received the markdown block
   * @param blockId - The ID of the new markdown block
   */
  public async syncNodeBlockAddition(nodeId: string, blockId: string): Promise<void> {
    const startTime = performance.now();
    this.logger.logFunctionEntry('syncNodeBlockAddition', { nodeId, blockId });
    
    await this.executeSyncOperation(async () => {
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
            await this.chatInterface.openChatForNode(currentThread.targetNodeId);
          }
        }
        
      } catch (error) {
        this.logger.logError(error as Error, 'syncNodeBlockAddition', { 
          nodeId, 
          blockId 
        });
        throw error;
      }
    });
    
    const executionTime = performance.now() - startTime;
    this.logger.logPerformance('syncNodeBlockAddition', 'sync_operation', executionTime);
    this.logger.logFunctionExit('syncNodeBlockAddition', undefined, executionTime);
  }
  
  /**
   * Synchronizes response block updates during streaming.
   * 
   * @param nodeId - The node containing the response
   * @param blockId - The response block ID
   * @param content - The updated content
   */
  public async syncResponseBlock(nodeId: string, blockId: string, content: string): Promise<void> {
    // For streaming responses, we might want to throttle updates
    // For now, the graph editor handles its own updates during streaming
    // and the chat will refresh when needed
    this.logger.logDebug('Response block sync called', 'syncResponseBlock', {
      nodeId,
      blockId,
      contentLength: content.length
    });
  }
  
  /**
   * Handles when a node is deleted externally.
   * TODO: Connect this to GraphEditor events when implemented
   * 
   * @param deletedNodeId - The ID of the deleted node
   */
  // @ts-ignore - Will be used when GraphEditor events are implemented
  private async handleNodeDeletion(deletedNodeId: string): Promise<void> {
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
          } else {
            // Try to rebuild the thread with the remaining nodes
            const remainingNodes = currentThread.nodePath.filter(id => id !== deletedNodeId);
            if (remainingNodes.length > 0) {
              const newTargetId = remainingNodes[remainingNodes.length - 1];
              if (newTargetId) {
                await this.chatInterface.openChatForNode(newTargetId);
              }
            } else {
              this.chatInterface.closeChat();
            }
          }
        }
      }
    } catch (error) {
      this.logger.logError(error as Error, 'handleNodeDeletion', { deletedNodeId });
    }
    
    this.logger.logFunctionExit('handleNodeDeletion');
  }
  
  /**
   * Handles when node content is modified externally.
   * TODO: Connect this to GraphEditor events when implemented
   * 
   * @param nodeId - The modified node ID
   * @param blockId - The modified block ID (if specific block)
   */
  // @ts-ignore - Will be used when GraphEditor events are implemented
  private async handleNodeModification(nodeId: string, blockId?: string): Promise<void> {
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
          await this.chatInterface.openChatForNode(currentThread.targetNodeId);
        }
      }
    } catch (error) {
      this.logger.logError(error as Error, 'handleNodeModification', { nodeId, blockId });
    }
    
    this.logger.logFunctionExit('handleNodeModification');
  }
  
  /**
   * Sets up event listeners for graph editor changes.
   */
  private setupGraphEventListeners(): void {
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
  private async executeSyncOperation(operation: () => Promise<void>): Promise<void> {
    if (this.isSyncing) {
      // Queue the operation
      this.logger.logInfo('Queueing sync operation', 'executeSyncOperation', {
        queueLength: this.syncQueue.length
      });
      
      return new Promise((resolve, reject) => {
        this.syncQueue.push(async () => {
          try {
            await operation();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    
    this.isSyncing = true;
    
    try {
      await operation();
      
      // Process any queued operations
      while (this.syncQueue.length > 0) {
        const nextOp = this.syncQueue.shift();
        if (nextOp) {
          await nextOp();
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }
}