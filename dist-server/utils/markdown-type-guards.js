"use strict";
/**
 * Type guards for markdown-specific interfaces
 *
 * Provides runtime validation for markdown rendering types
 * following ts_readme.xml conventions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPreviewMode = isPreviewMode;
exports.isRenderingState = isRenderingState;
exports.isDiagramType = isDiagramType;
exports.isRenderTheme = isRenderTheme;
exports.isRenderStage = isRenderStage;
exports.isMarkdownFeatures = isMarkdownFeatures;
exports.isRenderError = isRenderError;
exports.isMarkdownBlock = isMarkdownBlock;
exports.isRenderOptions = isRenderOptions;
exports.isRenderedContent = isRenderedContent;
exports.isPreviewState = isPreviewState;
exports.isRenderTask = isRenderTask;
exports.validateRenderOptions = validateRenderOptions;
exports.validateMarkdownBlock = validateMarkdownBlock;
const type_guards_js_1 = require("./type-guards.js");
/**
 * Type guard for PreviewMode
 */
function isPreviewMode(value) {
    return typeof value === 'string' &&
        ['split', 'preview_only', 'edit_only', 'tabbed'].includes(value);
}
/**
 * Type guard for RenderingState
 */
function isRenderingState(value) {
    return typeof value === 'string' &&
        ['editing', 'processing', 'rendered', 'error', 'preview'].includes(value);
}
/**
 * Type guard for DiagramType
 */
function isDiagramType(value) {
    return typeof value === 'string' &&
        ['mermaid', 'plantuml', 'graphviz'].includes(value);
}
/**
 * Type guard for RenderTheme
 */
function isRenderTheme(value) {
    return typeof value === 'string' &&
        ['default', 'github', 'dark', 'light'].includes(value);
}
/**
 * Type guard for RenderStage
 */
function isRenderStage(value) {
    return typeof value === 'string' &&
        ['parsing', 'sanitization', 'math', 'diagrams', 'highlighting'].includes(value);
}
/**
 * Type guard for MarkdownFeatures
 */
function isMarkdownFeatures(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const obj = value;
    return (typeof obj.basicSyntax === 'boolean' &&
        typeof obj.extendedSyntax === 'boolean' &&
        typeof obj.syntaxHighlighting === 'boolean' &&
        typeof obj.mathRendering === 'boolean' &&
        typeof obj.diagramSupport === 'boolean' &&
        typeof obj.emojiSupport === 'boolean' &&
        typeof obj.footnotes === 'boolean' &&
        typeof obj.taskLists === 'boolean' &&
        typeof obj.tables === 'boolean');
}
/**
 * Type guard for RenderError
 */
function isRenderError(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const obj = value;
    return (isRenderStage(obj.stage) &&
        typeof obj.message === 'string' &&
        obj.timestamp instanceof Date &&
        (obj.originalError === undefined || obj.originalError instanceof Error));
}
/**
 * Type guard for MarkdownBlock
 */
function isMarkdownBlock(value) {
    if (!(0, type_guards_js_1.isNodeBlock)(value)) {
        return false;
    }
    const block = value;
    return (block.type === 'markdown' &&
        isRenderingState(block.renderingState) &&
        isMarkdownFeatures(block.markdownFeatures) &&
        isPreviewMode(block.previewMode) &&
        (block.renderedHtml === undefined || typeof block.renderedHtml === 'string') &&
        (block.lastRenderTime === undefined || block.lastRenderTime instanceof Date) &&
        (block.renderErrors === undefined ||
            (Array.isArray(block.renderErrors) && block.renderErrors.every(isRenderError))));
}
/**
 * Type guard for RenderOptions
 */
function isRenderOptions(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const obj = value;
    return ((obj.enableSyntaxHighlighting === undefined || typeof obj.enableSyntaxHighlighting === 'boolean') &&
        (obj.enableMath === undefined || typeof obj.enableMath === 'boolean') &&
        (obj.enableDiagrams === undefined || typeof obj.enableDiagrams === 'boolean') &&
        (obj.enableEmoji === undefined || typeof obj.enableEmoji === 'boolean') &&
        (obj.sanitize === undefined || typeof obj.sanitize === 'boolean') &&
        (obj.baseUrl === undefined || typeof obj.baseUrl === 'string') &&
        (obj.theme === undefined || isRenderTheme(obj.theme)));
}
/**
 * Type guard for RenderedContent
 */
function isRenderedContent(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const obj = value;
    return (typeof obj.html === 'string' &&
        typeof obj.renderTime === 'number' &&
        typeof obj.usedFeatures === 'object' &&
        (obj.warnings === undefined ||
            (Array.isArray(obj.warnings) && obj.warnings.every(w => typeof w === 'string'))));
}
/**
 * Type guard for PreviewState
 */
function isPreviewState(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const obj = value;
    return (typeof obj.blockId === 'string' &&
        isPreviewMode(obj.mode) &&
        typeof obj.scrollPosition === 'number' &&
        typeof obj.cursorPosition === 'number' &&
        obj.lastUpdate instanceof Date);
}
/**
 * Type guard for RenderTask
 */
function isRenderTask(value) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const obj = value;
    return (typeof obj.blockId === 'string' &&
        typeof obj.content === 'string' &&
        isRenderOptions(obj.options) &&
        typeof obj.priority === 'number' &&
        obj.timestamp instanceof Date);
}
/**
 * Validates and sanitizes render options
 */
function validateRenderOptions(value) {
    if (!isRenderOptions(value)) {
        throw new Error('Invalid render options');
    }
    return value;
}
/**
 * Validates markdown block structure
 */
function validateMarkdownBlock(value) {
    if (!isMarkdownBlock(value)) {
        throw new Error('Invalid markdown block structure');
    }
    return value;
}
