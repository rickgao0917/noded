/**
 * @fileoverview Core service for managing preview toggle functionality across blocks
 * @version 1.0.0
 * @compliance ts_readme.xml
 */

import { Logger } from '../utils/logger.js';
import { MarkdownProcessor } from '../utils/markdown.js';
import { ErrorFactory } from '../types/errors.js';
import type { 
    BlockPreviewState, 
    PreviewDisplayMode, 
    PreviewConfig, 
    PreviewToggleEvent,
    PreviewToggleTrigger
} from '../types/preview.types.js';
import { DEFAULT_PREVIEW_CONFIG } from '../types/preview.types.js';
import type { BlockId, CorrelationId } from '../types/branded.types.js';

/**
 * Core service for managing preview toggle functionality across blocks
 * Handles state management, DOM manipulation, and integration with markdown rendering
 */
export class PreviewToggleManager {
    private readonly logger: Logger;
    private readonly markdownProcessor: MarkdownProcessor;
    private readonly errorFactory: ErrorFactory;
    private readonly config: PreviewConfig;
    private readonly blockStates: Map<BlockId, BlockPreviewState>;

    constructor(
        markdownProcessor?: MarkdownProcessor,
        errorFactory?: ErrorFactory,
        config?: Partial<PreviewConfig>
    ) {
        this.logger = new Logger('PreviewToggleManager');
        this.markdownProcessor = markdownProcessor || new MarkdownProcessor();
        this.errorFactory = errorFactory || new ErrorFactory('preview-toggle-manager');
        this.blockStates = new Map();
        
        // Merge with default config
        this.config = {
            ...DEFAULT_PREVIEW_CONFIG,
            ...config
        };

        this.logger.logFunctionEntry('constructor', {
            configProvided: !!config,
            markdownProcessorProvided: !!markdownProcessor,
            errorFactoryProvided: !!errorFactory
        });

        this.logger.logFunctionExit('constructor', { initialized: true });
    }

    /**
     * Toggle the preview mode for a specific block
     * @param blockId - Unique identifier for the block
     * @param correlationId - Optional correlation ID for request tracing
     * @returns Promise resolving to the new block preview state
     * @throws ValidationError if blockId is invalid
     * @throws NodeEditorError if DOM manipulation fails
     */
    public async toggleBlockPreview(
        blockId: BlockId, 
        correlationId?: CorrelationId
    ): Promise<BlockPreviewState> {
        const startTime = performance.now();
        
        this.logger.logFunctionEntry('toggleBlockPreview', {
            blockId: String(blockId),
            correlationId: correlationId ? String(correlationId) : undefined
        });

        try {
            // Validate blockId
            if (!this.isValidBlockId(blockId)) {
                throw this.errorFactory.createValidationError(
                    'blockId',
                    String(blockId),
                    'valid block ID',
                    'toggleBlockPreview'
                );
            }

            const currentState = this.getBlockPreviewState(blockId);
            const newMode: PreviewDisplayMode = currentState.displayMode === 'raw' ? 'rendered' : 'raw';
            
            this.logger.logInfo('Toggling preview mode', 'toggleBlockPreview', {
                blockId: String(blockId),
                fromMode: currentState.displayMode,
                toMode: newMode
            });

            const newState = await this.setBlockPreviewMode(
                blockId, 
                newMode, 
                'button',
                correlationId
            );

            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('toggleBlockPreview', 'toggle_operation', executionTime);

            this.logger.logFunctionExit('toggleBlockPreview', {
                newState: newState.displayMode,
                executionTime
            });

            return newState;

        } catch (error) {
            const executionTime = performance.now() - startTime;
            this.logger.logError(error as Error, 'toggleBlockPreview', {
                blockId: String(blockId),
                executionTime
            });
            throw error;
        }
    }

    /**
     * Set the preview mode for a specific block
     * @param blockId - Unique identifier for the block
     * @param mode - The desired preview display mode
     * @param triggeredBy - How the change was triggered
     * @param correlationId - Optional correlation ID for request tracing
     * @returns Promise resolving to the new block preview state
     */
    public async setBlockPreviewMode(
        blockId: BlockId,
        mode: PreviewDisplayMode,
        triggeredBy: PreviewToggleTrigger = 'api',
        correlationId?: CorrelationId
    ): Promise<BlockPreviewState> {
        const startTime = performance.now();
        
        this.logger.logFunctionEntry('setBlockPreviewMode', {
            blockId: String(blockId),
            mode,
            triggeredBy,
            correlationId: correlationId ? String(correlationId) : undefined
        });

        try {
            const currentState = this.getBlockPreviewState(blockId);
            
            // No change needed
            if (currentState.displayMode === mode) {
                this.logger.logInfo('Preview mode already set', 'setBlockPreviewMode', {
                    blockId: String(blockId),
                    mode
                });
                return currentState;
            }

            // Apply the preview mode to DOM
            await this.applyPreviewMode(blockId, mode, correlationId);

            // Update state
            const newState: BlockPreviewState = {
                blockId,
                displayMode: mode,
                lastToggleTime: Date.now(),
                isUserPreference: triggeredBy !== 'api'
            };

            this.blockStates.set(blockId, newState);

            // Log toggle event
            const toggleEvent: PreviewToggleEvent = {
                blockId,
                previousMode: currentState.displayMode,
                newMode: mode,
                timestamp: Date.now(),
                triggeredBy,
                correlationId
            };

            this.logger.logUserInteraction('preview_toggle', 'setBlockPreviewMode', toggleEvent);

            const executionTime = performance.now() - startTime;
            this.logger.logPerformance('setBlockPreviewMode', 'mode_change', executionTime);

            this.logger.logFunctionExit('setBlockPreviewMode', {
                newMode: mode,
                executionTime
            });

            return newState;

        } catch (error) {
            const executionTime = performance.now() - startTime;
            this.logger.logError(error as Error, 'setBlockPreviewMode', {
                blockId: String(blockId),
                mode,
                executionTime
            });
            throw error;
        }
    }

    /**
     * Get the current preview state for a block
     * @param blockId - Unique identifier for the block
     * @returns Current block preview state
     */
    public getBlockPreviewState(blockId: BlockId): BlockPreviewState {
        this.logger.logFunctionEntry('getBlockPreviewState', {
            blockId: String(blockId)
        });

        const existingState = this.blockStates.get(blockId);
        
        if (existingState) {
            this.logger.logFunctionExit('getBlockPreviewState', {
                found: true,
                mode: existingState.displayMode
            });
            return existingState;
        }

        // Return default state for new blocks
        const defaultState: BlockPreviewState = {
            blockId,
            displayMode: 'raw',
            lastToggleTime: Date.now(),
            isUserPreference: false
        };

        this.blockStates.set(blockId, defaultState);

        this.logger.logFunctionExit('getBlockPreviewState', {
            found: false,
            defaultMode: defaultState.displayMode
        });

        return defaultState;
    }

    /**
     * Initialize response block preview based on configuration
     * @param blockId - Unique identifier for the response block
     * @param correlationId - Optional correlation ID for request tracing
     */
    public async initializeResponseBlockPreview(
        blockId: BlockId,
        correlationId?: CorrelationId
    ): Promise<void> {
        this.logger.logFunctionEntry('initializeResponseBlockPreview', {
            blockId: String(blockId),
            autoRenderResponses: this.config.autoRenderResponses
        });

        try {
            if (this.config.autoRenderResponses) {
                await this.setBlockPreviewMode(blockId, 'rendered', 'api', correlationId);
                this.logger.logInfo('Auto-rendered response block', 'initializeResponseBlockPreview', {
                    blockId: String(blockId)
                });
            }
        } catch (error) {
            // Don't throw for non-critical initialization
            this.logger.logWarn('Failed to initialize response block preview', 'initializeResponseBlockPreview', {
                blockId: String(blockId),
                error: error instanceof Error ? error.message : String(error)
            });
        }

        this.logger.logFunctionExit('initializeResponseBlockPreview', {});
    }

    /**
     * Export all current preview states
     * @returns Map of all block preview states
     */
    public exportPreviewStates(): Map<BlockId, BlockPreviewState> {
        this.logger.logFunctionEntry('exportPreviewStates', {
            stateCount: this.blockStates.size
        });

        const exported = new Map(this.blockStates);

        this.logger.logFunctionExit('exportPreviewStates', {
            exportedCount: exported.size
        });

        return exported;
    }

    /**
     * Import preview states from external source
     * @param states - Map of block preview states to import
     */
    public importPreviewStates(states: Map<BlockId, BlockPreviewState>): void {
        this.logger.logFunctionEntry('importPreviewStates', {
            importCount: states.size
        });

        try {
            // Validate each state before import
            for (const [blockId, state] of states) {
                if (this.isValidPreviewState(state)) {
                    this.blockStates.set(blockId, state);
                } else {
                    this.logger.logWarn('Invalid preview state during import', 'importPreviewStates', {
                        blockId: String(blockId)
                    });
                }
            }

            this.logger.logFunctionExit('importPreviewStates', {
                importedCount: this.blockStates.size
            });

        } catch (error) {
            this.logger.logError(error as Error, 'importPreviewStates', {});
            throw error;
        }
    }

    /**
     * Clean up preview states for deleted blocks
     * @param blockIds - Array of block IDs to remove from state
     */
    public cleanupDeletedBlocks(blockIds: readonly BlockId[]): void {
        this.logger.logFunctionEntry('cleanupDeletedBlocks', {
            blockCount: blockIds.length
        });

        let cleanedCount = 0;
        for (const blockId of blockIds) {
            if (this.blockStates.delete(blockId)) {
                cleanedCount++;
            }
        }

        this.logger.logFunctionExit('cleanupDeletedBlocks', {
            cleanedCount,
            remainingStates: this.blockStates.size
        });
    }

    /**
     * Apply preview mode to DOM elements
     * @private
     */
    private async applyPreviewMode(
        blockId: BlockId,
        mode: PreviewDisplayMode,
        correlationId?: CorrelationId
    ): Promise<void> {
        this.logger.logFunctionEntry('applyPreviewMode', {
            blockId: String(blockId),
            mode
        });

        const blockElement = document.querySelector(`[data-block-id="${String(blockId)}"]`) as HTMLElement;
        
        if (!blockElement) {
            throw this.errorFactory.createDOMError(
                'Block element not found in DOM',
                'DOM_ELEMENT_MISSING',
                'Block element not found',
                'applyPreviewMode'
            );
        }

        // Set data attribute for CSS styling
        blockElement.setAttribute('data-preview-mode', mode);

        if (mode === 'rendered') {
            await this.showRenderedContent(blockId, blockElement, correlationId);
        } else {
            this.showRawContent(blockId, blockElement);
        }

        // Update toggle button state
        this.updateToggleButton(blockElement, mode);

        this.logger.logFunctionExit('applyPreviewMode', { success: true });
    }

    /**
     * Show rendered content for a block
     * @private
     */
    private async showRenderedContent(
        blockId: BlockId,
        container: HTMLElement,
        _correlationId?: CorrelationId
    ): Promise<void> {
        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        
        if (!textarea) {
            throw this.errorFactory.createDOMError(
                'Textarea not found in block',
                'TEXTAREA_MISSING', 
                'Textarea element not found',
                'showRenderedContent'
            );
        }

        // Get or create rendered content container
        let renderedContainer = container.querySelector('.rendered-content') as HTMLElement;
        
        if (!renderedContainer) {
            renderedContainer = document.createElement('div');
            renderedContainer.className = 'rendered-content';
            renderedContainer.title = 'Double-click to edit';
            container.appendChild(renderedContainer);
        }

        // Render markdown content
        const markdownContent = textarea.value;
        const renderedHTML = this.markdownProcessor.renderMarkdown(markdownContent, 'preview');
        renderedContainer.innerHTML = renderedHTML;

        // Preserve the height from textarea to maintain consistent sizing
        const textareaHeight = textarea.style.height || textarea.offsetHeight + 'px';
        renderedContainer.style.height = textareaHeight;

        // Hide textarea, show rendered content
        textarea.style.display = 'none';
        renderedContainer.style.display = 'block';

        // Add hover-to-scroll functionality for preview content
        const finalContainer = this.setupHoverScrolling(renderedContainer);

        // Add double-click handler if enabled (after setupHoverScrolling which may clone the element)
        if (this.config.enableDoubleClickEdit) {
            finalContainer.addEventListener('dblclick', () => {
                this.handleDoubleClickEdit(blockId);
            });
        }
    }

    /**
     * Show raw content for a block
     * @private
     */
    private showRawContent(_blockId: BlockId, container: HTMLElement): void {
        const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
        const renderedContainer = container.querySelector('.rendered-content') as HTMLElement;

        if (textarea) {
            textarea.style.display = 'block';
            textarea.focus();
        }

        if (renderedContainer) {
            renderedContainer.style.display = 'none';
        }
    }

    /**
     * Update toggle button state
     * @private
     */
    private updateToggleButton(container: HTMLElement, mode: PreviewDisplayMode): void {
        const toggleButton = container.querySelector('.btn-preview-toggle') as HTMLButtonElement;
        
        if (toggleButton) {
            const icon = mode === 'rendered' ? '👁️' : '📝';
            const title = mode === 'rendered' ? 'Show raw content' : 'Show rendered content';
            
            toggleButton.innerHTML = icon;
            toggleButton.title = title;
            toggleButton.setAttribute('aria-label', title);
        }
    }

    /**
     * Handle double-click editing in rendered mode
     * @private
     */
    private handleDoubleClickEdit(blockId: BlockId): void {
        this.logger.logUserInteraction('double_click_edit', 'handleDoubleClickEdit', {
            blockId: String(blockId)
        });

        // Switch to raw mode for editing
        this.setBlockPreviewMode(blockId, 'raw', 'doubleClick').catch(error => {
            this.logger.logError(error as Error, 'handleDoubleClickEdit', {
                blockId: String(blockId)
            });
        });
    }

    /**
     * Setup hover-to-scroll functionality for preview content
     * @param container - The rendered content container element
     * @returns The final container element (may be a clone if listeners were reset)
     * @private
     */
    private setupHoverScrolling(container: HTMLElement): HTMLElement {
        // Remove any existing event listeners by cloning the element
        const parent = container.parentElement;
        if (parent) {
            const newContainer = container.cloneNode(true) as HTMLElement;
            parent.replaceChild(newContainer, container);
            container = newContainer;
        }

        // Only enable scrolling if content is actually scrollable
        const enableScrolling = () => {
            return container.scrollHeight > container.clientHeight;
        };

        let isHovering = false;

        // Check if scrolling is available and update UI accordingly
        const updateScrollState = () => {
            if (enableScrolling()) {
                container.setAttribute('title', 'Use mouse wheel to scroll, double-click to edit');
                container.style.cursor = 'default';
            } else {
                container.setAttribute('title', 'Double-click to edit');
                container.style.cursor = 'pointer';
            }
        };

        // Initial state check - wait for DOM updates and CSS to apply
        setTimeout(() => {
            updateScrollState();
        }, 100);

        // Mouse enter - start monitoring for scroll
        container.addEventListener('mouseenter', () => {
            isHovering = true;
            updateScrollState();
        });

        // Mouse leave - cleanup
        container.addEventListener('mouseleave', () => {
            isHovering = false;
            container.style.cursor = 'pointer';
            container.setAttribute('title', 'Double-click to edit');
        });

        // Mouse wheel - intercept scroll events to scroll content instead of zoom
        container.addEventListener('wheel', (e: WheelEvent) => {
            if (!isHovering || !enableScrolling()) return;

            // Prevent the default zoom behavior
            e.preventDefault();
            e.stopPropagation();

            // Get scroll direction and amount from wheel event
            const deltaY = e.deltaY;
            const scrollAmount = deltaY; // Match native textarea scroll speed (no multiplier)

            // Apply scroll to the container
            const newScrollTop = container.scrollTop + scrollAmount;
            container.scrollTop = Math.max(0, Math.min(newScrollTop, container.scrollHeight - container.clientHeight));
        }, { passive: false }); // passive: false allows preventDefault

        // Handle content changes that might affect scrollability
        const observer = new MutationObserver(() => {
            updateScrollState();
        });
        
        observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true
        });

        return container;
    }

    /**
     * Validate block ID
     * @private
     */
    private isValidBlockId(blockId: BlockId): boolean {
        return typeof blockId === 'string' && blockId.length > 0;
    }

    /**
     * Validate preview state object
     * @private
     */
    private isValidPreviewState(state: unknown): state is BlockPreviewState {
        return typeof state === 'object' &&
               state !== null &&
               typeof (state as BlockPreviewState).blockId === 'string' &&
               ['raw', 'rendered'].includes((state as BlockPreviewState).displayMode) &&
               typeof (state as BlockPreviewState).lastToggleTime === 'number' &&
               typeof (state as BlockPreviewState).isUserPreference === 'boolean';
    }
}