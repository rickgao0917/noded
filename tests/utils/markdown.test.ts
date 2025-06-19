/**
 * Tests for Markdown processing utility
 */

import { MarkdownProcessor } from '../../src/utils/markdown';
import { Logger } from '../../src/utils/logger';

// Mock the Logger module
jest.mock('../../src/utils/logger');

describe('MarkdownProcessor Utility', () => {
  let processor: MarkdownProcessor;
  let mockLogger: jest.Mocked<Logger>;
  let originalWindow: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Store original window
    originalWindow = global.window;
    
    // Ensure window.marked and window.hljs are properly set up
    if (!window.marked) {
      Object.defineProperty(window, 'marked', {
        value: {
          parse: jest.fn((text: string) => `<p>${text}</p>`),
          setOptions: jest.fn()
        },
        writable: true,
        configurable: true
      });
    }
    
    if (!window.hljs) {
      Object.defineProperty(window, 'hljs', {
        value: {
          highlight: jest.fn((code: string, options: any) => ({ value: `<span class="hljs">${code}</span>` })),
          highlightElement: jest.fn()
        },
        writable: true,
        configurable: true
      });
    }
    
    // Create mock logger
    mockLogger = {
      logFunctionEntry: jest.fn(),
      logFunctionExit: jest.fn(),
      logInfo: jest.fn(),
      logWarn: jest.fn(),
      logError: jest.fn(),
      logLoop: jest.fn(),
      logPerformance: jest.fn(),
      logDebug: jest.fn()
    } as any;
    
    // Mock Logger constructor
    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    
    // Create processor instance AFTER mocking window
    processor = new MarkdownProcessor();
  });

  afterEach(() => {
    // Restore original window
    (global as any).window = originalWindow;
  });

  describe('renderMarkdown', () => {
    it('should render basic markdown text', () => {
      const markdown = '# Hello World';
      
      const result = processor.renderMarkdown(markdown);
      
      expect(result).toContain('<div class="markdown-content">');
      expect(result).toContain('<p># Hello World</p>');
      expect(window.marked!.parse).toHaveBeenCalledWith(markdown);
    });

    it('should handle empty input', () => {
      const result = processor.renderMarkdown('');
      
      expect(result).toBe('<div class="markdown-content"></div>');
      expect(window.marked!.parse).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only input', () => {
      const result = processor.renderMarkdown('   \n   ');
      
      expect(result).toBe('<div class="markdown-content"></div>');
      expect(window.marked!.parse).not.toHaveBeenCalled();
    });

    it('should handle non-string input', () => {
      const result = processor.renderMarkdown(null as any);
      
      expect(result).toBe('');
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'Invalid markdown input type',
        'renderMarkdown',
        { inputType: 'object' }
      );
    });

    it('should configure marked with syntax highlighting', () => {
      processor.renderMarkdown('```js\nconst x = 1;\n```');
      
      expect(window.marked!.setOptions).toHaveBeenCalledWith({
        highlight: expect.any(Function),
        breaks: true,
        gfm: true
      });
    });

    it('should apply syntax highlighting to code blocks', () => {
      const highlightFn = (window.marked!.setOptions as jest.Mock).mock.calls[0][0].highlight;
      const result = highlightFn('const x = 1;', 'javascript');
      
      expect(result).toBe('<span class="hljs">const x = 1;</span>');
      expect(window.hljs!.highlight).toHaveBeenCalledWith('const x = 1;', { language: 'javascript' });
    });

    it('should handle highlight errors gracefully', () => {
      processor.renderMarkdown('```js\nconst x = 1;\n```');
      
      const highlightFn = (window.marked!.setOptions as jest.Mock).mock.calls[0][0].highlight;
      
      // Mock hljs to throw error
      window.hljs!.highlight = jest.fn(() => {
        throw new Error('Highlight error');
      });
      
      const result = highlightFn('const x = 1;', 'javascript');
      
      expect(result).toBe('const x = 1;');
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'Syntax highlighting failed',
        'renderMarkdown',
        { 
          language: 'javascript',
          error: 'Error: Highlight error'
        }
      );
    });

    it('should return code without highlighting if hljs is not available', () => {
      processor.renderMarkdown('```js\nconst x = 1;\n```');
      
      const highlightFn = (window.marked!.setOptions as jest.Mock).mock.calls[0][0].highlight;
      
      // Temporarily remove hljs
      const originalHljs = window.hljs;
      delete (window as any).hljs;
      
      const result = highlightFn('const x = 1;', 'javascript');
      
      expect(result).toBe('const x = 1;');
      
      // Restore hljs
      (window as any).hljs = originalHljs;
    });

    it('should handle complex markdown content', () => {
      const markdown = `
# Header
**Bold** text
- List item 1
- List item 2
\`\`\`js
console.log('hello');
\`\`\`
      `;
      
      const result = processor.renderMarkdown(markdown);
      
      expect(result).toContain('<div class="markdown-content">');
      expect(window.marked!.parse).toHaveBeenCalledWith(markdown);
    });

    it('should handle markdown parse errors', () => {
      window.marked!.parse = jest.fn(() => {
        throw new Error('Parse error');
      });
      
      const result = processor.renderMarkdown('# Test');
      
      expect(result).toContain('<div class="markdown-content">');
      expect(result).toContain('<pre>&lt;h1&gt;Test&lt;/h1&gt;</pre>');
      expect(mockLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        'renderMarkdown',
        { textLength: 6, blockType: 'markdown' }
      );
    });

    it('should use fallback when marked is not available', () => {
      // Temporarily remove marked
      const originalMarked = window.marked;
      delete (window as any).marked;
      
      // Create new processor without marked
      const fallbackProcessor = new MarkdownProcessor();
      const result = fallbackProcessor.renderMarkdown('# Test <script>alert("xss")</script>');
      
      expect(result).toContain('<pre># Test &lt;script&gt;alert("xss")&lt;/script&gt;</pre>');
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'Marked library not available, using fallback',
        'renderMarkdown'
      );
      
      // Restore marked
      (window as any).marked = originalMarked;
    });

    it('should handle different block types', () => {
      processor.renderMarkdown('# Test', 'prompt');
      
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'Markdown rendered successfully',
        'renderMarkdown',
        expect.objectContaining({ blockType: 'prompt' })
      );
    });

    it('should track performance metrics', () => {
      processor.renderMarkdown('# Test');
      
      expect(mockLogger.logPerformance).toHaveBeenCalledWith(
        'renderMarkdown',
        'markdown_parse',
        expect.any(Number)
      );
    });

    it('should handle code blocks without language specified', () => {
      processor.renderMarkdown('```\nplain code\n```');
      
      const highlightFn = (window.marked!.setOptions as jest.Mock).mock.calls[0][0].highlight;
      const result = highlightFn('plain code', '');
      
      expect(result).toBe('plain code');
      expect(window.hljs!.highlight).not.toHaveBeenCalled();
    });

    it('should escape HTML in fallback mode', () => {
      const processor = new MarkdownProcessor();
      const escapedResult = (processor as any).escapeHtml('<div>Test & "quotes"</div>');
      
      expect(escapedResult).toBe('&lt;div&gt;Test &amp; &quot;quotes&quot;&lt;/div&gt;');
    });
  });
});