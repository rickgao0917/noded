/**
 * Type definitions for enhanced chat interface components
 * 
 * Defines the structure for chat continuation states, loading indicators,
 * and chat input modes used throughout the enhanced chat interface.
 */

/**
 * State management for inline chat continuation interface
 * 
 * @public
 */
export interface ChatContinuationState {
  /** Unique identifier for the node */
  readonly nodeId: string;
  /** Whether the chat input is in expanded mode */
  readonly isExpanded: boolean;
  /** Whether the chat is currently processing a request */
  readonly isLoading: boolean;
  /** Whether an error occurred during chat processing */
  readonly hasError: boolean;
  /** Error message if hasError is true */
  readonly errorMessage?: string;
  /** Timestamp when state was last updated */
  readonly lastUpdated: number;
}

/**
 * State management for loading indicators during API calls
 * 
 * @public
 */
export interface LoadingIndicatorState {
  /** Unique identifier for the node */
  readonly nodeId: string;
  /** Whether the loading indicator is currently visible */
  readonly isVisible: boolean;
  /** Current loading message being displayed */
  readonly message: string;
  /** Timestamp when loading started */
  readonly startTime: number;
  /** Optional timeout for automatic cleanup */
  readonly timeoutMs?: number;
}

/**
 * Chat input interface modes
 * 
 * @public
 */
export type ChatInputMode = 'compact' | 'expanded' | 'loading' | 'error';

/**
 * Chat submission result
 * 
 * @public
 */
export interface ChatSubmissionResult {
  /** Whether the submission was successful */
  readonly success: boolean;
  /** Response text from the AI service */
  readonly responseText?: string;
  /** Error message if submission failed */
  readonly errorMessage?: string;
  /** Timestamp of submission completion */
  readonly timestamp: number;
  /** Duration of the submission process in milliseconds */
  readonly durationMs: number;
}

/**
 * Branded type for chat block identifiers
 * 
 * @public
 */
export type ChatBlockId = string & { readonly brand: 'ChatBlockId' };

/**
 * Branded type for loading state identifiers
 * 
 * @public
 */
export type LoadingStateId = string & { readonly brand: 'LoadingStateId' };

/**
 * Configuration for inline chat behavior
 * 
 * @public
 */
export interface InlineChatConfig {
  /** Maximum characters allowed in chat input */
  readonly maxLength: number;
  /** Debounce delay in milliseconds for input changes */
  readonly debounceMs: number;
  /** Whether to auto-expand on focus */
  readonly autoExpandOnFocus: boolean;
  /** Placeholder text for compact mode */
  readonly compactPlaceholder: string;
  /** Placeholder text for expanded mode */
  readonly expandedPlaceholder: string;
}