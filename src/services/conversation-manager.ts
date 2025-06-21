/**
 * ConversationManager Service
 * 
 * Manages conversation threads, node associations, and message flow
 * between the chat interface and graph nodes.
 */

import { Logger } from '../utils/logger.js';
import { ErrorFactory } from '../types/errors.js';
import type { GraphEditor } from '../components/graph-editor.js';
import type { GraphNode, NodeBlock } from '../types/graph.types.js';
import type { 
  ChatMessage, 
  ConversationThread
} from '../types/chat.types.js';
import { ChatMessageType } from '../types/chat.types.js';
import type {
  ConversationFlowState
} from '../types/conversation.types.js';
import { 
  DEFAULT_ASSOCIATION_RULES
} from '../types/conversation.types.js';

/**
 * Service responsible for managing conversation flow and node associations.
 * Handles thread construction, message creation, and coordination with the graph editor.
 */
export class ConversationManager {
  private readonly logger: Logger;
  private readonly errorFactory: ErrorFactory;
  private readonly graphEditor: GraphEditor;
  
  private flowState: ConversationFlowState = {
    currentThreadId: null,
    lastPromptNodeId: null,
    associationRules: DEFAULT_ASSOCIATION_RULES,
    pendingOperations: []
  };
  
  constructor(graphEditor: GraphEditor) {
    this.logger = new Logger('ConversationManager');
    this.errorFactory = new ErrorFactory('conversation-manager');
    this.graphEditor = graphEditor;
    
    this.logger.logFunctionEntry('constructor');
    this.logger.logFunctionExit('constructor');
  }
  
  /**
   * Builds a complete conversation thread from the target node back to the root.
   * Traverses the parent chain and constructs an ordered message list.
   * 
   * @param nodeId - The target node ID to build the thread from
   * @returns Complete conversation thread with all messages in chronological order
   * @throws ValidationError if nodeId doesn't exist or path is broken
   */
  public buildThreadFromNodeToRoot(nodeId: string): ConversationThread {
    const startTime = performance.now();
    this.logger.logFunctionEntry('buildThreadFromNodeToRoot', { nodeId });
    
    try {
      // Validate node exists
      const targetNode = this.graphEditor.getNode(nodeId);
      if (!targetNode) {
        throw this.errorFactory.createValidationError(
          `Node with ID ${nodeId} not found`,
          'NODE_NOT_FOUND',
          'The selected node does not exist.',
          'buildThreadFromNodeToRoot',
          { nodeId }
        );
      }
      
      // Step 1: Traverse from target node back to root
      const nodePath: string[] = [];
      const excludedNodes = new Set<string>(); // Track nodes to exclude (siblings not in path)
      let currentNode: GraphNode | undefined = targetNode;
      
      while (currentNode) {
        nodePath.unshift(currentNode.id); // Add to beginning for root-to-target order
        
        // If this node was branched from another node, we should use the original node instead
        // and exclude all its sibling branches from the path
        if (currentNode.branchedFrom) {
          const originalNode = this.graphEditor.getNode(currentNode.branchedFrom);
          if (originalNode) {
            // Add all branches of the original node to excluded set except the current one
            if (originalNode.branches) {
              for (const branchId of originalNode.branches) {
                if (branchId !== currentNode.id) {
                  excludedNodes.add(branchId);
                }
              }
            }
            // Also exclude the original node since we're using the branch
            excludedNodes.add(originalNode.id);
          }
        }
        
        // If this node has branches, exclude all of them from the path
        // (we're following the main path, not the branches)
        if (currentNode.branches) {
          for (const branchId of currentNode.branches) {
            excludedNodes.add(branchId);
          }
        }
        
        if (currentNode.parentId) {
          currentNode = this.graphEditor.getNode(currentNode.parentId);
          if (!currentNode && nodePath.length > 1) {
            // Parent reference is broken
            throw this.errorFactory.createTreeStructureError(
              'Broken parent reference in conversation thread',
              'BROKEN_PARENT_REF',
              'The conversation thread is incomplete due to missing nodes.',
              'buildThreadFromNodeToRoot',
              { brokenAt: nodePath[0], parentId: targetNode.parentId }
            );
          }
        } else {
          currentNode = undefined; // Reached root
        }
      }
      
      this.logger.logInfo('Node path constructed', 'buildThreadFromNodeToRoot', {
        pathLength: nodePath.length,
        rootId: nodePath[0],
        targetId: nodeId
      });
      
      // Step 2: Extract all blocks from each node in order
      const messages: ChatMessage[] = [];
      
      for (const pathNodeId of nodePath) {
        const node = this.graphEditor.getNode(pathNodeId);
        if (!node) continue; // Shouldn't happen, but be safe
        
        // Convert each block to a ChatMessage
        for (const block of node.blocks) {
          const messageType = this.getMessageTypeFromBlock(block);
          if (messageType) {
            messages.push({
              id: `msg-${pathNodeId}-${block.id}`,
              type: messageType,
              content: block.content,
              timestamp: new Date(), // TODO: Add actual timestamps to blocks
              nodeId: pathNodeId,
              blockId: block.id
            });
          }
        }
      }
      
      // Step 3: Create and return the conversation thread
      const thread: ConversationThread = {
        id: `thread-${Date.now()}`,
        rootNodeId: nodePath[0] || nodeId,
        targetNodeId: nodeId,
        nodePath,
        messages,
        depth: nodePath.length
      };
      
      // Update flow state
      this.flowState.currentThreadId = thread.id;
      this.updateLastPromptNodeId(thread);
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('buildThreadFromNodeToRoot', 'thread_construction', executionTime);
      this.logger.logFunctionExit('buildThreadFromNodeToRoot', { 
        threadId: thread.id,
        messageCount: messages.length,
        depth: thread.depth
      }, executionTime);
      
      return thread;
      
    } catch (error) {
      this.logger.logError(error as Error, 'buildThreadFromNodeToRoot', { nodeId });
      throw error;
    }
  }
  
  /**
   * Updates an empty node with prompt content or creates a new child node.
   * If the current node has an empty prompt, it updates that node.
   * Otherwise, it creates a new child node.
   * 
   * @param nodeId - The current node ID
   * @param promptContent - The prompt content from the user
   * @param onStreamingUpdate - Optional callback for streaming updates
   * @returns The ID of the updated or newly created node
   * @throws ValidationError if node doesn't exist
   */
  public async submitPromptForNode(
    nodeId: string, 
    promptContent: string,
    onStreamingUpdate?: (content: string) => void
  ): Promise<string> {
    const startTime = performance.now();
    this.logger.logFunctionEntry('submitPromptForNode', { 
      nodeId, 
      promptLength: promptContent.length 
    });
    
    try {
      // Check if current node has an empty prompt block
      const currentNode = this.graphEditor.getNode(nodeId);
      if (!currentNode) {
        throw this.errorFactory.createValidationError(
          `Node with ID ${nodeId} not found`,
          'NODE_NOT_FOUND',
          'Cannot submit prompt: node does not exist.',
          'submitPromptForNode',
          { nodeId }
        );
      }
      
      // Check if the node has an empty prompt block
      const promptBlock = currentNode.blocks.find(b => b.type === 'prompt');
      if (promptBlock && promptBlock.content === '') {
        // Update the existing empty node
        this.logger.logInfo('Updating empty prompt block', 'submitPromptForNode', { nodeId });
        
        // Directly update the prompt content to avoid branching on empty nodes
        // This is safe because the prompt is empty, so there's no history to preserve
        promptBlock.content = promptContent;
        
        // Refresh the node to update the UI
        this.graphEditor.refreshNode(nodeId);
        
        // Generate LLM response for this node
        await this.graphEditor.submitToLLM(nodeId, onStreamingUpdate);
        
        // Update flow state
        this.flowState.lastPromptNodeId = nodeId;
        
        return nodeId;
      } else {
        // Create a new child node
        this.logger.logInfo('Creating new child node for prompt', 'submitPromptForNode', { nodeId });
        return await this.createChildNodeForPrompt(nodeId, promptContent, onStreamingUpdate);
      }
      
    } catch (error) {
      this.logger.logError(error as Error, 'submitPromptForNode');
      throw error;
    } finally {
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('submitPromptForNode', 'prompt_submission', executionTime);
      this.logger.logFunctionExit('submitPromptForNode', undefined, executionTime);
    }
  }

  /**
   * Creates a new child node with a prompt block and generates an LLM response.
   * 
   * @param parentNodeId - The parent node to create the child under
   * @param promptContent - The prompt content from the user
   * @param onStreamingUpdate - Optional callback for streaming updates
   * @returns The ID of the newly created node
   * @throws ValidationError if parent doesn't exist
   * @throws TreeStructureError if tree constraints would be violated
   */
  public async createChildNodeForPrompt(
    parentNodeId: string, 
    promptContent: string,
    onStreamingUpdate?: (content: string) => void
  ): Promise<string> {
    const startTime = performance.now();
    this.logger.logFunctionEntry('createChildNodeForPrompt', { 
      parentNodeId, 
      promptLength: promptContent.length 
    });
    
    try {
      // Step 1: Validate parent node exists
      const parentNode = this.graphEditor.getNode(parentNodeId);
      if (!parentNode) {
        throw this.errorFactory.createValidationError(
          `Parent node with ID ${parentNodeId} not found`,
          'PARENT_NOT_FOUND',
          'Cannot create child node: parent does not exist.',
          'createChildNodeForPrompt',
          { parentNodeId }
        );
      }
      
      // Step 2: Create new node with prompt block
      const promptBlock: NodeBlock = {
        id: `block-${Date.now()}-prompt`,
        type: 'prompt',
        content: promptContent,
        position: 0  // First block in the node
      };
      
      // Create the node with just the prompt block initially
      let newNodeId: string;
      try {
        newNodeId = this.graphEditor.createNode(parentNodeId, [promptBlock]);
        this.logger.logInfo('Child node created with prompt', 'createChildNodeForPrompt', {
          newNodeId,
          parentNodeId
        });
      } catch (error) {
        this.logger.logError(error as Error, 'createChildNodeForPrompt', { 
          phase: 'node_creation' 
        });
        throw error;
      }
      
      // Step 3: Generate LLM response
      try {
        // Build conversation context
        const thread = this.buildThreadFromNodeToRoot(newNodeId);
        const conversationContext = this.buildConversationContext(thread);
        
        // Call Gemini service
        this.logger.logInfo('Calling Gemini API', 'createChildNodeForPrompt', {
          contextLength: conversationContext.length,
          promptPreview: promptContent.substring(0, 50)
        });
        
        await this.graphEditor.submitToLLM(newNodeId, onStreamingUpdate);
        
        // Update flow state
        this.flowState.lastPromptNodeId = newNodeId;
        
      } catch (error) {
        this.logger.logError(error as Error, 'createChildNodeForPrompt', { 
          phase: 'llm_generation',
          nodeId: newNodeId
        });
        // Note: We don't rollback the node creation here as the user might want to retry
        // or the node might still be useful even without a response
        throw error;
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('createChildNodeForPrompt', 'node_creation_with_llm', executionTime);
      this.logger.logFunctionExit('createChildNodeForPrompt', { newNodeId }, executionTime);
      
      return newNodeId;
      
    } catch (error) {
      this.logger.logError(error as Error, 'createChildNodeForPrompt');
      throw error;
    }
  }
  
  /**
   * Adds a markdown block to the most recent prompt node in the thread.
   * 
   * @param markdownContent - The markdown content to add
   * @param currentThread - The current conversation thread
   * @throws ValidationError if no previous prompt exists
   */
  public async associateMarkdownWithPreviousPrompt(
    markdownContent: string, 
    currentThread: ConversationThread
  ): Promise<void> {
    const startTime = performance.now();
    this.logger.logFunctionEntry('associateMarkdownWithPreviousPrompt', {
      markdownLength: markdownContent.length,
      threadId: currentThread.id,
      markdownPreview: markdownContent.substring(0, 100),
      fullContent: markdownContent // Log full content for debugging
    });
    
    try {
      // Step 1: Find the most recent prompt node
      let promptNodeId: string | null = null;
      
      // First check if we have a cached last prompt node ID
      if (this.flowState.lastPromptNodeId) {
        // Verify it still exists and is in the current thread
        if (currentThread.nodePath.includes(this.flowState.lastPromptNodeId)) {
          promptNodeId = this.flowState.lastPromptNodeId;
          this.logger.logInfo('Using cached last prompt node', 'associateMarkdownWithPreviousPrompt', {
            nodeId: promptNodeId
          });
        }
      }
      
      // If not found in cache, search through the thread
      if (!promptNodeId) {
        // Traverse messages in reverse to find most recent prompt
        for (let i = currentThread.messages.length - 1; i >= 0; i--) {
          const message = currentThread.messages[i];
          if (message && message.type === ChatMessageType.USER_PROMPT) {
            promptNodeId = message.nodeId;
            this.logger.logInfo('Found prompt node by traversal', 'associateMarkdownWithPreviousPrompt', {
              nodeId: promptNodeId,
              messageIndex: i
            });
            break;
          }
        }
      }
      
      if (!promptNodeId) {
        throw this.errorFactory.createValidationError(
          'No previous prompt found to associate markdown with',
          'NO_PREVIOUS_PROMPT',
          'You must send a prompt before adding markdown notes.',
          'associateMarkdownWithPreviousPrompt',
          { threadId: currentThread.id }
        );
      }
      
      // Step 2: Add markdown block to the identified node
      try {
        this.graphEditor.addMarkdownBlock(promptNodeId);
        
        // Find the newly added block and update its content
        const node = this.graphEditor.getNode(promptNodeId);
        if (node) {
          const markdownBlocks = node.blocks.filter(b => b.type === 'markdown');
          const lastMarkdownBlock = markdownBlocks[markdownBlocks.length - 1];
          
          if (lastMarkdownBlock) {
            // Use the index to update the content
            const blockIndex = node.blocks.findIndex(b => b.id === lastMarkdownBlock.id);
            if (blockIndex !== -1) {
              this.logger.logInfo('Updating markdown block content', 'associateMarkdownWithPreviousPrompt', {
                nodeId: promptNodeId,
                blockId: lastMarkdownBlock.id,
                blockIndex,
                contentToSet: markdownContent,
                contentLength: markdownContent.length
              });
              
              this.graphEditor.updateBlockContent(promptNodeId, blockIndex, markdownContent);
              
              // Re-render the node to show the updated content
              this.graphEditor.refreshNode(promptNodeId);
              
              // Wait a bit for DOM to update before setting preview mode
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Set the markdown block to preview mode
              const previewManager = this.graphEditor.getPreviewToggleManager();
              if (previewManager) {
                try {
                  await previewManager.setBlockPreviewMode(
                    lastMarkdownBlock.id as any, // BlockId type
                    'rendered',
                    'api'
                  );
                } catch (error) {
                  this.logger.logWarn('Failed to set preview mode', 'associateMarkdownWithPreviousPrompt', {
                    error: String(error),
                    blockId: lastMarkdownBlock.id
                  });
                }
              }
              
              this.logger.logInfo('Markdown block added and updated', 'associateMarkdownWithPreviousPrompt', {
                nodeId: promptNodeId,
                blockId: lastMarkdownBlock.id,
                blockIndex,
                finalContent: this.graphEditor.getNode(promptNodeId)?.blocks[blockIndex]?.content
              });
            }
          }
        }
        
      } catch (error) {
        this.logger.logError(error as Error, 'associateMarkdownWithPreviousPrompt', {
          phase: 'block_addition',
          targetNodeId: promptNodeId
        });
        throw error;
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('associateMarkdownWithPreviousPrompt', 'markdown_association', executionTime);
      this.logger.logFunctionExit('associateMarkdownWithPreviousPrompt', undefined, executionTime);
      
    } catch (error) {
      this.logger.logError(error as Error, 'associateMarkdownWithPreviousPrompt');
      throw error;
    }
  }
  
  /**
   * Gets the current conversation flow state.
   */
  public getFlowState(): ConversationFlowState {
    return { ...this.flowState };
  }
  
  /**
   * Clears the current conversation state.
   */
  public clearState(): void {
    this.logger.logFunctionEntry('clearState');
    
    this.flowState = {
      currentThreadId: null,
      lastPromptNodeId: null,
      associationRules: DEFAULT_ASSOCIATION_RULES,
      pendingOperations: []
    };
    
    this.logger.logInfo('Conversation state cleared', 'clearState');
    this.logger.logFunctionExit('clearState');
  }
  
  /**
   * Determines the message type from a node block.
   */
  private getMessageTypeFromBlock(block: NodeBlock): ChatMessageType | null {
    switch (block.type) {
      case 'prompt':
        return ChatMessageType.USER_PROMPT;
      case 'response':
        return ChatMessageType.ASSISTANT_RESPONSE;
      case 'markdown':
        return ChatMessageType.USER_MARKDOWN;
      default:
        return null;
    }
  }
  
  /**
   * Updates the last prompt node ID based on the current thread.
   */
  private updateLastPromptNodeId(thread: ConversationThread): void {
    // Find the last prompt message in the thread
    for (let i = thread.messages.length - 1; i >= 0; i--) {
      const message = thread.messages[i];
      if (message && message.type === ChatMessageType.USER_PROMPT) {
        this.flowState.lastPromptNodeId = message.nodeId;
        this.logger.logInfo('Updated last prompt node ID', 'updateLastPromptNodeId', {
          nodeId: this.flowState.lastPromptNodeId
        });
        break;
      }
    }
  }
  
  /**
   * Builds conversation context from the thread for LLM prompting.
   */
  private buildConversationContext(thread: ConversationThread): string {
    const contextParts: string[] = [];
    
    for (const message of thread.messages) {
      switch (message.type) {
        case ChatMessageType.USER_PROMPT:
          contextParts.push(`User: ${message.content}`);
          break;
        case ChatMessageType.ASSISTANT_RESPONSE:
          contextParts.push(`Assistant: ${message.content}`);
          break;
        case ChatMessageType.USER_MARKDOWN:
          contextParts.push(`[User Note: ${message.content}]`);
          break;
      }
    }
    
    return contextParts.join('\n\n');
  }
}