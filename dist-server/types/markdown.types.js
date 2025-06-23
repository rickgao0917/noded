"use strict";
/**
 * Enhanced type definitions for markdown rendering system
 *
 * Extends basic block types with markdown-specific properties
 * for live preview, rendering states, and feature configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RENDER_OPTIONS = exports.DEFAULT_MARKDOWN_FEATURES = void 0;
/**
 * Default markdown features configuration
 */
exports.DEFAULT_MARKDOWN_FEATURES = {
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
exports.DEFAULT_RENDER_OPTIONS = {
    enableSyntaxHighlighting: true,
    enableMath: true,
    enableDiagrams: true,
    enableEmoji: true,
    sanitize: true,
    theme: 'dark'
};
