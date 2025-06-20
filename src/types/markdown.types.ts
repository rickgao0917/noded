/**
 * Enhanced type definitions for markdown rendering system
 * 
 * Extends basic block types with markdown-specific properties
 * for live preview, rendering states, and feature configuration.
 */

import { NodeBlock } from './graph.types.js';
import { BlockId } from './branded.types.js';

/**
 * Rendering states for markdown blocks
 */
export type RenderingState = 'editing' | 'processing' | 'rendered' | 'error' | 'preview';

/**
 * Preview modes for markdown display
 */
export type PreviewMode = 'split' | 'preview_only' | 'edit_only' | 'tabbed';

/**
 * Types of diagrams supported
 */
export type DiagramType = 'mermaid' | 'plantuml' | 'graphviz';

/**
 * Render themes available
 */
export type RenderTheme = 'default' | 'github' | 'dark' | 'light';

/**
 * Stages where rendering can fail
 */
export type RenderStage = 'parsing' | 'sanitization' | 'math' | 'diagrams' | 'highlighting';

/**
 * Configuration for markdown feature support
 */
export interface MarkdownFeatures {
  readonly basicSyntax: boolean;
  readonly extendedSyntax: boolean;
  readonly syntaxHighlighting: boolean;
  readonly mathRendering: boolean;
  readonly diagramSupport: boolean;
  readonly emojiSupport: boolean;
  readonly footnotes: boolean;
  readonly taskLists: boolean;
  readonly tables: boolean;
}

/**
 * Error information for render failures
 */
export interface RenderError {
  readonly stage: RenderStage;
  readonly message: string;
  readonly originalError?: Error;
  readonly timestamp: Date;
}

/**
 * Extended markdown block with rendering capabilities
 */
export interface MarkdownBlock extends NodeBlock {
  readonly type: 'markdown';
  readonly renderedHtml?: string;
  readonly renderingState: RenderingState;
  readonly markdownFeatures: MarkdownFeatures;
  readonly previewMode: PreviewMode;
  readonly lastRenderTime?: Date;
  readonly renderErrors?: readonly RenderError[];
}

/**
 * Options for markdown rendering
 */
export interface RenderOptions {
  readonly enableSyntaxHighlighting?: boolean;
  readonly enableMath?: boolean;
  readonly enableDiagrams?: boolean;
  readonly enableEmoji?: boolean;
  readonly sanitize?: boolean;
  readonly baseUrl?: string;
  readonly theme?: RenderTheme;
}

/**
 * Result of a markdown render operation
 */
export interface RenderedContent {
  readonly html: string;
  readonly renderTime: number;
  readonly usedFeatures: Partial<MarkdownFeatures>;
  readonly warnings?: readonly string[];
}

/**
 * Task queued for rendering
 */
export interface RenderTask {
  readonly blockId: BlockId;
  readonly content: string;
  readonly options: RenderOptions;
  readonly priority: number;
  readonly timestamp: Date;
}

/**
 * State of a block's preview
 */
export interface PreviewState {
  readonly blockId: BlockId;
  readonly mode: PreviewMode;
  readonly scrollPosition: number;
  readonly cursorPosition: number;
  readonly lastUpdate: Date;
}

/**
 * Synchronization options for preview
 */
export interface SyncOptions {
  readonly scrollSync: boolean;
  readonly cursorSync: boolean;
  readonly highlightChanges: boolean;
  readonly lineMapping: boolean;
}

/**
 * Performance metrics for rendering
 */
export interface RenderPerformanceMetrics {
  readonly parseTime: number;
  readonly sanitizeTime: number;
  readonly highlightTime: number;
  readonly mathTime: number;
  readonly diagramTime: number;
  readonly totalTime: number;
  readonly cacheHit: boolean;
}

/**
 * Default markdown features configuration
 */
export const DEFAULT_MARKDOWN_FEATURES: MarkdownFeatures = {
  basicSyntax: true,
  extendedSyntax: true,
  syntaxHighlighting: true,
  mathRendering: true,
  diagramSupport: true,
  emojiSupport: true,
  footnotes: true,
  taskLists: true,
  tables: true
} as const;

/**
 * Default render options
 */
export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  enableSyntaxHighlighting: true,
  enableMath: true,
  enableDiagrams: true,
  enableEmoji: true,
  sanitize: true,
  theme: 'dark'
} as const;