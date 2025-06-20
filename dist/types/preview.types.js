/**
 * @fileoverview Enhanced type definitions for preview toggle functionality
 * @version 1.0.0
 * @compliance ts_readme.xml
 */
/**
 * Default configuration for preview functionality
 * @description Provides sensible defaults for preview behavior
 */
export const DEFAULT_PREVIEW_CONFIG = {
    enableDoubleClickEdit: true,
    autoRenderResponses: true,
    preserveScrollPosition: true,
    renderTheme: 'auto'
};
/**
 * Constants for preview toggle functionality
 * @description Defines timing and behavior constants
 */
export const PREVIEW_CONSTANTS = {
    /** Minimum time between toggle events (ms) to prevent spam */
    MIN_TOGGLE_INTERVAL: 100,
    /** Default fade transition duration (ms) */
    FADE_TRANSITION_DURATION: 200,
    /** Maximum content length for auto-preview (characters) */
    MAX_AUTO_PREVIEW_LENGTH: 10000,
    /** Double-click detection window (ms) */
    DOUBLE_CLICK_THRESHOLD: 500
};
