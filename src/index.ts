/**
 * Main application entry point
 * 
 * Initializes the graph editor with DOM elements and sets up event delegation.
 * Follows comprehensive logging and error handling standards.
 */

import { GraphEditor } from './components/graph-editor.js';
import { Logger } from './utils/logger.js';
import { ErrorFactory } from './types/errors.js';
import './utils/debug-helper.js'; // Initializes window.debug

/**
 * Initialize the graph editor application
 * 
 * @throws {DOMError} When required DOM elements are not found
 * @throws {NodeEditorError} When initialization fails
 */
function initializeEditor(): void {
  const startTime = performance.now();
  const logger = new Logger('Application');
  const errorFactory = new ErrorFactory('app-init');
  
  logger.logFunctionEntry('initializeEditor');

  try {
    const canvas = document.getElementById('canvas') as HTMLElement;
    const canvasContent = document.getElementById('canvasContent') as HTMLElement;
    const connections = document.getElementById('connections') as unknown as SVGElement;
    
    const elementsFound = !!(canvas && canvasContent && connections);
    logger.logBranch('initializeEditor', 'elementsFound', elementsFound, {
      canvasFound: !!canvas,
      canvasContentFound: !!canvasContent,
      connectionsFound: !!connections
    });
    
    if (!elementsFound) {
      logger.logError(
        new Error('Required DOM elements not found'),
        'initializeEditor',
        {
          canvasFound: !!canvas,
          canvasContentFound: !!canvasContent,
          connectionsFound: !!connections
        }
      );
      
      throw errorFactory.createDOMError(
        'Required DOM elements not found',
        'ELEMENTS_NOT_FOUND',
        'Unable to initialize the editor. Please refresh the page.',
        'initializeEditor'
      );
    }

    const editor = new GraphEditor(canvas, canvasContent, connections, false);
    logger.logInfo('GraphEditor instance created successfully', 'initializeEditor');
    
    // Set up global button handlers with comprehensive error handling
    setupGlobalEventHandlers(editor, logger, errorFactory);
    
    const executionTime = performance.now() - startTime;
    logger.logPerformance('initializeEditor', 'app_initialization', executionTime);
    logger.logFunctionExit('initializeEditor', { success: true }, executionTime);
    
  } catch (error) {
    logger.logError(error as Error, 'initializeEditor');
    
    // Re-throw the error to be handled by the global error handler
    throw error;
  }
}

/**
 * Set up global event handlers for the application
 * 
 * @param editor - The GraphEditor instance
 * @param logger - The Logger instance
 * @param errorFactory - The ErrorFactory instance
 * @private
 */
function setupGlobalEventHandlers(
  editor: GraphEditor, 
  logger: Logger, 
  errorFactory: ErrorFactory
): void {
  const startTime = performance.now();
  logger.logFunctionEntry('setupGlobalEventHandlers');

  try {
    // Set up control button handlers
    const addRootBtn = document.getElementById('addRootBtn');
    const autoLayoutBtn = document.getElementById('autoLayoutBtn');
    const toggleCollapseBtn = document.getElementById('toggleCollapseBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');
    const exportBtn = document.getElementById('exportBtn');
    const zoomSlider = document.getElementById('zoomSlider') as HTMLInputElement;
    const zoomValue = document.getElementById('zoomValue');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    
    logger.logVariableAssignment('setupGlobalEventHandlers', 'addRootBtnFound', !!addRootBtn);
    logger.logVariableAssignment('setupGlobalEventHandlers', 'autoLayoutBtnFound', !!autoLayoutBtn);
    logger.logVariableAssignment('setupGlobalEventHandlers', 'toggleCollapseBtnFound', !!toggleCollapseBtn);
    logger.logVariableAssignment('setupGlobalEventHandlers', 'resetViewBtnFound', !!resetViewBtn);
    logger.logVariableAssignment('setupGlobalEventHandlers', 'exportBtnFound', !!exportBtn);
    logger.logVariableAssignment('setupGlobalEventHandlers', 'zoomSliderFound', !!zoomSlider);
    logger.logVariableAssignment('setupGlobalEventHandlers', 'zoomInBtnFound', !!zoomInBtn);
    logger.logVariableAssignment('setupGlobalEventHandlers', 'zoomOutBtnFound', !!zoomOutBtn);
    
    if (addRootBtn) {
      addRootBtn.addEventListener('click', () => {
        try {
          logger.logUserInteraction('add_root_click', 'addRootBtn');
          editor.addRootNode();
          logger.logInfo('Root node added successfully via button', 'setupGlobalEventHandlers');
        } catch (error) {
          logger.logError(error as Error, 'setupGlobalEventHandlers.addRoot');
          handleUserFacingError(error as Error, 'Failed to add root node');
        }
      });
    }
    
    if (autoLayoutBtn) {
      autoLayoutBtn.addEventListener('click', () => {
        try {
          logger.logUserInteraction('auto_layout_click', 'autoLayoutBtn');
          editor.autoLayout();
          logger.logInfo('Auto layout applied successfully via button', 'setupGlobalEventHandlers');
        } catch (error) {
          logger.logError(error as Error, 'setupGlobalEventHandlers.autoLayout');
          handleUserFacingError(error as Error, 'Failed to apply auto layout');
        }
      });
    }
    
    if (toggleCollapseBtn) {
      toggleCollapseBtn.addEventListener('click', () => {
        try {
          const currentText = toggleCollapseBtn.textContent;
          const isCollapseMode = currentText === 'Collapse All';
          
          logger.logUserInteraction('toggle_collapse_click', 'toggleCollapseBtn', { 
            currentMode: isCollapseMode ? 'collapse' : 'expand' 
          });
          
          if (isCollapseMode) {
            editor.collapseAllNodes();
            toggleCollapseBtn.textContent = 'Expand All';
            logger.logInfo('All nodes collapsed, button changed to Expand All', 'setupGlobalEventHandlers');
          } else {
            editor.expandAllNodes();
            toggleCollapseBtn.textContent = 'Collapse All';
            logger.logInfo('All nodes expanded, button changed to Collapse All', 'setupGlobalEventHandlers');
          }
        } catch (error) {
          logger.logError(error as Error, 'setupGlobalEventHandlers.toggleCollapse');
          handleUserFacingError(error as Error, 'Failed to toggle collapse/expand');
        }
      });
    }
    
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        try {
          logger.logUserInteraction('zoom_in_click', 'zoomInBtn');
          editor.zoomIn();
          // Update slider to reflect new zoom level
          if (zoomSlider && zoomValue) {
            const currentScale = Math.round(editor.getScale() * 100);
            zoomSlider.value = currentScale.toString();
            zoomValue.textContent = `${currentScale}%`;
          }
          logger.logInfo('Zoomed in successfully via button', 'setupGlobalEventHandlers');
        } catch (error) {
          logger.logError(error as Error, 'setupGlobalEventHandlers.zoomIn');
          handleUserFacingError(error as Error, 'Failed to zoom in');
        }
      });
    }
    
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        try {
          logger.logUserInteraction('zoom_out_click', 'zoomOutBtn');
          editor.zoomOut();
          // Update slider to reflect new zoom level
          if (zoomSlider && zoomValue) {
            const currentScale = Math.round(editor.getScale() * 100);
            zoomSlider.value = currentScale.toString();
            zoomValue.textContent = `${currentScale}%`;
          }
          logger.logInfo('Zoomed out successfully via button', 'setupGlobalEventHandlers');
        } catch (error) {
          logger.logError(error as Error, 'setupGlobalEventHandlers.zoomOut');
          handleUserFacingError(error as Error, 'Failed to zoom out');
        }
      });
    }
    
    if (zoomSlider && zoomValue) {
      zoomSlider.addEventListener('input', () => {
        try {
          const zoomLevel = parseInt(zoomSlider.value) / 100;
          logger.logUserInteraction('zoom_slider_change', 'zoomSlider', { zoomLevel });
          editor.setZoom(zoomLevel);
          zoomValue.textContent = `${zoomSlider.value}%`;
          logger.logInfo('Zoom level changed via slider', 'setupGlobalEventHandlers', { zoomLevel });
        } catch (error) {
          logger.logError(error as Error, 'setupGlobalEventHandlers.zoomSlider');
          handleUserFacingError(error as Error, 'Failed to change zoom level');
        }
      });
    }
    
    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', () => {
        try {
          logger.logUserInteraction('reset_view_click', 'resetViewBtn');
          editor.resetView();
          logger.logInfo('View reset successfully via button', 'setupGlobalEventHandlers');
        } catch (error) {
          logger.logError(error as Error, 'setupGlobalEventHandlers.resetView');
          handleUserFacingError(error as Error, 'Failed to reset view');
        }
      });
    }
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        try {
          logger.logUserInteraction('export_click', 'exportBtn');
          const data = editor.exportData();
          
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'node-editor-data.json';
          a.click();
          URL.revokeObjectURL(url);
          
          logger.logInfo('Data exported successfully via button', 'setupGlobalEventHandlers', {
            dataSize: JSON.stringify(data).length
          });
        } catch (error) {
          logger.logError(error as Error, 'setupGlobalEventHandlers.export');
          handleUserFacingError(error as Error, 'Failed to export data');
        }
      });
    }
    
    // Set up textarea change handlers for block content updates
    document.addEventListener('change', (e: Event) => {
      try {
        const target = e.target as HTMLTextAreaElement;
        const isTextarea = target.tagName === 'TEXTAREA';
        logger.logBranch('setupGlobalEventHandlers', 'isTextarea', isTextarea);
        
        if (isTextarea) {
          const nodeId = target.getAttribute('data-node-id');
          const blockIndex = target.getAttribute('data-block-index');
          
          logger.logUserInteraction('textarea_change', target.id || 'unnamed', {
            nodeId,
            blockIndex,
            contentLength: target.value.length
          });
          
          if (nodeId && blockIndex !== null) {
            editor.updateBlockContent(nodeId, parseInt(blockIndex), target.value);
            logger.logInfo('Block content updated via textarea', 'setupGlobalEventHandlers', {
              nodeId,
              blockIndex: parseInt(blockIndex)
            });
          }
        }
      } catch (error) {
        logger.logError(error as Error, 'setupGlobalEventHandlers.textareaChange');
      }
    });
    
    // Set up button handlers for markdown block additions and LLM submission
    document.addEventListener('click', async (e: Event) => {
      try {
        const target = e.target as HTMLElement;
        const isButton = target.classList.contains('btn');
        const action = target.getAttribute('data-action');
        
        logger.logBranch('setupGlobalEventHandlers', 'isButton', isButton, {
          action,
          className: target.className
        });
        
        if (isButton && action === 'addMarkdown') {
          const nodeId = target.getAttribute('data-node-id');
          
          logger.logUserInteraction('add_markdown_click', target.id || 'unnamed', { nodeId });
          
          if (nodeId) {
            editor.addMarkdownBlock(nodeId);
            logger.logInfo('Markdown block added via button', 'setupGlobalEventHandlers', { nodeId });
          }
        } else if (isButton && action === 'submitToLLM') {
          const nodeId = target.getAttribute('data-node-id');
          
          logger.logUserInteraction('submit_to_llm_click', target.id || 'unnamed', { nodeId });
          
          if (nodeId) {
            try {
              await editor.submitToLLM(nodeId);
              logger.logInfo('LLM submission triggered successfully', 'setupGlobalEventHandlers', { nodeId });
            } catch (error) {
              logger.logError(error as Error, 'setupGlobalEventHandlers.submitToLLM');
              handleUserFacingError(error as Error, 'Failed to submit to AI');
            }
          }
        }
      } catch (error) {
        logger.logError(error as Error, 'setupGlobalEventHandlers.buttonClick');
      }
    });
    
    const executionTime = performance.now() - startTime;
    logger.logPerformance('setupGlobalEventHandlers', 'event_handler_setup', executionTime);
    logger.logFunctionExit('setupGlobalEventHandlers', undefined, executionTime);
    
  } catch (error) {
    logger.logError(error as Error, 'setupGlobalEventHandlers');
    
    throw errorFactory.createNodeEditorError(
      'Failed to setup global event handlers',
      'EVENT_HANDLERS_FAILED',
      'Unable to setup user interactions.',
      'setupGlobalEventHandlers',
      { error: String(error) },
      'high'
    );
  }
}

/**
 * Handle user-facing errors with appropriate messaging
 * 
 * @param error - The error that occurred
 * @param defaultMessage - Default message if error doesn't have user-friendly message
 * @private
 */
function handleUserFacingError(error: Error, defaultMessage: string): void {
  const logger = new Logger('ErrorHandler');
  
  logger.logFunctionEntry('handleUserFacingError', {
    errorName: error.name,
    errorMessage: error.message,
    defaultMessage
  });
  
  try {
    // Check if it's one of our custom errors with user-friendly messages
    const hasUserFriendlyMessage = 'userFriendlyMessage' in error;
    logger.logBranch('handleUserFacingError', 'hasUserFriendlyMessage', hasUserFriendlyMessage);
    
    let userMessage = defaultMessage;
    if (hasUserFriendlyMessage) {
      userMessage = (error as any).userFriendlyMessage;
    }
    
    logger.logVariableAssignment('handleUserFacingError', 'userMessage', userMessage);
    
    // Show user-friendly error message
    alert(userMessage);
    
    logger.logInfo('User error message displayed', 'handleUserFacingError', {
      userMessage,
      originalError: error.message
    });
    
    logger.logFunctionExit('handleUserFacingError', { userMessage });
    
  } catch (handlingError) {
    logger.logError(handlingError as Error, 'handleUserFacingError');
    // Fallback: show the default message
    alert(defaultMessage);
  }
}

/**
 * Global error handler for unhandled errors
 * 
 * @param error - The unhandled error
 * @private
 */
function handleGlobalError(error: Error): void {
  const logger = new Logger('GlobalErrorHandler');
  
  logger.logFatal('Unhandled application error', 'handleGlobalError', {
    errorName: error.name,
    errorMessage: error.message,
    stackTrace: error.stack
  });
  
  handleUserFacingError(error, 'An unexpected error occurred. Please refresh the page and try again.');
}

// Set up global error handlers
window.addEventListener('error', (event) => {
  handleGlobalError(event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  handleGlobalError(new Error(`Unhandled promise rejection: ${event.reason}`));
});

// Initialize the application when DOM is ready
if (typeof window !== 'undefined') {
  const logger = new Logger('Bootstrap');
  
  logger.logInfo('Application bootstrap starting', 'bootstrap', {
    readyState: document.readyState,
    url: window.location.href
  });
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      logger.logInfo('DOM content loaded, initializing editor', 'bootstrap');
      initializeEditor();
    });
  } else {
    logger.logInfo('DOM already loaded, initializing editor immediately', 'bootstrap');
    initializeEditor();
  }
}

// Export main classes for external use
export { GraphEditor } from './components/graph-editor.js';
export * from './types/graph.types.js';
export { Logger } from './utils/logger.js';
export { Validator } from './utils/type-guards.js';
export * from './types/errors.js';