/**
 * Core type definitions for the chat system.
 * This file contains the fundamental types used throughout the chat interface
 * and conversation management components.
 */

/**
 * Represents the different types of messages that can appear in a chat conversation.
 */
export enum ChatMessageType {
  USER_PROMPT = 'user_prompt',
  ASSISTANT_RESPONSE = 'assistant_response',
  USER_MARKDOWN = 'user_markdown'
}

/**
 * Represents a single message in a chat conversation.
 * Messages are immutable once created, with readonly properties to prevent accidental modification.
 */
export interface ChatMessage {
  /** Unique identifier for this message */
  readonly id: string;
  
  /** The type of message (user prompt, assistant response, or user markdown) */
  readonly type: ChatMessageType;
  
  /** The text content of the message */
  content: string;
  
  /** When this message was created */
  readonly timestamp: Date;
  
  /** The ID of the graph node containing this message */
  readonly nodeId: string;
  
  /** The ID of the specific block within the node */
  readonly blockId: string;
}

/**
 * Represents a complete conversation thread from root to a specific node.
 * A thread is constructed by traversing the graph from a target node back to the root,
 * then displaying all messages in chronological order.
 */
export interface ConversationThread {
  /** Unique identifier for this thread instance */
  readonly id: string;
  
  /** The ID of the root node where the conversation started */
  readonly rootNodeId: string;
  
  /** The ID of the node that was double-clicked to open this thread */
  readonly targetNodeId: string;
  
  /** Ordered array of node IDs from root to target */
  readonly nodePath: string[];
  
  /** All messages in the thread, ordered chronologically */
  readonly messages: ChatMessage[];
  
  /** The depth of the conversation (number of nodes in the path) */
  readonly depth: number;
}

/**
 * Valid chat commands that users can enter.
 */
export type ChatCommand = '/prompt' | '/md';

/**
 * Result of parsing a user's input for chat commands.
 * Used to validate and extract command information from raw input.
 */
export interface ChatCommandResult {
  /** The parsed command, or null if no valid command found */
  command: ChatCommand | null;
  
  /** The content after the command */
  content: string;
  
  /** Whether the input represents a valid command */
  isValid: boolean;
  
  /** Error message if the command is invalid */
  error?: string | undefined;
}

/**
 * Configuration options for the chat interface.
 */
export interface ChatConfig {
  /** Width of the chat panel as a percentage (30-70) */
  panelWidth: number;
  
  /** Maximum number of messages to display before virtualization */
  maxMessagesBeforeVirtualization: number;
  
  /** Whether to auto-focus the input field when opening chat */
  autoFocusInput: boolean;
  
  /** Debounce delay for input handling (ms) */
  inputDebounceDelay: number;
  
  /** Animation duration for panel transitions (ms) */
  transitionDuration: number;
}

/**
 * Default configuration values for the chat interface.
 */
export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  panelWidth: 40,
  maxMessagesBeforeVirtualization: 100,
  autoFocusInput: true,
  inputDebounceDelay: 300,
  transitionDuration: 300
};

/**
 * Events emitted by the chat system.
 */
export interface ChatEvents {
  /** Emitted when a chat is opened for a node */
  chatOpened: { nodeId: string; thread: ConversationThread };
  
  /** Emitted when the chat is closed */
  chatClosed: { lastNodeId: string };
  
  /** Emitted when a message is sent */
  messageSent: { command: ChatCommand; content: string; nodeId: string };
  
  /** Emitted when a new node is created from chat */
  nodeCreatedFromChat: { parentNodeId: string; newNodeId: string };
  
  /** Emitted when a markdown block is added from chat */
  markdownAddedFromChat: { nodeId: string; blockId: string };
}

/**
 * Type guard to check if a value is a valid ChatCommand.
 */
export function isChatCommand(value: string): value is ChatCommand {
  return value === '/prompt' || value === '/md';
}

/**
 * Type guard to check if a message type is valid.
 */
export function isValidMessageType(type: string): type is ChatMessageType {
  return Object.values(ChatMessageType).includes(type as ChatMessageType);
}

/**
 * Constants for chat system behavior.
 */
export const CHAT_CONSTANTS = {
  /** Maximum length for any single message content */
  MAX_MESSAGE_LENGTH: 10000,
  
  /** Maximum depth of conversation threads to prevent stack overflow */
  MAX_THREAD_DEPTH: 100,
  
  /** Regex pattern for validating chat commands */
  COMMAND_PATTERN: /^(\/prompt|\/md)\s+(.+)$/,
  
  /** Minimum content length after command */
  MIN_CONTENT_LENGTH: 1,
  
  /** Rate limit for sending messages (ms between messages) */
  MESSAGE_RATE_LIMIT: 500,
  
  /** Canvas width percentage when chat is open */
  CANVAS_WIDTH_WITH_CHAT: 60,
  
  /** Default panel width percentage */
  DEFAULT_PANEL_WIDTH: 40,
  
  /** Zoom reduction factor when chat opens (0.7 = 70% of current zoom) */
  ZOOM_REDUCTION_FACTOR: 0.65
} as const;