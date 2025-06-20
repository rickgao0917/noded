/**
 * @fileoverview Enhanced type definitions for preview toggle functionality
 * @version 1.0.0
 * @compliance ts_readme.xml
 */

import type { NodeBlock } from './graph.types.js';
import type { BlockId, CorrelationId } from './branded.types.js';

/**
 * Display mode for preview functionality
 * @description Determines how block content should be displayed
 */
export type PreviewDisplayMode = 'raw' | 'rendered';

/**
 * Block types that support preview functionality
 * @description Only these block types can toggle between raw and rendered modes
 */
export type PreviewableBlockType = 'markdown' | 'response';

/**
 * Event trigger sources for preview toggle operations
 * @description Tracks how a preview toggle was initiated
 */
export type PreviewToggleTrigger = 'button' | 'doubleClick' | 'api';

/**
 * State information for a block's preview functionality
 * @description Tracks the current preview mode and user preferences
 */
export interface BlockPreviewState {
    /** Unique identifier for the block */
    readonly blockId: BlockId;
    /** Current display mode for the block */
    readonly displayMode: PreviewDisplayMode;
    /** Timestamp of the last toggle operation */
    readonly lastToggleTime: number;
    /** Whether this is a user-set preference or system default */
    readonly isUserPreference: boolean;
}

/**
 * Configuration options for preview functionality
 * @description Controls behavior of the preview toggle system
 */
export interface PreviewConfig {
    /** Enable double-click to edit in rendered mode */
    readonly enableDoubleClickEdit: boolean;
    /** Automatically render response blocks after completion */
    readonly autoRenderResponses: boolean;
    /** Preserve scroll position during toggle operations */
    readonly preserveScrollPosition: boolean;
    /** Theme for rendered content (light/dark) */
    readonly renderTheme: 'light' | 'dark' | 'auto';
}

/**
 * Enhanced node block interface with preview capabilities
 * @description Extends base NodeBlock with preview-specific properties
 */
export interface PreviewableNodeBlock extends NodeBlock {
    /** Current preview state for this block */
    readonly previewState?: BlockPreviewState;
    /** Whether this block type supports preview functionality */
    readonly supportsPreview: boolean;
}

/**
 * Event data for preview toggle operations
 * @description Tracks details of preview toggle events for logging
 */
export interface PreviewToggleEvent extends Record<string, unknown> {
    /** Block identifier */
    readonly blockId: BlockId;
    /** Previous display mode */
    readonly previousMode: PreviewDisplayMode;
    /** New display mode */
    readonly newMode: PreviewDisplayMode;
    /** Event timestamp */
    readonly timestamp: number;
    /** How the toggle was triggered */
    readonly triggeredBy: PreviewToggleTrigger;
    /** Optional correlation ID for request tracing */
    readonly correlationId?: CorrelationId | undefined;
}

/**
 * Default configuration for preview functionality
 * @description Provides sensible defaults for preview behavior
 */
export const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
    enableDoubleClickEdit: true,
    autoRenderResponses: true,
    preserveScrollPosition: true,
    renderTheme: 'auto'
} as const;

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
} as const;