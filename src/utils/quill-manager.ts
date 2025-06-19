import { Logger } from './logger.js';
import type { QuillInstance, QuillConstructor, QuillDelta, QuillOperation, QuillOptions } from '../types/quill.types.js';

/**
 * Quill editor manager for handling rich text editing
 * Manages Quill instances for each block in the graph editor
 */
export class QuillManager {
  private logger: Logger;
  private editors: Map<string, QuillInstance> = new Map();
  private quillInstance: QuillConstructor | undefined;

  constructor() {
    this.logger = new Logger('QuillManager');
    this.quillInstance = window.Quill;
  }

  /**
   * Create a Quill editor instance for a specific block
   * 
   * @param blockId - The ID of the block
   * @param initialContent - Initial content (can be HTML or plain text)
   * @param container : HTMLElement - DOM element to render the editor in
   * @param onChange - Callback when content changes
   * @returns The editor instance
   */
  public createEditor(
    blockId: string,
    initialContent: string,
    container: HTMLElement,
    onChange?: (content: string) => void
  ): QuillInstance {
    const startTime = performance.now();
    this.logger.logFunctionEntry('createEditor', { 
      blockId, 
      contentLength: initialContent.length 
    });

    try {
      // Check if Quill is available
      if (!this.quillInstance) {
        this.logger.logError(new Error('Quill not found'), 'createEditor', { blockId });
        throw new Error('Quill not found. Make sure Quill is loaded before creating editors.');
      }

      // Clean up any existing editor
      if (this.editors.has(blockId)) {
        this.destroyEditor(blockId);
      }

      // Create container for Quill
      const editorContainer = document.createElement('div');
      editorContainer.id = `quill-editor-${blockId}`;
      container.appendChild(editorContainer);

      // Configure Quill options based on block type
      const options: QuillOptions = {
        theme: 'snow',
        placeholder: 'Start typing...',
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link'],
            ['clean']
          ]
        }
      };

      // Create Quill instance
      if (!this.quillInstance) {
        throw new Error('Quill constructor not available');
      }
      const quill = new this.quillInstance(editorContainer, options);

      // Set initial content
      if (initialContent) {
        // Check if content is HTML or plain text
        if (initialContent.includes('<') && initialContent.includes('>')) {
          // It's likely HTML
          quill.root.innerHTML = initialContent;
        } else {
          // Convert markdown-like content to Quill delta
          const delta = this.convertMarkdownToDelta(initialContent);
          quill.setContents(delta);
        }
      }

      // Set up change handler
      if (onChange) {
        quill.on('text-change', () => {
          // Get content as HTML
          const html = quill.root.innerHTML;
          // Also get plain text for fallback
          const text = quill.getText();
          
          // For now, we'll store the HTML content
          onChange(html);
          
          this.logger.logInfo('Content updated', 'createEditor', {
            blockId,
            htmlLength: html.length,
            textLength: text.length
          });
        });
      }

      // Store editor reference
      this.editors.set(blockId, quill);

      this.logger.logInfo('Quill editor created', 'createEditor', { blockId });

      const executionTime = performance.now() - startTime;
      this.logger.logPerformance('createEditor', 'editor_creation', executionTime);
      this.logger.logFunctionExit('createEditor', { blockId }, executionTime);

      return quill;

    } catch (error) {
      this.logger.logError(error as Error, 'createEditor', { blockId });
      throw new Error(`Failed to create Quill editor for block ${blockId}: ${error}`);
    }
  }

  /**
   * Convert basic markdown to Quill Delta format
   * 
   * @param markdown - Markdown string to convert
   * @returns Quill Delta object
   */
  private convertMarkdownToDelta(markdown: string): QuillDelta {
    const lines = markdown.split('\n');
    const ops: QuillOperation[] = [];

    for (const line of lines) {
      if (line.startsWith('# ')) {
        ops.push({ insert: line.slice(2) });
        ops.push({ insert: '\n', attributes: { header: 1 } });
      } else if (line.startsWith('## ')) {
        ops.push({ insert: line.slice(3) });
        ops.push({ insert: '\n', attributes: { header: 2 } });
      } else if (line.startsWith('### ')) {
        ops.push({ insert: line.slice(4) });
        ops.push({ insert: '\n', attributes: { header: 3 } });
      } else if (line.startsWith('> ')) {
        ops.push({ insert: line.slice(2) });
        ops.push({ insert: '\n', attributes: { blockquote: true } });
      } else if (line.startsWith('- ')) {
        ops.push({ insert: line.slice(2) });
        ops.push({ insert: '\n', attributes: { list: 'bullet' } });
      } else if (line.match(/^\d+\. /)) {
        ops.push({ insert: line.replace(/^\d+\. /, '') });
        ops.push({ insert: '\n', attributes: { list: 'ordered' } });
      } else if (line.startsWith('```')) {
        // Handle code blocks
        continue; // Skip fence markers
      } else if (line.trim()) {
        // Process inline formatting
        let processedLine = line;
        
        // Bold
        processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, (_match, text: string) => {
          ops.push({ insert: text, attributes: { bold: true } });
          return '';
        });
        
        // Italic
        processedLine = processedLine.replace(/\*(.*?)\*/g, (_match, text: string) => {
          ops.push({ insert: text, attributes: { italic: true } });
          return '';
        });
        
        // Code
        processedLine = processedLine.replace(/`(.*?)`/g, (_match, text: string) => {
          ops.push({ insert: text, attributes: { code: true } });
          return '';
        });
        
        // Add remaining text
        if (processedLine.trim()) {
          ops.push({ insert: processedLine });
        }
        
        ops.push({ insert: '\n' });
      } else {
        // Empty line
        ops.push({ insert: '\n' });
      }
    }

    return { ops };
  }

  /**
   * Update editor content
   * 
   * @param blockId - The ID of the block
   * @param content - New content (HTML or plain text)
   */
  public updateContent(blockId: string, content: string): void {
    this.logger.logFunctionEntry('updateContent', { 
      blockId, 
      contentLength: content.length 
    });

    try {
      const editor = this.editors.get(blockId);
      
      if (!editor) {
        this.logger.logWarn('Editor not found', 'updateContent', { blockId });
        return;
      }

      if (content.includes('<') && content.includes('>')) {
        // HTML content
        editor.root.innerHTML = content;
      } else {
        // Plain text or markdown
        const delta = this.convertMarkdownToDelta(content);
        editor.setContents(delta);
      }

      this.logger.logInfo('Editor content updated', 'updateContent', { blockId });

    } catch (error) {
      this.logger.logError(error as Error, 'updateContent', { blockId });
    }
  }

  /**
   * Get current content from editor
   * 
   * @param blockId - The ID of the block
   * @returns Current content as HTML
   */
  public getContent(blockId: string): string {
    this.logger.logFunctionEntry('getContent', { blockId });

    try {
      const editor = this.editors.get(blockId);
      
      if (!editor) {
        this.logger.logWarn('Editor not found', 'getContent', { blockId });
        return '';
      }

      const html = editor.root.innerHTML;

      this.logger.logInfo('Retrieved editor content', 'getContent', { 
        blockId,
        contentLength: html.length 
      });

      return html;

    } catch (error) {
      this.logger.logError(error as Error, 'getContent', { blockId });
      return '';
    }
  }

  /**
   * Get content as plain text
   * 
   * @param blockId - The ID of the block
   * @returns Current content as plain text
   */
  public getPlainText(blockId: string): string {
    this.logger.logFunctionEntry('getPlainText', { blockId });

    try {
      const editor = this.editors.get(blockId);
      
      if (!editor) {
        this.logger.logWarn('Editor not found', 'getPlainText', { blockId });
        return '';
      }

      const text = editor.getText();

      this.logger.logInfo('Retrieved plain text', 'getPlainText', { 
        blockId,
        textLength: text.length 
      });

      return text;

    } catch (error) {
      this.logger.logError(error as Error, 'getPlainText', { blockId });
      return '';
    }
  }

  /**
   * Destroy a specific editor instance
   * 
   * @param blockId - The ID of the block
   */
  public destroyEditor(blockId: string): void {
    this.logger.logFunctionEntry('destroyEditor', { blockId });

    try {
      const editor = this.editors.get(blockId);
      
      if (editor) {
        // Remove Quill instance
        const container = editor.container;
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        
        this.editors.delete(blockId);
        
        this.logger.logInfo('Editor destroyed', 'destroyEditor', { blockId });
      }

    } catch (error) {
      this.logger.logError(error as Error, 'destroyEditor', { blockId });
    }
  }

  /**
   * Destroy all editor instances
   */
  public destroyAll(): void {
    this.logger.logFunctionEntry('destroyAll', { 
      editorCount: this.editors.size 
    });

    try {
      for (const [blockId] of this.editors) {
        try {
          this.destroyEditor(blockId);
        } catch (error) {
          this.logger.logError(error as Error, 'destroyAll', { blockId });
        }
      }

      this.editors.clear();
      
      this.logger.logInfo('All editors destroyed', 'destroyAll');

    } catch (error) {
      this.logger.logError(error as Error, 'destroyAll');
    }
  }

  /**
   * Enable or disable an editor
   * 
   * @param blockId - The ID of the block
   * @param enabled - Whether to enable or disable
   */
  public setEnabled(blockId: string, enabled: boolean): void {
    const editor = this.editors.get(blockId);
    
    if (editor) {
      editor.enable(enabled);
      this.logger.logInfo(`Editor ${enabled ? 'enabled' : 'disabled'}`, 'setEnabled', { blockId });
    }
  }
}

// Export singleton instance
export const quillManager = new QuillManager();