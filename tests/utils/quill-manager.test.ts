/**
 * Tests for Quill Manager utility
 */

import { QuillManager } from '../../src/utils/quill-manager';
import { Logger } from '../../src/utils/logger';

// Mock the Logger module
jest.mock('../../src/utils/logger');

describe('QuillManager Utility', () => {
  let manager: QuillManager;
  let mockLogger: jest.Mocked<Logger>;
  let mockQuillInstance: any;
  let mockQuill: any;
  let originalWindow: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock logger
    mockLogger = {
      logFunctionEntry: jest.fn(),
      logFunctionExit: jest.fn(),
      logInfo: jest.fn(),
      logWarn: jest.fn(),
      logError: jest.fn(),
      logPerformance: jest.fn()
    } as any;
    
    // Mock Logger constructor
    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    
    // Mock Quill instance
    mockQuillInstance = {
      root: {
        innerHTML: '',
        textContent: ''
      },
      container: document.createElement('div'),
      getText: jest.fn(() => 'mock text'),
      setContents: jest.fn(),
      on: jest.fn(),
      enable: jest.fn()
    };
    
    // Store original window
    originalWindow = global.window;
    
    // Mock Quill constructor
    mockQuill = jest.fn(() => mockQuillInstance);
    
    // Define Quill on the global window object BEFORE creating manager
    Object.defineProperty(window, 'Quill', {
      value: mockQuill,
      writable: true,
      configurable: true
    });
    
    // Also set it on global for consistency
    (global as any).window = {
      ...global.window,
      Quill: mockQuill
    };
    
    // Create manager instance AFTER setting up window.Quill
    manager = new QuillManager();
  });

  afterEach(() => {
    // Restore original window
    (global as any).window = originalWindow;
    // Also delete the property we added
    if (window.hasOwnProperty('Quill')) {
      delete (window as any).Quill;
    }
  });

  describe('createEditor', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      container.id = 'test-container';
    });

    it('should create a Quill editor instance', () => {
      const onChange = jest.fn();
      const result = manager.createEditor('block-1', 'Initial content', container, onChange);
      
      expect(result).toBe(mockQuillInstance);
      expect(mockQuill).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          theme: 'snow',
          placeholder: 'Start typing...',
          modules: expect.objectContaining({
            toolbar: expect.any(Array)
          })
        })
      );
    });

    it('should create editor container element', () => {
      manager.createEditor('block-1', '', container);
      
      const editorContainer = container.querySelector('#quill-editor-block-1');
      expect(editorContainer).toBeTruthy();
    });

    it('should handle plain text content', () => {
      manager.createEditor('block-1', 'Plain text content', container);
      
      expect(mockQuillInstance.setContents).toHaveBeenCalledWith({
        ops: expect.arrayContaining([
          { insert: 'Plain text content' },
          { insert: '\n' }
        ])
      });
    });

    it('should handle HTML content', () => {
      const htmlContent = '<p>HTML content</p>';
      manager.createEditor('block-1', htmlContent, container);
      
      expect(mockQuillInstance.root.innerHTML).toBe(htmlContent);
      expect(mockQuillInstance.setContents).not.toHaveBeenCalled();
    });

    it('should set up change handler', () => {
      const onChange = jest.fn();
      manager.createEditor('block-1', '', container, onChange);
      
      expect(mockQuillInstance.on).toHaveBeenCalledWith('text-change', expect.any(Function));
      
      // Trigger the change handler
      mockQuillInstance.root.innerHTML = '<p>New content</p>';
      mockQuillInstance.getText.mockReturnValue('New content');
      const changeHandler = mockQuillInstance.on.mock.calls[0][1];
      changeHandler();
      
      expect(onChange).toHaveBeenCalledWith('<p>New content</p>');
    });

    it('should destroy existing editor before creating new one', () => {
      // Create first editor
      manager.createEditor('block-1', '', container);
      
      // Create second editor with same ID
      const destroySpy = jest.spyOn(manager, 'destroyEditor').mockImplementation(() => {});
      manager.createEditor('block-1', '', container);
      
      expect(destroySpy).toHaveBeenCalledWith('block-1');
    });

    it('should handle when Quill is not available', () => {
      // Create a new manager with no Quill available
      (global as any).window.Quill = undefined;
      const noQuillManager = new QuillManager();
      
      expect(() => {
        noQuillManager.createEditor('block-1', '', container);
      }).toThrow('Failed to create Quill editor for block block-1');
      
      expect(mockLogger.logError).toHaveBeenCalled();
    });

    it('should handle errors during editor creation', () => {
      mockQuill.mockImplementation(() => {
        throw new Error('Creation error');
      });
      
      expect(() => {
        manager.createEditor('block-1', '', container);
      }).toThrow('Failed to create Quill editor for block block-1');
    });

    it('should log performance metrics', () => {
      const performanceNow = jest.spyOn(performance, 'now');
      performanceNow.mockReturnValueOnce(1000).mockReturnValueOnce(1020);
      
      manager.createEditor('block-1', '', container);
      
      expect(mockLogger.logPerformance).toHaveBeenCalledWith(
        'createEditor',
        'editor_creation',
        20
      );
      
      performanceNow.mockRestore();
    });
  });

  describe('convertMarkdownToDelta', () => {
    it('should convert headers', () => {
      const result = (manager as any).convertMarkdownToDelta('# Header 1\n## Header 2\n### Header 3');
      
      expect(result.ops).toContainEqual({ insert: 'Header 1' });
      expect(result.ops).toContainEqual({ insert: '\n', attributes: { header: 1 } });
      expect(result.ops).toContainEqual({ insert: 'Header 2' });
      expect(result.ops).toContainEqual({ insert: '\n', attributes: { header: 2 } });
      expect(result.ops).toContainEqual({ insert: 'Header 3' });
      expect(result.ops).toContainEqual({ insert: '\n', attributes: { header: 3 } });
    });

    it('should convert blockquotes', () => {
      const result = (manager as any).convertMarkdownToDelta('> Quote text');
      
      expect(result.ops).toContainEqual({ insert: 'Quote text' });
      expect(result.ops).toContainEqual({ insert: '\n', attributes: { blockquote: true } });
    });

    it('should convert lists', () => {
      const result = (manager as any).convertMarkdownToDelta('- Bullet item\n1. Ordered item');
      
      expect(result.ops).toContainEqual({ insert: 'Bullet item' });
      expect(result.ops).toContainEqual({ insert: '\n', attributes: { list: 'bullet' } });
      expect(result.ops).toContainEqual({ insert: 'Ordered item' });
      expect(result.ops).toContainEqual({ insert: '\n', attributes: { list: 'ordered' } });
    });

    it('should skip code fence markers', () => {
      const result = (manager as any).convertMarkdownToDelta('```\ncode\n```');
      
      expect(result.ops).toContainEqual({ insert: 'code' });
      expect(result.ops).toContainEqual({ insert: '\n' });
      expect(result.ops).not.toContainEqual({ insert: '```' });
    });

    it('should handle empty lines', () => {
      const result = (manager as any).convertMarkdownToDelta('Line 1\n\nLine 2');
      
      expect(result.ops).toContainEqual({ insert: 'Line 1' });
      expect(result.ops).toContainEqual({ insert: '\n' });
      expect(result.ops).toContainEqual({ insert: '\n' });
      expect(result.ops).toContainEqual({ insert: 'Line 2' });
    });

    it('should handle inline formatting', () => {
      const result = (manager as any).convertMarkdownToDelta('**bold** *italic* `code`');
      
      expect(result.ops).toContainEqual({ insert: 'bold', attributes: { bold: true } });
      expect(result.ops).toContainEqual({ insert: 'italic', attributes: { italic: true } });
      expect(result.ops).toContainEqual({ insert: 'code', attributes: { code: true } });
    });
  });

  describe('updateContent', () => {
    beforeEach(() => {
      // Create editor first
      const container = document.createElement('div');
      manager.createEditor('block-1', '', container);
    });

    it('should update editor with HTML content', () => {
      const htmlContent = '<p>Updated HTML</p>';
      manager.updateContent('block-1', htmlContent);
      
      expect(mockQuillInstance.root.innerHTML).toBe(htmlContent);
      expect(mockQuillInstance.setContents).not.toHaveBeenCalled();
    });

    it('should update editor with plain text content', () => {
      manager.updateContent('block-1', 'Updated plain text');
      
      expect(mockQuillInstance.setContents).toHaveBeenCalledWith({
        ops: expect.arrayContaining([
          { insert: 'Updated plain text' },
          { insert: '\n' }
        ])
      });
    });

    it('should handle non-existent editor', () => {
      manager.updateContent('non-existent', 'content');
      
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'Editor not found',
        'updateContent',
        { blockId: 'non-existent' }
      );
    });

    it('should handle errors during update', () => {
      mockQuillInstance.setContents.mockImplementation(() => {
        throw new Error('Update error');
      });
      
      manager.updateContent('block-1', 'content');
      
      expect(mockLogger.logError).toHaveBeenCalled();
    });
  });

  describe('getContent', () => {
    beforeEach(() => {
      const container = document.createElement('div');
      manager.createEditor('block-1', '', container);
      mockQuillInstance.root.innerHTML = '<p>Current content</p>';
    });

    it('should return HTML content from editor', () => {
      const result = manager.getContent('block-1');
      
      expect(result).toBe('<p>Current content</p>');
    });

    it('should return empty string for non-existent editor', () => {
      const result = manager.getContent('non-existent');
      
      expect(result).toBe('');
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'Editor not found',
        'getContent',
        { blockId: 'non-existent' }
      );
    });

    it('should handle errors during retrieval', () => {
      // Mock property access to throw
      Object.defineProperty(mockQuillInstance.root, 'innerHTML', {
        get: () => { throw new Error('Access error'); }
      });
      
      const result = manager.getContent('block-1');
      
      expect(result).toBe('');
      expect(mockLogger.logError).toHaveBeenCalled();
    });
  });

  describe('getPlainText', () => {
    beforeEach(() => {
      const container = document.createElement('div');
      manager.createEditor('block-1', '', container);
    });

    it('should return plain text from editor', () => {
      mockQuillInstance.getText.mockReturnValue('Plain text content');
      const result = manager.getPlainText('block-1');
      
      expect(result).toBe('Plain text content');
      expect(mockQuillInstance.getText).toHaveBeenCalled();
    });

    it('should return empty string for non-existent editor', () => {
      const result = manager.getPlainText('non-existent');
      
      expect(result).toBe('');
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'Editor not found',
        'getPlainText',
        { blockId: 'non-existent' }
      );
    });

    it('should handle errors during retrieval', () => {
      mockQuillInstance.getText.mockImplementation(() => {
        throw new Error('Get text error');
      });
      
      const result = manager.getPlainText('block-1');
      
      expect(result).toBe('');
      expect(mockLogger.logError).toHaveBeenCalled();
    });
  });

  describe('destroyEditor', () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      manager.createEditor('block-1', '', container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('should remove editor container from DOM', () => {
      const editorContainer = mockQuillInstance.container;
      editorContainer.parentNode = container;
      container.appendChild(editorContainer);
      
      manager.destroyEditor('block-1');
      
      expect(container.contains(editorContainer)).toBe(false);
    });

    it('should remove editor from internal map', () => {
      manager.destroyEditor('block-1');
      
      // Try to get content - should return empty
      const result = manager.getContent('block-1');
      expect(result).toBe('');
    });

    it('should handle non-existent editor gracefully', () => {
      manager.destroyEditor('non-existent');
      
      // Should not throw
      expect(mockLogger.logError).not.toHaveBeenCalled();
    });

    it('should handle errors during destruction', () => {
      // Make removeChild throw
      Object.defineProperty(mockQuillInstance.container, 'parentNode', {
        get: () => ({
          removeChild: () => { throw new Error('Remove error'); }
        })
      });
      
      manager.destroyEditor('block-1');
      
      expect(mockLogger.logError).toHaveBeenCalled();
    });
  });

  describe('destroyAll', () => {
    beforeEach(() => {
      const container = document.createElement('div');
      manager.createEditor('block-1', '', container);
      manager.createEditor('block-2', '', container);
      manager.createEditor('block-3', '', container);
    });

    it('should destroy all editors', () => {
      const destroySpy = jest.spyOn(manager, 'destroyEditor');
      
      manager.destroyAll();
      
      expect(destroySpy).toHaveBeenCalledTimes(3);
      expect(destroySpy).toHaveBeenCalledWith('block-1');
      expect(destroySpy).toHaveBeenCalledWith('block-2');
      expect(destroySpy).toHaveBeenCalledWith('block-3');
    });

    it('should clear internal map', () => {
      manager.destroyAll();
      
      // All editors should be gone
      expect(manager.getContent('block-1')).toBe('');
      expect(manager.getContent('block-2')).toBe('');
      expect(manager.getContent('block-3')).toBe('');
    });

    it('should handle errors in individual destroys', () => {
      const originalDestroy = manager.destroyEditor.bind(manager);
      jest.spyOn(manager, 'destroyEditor').mockImplementation((id) => {
        if (id === 'block-2') {
          throw new Error('Destroy error');
        }
        originalDestroy(id);
      });
      
      manager.destroyAll();
      
      expect(mockLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        'destroyAll',
        { blockId: 'block-2' }
      );
    });
  });

  describe('setEnabled', () => {
    beforeEach(() => {
      const container = document.createElement('div');
      manager.createEditor('block-1', '', container);
    });

    it('should enable editor', () => {
      manager.setEnabled('block-1', true);
      
      expect(mockQuillInstance.enable).toHaveBeenCalledWith(true);
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'Editor enabled',
        'setEnabled',
        { blockId: 'block-1' }
      );
    });

    it('should disable editor', () => {
      manager.setEnabled('block-1', false);
      
      expect(mockQuillInstance.enable).toHaveBeenCalledWith(false);
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'Editor disabled',
        'setEnabled',
        { blockId: 'block-1' }
      );
    });

    it('should do nothing for non-existent editor', () => {
      manager.setEnabled('non-existent', true);
      
      expect(mockQuillInstance.enable).not.toHaveBeenCalled();
      expect(mockLogger.logInfo).not.toHaveBeenCalled();
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', async () => {
      const module = await import('../../src/utils/quill-manager');
      expect(module.quillManager).toBeInstanceOf(QuillManager);
    });
  });
});