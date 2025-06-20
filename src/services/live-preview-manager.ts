/**
 * Live preview manager for real-time markdown rendering
 * 
 * Handles preview modes, content synchronization, and efficient
 * rendering with debouncing and queue management.
 */

import { Logger } from '../utils/logger.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import {
  BlockId,
  CorrelationId
} from '../types/branded.types.js';
import {
  PreviewMode,
  PreviewState,
  RenderTask,
  SyncOptions
} from '../types/markdown.types.js';

/**
 * Priority queue implementation for render tasks
 */
class PriorityQueue<T> {
  private items: { element: T; priority: number }[] = [];
  
  enqueue(element: T, priority: number): void {
    const queueElement = { element, priority };
    let added = false;
    
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (item && queueElement.priority > item.priority) {
        this.items.splice(i, 0, queueElement);
        added = true;
        break;
      }
    }
    
    if (!added) {
      this.items.push(queueElement);
    }
  }
  
  dequeue(): T | undefined {
    const item = this.items.shift();
    return item ? item.element : undefined;
  }
  
  get length(): number {
    return this.items.length;
  }
  
  clear(): void {
    this.items = [];
  }
}

/**
 * Manages live preview functionality for markdown blocks
 */
export class LivePreviewManager {
  private readonly logger: Logger;
  private readonly markdownRenderer: MarkdownRenderer;
  private readonly activeBlocks = new Map<BlockId, PreviewState>();
  private readonly renderQueue = new PriorityQueue<RenderTask>();
  private readonly debounceTimers = new Map<BlockId, number>();
  private readonly debounceDelay = 300; // ms
  private isProcessingQueue = false;
  
  // Synchronization options
  private readonly syncOptions: SyncOptions = {
    scrollSync: true,
    cursorSync: true,
    highlightChanges: true,
    lineMapping: true
  };
  
  constructor() {
    this.logger = new Logger('LivePreviewManager');
    this.markdownRenderer = new MarkdownRenderer();
  }
  
  /**
   * Enables preview for a markdown block
   */
  enablePreview(
    blockId: BlockId,
    mode: PreviewMode = 'split',
    correlationId?: CorrelationId
  ): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('enablePreview', { blockId, mode, correlationId });
    
    try {
      // Check if block element exists
      const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
      if (!blockElement) {
        throw new Error(`Block element not found: ${blockId}`);
      }
      
      // Update preview state
      const previewState: PreviewState = {
        blockId,
        mode,
        scrollPosition: 0,
        cursorPosition: 0,
        lastUpdate: new Date()
      };
      
      this.activeBlocks.set(blockId, previewState);
      
      // Apply preview mode class
      blockElement.classList.remove('preview-mode-split', 'preview-mode-preview_only', 
                                   'preview-mode-edit_only', 'preview-mode-tabbed');
      blockElement.classList.add(`preview-mode-${mode}`);
      
      // Create preview container if needed
      if (mode !== 'edit_only') {
        this.createPreviewContainer(blockId, blockElement as HTMLElement);
      }
      
      // Get initial content and render
      const textarea = blockElement.querySelector('textarea');
      if (textarea) {
        const content = (textarea as HTMLTextAreaElement).value;
        this.updatePreview(blockId, content, correlationId);
      }
      
      const executionTime = performance.now() - startTime;
      this.logger.logFunctionExit('enablePreview', { executionTime });
      
    } catch (error) {
      this.logger.logError(error as Error, 'enablePreview', {
        blockId,
        mode,
        correlationId
      });
      
      throw error;
    }
  }
  
  /**
   * Updates preview content with debouncing
   */
  async updatePreview(
    blockId: BlockId,
    content: string,
    correlationId?: CorrelationId
  ): Promise<void> {
    this.logger.logFunctionEntry('updatePreview', {
      blockId,
      contentLength: content.length,
      correlationId
    });
    
    try {
      // Clear existing debounce timer
      const existingTimer = this.debounceTimers.get(blockId);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }
      
      // Set new debounce timer
      const timer = window.setTimeout(() => {
        this.debounceTimers.delete(blockId);
        this.queueRender({
          blockId,
          content,
          options: {
            enableSyntaxHighlighting: true,
            enableMath: true,
            enableDiagrams: true,
            enableEmoji: true,
            sanitize: true,
            theme: 'dark'
          },
          priority: 1,
          timestamp: new Date()
        });
      }, this.debounceDelay);
      
      this.debounceTimers.set(blockId, timer);
      
      this.logger.logFunctionExit('updatePreview');
      
    } catch (error) {
      this.logger.logError(error as Error, 'updatePreview', {
        blockId,
        contentLength: content.length,
        correlationId
      });
      
      throw error;
    }
  }
  
  /**
   * Disables preview for a block
   */
  disablePreview(blockId: BlockId, correlationId?: CorrelationId): void {
    this.logger.logFunctionEntry('disablePreview', { blockId, correlationId });
    
    try {
      // Remove from active blocks
      this.activeBlocks.delete(blockId);
      
      // Clear any pending timers
      const timer = this.debounceTimers.get(blockId);
      if (timer) {
        window.clearTimeout(timer);
        this.debounceTimers.delete(blockId);
      }
      
      // Remove preview container and classes
      const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
      if (blockElement) {
        blockElement.classList.remove('preview-mode-split', 'preview-mode-preview_only',
                                    'preview-mode-edit_only', 'preview-mode-tabbed');
        
        const previewContainer = blockElement.querySelector('.markdown-preview');
        if (previewContainer) {
          previewContainer.remove();
        }
      }
      
      this.logger.logFunctionExit('disablePreview');
      
    } catch (error) {
      this.logger.logError(error as Error, 'disablePreview', {
        blockId,
        correlationId
      });
    }
  }
  
  /**
   * Changes the preview mode for a block
   */
  changePreviewMode(
    blockId: BlockId,
    mode: PreviewMode,
    correlationId?: CorrelationId
  ): void {
    this.logger.logFunctionEntry('changePreviewMode', { blockId, mode, correlationId });
    
    try {
      const state = this.activeBlocks.get(blockId);
      if (!state) {
        throw new Error(`Block ${blockId} does not have preview enabled`);
      }
      
      // Update state
      this.activeBlocks.set(blockId, {
        ...state,
        mode,
        lastUpdate: new Date()
      });
      
      // Update DOM classes
      const blockElement = document.querySelector(`[data-block-id="${blockId}"]`);
      if (blockElement) {
        blockElement.classList.remove('preview-mode-split', 'preview-mode-preview_only',
                                    'preview-mode-edit_only', 'preview-mode-tabbed');
        blockElement.classList.add(`preview-mode-${mode}`);
        
        // Show/hide preview container based on mode
        const previewContainer = blockElement.querySelector('.markdown-preview');
        if (previewContainer) {
          (previewContainer as HTMLElement).style.display = 
            mode === 'edit_only' ? 'none' : 'block';
        }
      }
      
      this.logger.logFunctionExit('changePreviewMode');
      
    } catch (error) {
      this.logger.logError(error as Error, 'changePreviewMode', {
        blockId,
        mode,
        correlationId
      });
      
      throw error;
    }
  }
  
  /**
   * Creates a preview container for a block
   */
  private createPreviewContainer(blockId: BlockId, blockElement: HTMLElement): void {
    this.logger.logFunctionEntry('createPreviewContainer', { blockId });
    
    try {
      // Check if preview already exists
      let previewContainer = blockElement.querySelector('.markdown-preview');
      if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.className = 'markdown-preview';
        
        const contentElement = blockElement.querySelector('.block-content');
        if (contentElement) {
          contentElement.appendChild(previewContainer);
        }
      }
      
      // Set up scroll synchronization if enabled
      if (this.syncOptions.scrollSync) {
        this.setupScrollSync(blockId, blockElement);
      }
      
      this.logger.logFunctionExit('createPreviewContainer');
      
    } catch (error) {
      this.logger.logError(error as Error, 'createPreviewContainer', { blockId });
      throw error;
    }
  }
  
  /**
   * Sets up scroll synchronization between editor and preview
   */
  private setupScrollSync(blockId: BlockId, blockElement: HTMLElement): void {
    this.logger.logFunctionEntry('setupScrollSync', { blockId });
    
    try {
      const textarea = blockElement.querySelector('textarea');
      const preview = blockElement.querySelector('.markdown-preview');
      
      if (textarea && preview) {
        // Sync scroll from textarea to preview
        textarea.addEventListener('scroll', () => {
          if (this.syncOptions.scrollSync) {
            const scrollPercentage = textarea.scrollTop / 
              (textarea.scrollHeight - textarea.clientHeight);
            
            preview.scrollTop = scrollPercentage * 
              (preview.scrollHeight - preview.clientHeight);
          }
        });
        
        // Sync scroll from preview to textarea
        preview.addEventListener('scroll', () => {
          if (this.syncOptions.scrollSync) {
            const scrollPercentage = preview.scrollTop / 
              (preview.scrollHeight - preview.clientHeight);
            
            textarea.scrollTop = scrollPercentage * 
              (textarea.scrollHeight - textarea.clientHeight);
          }
        });
      }
      
      this.logger.logFunctionExit('setupScrollSync');
      
    } catch (error) {
      this.logger.logError(error as Error, 'setupScrollSync', { blockId });
    }
  }
  
  /**
   * Queues a render task
   */
  private queueRender(task: RenderTask): void {
    this.logger.logFunctionEntry('queueRender', {
      blockId: task.blockId,
      priority: task.priority
    });
    
    try {
      this.renderQueue.enqueue(task, task.priority);
      
      // Process queue if not already processing
      if (!this.isProcessingQueue) {
        this.processRenderQueue();
      }
      
      this.logger.logFunctionExit('queueRender');
      
    } catch (error) {
      this.logger.logError(error as Error, 'queueRender', {
        blockId: task.blockId
      });
    }
  }
  
  /**
   * Processes the render queue
   */
  private async processRenderQueue(): Promise<void> {
    if (this.isProcessingQueue || this.renderQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    this.logger.logFunctionEntry('processRenderQueue', {
      queueLength: this.renderQueue.length
    });
    
    try {
      while (this.renderQueue.length > 0) {
        const task = this.renderQueue.dequeue();
        if (!task) continue;
        
        // Check if block is still active
        const state = this.activeBlocks.get(task.blockId);
        if (!state || state.mode === 'edit_only') {
          continue;
        }
        
        // Render content
        const startTime = performance.now();
        
        try {
          const result = await this.markdownRenderer.renderMarkdown(
            task.content,
            task.options
          );
          
          // Update preview container
          const blockElement = document.querySelector(`[data-block-id="${task.blockId}"]`);
          const previewContainer = blockElement?.querySelector('.markdown-preview');
          
          if (previewContainer) {
            // Store scroll position
            const scrollTop = previewContainer.scrollTop;
            
            // Update content
            previewContainer.innerHTML = result.html;
            
            // Restore scroll position
            previewContainer.scrollTop = scrollTop;
            
            // Highlight changes if enabled
            if (this.syncOptions.highlightChanges) {
              this.highlightChanges(previewContainer as HTMLElement);
            }
          }
          
          const renderTime = performance.now() - startTime;
          
          this.logger.logDebug('Rendered markdown content', 'processRenderQueue', {
            blockId: task.blockId,
            renderTime,
            htmlLength: result.html.length
          });
          
        } catch (error) {
          this.logger.logError(error as Error, 'processRenderQueue', {
            blockId: task.blockId
          });
          
          // Show error in preview
          const blockElement = document.querySelector(`[data-block-id="${task.blockId}"]`);
          const previewContainer = blockElement?.querySelector('.markdown-preview');
          
          if (previewContainer) {
            previewContainer.innerHTML = `
              <div class="markdown-error">
                <p>Error rendering markdown:</p>
                <pre>${this.escapeHtml((error as Error).message)}</pre>
              </div>
            `;
          }
        }
      }
      
    } finally {
      this.isProcessingQueue = false;
      this.logger.logFunctionExit('processRenderQueue');
    }
  }
  
  /**
   * Highlights recently changed content
   */
  private highlightChanges(container: HTMLElement): void {
    container.classList.add('content-updated');
    
    setTimeout(() => {
      container.classList.remove('content-updated');
    }, 500);
  }
  
  /**
   * Escapes HTML for safe display
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Gets the current preview state for a block
   */
  getPreviewState(blockId: BlockId): PreviewState | undefined {
    return this.activeBlocks.get(blockId);
  }
  
  /**
   * Updates synchronization options
   */
  updateSyncOptions(options: Partial<SyncOptions>): void {
    Object.assign(this.syncOptions, options);
    
    this.logger.logInfo('Updated synchronization options', 'updateSyncOptions', {
      syncOptions: this.syncOptions
    });
  }
}