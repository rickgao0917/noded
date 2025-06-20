/**
 * Type definitions for conversation management and node association logic.
 * These types define how chat messages map to graph nodes and how
 * conversation flow is managed.
 */

import type { ChatMessage } from './chat.types.js';

/**
 * Defines the rules for how different types of content associate with nodes.
 * These rules ensure consistent behavior when adding prompts, responses, and markdown.
 */
export interface NodeAssociationRule {
  /** Markdown blocks always associate with the previous prompt node, not the current node */
  readonly markdownTargetsLastPrompt: boolean;
  
  /** New prompts always create child nodes rather than adding to existing nodes */
  readonly promptCreatesNewChild: boolean;
  
  /** LLM responses go in the same node as the prompt that triggered them */
  readonly responseInSameNode: boolean;
}

/**
 * Default association rules for the chat system.
 */
export const DEFAULT_ASSOCIATION_RULES: NodeAssociationRule = {
  markdownTargetsLastPrompt: true,
  promptCreatesNewChild: true,
  responseInSameNode: true
};

/**
 * Represents the current state of a conversation flow.
 * Tracks active threads, node associations, and pending operations.
 */
export interface ConversationFlowState {
  /** ID of the currently active conversation thread, null if no chat is open */
  currentThreadId: string | null;
  
  /** ID of the most recent node containing a prompt (for markdown association) */
  lastPromptNodeId: string | null;
  
  /** Rules governing how content associates with nodes */
  associationRules: NodeAssociationRule;
  
  /** Queue of operations waiting to be applied to the graph */
  pendingOperations: PendingOperation[];
}

/**
 * Base interface for pending operations.
 */
interface BasePendingOperation {
  /** Unique identifier for this operation */
  id: string;
  
  /** When this operation was created */
  timestamp: Date;
  
  /** Whether this operation has been started */
  started: boolean;
  
  /** Whether this operation has completed */
  completed: boolean;
  
  /** Error message if operation failed */
  error?: string;
}

/**
 * Operation to create a new child node with a prompt.
 */
export interface CreateChildOperation extends BasePendingOperation {
  type: 'create_child';
  
  /** Parent node ID where the child will be added */
  parentNodeId: string;
  
  /** The prompt content to add to the new child node */
  promptContent: string;
}

/**
 * Operation to add a markdown block to an existing node.
 */
export interface AddMarkdownOperation extends BasePendingOperation {
  type: 'add_markdown';
  
  /** Target node ID to add the markdown block to */
  targetNodeId: string;
  
  /** The markdown content to add */
  markdownContent: string;
}

/**
 * Operation to add an LLM response to a node.
 */
export interface AddResponseOperation extends BasePendingOperation {
  type: 'add_response';
  
  /** Target node ID to add the response to */
  targetNodeId: string;
  
  /** The response content (may be updated during streaming) */
  responseContent: string;
  
  /** Whether this response is still streaming */
  isStreaming: boolean;
}

/**
 * Discriminated union of all pending operation types.
 */
export type PendingOperation = CreateChildOperation | AddMarkdownOperation | AddResponseOperation;

/**
 * Context needed to build appropriate prompts for the LLM.
 */
export interface ConversationContext {
  /** Recent messages to include as context */
  recentMessages: ChatMessage[];
  
  /** The current prompt being submitted */
  currentPrompt: string;
  
  /** Maximum number of tokens to include in context */
  maxContextTokens: number;
  
  /** System instructions for the LLM */
  systemPrompt?: string;
}

/**
 * Options for building a conversation thread.
 */
export interface ThreadBuildOptions {
  /** Whether to include system messages in the thread */
  includeSystemMessages: boolean;
  
  /** Maximum number of messages to include */
  maxMessages?: number;
  
  /** Whether to validate node integrity during traversal */
  validateIntegrity: boolean;
}

/**
 * Result of validating thread integrity.
 */
export interface ThreadValidationResult {
  /** Whether the thread is valid */
  isValid: boolean;
  
  /** Detected issues with the thread */
  issues: ThreadValidationIssue[];
  
  /** Suggested repairs for the issues */
  suggestedRepairs: ThreadRepair[];
}

/**
 * Represents an issue found during thread validation.
 */
export interface ThreadValidationIssue {
  /** Type of issue detected */
  type: 'missing_node' | 'broken_parent_reference' | 'circular_reference' | 'orphaned_blocks';
  
  /** Node ID where the issue was found */
  nodeId: string;
  
  /** Human-readable description of the issue */
  description: string;
  
  /** Severity of the issue */
  severity: 'warning' | 'error';
}

/**
 * Represents a suggested repair for a thread issue.
 */
export interface ThreadRepair {
  /** The issue this repair addresses */
  issueType: ThreadValidationIssue['type'];
  
  /** Node ID to repair */
  nodeId: string;
  
  /** Description of the repair action */
  action: string;
  
  /** Function to execute the repair */
  execute: () => Promise<void>;
}

/**
 * Statistics about a conversation thread.
 */
export interface ThreadStatistics {
  /** Total number of messages in the thread */
  messageCount: number;
  
  /** Breakdown of messages by type */
  messagesByType: {
    prompts: number;
    responses: number;
    markdown: number;
  };
  
  /** Number of nodes in the thread */
  nodeCount: number;
  
  /** Maximum depth of the conversation tree */
  maxDepth: number;
  
  /** Estimated token count for the full conversation */
  estimatedTokens: number;
  
  /** Timestamp of the first message */
  firstMessageTime: Date;
  
  /** Timestamp of the last message */
  lastMessageTime: Date;
}

/**
 * Type guards for pending operations.
 */
export function isCreateChildOperation(op: PendingOperation): op is CreateChildOperation {
  return op.type === 'create_child';
}

export function isAddMarkdownOperation(op: PendingOperation): op is AddMarkdownOperation {
  return op.type === 'add_markdown';
}

export function isAddResponseOperation(op: PendingOperation): op is AddResponseOperation {
  return op.type === 'add_response';
}

/**
 * Constants for conversation management.
 */
export const CONVERSATION_CONSTANTS = {
  /** Maximum number of pending operations to queue */
  MAX_PENDING_OPERATIONS: 50,
  
  /** Timeout for operations (ms) */
  OPERATION_TIMEOUT: 30000,
  
  /** Maximum context window size in tokens (approximate) */
  MAX_CONTEXT_TOKENS: 4000,
  
  /** Number of recent messages to include by default */
  DEFAULT_CONTEXT_MESSAGES: 10,
  
  /** Delay before retrying failed operations (ms) */
  RETRY_DELAY: 1000,
  
  /** Maximum number of retries for failed operations */
  MAX_RETRIES: 3
} as const;