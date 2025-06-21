/**
 * Unit tests for BlockSizeManager
 * Tests block size preservation during preview mode transitions
 */

import { BlockSizeManager } from '../../src/services/block-size-manager';
import { BlockId } from '../../src/types/branded.types';
import { SizeConstraints } from '../../src/types/branching.types';
import { DOMError } from '../../src/types/errors';

// Mock DOM elements
class MockHTMLElement {
  id: string;
  style: any = {};
  offsetHeight: number = 100;
  offsetWidth: number = 400;
  parentNode: MockHTMLElement | null = null;
  
  constructor(id: string) {
    this.id = id;
  }
  
  removeChild(child: any): void {
    // Mock implementation
  }
}

describe('BlockSizeManager', () => {
  let manager: BlockSizeManager;
  let mockElement: MockHTMLElement;
  
  // Mock window.getComputedStyle
  const originalGetComputedStyle = window.getComputedStyle;
  
  beforeAll(() => {
    // Mock getComputedStyle
    (window as any).getComputedStyle = jest.fn().mockReturnValue({
      height: '100px',
      width: '400px'
    });
    
    // Mock setTimeout
    jest.useFakeTimers();
  });
  
  afterAll(() => {
    window.getComputedStyle = originalGetComputedStyle;
    jest.useRealTimers();
  });
  
  beforeEach(() => {
    manager = new BlockSizeManager();
    mockElement = new MockHTMLElement('block-123');
    
    // Mock document.getElementById
    jest.spyOn(document, 'getElementById').mockImplementation((id: string) => {
      if (id === 'block-123') {
        return mockElement as any;
      }
      return null;
    });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });
  
  describe('preserveBlockSize', () => {
    it('should measure and lock block size', () => {
      manager.preserveBlockSize('block-123' as BlockId, 'rendered');
      
      expect(mockElement.style.height).toBe('100px');
      expect(mockElement.style.minHeight).toBe('100px');
      expect(mockElement.style.transition).toContain('height');
    });
    
    it('should cache size constraints', () => {
      manager.preserveBlockSize('block-123' as BlockId, 'raw');
      
      const constraints = manager.getSizeConstraints('block-123' as BlockId);
      expect(constraints.height).toBe(100);
      expect(constraints.width).toBe(400);
      expect(constraints.minHeight).toBe(60);
      expect(constraints.maxHeight).toBe(400);
    });
    
    it('should schedule constraint removal', () => {
      manager.preserveBlockSize('block-123' as BlockId, 'rendered');
      
      // Before timeout
      expect(mockElement.style.height).toBe('100px');
      
      // Fast-forward past the timeout
      jest.advanceTimersByTime(350); // 300ms transition + 50ms delay
      
      // After timeout
      expect(mockElement.style.height).toBe('');
      expect(mockElement.style.minHeight).toBe('');
      expect(mockElement.style.transition).toBe('');
    });
    
    it('should throw error if block element not found', () => {
      expect(() => {
        manager.preserveBlockSize('non-existent' as BlockId, 'rendered');
      }).toThrow(DOMError);
    });
    
    it('should handle multiple calls for same block', () => {
      // First call
      manager.preserveBlockSize('block-123' as BlockId, 'rendered');
      
      // Update element size
      mockElement.offsetHeight = 200;
      
      // Second call should update constraints
      manager.preserveBlockSize('block-123' as BlockId, 'raw');
      
      const constraints = manager.getSizeConstraints('block-123' as BlockId);
      expect(constraints.height).toBe(200);
      
      // Should clear previous timeout
      jest.advanceTimersByTime(350);
      expect(mockElement.style.height).toBe('');
    });
  });
  
  // Skip tests for private methods
  /*
  describe('measureAndLockSize', () => {
    it('should return correct size constraints', () => {
      mockElement.offsetHeight = 150;
      mockElement.offsetWidth = 500;
      
      const constraints = manager.measureAndLockSize(mockElement as any);
      
      expect(constraints).toEqual({
        width: 500,
        height: 150,
        minHeight: 60,
        maxHeight: 400
      });
    });
    
    it('should use computed styles when available', () => {
      const constraints = manager.measureAndLockSize(mockElement as any);
      
      expect(window.getComputedStyle).toHaveBeenCalledWith(mockElement);
    });
  });
  */
  
  describe('getSizeConstraints', () => {
    it('should return cached constraints when available', () => {
      // Cache some constraints
      manager.preserveBlockSize('block-123' as BlockId, 'rendered');
      
      const constraints = manager.getSizeConstraints('block-123' as BlockId);
      expect(constraints.height).toBe(100);
      expect(constraints.width).toBe(400);
    });
    
    it('should return default constraints when not cached', () => {
      const constraints = manager.getSizeConstraints('unknown-block' as BlockId);
      
      expect(constraints).toEqual({
        width: 0,
        height: 100,
        minHeight: 60,
        maxHeight: 400
      });
    });
  });
  
  describe('clearSizeConstraints', () => {
    it('should remove cached constraints', () => {
      // Cache constraints
      manager.preserveBlockSize('block-123' as BlockId, 'rendered');
      
      // Clear them
      manager.clearSizeConstraints('block-123' as BlockId);
      
      // Should return defaults now
      const constraints = manager.getSizeConstraints('block-123' as BlockId);
      expect(constraints.height).toBe(100); // Default height
    });
    
    it('should clear pending timeouts', () => {
      manager.preserveBlockSize('block-123' as BlockId, 'rendered');
      
      // Clear before timeout fires
      manager.clearSizeConstraints('block-123' as BlockId);
      
      // Fast-forward time
      jest.advanceTimersByTime(350);
      
      // Style should not have been cleared (timeout was cancelled)
      expect(mockElement.style.height).toBe('100px');
    });
    
    it('should handle clearing non-existent block gracefully', () => {
      expect(() => {
        manager.clearSizeConstraints('non-existent' as BlockId);
      }).not.toThrow();
    });
  });
  
  describe('cleanup', () => {
    it('should clear all timeouts and caches', () => {
      // Set up multiple blocks
      manager.preserveBlockSize('block-123' as BlockId, 'rendered');
      
      const mockElement2 = new MockHTMLElement('block-456');
      jest.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        if (id === 'block-123') return mockElement as any;
        if (id === 'block-456') return mockElement2 as any;
        return null;
      });
      
      manager.preserveBlockSize('block-456' as BlockId, 'raw');
      
      // Cleanup
      manager.cleanup();
      
      // Fast-forward time
      jest.advanceTimersByTime(350);
      
      // Styles should not have been cleared (timeouts were cancelled)
      expect(mockElement.style.height).toBe('100px');
      expect(mockElement2.style.height).toBe('100px');
      
      // Caches should be empty
      const constraints1 = manager.getSizeConstraints('block-123' as BlockId);
      const constraints2 = manager.getSizeConstraints('block-456' as BlockId);
      
      expect(constraints1.height).toBe(100); // Default
      expect(constraints2.height).toBe(100); // Default
    });
  });
  
  describe('edge cases', () => {
    it('should handle zero dimensions', () => {
      const zeroElement = new MockHTMLElement('block-zero');
      zeroElement.offsetHeight = 0;
      zeroElement.offsetWidth = 0;
      
      jest.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        if (id === 'block-zero') return zeroElement as any;
        return mockElement as any;
      });
      
      // Test through public API instead
      manager.preserveBlockSize('block-zero' as BlockId, 'rendered');
      const constraints = manager.getSizeConstraints('block-zero' as BlockId);
      
      expect(constraints.height).toBe(0);
      expect(constraints.width).toBe(0);
      expect(constraints.minHeight).toBe(60);
      expect(constraints.maxHeight).toBe(400);
    });
    
    it('should handle very large dimensions', () => {
      const largeElement = new MockHTMLElement('block-large');
      largeElement.offsetHeight = 1000;
      largeElement.offsetWidth = 2000;
      
      jest.spyOn(document, 'getElementById').mockImplementation((id: string) => {
        if (id === 'block-large') return largeElement as any;
        return mockElement as any;
      });
      
      // Test through public API instead
      manager.preserveBlockSize('block-large' as BlockId, 'rendered');
      const constraints = manager.getSizeConstraints('block-large' as BlockId);
      
      expect(constraints.height).toBe(1000);
      expect(constraints.width).toBe(2000);
    });
    
    it('should handle rapid size changes', () => {
      // Initial size
      manager.preserveBlockSize('block-123' as BlockId, 'rendered');
      
      // Rapid changes
      for (let i = 0; i < 10; i++) {
        mockElement.offsetHeight = 100 + i * 10;
        manager.preserveBlockSize('block-123' as BlockId, 'raw');
      }
      
      // Should have latest size
      const constraints = manager.getSizeConstraints('block-123' as BlockId);
      expect(constraints.height).toBe(190);
      
      // Should only have one timeout pending
      jest.advanceTimersByTime(350);
      expect(mockElement.style.height).toBe('');
    });
  });
});