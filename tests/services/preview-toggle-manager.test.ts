/**
 * @fileoverview Comprehensive test suite for PreviewToggleManager service
 * @version 1.0.0
 * @compliance ts_readme.xml
 */

import { PreviewToggleManager } from '../../src/services/preview-toggle-manager.js';
import { MarkdownProcessor } from '../../src/utils/markdown.js';
import { ErrorFactory } from '../../src/types/errors.js';
import { Logger } from '../../src/utils/logger.js';
import type { 
    BlockPreviewState, 
    PreviewDisplayMode, 
    PreviewConfig 
} from '../../src/types/preview.types.js';
import type { BlockId } from '../../src/types/branded.types.js';

// Mock dependencies
jest.mock('../../src/utils/logger.js');
jest.mock('../../src/utils/markdown.js');
jest.mock('../../src/types/errors.js');

describe('PreviewToggleManager', () => {
    let previewManager: PreviewToggleManager;
    let mockLogger: jest.Mocked<Logger>;
    let mockMarkdownProcessor: jest.Mocked<MarkdownProcessor>;
    let mockErrorFactory: jest.Mocked<ErrorFactory>;

    // Test DOM setup
    const createTestBlockElement = (blockId: string, blockType: string = 'markdown'): HTMLElement => {
        const blockEl = document.createElement('div');
        blockEl.className = `block ${blockType}-block`;
        blockEl.setAttribute('data-block-id', blockId);
        blockEl.setAttribute('data-preview-mode', 'raw');

        const textarea = document.createElement('textarea');
        textarea.value = '# Test Markdown\n\nThis is test content.';
        blockEl.appendChild(textarea);

        const toggleButton = document.createElement('button');
        toggleButton.className = 'btn-preview-toggle';
        toggleButton.setAttribute('data-action', 'togglePreview');
        toggleButton.setAttribute('data-block-id', blockId);
        blockEl.appendChild(toggleButton);

        document.body.appendChild(blockEl);
        return blockEl;
    };

    const cleanupDOM = (): void => {
        document.body.innerHTML = '';
    };

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup mock logger
        mockLogger = {
            logFunctionEntry: jest.fn(),
            logFunctionExit: jest.fn(),
            logError: jest.fn(),
            logWarn: jest.fn(),
            logInfo: jest.fn(),
            logUserInteraction: jest.fn(),
            logPerformance: jest.fn()
        } as any;

        // Setup mock markdown processor
        mockMarkdownProcessor = {
            renderMarkdown: jest.fn().mockReturnValue('<h1>Test Markdown</h1><p>This is test content.</p>')
        } as any;

        // Setup mock error factory
        mockErrorFactory = {
            createValidationError: jest.fn().mockImplementation((message) => new Error(message)),
            createDOMError: jest.fn().mockImplementation((message) => new Error(message)),
            createNodeEditorError: jest.fn().mockImplementation((message) => new Error(message))
        } as any;

        // Setup constructor mocks
        (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
        (MarkdownProcessor as jest.MockedClass<typeof MarkdownProcessor>).mockImplementation(() => mockMarkdownProcessor);
        (ErrorFactory as jest.MockedClass<typeof ErrorFactory>).mockImplementation(() => mockErrorFactory);

        // Cleanup DOM before each test
        cleanupDOM();

        // Create instance
        previewManager = new PreviewToggleManager(
            mockMarkdownProcessor,
            mockErrorFactory
        );
    });

    afterEach(() => {
        cleanupDOM();
    });

    describe('constructor', () => {
        it('should initialize with default config', () => {
            const manager = new PreviewToggleManager();
            expect(Logger).toHaveBeenCalledWith('PreviewToggleManager');
        });

        it('should initialize with custom config', () => {
            const customConfig: Partial<PreviewConfig> = {
                enableDoubleClickEdit: false,
                autoRenderResponses: false
            };

            const manager = new PreviewToggleManager(
                mockMarkdownProcessor,
                mockErrorFactory,
                customConfig
            );

            expect(Logger).toHaveBeenCalledWith('PreviewToggleManager');
        });

        it('should use provided dependencies', () => {
            expect(previewManager).toBeDefined();
            expect(mockLogger.logFunctionEntry).toHaveBeenCalledWith('constructor', expect.any(Object));
            expect(mockLogger.logFunctionExit).toHaveBeenCalledWith('constructor', { initialized: true });
        });
    });

    describe('getBlockPreviewState', () => {
        it('should return default state for new block', () => {
            const blockId = 'test-block-1' as BlockId;
            const state = previewManager.getBlockPreviewState(blockId);

            expect(state).toEqual({
                blockId,
                displayMode: 'raw',
                lastToggleTime: expect.any(Number),
                isUserPreference: false
            });

            expect(mockLogger.logFunctionEntry).toHaveBeenCalledWith('getBlockPreviewState', {
                blockId: 'test-block-1'
            });
            expect(mockLogger.logFunctionExit).toHaveBeenCalledWith('getBlockPreviewState', {
                found: false,
                defaultMode: 'raw'
            });
        });

        it('should return cached state for existing block', () => {
            const blockId = 'test-block-2' as BlockId;
            
            // First call creates default state
            const firstState = previewManager.getBlockPreviewState(blockId);
            
            // Second call should return cached state
            const secondState = previewManager.getBlockPreviewState(blockId);

            expect(secondState).toBe(firstState);
            expect(mockLogger.logFunctionExit).toHaveBeenLastCalledWith('getBlockPreviewState', {
                found: true,
                mode: 'raw'
            });
        });
    });

    describe('toggleBlockPreview', () => {
        it('should toggle from raw to rendered mode', async () => {
            const blockId = 'test-block-3' as BlockId;
            const blockEl = createTestBlockElement(blockId);

            const result = await previewManager.toggleBlockPreview(blockId);

            expect(result.displayMode).toBe('rendered');
            expect(result.isUserPreference).toBe(true);
            expect(blockEl.getAttribute('data-preview-mode')).toBe('rendered');
            expect(mockMarkdownProcessor.renderMarkdown).toHaveBeenCalled();
        });

        it('should toggle from rendered to raw mode', async () => {
            const blockId = 'test-block-4' as BlockId;
            const blockEl = createTestBlockElement(blockId);

            // First toggle to rendered
            await previewManager.toggleBlockPreview(blockId);
            
            // Second toggle back to raw
            const result = await previewManager.toggleBlockPreview(blockId);

            expect(result.displayMode).toBe('raw');
            expect(blockEl.getAttribute('data-preview-mode')).toBe('raw');
        });

        it('should handle validation errors', async () => {
            const invalidBlockId = '' as BlockId;

            await expect(previewManager.toggleBlockPreview(invalidBlockId))
                .rejects.toThrow();

            expect(mockErrorFactory.createValidationError).toHaveBeenCalledWith(
                'blockId',
                '',
                'valid block ID',
                'toggleBlockPreview'
            );
        });

        it('should handle DOM element not found', async () => {
            const blockId = 'non-existent-block' as BlockId;

            await expect(previewManager.toggleBlockPreview(blockId))
                .rejects.toThrow();

            expect(mockErrorFactory.createDOMError).toHaveBeenCalledWith(
                'Block element not found in DOM',
                'DOM_ELEMENT_MISSING',
                'Block element not found',
                'applyPreviewMode'
            );
        });

        it('should update button icons correctly', async () => {
            const blockId = 'test-block-5' as BlockId;
            const blockEl = createTestBlockElement(blockId);
            const button = blockEl.querySelector('.btn-preview-toggle') as HTMLButtonElement;

            // Toggle to rendered mode
            await previewManager.toggleBlockPreview(blockId);
            expect(button.innerHTML).toBe('👁️');
            expect(button.title).toBe('Show raw content');

            // Toggle back to raw mode
            await previewManager.toggleBlockPreview(blockId);
            expect(button.innerHTML).toBe('📝');
            expect(button.title).toBe('Show rendered content');
        });
    });

    describe('setBlockPreviewMode', () => {
        it('should set specific preview mode', async () => {
            const blockId = 'test-block-6' as BlockId;
            createTestBlockElement(blockId);

            const result = await previewManager.setBlockPreviewMode(blockId, 'rendered', 'button');

            expect(result.displayMode).toBe('rendered');
            expect(result.isUserPreference).toBe(true);
            expect(mockLogger.logUserInteraction).toHaveBeenCalledWith(
                'preview_toggle',
                'setBlockPreviewMode',
                expect.objectContaining({
                    blockId,
                    previousMode: 'raw',
                    newMode: 'rendered',
                    triggeredBy: 'button'
                })
            );
        });

        it('should not change when mode already set', async () => {
            const blockId = 'test-block-7' as BlockId;
            createTestBlockElement(blockId);

            // Set to rendered mode
            const firstResult = await previewManager.setBlockPreviewMode(blockId, 'rendered');
            
            // Try to set to rendered mode again
            const secondResult = await previewManager.setBlockPreviewMode(blockId, 'rendered');

            expect(secondResult).toBe(firstResult);
            expect(mockLogger.logInfo).toHaveBeenCalledWith(
                'Preview mode already set',
                'setBlockPreviewMode',
                { blockId: 'test-block-7', mode: 'rendered' }
            );
        });

        it('should handle API vs user triggered changes', async () => {
            const blockId = 'test-block-8' as BlockId;
            createTestBlockElement(blockId);

            // API triggered change
            const apiResult = await previewManager.setBlockPreviewMode(blockId, 'rendered', 'api');
            expect(apiResult.isUserPreference).toBe(false);

            // User triggered change
            const userResult = await previewManager.setBlockPreviewMode(blockId, 'raw', 'button');
            expect(userResult.isUserPreference).toBe(true);
        });
    });

    describe('initializeResponseBlockPreview', () => {
        it('should not auto-render when disabled by default', async () => {
            // Create a new instance with explicit config to ensure auto-render is disabled
            const disabledManager = new PreviewToggleManager(
                mockMarkdownProcessor,
                mockErrorFactory,
                { autoRenderResponses: false }
            );
            
            const blockId = 'response-block-1' as BlockId;
            createTestBlockElement(blockId, 'response');

            await disabledManager.initializeResponseBlockPreview(blockId);

            const state = disabledManager.getBlockPreviewState(blockId);
            expect(state.displayMode).toBe('raw'); // Should stay in raw mode
        });

        it('should handle errors gracefully', async () => {
            const blockId = 'non-existent-response' as BlockId;

            // Should not throw even if block doesn't exist
            await expect(previewManager.initializeResponseBlockPreview(blockId))
                .resolves.toBeUndefined();

            expect(mockLogger.logWarn).toHaveBeenCalledWith(
                'Failed to initialize response block preview',
                'initializeResponseBlockPreview',
                expect.objectContaining({
                    blockId: 'non-existent-response'
                })
            );
        });
    });

    describe('DOM manipulation', () => {
        it('should show rendered content correctly', async () => {
            const blockId = 'test-dom-1' as BlockId;
            const blockEl = createTestBlockElement(blockId);

            await previewManager.setBlockPreviewMode(blockId, 'rendered');

            const textarea = blockEl.querySelector('textarea') as HTMLTextAreaElement;
            const renderedContainer = blockEl.querySelector('.rendered-content') as HTMLElement;

            expect(textarea.style.display).toBe('none');
            expect(renderedContainer.style.display).toBe('block');
            expect(renderedContainer.innerHTML).toBe('<h1>Test Markdown</h1><p>This is test content.</p>');
            expect(renderedContainer.title).toBe('Double-click to edit');
        });

        it('should show raw content correctly', async () => {
            const blockId = 'test-dom-2' as BlockId;
            const blockEl = createTestBlockElement(blockId);

            // First set to rendered
            await previewManager.setBlockPreviewMode(blockId, 'rendered');
            
            // Then back to raw
            await previewManager.setBlockPreviewMode(blockId, 'raw');

            const textarea = blockEl.querySelector('textarea') as HTMLTextAreaElement;
            const renderedContainer = blockEl.querySelector('.rendered-content') as HTMLElement;

            expect(textarea.style.display).toBe('block');
            expect(renderedContainer.style.display).toBe('none');
        });

        it('should handle missing DOM elements', async () => {
            const blockId = 'test-dom-3' as BlockId;
            const blockEl = createTestBlockElement(blockId);
            
            // Remove textarea to simulate missing element
            blockEl.querySelector('textarea')?.remove();

            await expect(previewManager.setBlockPreviewMode(blockId, 'rendered'))
                .rejects.toThrow();

            expect(mockErrorFactory.createDOMError).toHaveBeenCalledWith(
                'Textarea not found in block',
                'TEXTAREA_MISSING',
                'Textarea element not found',
                'showRenderedContent'
            );
        });

        it('should add double-click handlers', async () => {
            const blockId = 'test-dom-4' as BlockId;
            const blockEl = createTestBlockElement(blockId);

            await previewManager.setBlockPreviewMode(blockId, 'rendered');

            const renderedContainer = blockEl.querySelector('.rendered-content') as HTMLElement;
            
            // Simulate double-click
            const event = new MouseEvent('dblclick', { bubbles: true });
            renderedContainer.dispatchEvent(event);

            expect(mockLogger.logUserInteraction).toHaveBeenCalledWith(
                'double_click_edit',
                'handleDoubleClickEdit',
                { blockId: 'test-dom-4' }
            );
        });
    });

    describe('state persistence', () => {
        it('should export preview states', () => {
            const blockId1 = 'export-test-1' as BlockId;
            const blockId2 = 'export-test-2' as BlockId;

            // Create some states
            previewManager.getBlockPreviewState(blockId1);
            previewManager.getBlockPreviewState(blockId2);

            const exported = previewManager.exportPreviewStates();

            expect(exported.size).toBe(2);
            expect(exported.has(blockId1)).toBe(true);
            expect(exported.has(blockId2)).toBe(true);
        });

        it('should import preview states', () => {
            const importStates = new Map<BlockId, BlockPreviewState>();
            const blockId = 'import-test-1' as BlockId;
            
            importStates.set(blockId, {
                blockId,
                displayMode: 'rendered',
                lastToggleTime: Date.now(),
                isUserPreference: true
            });

            previewManager.importPreviewStates(importStates);

            const state = previewManager.getBlockPreviewState(blockId);
            expect(state.displayMode).toBe('rendered');
            expect(state.isUserPreference).toBe(true);
        });

        it('should handle import validation errors', () => {
            const invalidStates = new Map<BlockId, any>();
            invalidStates.set('invalid-block' as BlockId, { invalid: 'state' });

            expect(() => previewManager.importPreviewStates(invalidStates)).not.toThrow();
            
            expect(mockLogger.logWarn).toHaveBeenCalledWith(
                'Invalid preview state during import',
                'importPreviewStates',
                { blockId: 'invalid-block' }
            );
        });
    });

    describe('cleanup', () => {
        it('should clean up deleted blocks', () => {
            const blockId1 = 'cleanup-test-1' as BlockId;
            const blockId2 = 'cleanup-test-2' as BlockId;
            const blockId3 = 'cleanup-test-3' as BlockId;

            // Create some states
            previewManager.getBlockPreviewState(blockId1);
            previewManager.getBlockPreviewState(blockId2);
            previewManager.getBlockPreviewState(blockId3);

            // Clean up some blocks
            previewManager.cleanupDeletedBlocks([blockId1, blockId3]);

            const exportedStates = previewManager.exportPreviewStates();
            expect(exportedStates.has(blockId1)).toBe(false);
            expect(exportedStates.has(blockId2)).toBe(true);
            expect(exportedStates.has(blockId3)).toBe(false);
        });

        it('should handle non-existent blocks', () => {
            const nonExistentBlocks = ['non-existent-1', 'non-existent-2'] as BlockId[];

            expect(() => previewManager.cleanupDeletedBlocks(nonExistentBlocks)).not.toThrow();
            
            expect(mockLogger.logFunctionExit).toHaveBeenCalledWith('cleanupDeletedBlocks', {
                cleanedCount: 0,
                remainingStates: 0
            });
        });
    });

    describe('performance monitoring', () => {
        it('should log toggle operation metrics', async () => {
            const blockId = 'perf-test-1' as BlockId;
            createTestBlockElement(blockId);

            await previewManager.toggleBlockPreview(blockId);

            expect(mockLogger.logPerformance).toHaveBeenCalledWith(
                'toggleBlockPreview',
                'toggle_operation',
                expect.any(Number)
            );
        });

        it('should log DOM update metrics', async () => {
            const blockId = 'perf-test-2' as BlockId;
            createTestBlockElement(blockId);

            await previewManager.setBlockPreviewMode(blockId, 'rendered');

            expect(mockLogger.logPerformance).toHaveBeenCalledWith(
                'setBlockPreviewMode',
                'mode_change',
                expect.any(Number)
            );
        });
    });

    describe('error handling', () => {
        it('should handle markdown rendering errors', async () => {
            const blockId = 'error-test-1' as BlockId;
            createTestBlockElement(blockId);

            // Mock markdown processor to throw error
            mockMarkdownProcessor.renderMarkdown.mockImplementation(() => {
                throw new Error('Markdown rendering failed');
            });

            await expect(previewManager.setBlockPreviewMode(blockId, 'rendered'))
                .rejects.toThrow('Markdown rendering failed');
        });

        it('should handle DOM manipulation errors', async () => {
            const blockId = 'error-test-2' as BlockId;
            
            // Don't create DOM element to trigger error
            await expect(previewManager.toggleBlockPreview(blockId))
                .rejects.toThrow();

            expect(mockLogger.logError).toHaveBeenCalledWith(
                expect.any(Error),
                'toggleBlockPreview',
                expect.objectContaining({
                    blockId: 'error-test-2'
                })
            );
        });

        it('should provide user-friendly error messages', async () => {
            const blockId = 'error-test-3' as BlockId;

            await expect(previewManager.toggleBlockPreview(blockId))
                .rejects.toThrow();

            // Verify error factory was called for user-friendly error
            expect(mockErrorFactory.createDOMError).toHaveBeenCalled();
        });
    });
});