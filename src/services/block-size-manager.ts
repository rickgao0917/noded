/**
 * Service for managing block size consistency during preview mode transitions
 * Ensures blocks maintain their dimensions when switching between raw and rendered modes
 * Following TypeScript standards from ts_readme.xml
 */

import { BlockId } from '../types/branded.types';
import { SizeConstraints } from '../types/branching.types';
import { PreviewDisplayMode } from '../types/preview.types';
import { Logger } from '../utils/logger';
import { DOMError } from '../types/errors';

/**
 * Constants for block size management
 */
const BLOCK_SIZE_CONSTANTS = {
  MIN_BLOCK_HEIGHT: 60,
  MAX_BLOCK_HEIGHT: 400,
  DEFAULT_BLOCK_HEIGHT: 100,
  TRANSITION_DURATION: 300,
  CONSTRAINT_REMOVAL_DELAY: 350,
  RENDER_DEBOUNCE_DELAY: 50
} as const;

/**
 * Service for managing block dimensions during mode transitions
 */
export class BlockSizeManager {
  private readonly logger: Logger;
  private readonly sizeCache: Map<string, SizeConstraints>;
  private readonly transitionTimeouts: Map<string, number>;
  private readonly correlationId: string;
  
  constructor() {
    this.logger = new Logger('BlockSizeManager');
    this.sizeCache = new Map();
    this.transitionTimeouts = new Map();
    this.correlationId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    this.logger.logFunctionEntry('constructor');
  }
  
  /**
   * Preserves block size before transitioning to a different display mode
   * @param blockId - ID of the block
   * @param mode - Target display mode
   * @throws DOMError if block element not found
   */
  preserveBlockSize(blockId: BlockId, mode: PreviewDisplayMode): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('preserveBlockSize', { blockId, mode });
    
    try {
      // Get the block element
      const blockElement = this.getBlockElement(blockId);
      
      // Measure and lock current size
      const constraints = this.measureAndLockSize(blockElement);
      
      // Cache the constraints
      this.sizeCache.set(blockId, constraints);
      
      // Apply constraints immediately
      this.applyHeightConstraint(blockElement, constraints.height);
      
      // Schedule removal of explicit height after transition
      this.scheduleConstraintRemoval(blockId, blockElement);
      
      const duration = performance.now() - startTime;
      this.logger.logPerformance('preserveBlockSize', 'preserve_size', duration, { blockId });
      this.logger.logFunctionExit('preserveBlockSize', undefined);
      
    } catch (error) {
      this.logger.logError(error as Error, 'preserveBlockSize', { blockId, mode });
      throw error;
    }
  }
  
  /**
   * Measures current block dimensions and creates size constraints
   * @param blockElement - DOM element of the block
   * @returns Size constraints for the block
   */
  private measureAndLockSize(blockElement: HTMLElement): SizeConstraints {
    this.logger.logFunctionEntry('measureAndLockSize');
    
    // Get current dimensions
    const currentHeight = blockElement.offsetHeight;
    const currentWidth = blockElement.offsetWidth;
    
    // Calculate constraints
    const constraints: SizeConstraints = {
      width: currentWidth,
      height: currentHeight,
      minHeight: BLOCK_SIZE_CONSTANTS.MIN_BLOCK_HEIGHT,
      maxHeight: BLOCK_SIZE_CONSTANTS.MAX_BLOCK_HEIGHT
    };
    
    this.logger.logBranch('measureAndLockSize', 'dimensions_measured', true, {
      width: currentWidth,
      height: currentHeight
    });
    
    this.logger.logFunctionExit('measureAndLockSize', constraints);
    return constraints;
  }
  
  /**
   * Gets the size constraints for a block
   * @param blockId - ID of the block
   * @returns Cached size constraints or default values
   */
  getSizeConstraints(blockId: BlockId): SizeConstraints {
    this.logger.logFunctionEntry('getSizeConstraints', { blockId });
    
    const cached = this.sizeCache.get(blockId);
    if (cached) {
      this.logger.logBranch('getSizeConstraints', 'cache_hit', true, { blockId });
      this.logger.logFunctionExit('getSizeConstraints', cached);
      return cached;
    }
    
    this.logger.logBranch('getSizeConstraints', 'cache_miss', true, { blockId });
    
    // Return default constraints
    const defaults: SizeConstraints = {
      width: 0, // Will be determined by parent
      height: BLOCK_SIZE_CONSTANTS.DEFAULT_BLOCK_HEIGHT,
      minHeight: BLOCK_SIZE_CONSTANTS.MIN_BLOCK_HEIGHT,
      maxHeight: BLOCK_SIZE_CONSTANTS.MAX_BLOCK_HEIGHT
    };
    
    this.logger.logFunctionExit('getSizeConstraints', defaults);
    return defaults;
  }
  
  /**
   * Clears size constraints for a block
   * @param blockId - ID of the block
   */
  clearSizeConstraints(blockId: BlockId): void {
    this.logger.logFunctionEntry('clearSizeConstraints', { blockId });
    
    this.sizeCache.delete(blockId);
    
    // Clear any pending timeouts
    const timeoutId = this.transitionTimeouts.get(blockId);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      this.transitionTimeouts.delete(blockId);
      this.logger.logBranch('clearSizeConstraints', 'timeout_cleared', true, { 
        blockId 
      });
    }
    
    this.logger.logFunctionExit('clearSizeConstraints', undefined);
  }
  
  /**
   * Applies height constraint to a block element
   * @param element - DOM element to constrain
   * @param height - Height to apply
   */
  private applyHeightConstraint(element: HTMLElement, height: number): void {
    this.logger.logFunctionEntry('applyHeightConstraint', { height });
    
    // Set explicit height for transition
    element.style.height = `${height}px`;
    element.style.minHeight = `${height}px`;
    element.style.transition = `height ${BLOCK_SIZE_CONSTANTS.TRANSITION_DURATION}ms ease`;
    
    this.logger.logFunctionExit('applyHeightConstraint', undefined);
  }
  
  /**
   * Schedules removal of size constraints after transition completes
   * @param blockId - ID of the block
   * @param element - DOM element
   */
  private scheduleConstraintRemoval(blockId: string, element: HTMLElement): void {
    this.logger.logFunctionEntry('scheduleConstraintRemoval', { blockId });
    
    // Clear any existing timeout
    const existingTimeout = this.transitionTimeouts.get(blockId);
    if (existingTimeout !== undefined) {
      window.clearTimeout(existingTimeout);
      this.logger.logBranch('scheduleConstraintRemoval', 
        'existing_timeout_cleared', 
        true,
        { blockId }
      );
    }
    
    // Schedule new timeout
    const timeoutId = window.setTimeout(() => {
      this.logger.logBranch('scheduleConstraintRemoval', 
        'removing_constraints', 
        true,
        { blockId }
      );
      
      // Remove explicit height to allow natural sizing
      element.style.height = '';
      element.style.minHeight = '';
      element.style.transition = '';
      
      // Clean up timeout tracking
      this.transitionTimeouts.delete(blockId);
      
    }, BLOCK_SIZE_CONSTANTS.CONSTRAINT_REMOVAL_DELAY);
    
    this.transitionTimeouts.set(blockId, timeoutId);
    
    this.logger.logFunctionExit('scheduleConstraintRemoval', undefined);
  }
  
  /**
   * Gets the DOM element for a block
   * @param blockId - ID of the block
   * @returns HTMLElement
   * @throws DOMError if element not found
   */
  private getBlockElement(blockId: string): HTMLElement {
    this.logger.logFunctionEntry('getBlockElement', { blockId });
    
    const element = document.getElementById(blockId);
    
    if (!element) {
      throw new DOMError(
        `Block element not found: ${blockId}`,
        'ELEMENT_NOT_FOUND',
        'Unable to find block element',
        {
          functionName: 'getBlockElement',
          timestamp: new Date().toISOString(),
          correlationId: this.correlationId,
          parameters: { blockId }
        }
      );
    }
    
    this.logger.logFunctionExit('getBlockElement', { found: true });
    return element as HTMLElement;
  }
  
  /**
   * Cleanup method to clear all cached data and timeouts
   */
  cleanup(): void {
    this.logger.logFunctionEntry('cleanup');
    
    // Clear all timeouts
    for (const [blockId, timeoutId] of this.transitionTimeouts) {
      window.clearTimeout(timeoutId);
      this.logger.logBranch('cleanup', 'timeout_cleared', true, { blockId });
    }
    
    // Clear caches
    this.sizeCache.clear();
    this.transitionTimeouts.clear();
    
    this.logger.logFunctionExit('cleanup', undefined);
  }
}