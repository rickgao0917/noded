/**
 * Type definitions for the chat user interface state and components.
 * These types manage the visual presentation and interaction state
 * of the chat panel.
 */
/**
 * Default animation configuration.
 */
export const DEFAULT_ANIMATION_CONFIG = {
    panelTransitionDuration: 300,
    panelTransitionEasing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    messageFadeInDuration: 200,
    messageStaggerDelay: 50,
    loadingFadeInDuration: 150
};
/**
 * Default keyboard shortcuts.
 */
export const DEFAULT_KEYBOARD_SHORTCUTS = {
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
 * Default accessibility options.
 */
export const DEFAULT_ACCESSIBILITY_OPTIONS = {
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
};
