/**
 * Enhanced type definitions for markdown rendering system
 *
 * Extends basic block types with markdown-specific properties
 * for live preview, rendering states, and feature configuration.
 */
/**
 * Default markdown features configuration
 */
export const DEFAULT_MARKDOWN_FEATURES = {
    basicSyntax: true,
    extendedSyntax: true,
    syntaxHighlighting: true,
    mathRendering: true,
    diagramSupport: true,
    emojiSupport: true,
    footnotes: true,
    taskLists: true,
    tables: true
};
/**
 * Default render options
 */
export const DEFAULT_RENDER_OPTIONS = {
    enableSyntaxHighlighting: true,
    enableMath: true,
    enableDiagrams: true,
    enableEmoji: true,
    sanitize: true,
    theme: 'dark'
};
