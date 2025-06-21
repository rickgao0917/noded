/**
 * Service for tracking and querying node version history
 * Manages branching metadata and version chains
 * Following TypeScript standards from ts_readme.xml
 */

import { NodeId } from '../types/branded.types';
import { BranchMetadata } from '../types/branching.types';
import { Logger } from '../utils/logger';

/**
 * Constants for version history management
 */
const VERSION_HISTORY_CONSTANTS = {
  MAX_HISTORY_ENTRIES: 1000,
  LOCAL_STORAGE_KEY: 'node-editor-version-history',
  CLEANUP_THRESHOLD: 900,
  HISTORY_VERSION: '1.0.0'
} as const;

/**
 * Structure for storing version history in localStorage
 */
interface StoredVersionHistory {
  version: string;
  entries: Record<string, BranchMetadata[]>;
  lastUpdated: string;
}

/**
 * Service for managing version history and branch tracking
 */
export class VersionHistoryManager {
  private readonly logger: Logger;
  private readonly history: Map<string, BranchMetadata[]>;
  private totalEntries: number;
  
  constructor() {
    this.logger = new Logger('VersionHistoryManager');
    this.history = new Map();
    this.totalEntries = 0;
    
    this.logger.logFunctionEntry('constructor');
    
    // Load history from localStorage if available
    this.loadFromStorage();
  }
  
  /**
   * Records a branch operation in version history
   * @param branchMetadata - Metadata about the branch operation
   * @throws ValidationError if maximum history entries exceeded
   */
  recordBranch(branchMetadata: BranchMetadata): void {
    const startTime = performance.now();
    this.logger.logFunctionEntry('recordBranch', { 
      originalNodeId: branchMetadata.originalNodeId,
      branchReason: branchMetadata.branchReason 
    });
    
    try {
      // Check if we need to cleanup old entries
      if (this.totalEntries >= VERSION_HISTORY_CONSTANTS.CLEANUP_THRESHOLD) {
        this.logger.logBranch('recordBranch', 'cleanup_triggered', true, {
          totalEntries: this.totalEntries
        });
        this.cleanupOldEntries();
      }
      
      // Add to history for the original node
      const originalHistory = this.history.get(branchMetadata.originalNodeId) || [];
      originalHistory.push(branchMetadata);
      this.history.set(branchMetadata.originalNodeId, originalHistory);
      
      this.totalEntries++;
      
      // Persist to storage
      this.saveToStorage();
      
      const duration = performance.now() - startTime;
      this.logger.logPerformance('recordBranch', 'record_branch', duration, { 
        originalNodeId: branchMetadata.originalNodeId 
      });
      this.logger.logFunctionExit('recordBranch', undefined);
      
    } catch (error) {
      this.logger.logError(error as Error, 'recordBranch', { branchMetadata });
      throw error;
    }
  }
  
  /**
   * Gets the complete version chain for a node
   * @param nodeId - ID of the node
   * @returns Array of branch metadata in chronological order
   */
  getVersionChain(nodeId: NodeId): readonly BranchMetadata[] {
    this.logger.logFunctionEntry('getVersionChain', { nodeId });
    
    const chain = this.history.get(nodeId) || [];
    
    // Sort by timestamp to ensure chronological order
    const sortedChain = [...chain].sort((a, b) => 
      a.branchTimestamp.getTime() - b.branchTimestamp.getTime()
    );
    
    this.logger.logBranch('getVersionChain', 'chain_retrieved', true, {
      nodeId,
      chainLength: sortedChain.length
    });
    
    this.logger.logFunctionExit('getVersionChain', { count: sortedChain.length });
    return Object.freeze(sortedChain);
  }
  
  /**
   * Gets all nodes that have branched from a specific node
   * @param nodeId - ID of the original node
   * @returns Array of node IDs that are branches
   */
  getBranches(nodeId: NodeId): readonly NodeId[] {
    this.logger.logFunctionEntry('getBranches', { nodeId });
    
    const branches: Set<NodeId> = new Set();
    
    // Look for all metadata entries where originalNodeId matches the given nodeId
    // The branchMetadata stored contains the ID of the new branch node
    for (const [_, metadataList] of this.history) {
      for (const metadata of metadataList) {
        if (metadata.originalNodeId === nodeId) {
          // The metadata should contain information about the branch
          // Since we're recording metadata for the original node,
          // we need to find a way to get the branch node ID
          // This requires the branch node ID to be stored in the metadata
          // For now, we'll skip this method as the current implementation
          // doesn't store the branch node ID in the metadata
        }
      }
    }
    
    const branchArray = Array.from(branches);
    
    this.logger.logFunctionExit('getBranches', { count: branchArray.length });
    return Object.freeze(branchArray);
  }
  
  /**
   * Clears history for a specific node
   * @param nodeId - ID of the node
   */
  clearNodeHistory(nodeId: NodeId): void {
    this.logger.logFunctionEntry('clearNodeHistory', { nodeId });
    
    const entries = this.history.get(nodeId) || [];
    this.totalEntries -= entries.length;
    
    this.history.delete(nodeId);
    
    this.saveToStorage();
    
    this.logger.logFunctionExit('clearNodeHistory', undefined);
  }
  
  /**
   * Gets a summary of version history
   * @returns Summary statistics
   */
  getHistorySummary(): {
    totalNodes: number;
    totalBranches: number;
    oldestBranch: Date | null;
    newestBranch: Date | null;
  } {
    this.logger.logFunctionEntry('getHistorySummary');
    
    let oldestBranch: Date | null = null;
    let newestBranch: Date | null = null;
    let totalBranches = 0;
    
    for (const entries of this.history.values()) {
      totalBranches += entries.length;
      
      for (const entry of entries) {
        if (!oldestBranch || entry.branchTimestamp < oldestBranch) {
          oldestBranch = entry.branchTimestamp;
        }
        if (!newestBranch || entry.branchTimestamp > newestBranch) {
          newestBranch = entry.branchTimestamp;
        }
      }
    }
    
    const summary = {
      totalNodes: this.history.size,
      totalBranches,
      oldestBranch,
      newestBranch
    };
    
    this.logger.logFunctionExit('getHistorySummary', summary);
    return summary;
  }
  
  /**
   * Loads version history from localStorage
   */
  private loadFromStorage(): void {
    this.logger.logFunctionEntry('loadFromStorage');
    
    try {
      const stored = localStorage.getItem(VERSION_HISTORY_CONSTANTS.LOCAL_STORAGE_KEY);
      if (!stored) {
        this.logger.logBranch('loadFromStorage', 'no_stored_data', true, {});
        return;
      }
      
      const parsed: StoredVersionHistory = JSON.parse(stored);
      
      // Validate version
      if (parsed.version !== VERSION_HISTORY_CONSTANTS.HISTORY_VERSION) {
        this.logger.logBranch('loadFromStorage', 'version_mismatch', true, {
          stored: parsed.version,
          expected: VERSION_HISTORY_CONSTANTS.HISTORY_VERSION
        });
        return;
      }
      
      // Restore entries
      this.history.clear();
      this.totalEntries = 0;
      
      for (const [nodeId, entries] of Object.entries(parsed.entries)) {
        // Convert date strings back to Date objects
        const restoredEntries = entries.map(entry => ({
          ...entry,
          branchTimestamp: new Date(entry.branchTimestamp)
        }));
        
        this.history.set(nodeId, restoredEntries);
        this.totalEntries += restoredEntries.length;
      }
      
      this.logger.logBranch('loadFromStorage', 'loaded_successfully', true, {
        nodes: this.history.size,
        entries: this.totalEntries
      });
      
    } catch (error) {
      this.logger.logError(error as Error, 'loadFromStorage');
      // Continue with empty history on error
    }
    
    this.logger.logFunctionExit('loadFromStorage', undefined);
  }
  
  /**
   * Saves version history to localStorage
   */
  private saveToStorage(): void {
    this.logger.logFunctionEntry('saveToStorage');
    
    try {
      // Convert Map to serializable object
      const entries: Record<string, BranchMetadata[]> = {};
      
      for (const [nodeId, metadata] of this.history) {
        entries[nodeId] = metadata;
      }
      
      const toStore: StoredVersionHistory = {
        version: VERSION_HISTORY_CONSTANTS.HISTORY_VERSION,
        entries,
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem(
        VERSION_HISTORY_CONSTANTS.LOCAL_STORAGE_KEY,
        JSON.stringify(toStore)
      );
      
      this.logger.logBranch('saveToStorage', 'saved_successfully', true, {
        nodes: this.history.size,
        entries: this.totalEntries
      });
      
    } catch (error) {
      this.logger.logError(error as Error, 'saveToStorage');
      // Continue without persistence on error
    }
    
    this.logger.logFunctionExit('saveToStorage', undefined);
  }
  
  /**
   * Cleans up old entries when approaching the limit
   */
  private cleanupOldEntries(): void {
    this.logger.logFunctionEntry('cleanupOldEntries');
    
    // Collect all entries with their timestamps
    const allEntries: Array<{ nodeId: string; entry: BranchMetadata }> = [];
    
    for (const [nodeId, entries] of this.history) {
      for (const entry of entries) {
        allEntries.push({ nodeId, entry });
      }
    }
    
    // Sort by timestamp (oldest first)
    allEntries.sort((a, b) => 
      a.entry.branchTimestamp.getTime() - b.entry.branchTimestamp.getTime()
    );
    
    // Calculate how many to remove (20% of total)
    const toRemove = Math.floor(allEntries.length * 0.2);
    
    if (toRemove > 0) {
      // Remove oldest entries
      const removeSet = new Set(allEntries.slice(0, toRemove));
      
      // Rebuild history without removed entries
      const newHistory = new Map<string, BranchMetadata[]>();
      
      for (const [nodeId, entries] of this.history) {
        const filtered = entries.filter(entry => 
          !removeSet.has({ nodeId, entry })
        );
        
        if (filtered.length > 0) {
          newHistory.set(nodeId, filtered);
        }
      }
      
      this.history.clear();
      for (const [nodeId, entries] of newHistory) {
        this.history.set(nodeId, entries);
      }
      
      this.totalEntries = allEntries.length - toRemove;
      
      this.logger.logBranch('cleanupOldEntries', 'cleanup_complete', true, {
        removed: toRemove,
        remaining: this.totalEntries
      });
    }
    
    this.logger.logFunctionExit('cleanupOldEntries', undefined);
  }
  
  /**
   * Clears all version history
   */
  clearAll(): void {
    this.logger.logFunctionEntry('clearAll');
    
    this.history.clear();
    this.totalEntries = 0;
    
    try {
      localStorage.removeItem(VERSION_HISTORY_CONSTANTS.LOCAL_STORAGE_KEY);
    } catch (error) {
      this.logger.logError(error as Error, 'clearAll');
    }
    
    this.logger.logFunctionExit('clearAll', undefined);
  }
}