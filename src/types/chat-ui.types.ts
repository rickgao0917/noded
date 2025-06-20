/**
 * Type definitions for the chat user interface state and components.
 * These types manage the visual presentation and interaction state
 * of the chat panel.
 */

import type { ConversationThread } from './chat.types';

/**
 * Represents the current input mode of the chat interface.
 */
export type InputMode = 'idle' | 'typing_prompt' | 'typing_markdown';

/**
 * Tracks loading states for various async operations in the chat interface.
 */
export interface LoadingStates {
  /** Whether a message is currently being sent */
  sendingMessage: boolean;
  
  /** Whether the LLM is generating a response */
  generatingResponse: boolean;
  
  /** Whether the graph is being updated with new data */
  updatingGraph: boolean;
  
  /** Whether a conversation thread is being built */
  buildingThread: boolean;
}

/**
 * Represents the complete state of the chat interface at any point in time.
 */
export interface ChatInterfaceState {
  /** The currently displayed conversation thread, null if chat is closed */
  activeThread: ConversationThread | null;
  
  /** Whether the chat panel is currently visible */
  isVisible: boolean;
  
  /** Width of the panel as a percentage (30-70) */
  panelWidth: number;
  
  /** Current state of the input field */
  inputMode: InputMode;
  
  /** Current content of the input field */
  inputContent: string;
  
  /** Loading states for various operations */
  loadingStates: LoadingStates;
}

/**
 * Options for rendering chat messages.
 */
export interface MessageRenderOptions {
  /** Whether to show timestamps on messages */
  showTimestamps: boolean;
  
  /** Whether to render markdown content */
  renderMarkdown: boolean;
  
  /** Whether to highlight code blocks */
  highlightCode: boolean;
  
  /** Whether to show loading indicators for streaming responses */
  showStreamingIndicator: boolean;
  
  /** Custom CSS classes for different message types */
  messageClasses?: {
    prompt?: string;
    response?: string;
    markdown?: string;
  };
}

/**
 * Represents a UI action that can be performed in the chat interface.
 */
export interface ChatUIAction {
  /** Unique identifier for the action */
  id: string;
  
  /** Display label for the action */
  label: string;
  
  /** Keyboard shortcut for the action */
  shortcut?: string;
  
  /** Icon class or element for the action */
  icon?: string;
  
  /** Whether the action is currently enabled */
  enabled: boolean;
  
  /** Handler function for the action */
  handler: () => void | Promise<void>;
}

/**
 * Configuration for chat panel animations and transitions.
 */
export interface ChatAnimationConfig {
  /** Duration of panel open/close animation (ms) */
  panelTransitionDuration: number;
  
  /** Easing function for panel transitions */
  panelTransitionEasing: string;
  
  /** Duration of message fade-in animation (ms) */
  messageFadeInDuration: number;
  
  /** Delay between message animations when loading thread (ms) */
  messageStaggerDelay: number;
  
  /** Duration of loading spinner fade-in (ms) */
  loadingFadeInDuration: number;
}

/**
 * Default animation configuration.
 */
export const DEFAULT_ANIMATION_CONFIG: ChatAnimationConfig = {
  panelTransitionDuration: 300,
  panelTransitionEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  messageFadeInDuration: 200,
  messageStaggerDelay: 50,
  loadingFadeInDuration: 150
};

/**
 * Represents the visual theme for the chat interface.
 */
export interface ChatTheme {
  /** Background colors */
  background: {
    panel: string;
    messages: string;
    input: string;
  };
  
  /** Text colors */
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  
  /** Message-specific colors */
  messages: {
    promptBackground: string;
    promptText: string;
    responseBackground: string;
    responseText: string;
    markdownBackground: string;
    markdownText: string;
  };
  
  /** Border colors */
  borders: {
    panel: string;
    input: string;
    message: string;
  };
  
  /** Interactive element colors */
  interactive: {
    buttonBackground: string;
    buttonHover: string;
    buttonActive: string;
    linkColor: string;
    linkHover: string;
  };
  
  /** Status colors */
  status: {
    error: string;
    warning: string;
    success: string;
    info: string;
  };
}

/**
 * Viewport information for responsive behavior.
 */
export interface ChatViewport {
  /** Current viewport width */
  width: number;
  
  /** Current viewport height */
  height: number;
  
  /** Whether the viewport is considered mobile size */
  isMobile: boolean;
  
  /** Whether the viewport is considered tablet size */
  isTablet: boolean;
  
  /** Whether the viewport is considered desktop size */
  isDesktop: boolean;
}

/**
 * Keyboard shortcut definitions for the chat interface.
 */
export interface ChatKeyboardShortcuts {
  /** Open/close chat panel */
  togglePanel: string;
  
  /** Focus input field */
  focusInput: string;
  
  /** Send message */
  sendMessage: string;
  
  /** Clear input */
  clearInput: string;
  
  /** Navigate to previous message */
  previousMessage: string;
  
  /** Navigate to next message */
  nextMessage: string;
  
  /** Scroll to top of conversation */
  scrollToTop: string;
  
  /** Scroll to bottom of conversation */
  scrollToBottom: string;
}

/**
 * Default keyboard shortcuts.
 */
export const DEFAULT_KEYBOARD_SHORTCUTS: ChatKeyboardShortcuts = {
  togglePanel: 'Escape',
  focusInput: '/',
  sendMessage: 'Ctrl+Enter',
  clearInput: 'Escape',
  previousMessage: 'ArrowUp',
  nextMessage: 'ArrowDown',
  scrollToTop: 'Home',
  scrollToBottom: 'End'
};

/**
 * Accessibility options for the chat interface.
 */
export interface ChatAccessibilityOptions {
  /** Whether to announce new messages to screen readers */
  announceNewMessages: boolean;
  
  /** Whether to provide keyboard navigation hints */
  showKeyboardHints: boolean;
  
  /** ARIA labels for UI elements */
  ariaLabels: {
    chatPanel: string;
    closeButton: string;
    messageList: string;
    inputField: string;
    sendButton: string;
    userMessage: string;
    assistantMessage: string;
    markdownContent: string;
  };
  
  /** Whether to enable high contrast mode */
  highContrastMode: boolean;
  
  /** Whether to reduce motion in animations */
  reduceMotion: boolean;
}

/**
 * Default accessibility options.
 */
export const DEFAULT_ACCESSIBILITY_OPTIONS: ChatAccessibilityOptions = {
  announceNewMessages: true,
  showKeyboardHints: true,
  ariaLabels: {
    chatPanel: 'Chat conversation panel',
    closeButton: 'Close chat',
    messageList: 'Conversation messages',
    inputField: 'Type a command (/prompt or /md)',
    sendButton: 'Send message',
    userMessage: 'User message',
    assistantMessage: 'Assistant response',
    markdownContent: 'Markdown content'
  },
  highContrastMode: false,
  reduceMotion: false
};

/**
 * Constants for UI dimensions and constraints.
 */
export const UI_CONSTANTS = {
  /** Minimum panel width as percentage */
  MIN_PANEL_WIDTH: 30,
  
  /** Maximum panel width as percentage */
  MAX_PANEL_WIDTH: 70,
  
  /** Default panel width as percentage */
  DEFAULT_PANEL_WIDTH: 40,
  
  /** Minimum viewport width for desktop layout (px) */
  DESKTOP_BREAKPOINT: 1024,
  
  /** Minimum viewport width for tablet layout (px) */
  TABLET_BREAKPOINT: 768,
  
  /** Maximum width for message content (px) */
  MAX_MESSAGE_WIDTH: 800,
  
  /** Height of the input area (px) */
  INPUT_AREA_HEIGHT: 120,
  
  /** Height of the chat header (px) */
  HEADER_HEIGHT: 60,
  
  /** Padding inside the chat panel (px) */
  PANEL_PADDING: 16,
  
  /** Z-index for the chat panel overlay */
  PANEL_Z_INDEX: 1000
} as const;