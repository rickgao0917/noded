import { Logger } from './logger.js';
import type { MarkedStatic } from '../types/markdown-libs.types.js';

/**
 * Markdown processing utility for rendering text content
 * Handles markdown parsing and syntax highlighting
 */
export class MarkdownProcessor {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MarkdownProcessor');
  }

  /**
   * Convert markdown text to HTML with syntax highlighting
   * 
   * @param markdownText - The markdown text to convert
   * @param blockType - The type of block for context (prompt, response, markdown)
   * @returns HTML string with rendered markdown
   */
  public renderMarkdown(markdownText: string, blockType: string = 'markdown'): string {
    const startTime = performance.now();
    this.logger.logFunctionEntry('renderMarkdown', { 
      textLength: markdownText.length,
      blockType 
    });

    try {
      // Validate input
      if (typeof markdownText !== 'string') {
        this.logger.logWarn('Invalid markdown input type', 'renderMarkdown', { 
          inputType: typeof markdownText 
        });
        return '';
      }

      if (!markdownText.trim()) {
        this.logger.logInfo('Empty markdown input', 'renderMarkdown');
        return '<div class="markdown-content"></div>';
      }

      // Configure marked with syntax highlighting
      if (typeof window !== 'undefined' && window.marked) {
        const marked: MarkedStatic = window.marked;
        
        // Configure marked options
        marked.setOptions({
          highlight: (code: string, lang: string) => {
            if (typeof window.hljs !== 'undefined' && lang) {
              try {
                return window.hljs.highlight(code, { language: lang }).value;
              } catch (err) {
                this.logger.logWarn('Syntax highlighting failed', 'renderMarkdown', { 
                  language: lang,
                  error: String(err) 
                });
                return code;
              }
            }
            return code;
          },
          breaks: true,
          gfm: true
        });

        // Parse markdown
        const htmlContent = marked.parse(markdownText);
        
        // Wrap in markdown-content div for styling
        const wrappedHtml = `<div class="markdown-content">${htmlContent}</div>`;
        
        this.logger.logInfo('Markdown rendered successfully', 'renderMarkdown', {
          inputLength: markdownText.length,
          outputLength: wrappedHtml.length,
          blockType
        });

        const executionTime = performance.now() - startTime;
        this.logger.logPerformance('renderMarkdown', 'markdown_parse', executionTime);
        this.logger.logFunctionExit('renderMarkdown', { success: true }, executionTime);

        return wrappedHtml;
      } else {
        // Fallback if marked is not available
        this.logger.logWarn('Marked library not available, using fallback', 'renderMarkdown');
        const escapedText = this.escapeHtml(markdownText);
        const fallbackHtml = `<div class="markdown-content"><pre>${escapedText}</pre></div>`;
        
        const executionTime = performance.now() - startTime;
        this.logger.logFunctionExit('renderMarkdown', { fallback: true }, executionTime);
        
        return fallbackHtml;
      }

    } catch (error) {
      this.logger.logError(error as Error, 'renderMarkdown', { 
        textLength: markdownText.length,
        blockType 
      });
      
      // Return escaped text as fallback
      const escapedText = this.escapeHtml(markdownText);
      return `<div class="markdown-content error"><pre>${escapedText}</pre></div>`;
    }
  }

  /**
   * Apply syntax highlighting to code blocks that weren't processed during markdown parsing
   * 
   * @param element - DOM element containing code blocks to highlight
   */
  public highlightCodeBlocks(element: HTMLElement): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('highlightCodeBlocks', { 
      elementId: element.id || 'unnamed' 
    });

    try {
      if (typeof window.hljs !== 'undefined' && window.hljs) {
        const codeBlocks = element.querySelectorAll('pre code');
        
        this.logger.logLoop('highlightCodeBlocks', 'code_blocks_processing', codeBlocks.length);
        
        codeBlocks.forEach((block, index) => {
          try {
            window.hljs!.highlightElement(block);
            this.logger.logInfo(`Code block ${index + 1} highlighted`, 'highlightCodeBlocks');
          } catch (error) {
            this.logger.logWarn(`Failed to highlight code block ${index + 1}`, 'highlightCodeBlocks', {
              error: String(error)
            });
          }
        });

        const executionTime = performance.now() - startTime;
        this.logger.logPerformance('highlightCodeBlocks', 'syntax_highlighting', executionTime);
        this.logger.logFunctionExit('highlightCodeBlocks', { 
          blocksProcessed: codeBlocks.length 
        }, executionTime);
      } else {
        this.logger.logWarn('Highlight.js not available', 'highlightCodeBlocks');
      }

    } catch (error) {
      this.logger.logError(error as Error, 'highlightCodeBlocks', { 
        elementId: element.id || 'unnamed' 
      });
    }
  }

  /**
   * Check if a text contains markdown syntax
   * 
   * @param text - Text to check for markdown syntax
   * @returns True if markdown syntax is detected
   */
  public hasMarkdownSyntax(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    // Common markdown patterns
    const markdownPatterns = [
      /^#{1,6}\s/m,           // Headers
      /\*\*.*\*\*/,           // Bold
      /\*.*\*/,               // Italic
      /`.*`/,                 // Inline code
      /```[\s\S]*```/,        // Code blocks
      /^\s*[\*\-\+]\s/m,      // Unordered lists
      /^\s*\d+\.\s/m,         // Ordered lists
      /^\s*>/m,               // Blockquotes
      /\[.*\]\(.*\)/,         // Links
      /!\[.*\]\(.*\)/,        // Images
      /^\s*\|.*\|/m,          // Tables
      /^\s*---+\s*$/m         // Horizontal rules
    ];

    return markdownPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Escape HTML characters for safe display
   * 
   * @param text - Text to escape
   * @returns HTML-escaped text
   * @private
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export singleton instance
export const markdownProcessor = new MarkdownProcessor();