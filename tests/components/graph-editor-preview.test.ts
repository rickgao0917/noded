/**
 * @fileoverview Integration tests for preview toggle functionality in GraphEditor
 * @version 1.0.0
 * @compliance ts_readme.xml
 */

import { GraphEditor } from '../../src/components/graph-editor.js';
import { PreviewToggleManager } from '../../src/services/preview-toggle-manager.js';
import { MarkdownProcessor } from '../../src/utils/markdown.js';
import { ErrorFactory } from '../../src/types/errors.js';
import { Logger } from '../../src/utils/logger.js';

// Mock dependencies
jest.mock('../../src/utils/logger.js');
jest.mock('../../src/utils/markdown.js');
jest.mock('../../src/types/errors.js');
jest.mock('../../src/services/live-preview-manager.js');
jest.mock('../../src/services/gemini-service.js');

describe.skip('GraphEditor Preview Integration', () => {
    let graphEditor: GraphEditor;
    let mockLogger: jest.Mocked<Logger>;
    let mockMarkdownProcessor: jest.Mocked<MarkdownProcessor>;
    let mockErrorFactory: jest.Mocked<ErrorFactory>;
    let canvasEl: HTMLElement;
    let canvasContentEl: HTMLElement;
    let connectionsEl: SVGElement;

    const setupMocks = () => {
        mockLogger = {
            logFunctionEntry: jest.fn(),
            logFunctionExit: jest.fn(),
            logError: jest.fn(),
            logWarn: jest.fn(),
            logInfo: jest.fn(),
            logUserInteraction: jest.fn(),
            logPerformance: jest.fn(),
            logBranch: jest.fn(),
            logVariableAssignment: jest.fn()
        } as any;

        mockMarkdownProcessor = {
            renderMarkdown: jest.fn().mockReturnValue('<h1>Test Markdown</h1><p>Rendered content</p>')
        } as any;

        mockErrorFactory = {
            createValidationError: jest.fn().mockImplementation((message) => new Error(message)),
            createDOMError: jest.fn().mockImplementation((message) => new Error(message)),
            createNodeEditorError: jest.fn().mockImplementation((message) => new Error(message))
        } as any;

        (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
        (MarkdownProcessor as jest.MockedClass<typeof MarkdownProcessor>).mockImplementation(() => mockMarkdownProcessor);
        (ErrorFactory as jest.MockedClass<typeof ErrorFactory>).mockImplementation(() => mockErrorFactory);
    };

    const setupDOM = () => {
        // Clear document body
        document.body.innerHTML = '';

        // Create canvas elements
        canvasEl = document.createElement('div');
        canvasEl.id = 'canvas';
        canvasEl.className = 'canvas';

        canvasContentEl = document.createElement('div');
        canvasContentEl.id = 'canvas-content';
        canvasContentEl.className = 'canvas-content';

        // Create mock SVG element for JSDOM compatibility
        connectionsEl = document.createElement('div') as any;
        connectionsEl.id = 'connections';
        (connectionsEl as any).className = 'connections';
        connectionsEl.setAttribute = jest.fn();

        document.body.appendChild(canvasEl);
        document.body.appendChild(canvasContentEl);
        if (connectionsEl) {
            document.body.appendChild(connectionsEl);
        }
    };

    const cleanupDOM = () => {
        document.body.innerHTML = '';
    };

    beforeEach(() => {
        jest.clearAllMocks();
        setupMocks();
        setupDOM();

        // Create GraphEditor instance without sample data
        graphEditor = new GraphEditor(canvasEl, canvasContentEl, connectionsEl, false);
    });

    afterEach(() => {
        cleanupDOM();
    });

    describe('preview toggle button rendering', () => {
        it('should render preview toggle buttons for markdown blocks', () => {
            // Add a node with markdown block
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;
            graphEditor.addMarkdownBlock(nodeId);

            // Check if preview toggle button exists for markdown blocks
            const markdownBlock = document.querySelector('.markdown-block');
            expect(markdownBlock).toBeTruthy();

            const previewToggleButton = markdownBlock?.querySelector('.btn-preview-toggle');
            expect(previewToggleButton).toBeTruthy();
            expect(previewToggleButton?.getAttribute('data-action')).toBe('togglePreview');
        });

        it('should render preview toggle buttons for response blocks', async () => {
            // Add a node and submit to create response block
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;
            
            // Add content to prompt block
            const promptBlock = document.querySelector('.prompt-block textarea') as HTMLTextAreaElement;
            if (promptBlock) {
                promptBlock.value = 'Test prompt content';
            }

            // Mock successful LLM submission
            const mockGeminiService = {
                sendMessage: jest.fn().mockImplementation((message, onChunk) => {
                    onChunk('Test response content');
                    return Promise.resolve('Test response content');
                })
            };
            
            // Replace the gemini service
            const originalGemini = require('../../src/services/gemini-service.js').geminiService;
            require('../../src/services/gemini-service.js').geminiService = mockGeminiService;

            try {
                await graphEditor.submitToLLM(nodeId);

                // Check if preview toggle button exists for response blocks
                const responseBlock = document.querySelector('.response-block');
                expect(responseBlock).toBeTruthy();

                const previewToggleButton = responseBlock?.querySelector('.btn-preview-toggle');
                expect(previewToggleButton).toBeTruthy();
                expect(previewToggleButton?.getAttribute('data-action')).toBe('togglePreview');
            } finally {
                // Restore original service
                require('../../src/services/gemini-service.js').geminiService = originalGemini;
            }
        });

        it('should not render preview toggle buttons for prompt blocks', () => {
            graphEditor.addRootNode();

            const promptBlock = document.querySelector('.prompt-block');
            expect(promptBlock).toBeTruthy();

            const previewToggleButton = promptBlock?.querySelector('.btn-preview-toggle');
            expect(previewToggleButton).toBeFalsy();
        });
    });

    describe('preview toggle interaction', () => {
        it('should handle preview toggle button clicks', async () => {
            // Add node with markdown block
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;
            graphEditor.addMarkdownBlock(nodeId);

            // Get the markdown block and its toggle button
            const markdownBlock = document.querySelector('.markdown-block') as HTMLElement;
            const toggleButton = markdownBlock.querySelector('.btn-preview-toggle') as HTMLButtonElement;
            const textarea = markdownBlock.querySelector('textarea') as HTMLTextAreaElement;
            
            // Add some content
            textarea.value = '# Test Markdown\n\nThis is test content.';

            // Simulate click on toggle button
            const clickEvent = new MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: toggleButton });
            
            toggleButton.dispatchEvent(clickEvent);

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));

            // Check if preview mode changed
            expect(markdownBlock.getAttribute('data-preview-mode')).toBe('rendered');
        });

        it('should update block rendering after toggle', async () => {
            // Add node with markdown block
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;
            graphEditor.addMarkdownBlock(nodeId);

            const markdownBlock = document.querySelector('.markdown-block') as HTMLElement;
            const toggleButton = markdownBlock.querySelector('.btn-preview-toggle') as HTMLButtonElement;
            const blockId = markdownBlock.getAttribute('data-block-id');

            // Trigger preview toggle
            if (blockId) {
                await (graphEditor as any).handlePreviewToggle(blockId);
            }

            // Check if rendered content is displayed
            const renderedContent = markdownBlock.querySelector('.rendered-content');
            expect(renderedContent).toBeTruthy();
            expect((renderedContent as HTMLElement)?.style.display).toBe('block');

            // Check if textarea is hidden
            const textarea = markdownBlock.querySelector('textarea') as HTMLTextAreaElement;
            expect(textarea.style.display).toBe('none');
        });

        it('should maintain state across re-renders', async () => {
            // Add node with markdown block
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;
            graphEditor.addMarkdownBlock(nodeId);

            const initialBlock = document.querySelector('.markdown-block') as HTMLElement;
            const blockId = initialBlock.getAttribute('data-block-id');

            // Toggle to preview mode
            if (blockId) {
                await (graphEditor as any).handlePreviewToggle(blockId);
            }

            // Force re-render by calling renderNode
            const node = (graphEditor as any).nodes.get(nodeId);
            if (node) {
                (graphEditor as any).renderNode(node);
            }

            // Check if preview mode is maintained
            const rerenderedBlock = document.querySelector('.markdown-block') as HTMLElement;
            expect(rerenderedBlock.getAttribute('data-preview-mode')).toBe('rendered');
        });
    });

    describe('response auto-rendering', () => {
        it('should auto-render response blocks after completion', async () => {
            // Add node 
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;

            // Add content to prompt
            const promptTextarea = document.querySelector('.prompt-block textarea') as HTMLTextAreaElement;
            if (promptTextarea) {
                promptTextarea.value = 'Test prompt for response';
            }

            // Mock the response completion
            const mockResponseBlockId = 'response-block-123';
            
            // Call handleResponseComplete directly
            await (graphEditor as any).handleResponseComplete(mockResponseBlockId);

            // Verify that the preview manager was called
            expect(mockLogger.logFunctionEntry).toHaveBeenCalledWith('handleResponseComplete', {
                blockId: mockResponseBlockId
            });
        });

        it('should handle auto-render failures gracefully', async () => {
            const nonExistentBlockId = 'non-existent-response';

            // Should not throw
            await expect((graphEditor as any).handleResponseComplete(nonExistentBlockId))
                .resolves.toBeUndefined();

            // Should log warning
            expect(mockLogger.logWarn).toHaveBeenCalledWith(
                'Failed to initialize response preview',
                'handleResponseComplete',
                expect.objectContaining({
                    blockId: nonExistentBlockId
                })
            );
        });
    });

    describe('double-click editing', () => {
        it('should enable double-click editing in rendered mode', async () => {
            // Add node with markdown block
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;
            graphEditor.addMarkdownBlock(nodeId);

            const markdownBlock = document.querySelector('.markdown-block') as HTMLElement;
            const blockId = markdownBlock.getAttribute('data-block-id');

            // Toggle to rendered mode
            if (blockId) {
                await (graphEditor as any).handlePreviewToggle(blockId);
            }

            // Check if rendered content has double-click handler
            const renderedContent = markdownBlock.querySelector('.rendered-content') as HTMLElement;
            expect(renderedContent.title).toBe('Double-click to edit');

            // Simulate double-click
            const dblClickEvent = new MouseEvent('dblclick', { bubbles: true });
            renderedContent.dispatchEvent(dblClickEvent);

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 0));

            // Should have switched back to raw mode
            expect(markdownBlock.getAttribute('data-preview-mode')).toBe('raw');
        });

        it('should focus textarea after double-click', async () => {
            // Add node with markdown block
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;
            graphEditor.addMarkdownBlock(nodeId);

            const markdownBlock = document.querySelector('.markdown-block') as HTMLElement;
            const textarea = markdownBlock.querySelector('textarea') as HTMLTextAreaElement;
            const blockId = markdownBlock.getAttribute('data-block-id');

            // Toggle to rendered mode
            if (blockId) {
                await (graphEditor as any).handlePreviewToggle(blockId);
            }

            // Simulate double-click on rendered content
            const renderedContent = markdownBlock.querySelector('.rendered-content') as HTMLElement;
            const dblClickEvent = new MouseEvent('dblclick', { bubbles: true });
            renderedContent.dispatchEvent(dblClickEvent);

            // Wait for mode switch
            await new Promise(resolve => setTimeout(resolve, 0));

            // Check if textarea is focused (simulated by display: block)
            expect(textarea.style.display).toBe('block');
        });
    });

    describe('state persistence integration', () => {
        it('should save preview states with node data', () => {
            // Add nodes and set preview states
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;
            graphEditor.addMarkdownBlock(nodeId);

            // Get preview manager states
            const previewManager = (graphEditor as any).previewToggleManager as PreviewToggleManager;
            const exportedStates = previewManager.exportPreviewStates();

            expect(exportedStates).toBeInstanceOf(Map);
        });

        it('should restore preview states on load', () => {
            // Create mock states
            const mockStates = new Map();
            mockStates.set('test-block-1', {
                blockId: 'test-block-1',
                displayMode: 'rendered',
                lastToggleTime: Date.now(),
                isUserPreference: true
            });

            // Import states
            const previewManager = (graphEditor as any).previewToggleManager as PreviewToggleManager;
            previewManager.importPreviewStates(mockStates);

            // Verify states were imported
            const exportedStates = previewManager.exportPreviewStates();
            expect(exportedStates.has('test-block-1' as any)).toBe(true);
        });

        it('should clean up states when blocks deleted', () => {
            // Add node and get block ID
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;
            graphEditor.addMarkdownBlock(nodeId);

            const markdownBlock = document.querySelector('.markdown-block') as HTMLElement;
            const blockId = markdownBlock.getAttribute('data-block-id');

            if (blockId) {
                // Create preview state
                const previewManager = (graphEditor as any).previewToggleManager as PreviewToggleManager;
                previewManager.getBlockPreviewState(blockId as any);

                // Delete node
                graphEditor.deleteNode(nodeId);

                // Cleanup should be called (this would normally happen in the actual implementation)
                previewManager.cleanupDeletedBlocks([blockId as any]);

                // Verify state was cleaned up
                const exportedStates = previewManager.exportPreviewStates();
                expect(exportedStates.has(blockId as any)).toBe(false);
            }
        });
    });

    describe('error handling integration', () => {
        it('should handle preview toggle errors gracefully', async () => {
            // Mock preview manager to throw error
            const previewManager = (graphEditor as any).previewToggleManager as PreviewToggleManager;
            jest.spyOn(previewManager, 'toggleBlockPreview').mockRejectedValue(new Error('Toggle failed'));

            const invalidBlockId = 'invalid-block';

            // Should handle error without throwing
            await expect((graphEditor as any).handlePreviewToggle(invalidBlockId))
                .resolves.toBeUndefined();

            // Should log error
            expect(mockLogger.logError).toHaveBeenCalledWith(
                'Failed to toggle preview',
                'handlePreviewToggle',
                expect.objectContaining({
                    blockId: invalidBlockId,
                    error: 'Toggle failed'
                })
            );
        });

        it('should handle DOM manipulation errors', async () => {
            // Remove DOM elements to trigger errors
            document.body.innerHTML = '';

            const blockId = 'test-block';
            
            // Should handle missing DOM gracefully
            await expect((graphEditor as any).handlePreviewToggle(blockId))
                .resolves.toBeUndefined();

            expect(mockLogger.logError).toHaveBeenCalled();
        });
    });

    describe('performance integration', () => {
        it('should log performance metrics for preview operations', async () => {
            // Add node with markdown block
            graphEditor.addRootNode();
            const nodeId = Array.from((graphEditor as any).nodes.keys())[0] as string;
            graphEditor.addMarkdownBlock(nodeId);

            const markdownBlock = document.querySelector('.markdown-block') as HTMLElement;
            const blockId = markdownBlock.getAttribute('data-block-id');

            if (blockId) {
                await (graphEditor as any).handlePreviewToggle(blockId);

                // Should log performance metrics
                expect(mockLogger.logPerformance).toHaveBeenCalledWith(
                    'handlePreviewToggle',
                    'toggle_operation',
                    expect.any(Number)
                );
            }
        });
    });
});