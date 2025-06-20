/**
 * Custom error classes for markdown rendering system
 * 
 * Provides specialized error types with detailed context
 * for different failure scenarios in markdown processing.
 */

import { NodeEditorError, ErrorContext } from './errors.js';
import { BlockId } from './branded.types.js';
import { PreviewMode, RenderStage, DiagramType } from './markdown.types.js';

/**
 * Base class for markdown-related errors
 */
export class MarkdownError extends NodeEditorError {
  constructor(
    message: string,
    code: string,
    userMessage: string,
    functionName: string,
    additionalContext?: Record<string, unknown>
  ) {
    const context: ErrorContext = {
      functionName,
      timestamp: new Date().toISOString(),
      correlationId: `markdown-${Date.now()}`
    };
    
    if (additionalContext) {
      (context as any).parameters = additionalContext;
    }
    
    super(message, code, userMessage, context);
    this.name = 'MarkdownError';
  }
}

/**
 * Error thrown when markdown rendering fails
 */
export class MarkdownRenderError extends MarkdownError {
  readonly markdownContent: string;
  readonly parsingErrors: Error[];
  readonly renderStage: RenderStage;
  
  constructor(
    message: string,
    markdownContent: string,
    renderStage: RenderStage,
    parsingErrors: Error[] = [],
    functionName: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'MARKDOWN_RENDER_FAILED',
      'Failed to render markdown content. Please check your syntax.',
      functionName,
      { ...context, markdownContent, renderStage, errorCount: parsingErrors.length }
    );
    
    this.name = 'MarkdownRenderError';
    this.markdownContent = markdownContent;
    this.parsingErrors = parsingErrors;
    this.renderStage = renderStage;
  }
}

/**
 * Error thrown when preview setup fails
 */
export class PreviewSetupError extends MarkdownError {
  readonly blockId: BlockId;
  readonly previewMode: PreviewMode;
  readonly domError: Error | null;
  
  constructor(
    message: string,
    blockId: BlockId,
    previewMode: PreviewMode,
    domError: Error | null = null,
    functionName: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'PREVIEW_SETUP_FAILED',
      'Unable to set up markdown preview. The block may have been removed.',
      functionName,
      { ...context, blockId, previewMode, hasDomError: !!domError }
    );
    
    this.name = 'PreviewSetupError';
    this.blockId = blockId;
    this.previewMode = previewMode;
    this.domError = domError;
  }
}

/**
 * Error thrown when math rendering fails
 */
export class MathRenderError extends MarkdownError {
  readonly mathExpression: string;
  readonly katexError: Error;
  
  constructor(
    message: string,
    mathExpression: string,
    katexError: Error,
    functionName: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'MATH_RENDER_FAILED',
      'Failed to render mathematical expression. Please check LaTeX syntax.',
      functionName,
      { ...context, mathExpression, katexErrorMessage: katexError.message }
    );
    
    this.name = 'MathRenderError';
    this.mathExpression = mathExpression;
    this.katexError = katexError;
  }
}

/**
 * Error thrown when diagram rendering fails
 */
export class DiagramRenderError extends MarkdownError {
  readonly diagramCode: string;
  readonly diagramType: DiagramType;
  readonly mermaidError: Error;
  
  constructor(
    message: string,
    diagramCode: string,
    diagramType: DiagramType,
    mermaidError: Error,
    functionName: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'DIAGRAM_RENDER_FAILED',
      'Failed to render diagram. Please check the diagram syntax.',
      functionName,
      { ...context, diagramCode, diagramType, mermaidErrorMessage: mermaidError.message }
    );
    
    this.name = 'DiagramRenderError';
    this.diagramCode = diagramCode;
    this.diagramType = diagramType;
    this.mermaidError = mermaidError;
  }
}

/**
 * Error thrown when content sanitization fails
 */
export class SanitizationError extends MarkdownError {
  readonly originalContent: string;
  readonly sanitizationReason: string;
  
  constructor(
    message: string,
    originalContent: string,
    sanitizationReason: string,
    functionName: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'SANITIZATION_FAILED',
      'Content could not be safely rendered due to security restrictions.',
      functionName,
      { ...context, contentLength: originalContent.length, sanitizationReason }
    );
    
    this.name = 'SanitizationError';
    this.originalContent = originalContent;
    this.sanitizationReason = sanitizationReason;
  }
}

/**
 * Error thrown when preview mode change fails
 */
export class PreviewModeError extends MarkdownError {
  readonly blockId: BlockId;
  readonly requestedMode: PreviewMode;
  readonly currentMode: PreviewMode | null;
  
  constructor(
    message: string,
    blockId: BlockId,
    requestedMode: PreviewMode,
    currentMode: PreviewMode | null,
    functionName: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'PREVIEW_MODE_CHANGE_FAILED',
      'Unable to change preview mode. Please try again.',
      functionName,
      { ...context, blockId, requestedMode, currentMode }
    );
    
    this.name = 'PreviewModeError';
    this.blockId = blockId;
    this.requestedMode = requestedMode;
    this.currentMode = currentMode;
  }
}

/**
 * Error thrown when syntax highlighting fails
 */
export class SyntaxHighlightError extends MarkdownError {
  readonly codeBlock: string;
  readonly language: string;
  readonly highlightError: Error;
  
  constructor(
    message: string,
    codeBlock: string,
    language: string,
    highlightError: Error,
    functionName: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'SYNTAX_HIGHLIGHT_FAILED',
      'Failed to highlight code syntax. The code will be displayed without highlighting.',
      functionName,
      { ...context, codeBlockLength: codeBlock.length, language, highlightErrorMessage: highlightError.message }
    );
    
    this.name = 'SyntaxHighlightError';
    this.codeBlock = codeBlock;
    this.language = language;
    this.highlightError = highlightError;
  }
}

/**
 * Factory for creating markdown-related errors
 */
export class MarkdownErrorFactory {
  createRenderError(
    markdownContent: string,
    renderStage: RenderStage,
    error: Error,
    functionName: string
  ): MarkdownRenderError {
    return new MarkdownRenderError(
      `Markdown rendering failed at ${renderStage} stage: ${error.message}`,
      markdownContent,
      renderStage,
      [error],
      functionName
    );
  }
  
  createPreviewSetupError(
    blockId: BlockId,
    previewMode: PreviewMode,
    error: Error,
    functionName: string
  ): PreviewSetupError {
    return new PreviewSetupError(
      `Failed to set up preview for block ${blockId}: ${error.message}`,
      blockId,
      previewMode,
      error,
      functionName
    );
  }
  
  createMathError(
    expression: string,
    error: Error,
    functionName: string
  ): MathRenderError {
    return new MathRenderError(
      `Failed to render math expression: ${error.message}`,
      expression,
      error,
      functionName
    );
  }
  
  createDiagramError(
    code: string,
    type: DiagramType,
    error: Error,
    functionName: string
  ): DiagramRenderError {
    return new DiagramRenderError(
      `Failed to render ${type} diagram: ${error.message}`,
      code,
      type,
      error,
      functionName
    );
  }
}