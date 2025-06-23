"use strict";
/**
 * Custom error classes for markdown rendering system
 *
 * Provides specialized error types with detailed context
 * for different failure scenarios in markdown processing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownErrorFactory = exports.SyntaxHighlightError = exports.PreviewModeError = exports.SanitizationError = exports.DiagramRenderError = exports.MathRenderError = exports.PreviewSetupError = exports.MarkdownRenderError = exports.MarkdownError = void 0;
const errors_js_1 = require("./errors.js");
/**
 * Base class for markdown-related errors
 */
class MarkdownError extends errors_js_1.NodeEditorError {
    constructor(message, code, userMessage, functionName, additionalContext) {
        const context = {
            functionName,
            timestamp: new Date().toISOString(),
            correlationId: `markdown-${Date.now()}`
        };
        if (additionalContext) {
            context.parameters = additionalContext;
        }
        super(message, code, userMessage, context);
        this.name = 'MarkdownError';
    }
}
exports.MarkdownError = MarkdownError;
/**
 * Error thrown when markdown rendering fails
 */
class MarkdownRenderError extends MarkdownError {
    constructor(message, markdownContent, renderStage, parsingErrors = [], functionName, context) {
        super(message, 'MARKDOWN_RENDER_FAILED', 'Failed to render markdown content. Please check your syntax.', functionName, Object.assign(Object.assign({}, context), { markdownContent, renderStage, errorCount: parsingErrors.length }));
        this.name = 'MarkdownRenderError';
        this.markdownContent = markdownContent;
        this.parsingErrors = parsingErrors;
        this.renderStage = renderStage;
    }
}
exports.MarkdownRenderError = MarkdownRenderError;
/**
 * Error thrown when preview setup fails
 */
class PreviewSetupError extends MarkdownError {
    constructor(message, blockId, previewMode, domError = null, functionName, context) {
        super(message, 'PREVIEW_SETUP_FAILED', 'Unable to set up markdown preview. The block may have been removed.', functionName, Object.assign(Object.assign({}, context), { blockId, previewMode, hasDomError: !!domError }));
        this.name = 'PreviewSetupError';
        this.blockId = blockId;
        this.previewMode = previewMode;
        this.domError = domError;
    }
}
exports.PreviewSetupError = PreviewSetupError;
/**
 * Error thrown when math rendering fails
 */
class MathRenderError extends MarkdownError {
    constructor(message, mathExpression, katexError, functionName, context) {
        super(message, 'MATH_RENDER_FAILED', 'Failed to render mathematical expression. Please check LaTeX syntax.', functionName, Object.assign(Object.assign({}, context), { mathExpression, katexErrorMessage: katexError.message }));
        this.name = 'MathRenderError';
        this.mathExpression = mathExpression;
        this.katexError = katexError;
    }
}
exports.MathRenderError = MathRenderError;
/**
 * Error thrown when diagram rendering fails
 */
class DiagramRenderError extends MarkdownError {
    constructor(message, diagramCode, diagramType, mermaidError, functionName, context) {
        super(message, 'DIAGRAM_RENDER_FAILED', 'Failed to render diagram. Please check the diagram syntax.', functionName, Object.assign(Object.assign({}, context), { diagramCode, diagramType, mermaidErrorMessage: mermaidError.message }));
        this.name = 'DiagramRenderError';
        this.diagramCode = diagramCode;
        this.diagramType = diagramType;
        this.mermaidError = mermaidError;
    }
}
exports.DiagramRenderError = DiagramRenderError;
/**
 * Error thrown when content sanitization fails
 */
class SanitizationError extends MarkdownError {
    constructor(message, originalContent, sanitizationReason, functionName, context) {
        super(message, 'SANITIZATION_FAILED', 'Content could not be safely rendered due to security restrictions.', functionName, Object.assign(Object.assign({}, context), { contentLength: originalContent.length, sanitizationReason }));
        this.name = 'SanitizationError';
        this.originalContent = originalContent;
        this.sanitizationReason = sanitizationReason;
    }
}
exports.SanitizationError = SanitizationError;
/**
 * Error thrown when preview mode change fails
 */
class PreviewModeError extends MarkdownError {
    constructor(message, blockId, requestedMode, currentMode, functionName, context) {
        super(message, 'PREVIEW_MODE_CHANGE_FAILED', 'Unable to change preview mode. Please try again.', functionName, Object.assign(Object.assign({}, context), { blockId, requestedMode, currentMode }));
        this.name = 'PreviewModeError';
        this.blockId = blockId;
        this.requestedMode = requestedMode;
        this.currentMode = currentMode;
    }
}
exports.PreviewModeError = PreviewModeError;
/**
 * Error thrown when syntax highlighting fails
 */
class SyntaxHighlightError extends MarkdownError {
    constructor(message, codeBlock, language, highlightError, functionName, context) {
        super(message, 'SYNTAX_HIGHLIGHT_FAILED', 'Failed to highlight code syntax. The code will be displayed without highlighting.', functionName, Object.assign(Object.assign({}, context), { codeBlockLength: codeBlock.length, language, highlightErrorMessage: highlightError.message }));
        this.name = 'SyntaxHighlightError';
        this.codeBlock = codeBlock;
        this.language = language;
        this.highlightError = highlightError;
    }
}
exports.SyntaxHighlightError = SyntaxHighlightError;
/**
 * Factory for creating markdown-related errors
 */
class MarkdownErrorFactory {
    createRenderError(markdownContent, renderStage, error, functionName) {
        return new MarkdownRenderError(`Markdown rendering failed at ${renderStage} stage: ${error.message}`, markdownContent, renderStage, [error], functionName);
    }
    createPreviewSetupError(blockId, previewMode, error, functionName) {
        return new PreviewSetupError(`Failed to set up preview for block ${blockId}: ${error.message}`, blockId, previewMode, error, functionName);
    }
    createMathError(expression, error, functionName) {
        return new MathRenderError(`Failed to render math expression: ${error.message}`, expression, error, functionName);
    }
    createDiagramError(code, type, error, functionName) {
        return new DiagramRenderError(`Failed to render ${type} diagram: ${error.message}`, code, type, error, functionName);
    }
}
exports.MarkdownErrorFactory = MarkdownErrorFactory;
