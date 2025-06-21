/**
 * Unit tests for VersionHistoryManager
 * Tests version history tracking and branch management
 */

import { VersionHistoryManager } from '../../src/services/version-history-manager';
import { BranchMetadata, BranchReason, ChangeType } from '../../src/types/branching.types';
import { NodeId, BlockId } from '../../src/types/branded.types';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('VersionHistoryManager', () => {
  let manager: VersionHistoryManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    manager = new VersionHistoryManager();
  });
  
  const createTestMetadata = (nodeId: string, timestamp: Date = new Date()): BranchMetadata => ({
    originalNodeId: nodeId as NodeId,
    branchTimestamp: timestamp,
    changeContext: {
      changedBlockId: 'block-1' as BlockId,
      changeType: ChangeType.CONTENT_EDIT,
      editSummary: 'Test edit',
      previousContent: 'old content',
      newContent: 'new content'
    },
    branchReason: BranchReason.PROMPT_EDIT
  });
  
  describe('recordBranch', () => {
    it('should record branch metadata', () => {
      const metadata = createTestMetadata('node-1');
      
      manager.recordBranch(metadata);
      
      const history = manager.getVersionChain('node-1' as NodeId);
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(metadata);
    });
    
    it('should save to localStorage', () => {
      const metadata = createTestMetadata('node-1');
      
      manager.recordBranch(metadata);
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const [key, value] = localStorageMock.setItem.mock.calls[0];
      expect(key).toBe('node-editor-version-history');
      
      const saved = JSON.parse(value);
      expect(saved.version).toBe('1.0.0');
      expect(saved.entries['node-1']).toHaveLength(1);
    });
    
    it('should handle multiple branches for same node', () => {
      const metadata1 = createTestMetadata('node-1', new Date('2024-01-01'));
      const metadata2 = createTestMetadata('node-1', new Date('2024-01-02'));
      const metadata3 = createTestMetadata('node-1', new Date('2024-01-03'));
      
      manager.recordBranch(metadata1);
      manager.recordBranch(metadata2);
      manager.recordBranch(metadata3);
      
      const history = manager.getVersionChain('node-1' as NodeId);
      expect(history).toHaveLength(3);
    });
    
    it('should handle localStorage save errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      
      const metadata = createTestMetadata('node-1');
      
      // Should not throw
      expect(() => manager.recordBranch(metadata)).not.toThrow();
      
      // Data should still be in memory
      const history = manager.getVersionChain('node-1' as NodeId);
      expect(history).toHaveLength(1);
    });
  });
  
  describe('getVersionChain', () => {
    it('should return empty array for nodes without history', () => {
      const history = manager.getVersionChain('unknown-node' as NodeId);
      expect(history).toEqual([]);
    });
    
    it('should return chronologically sorted history', () => {
      const metadata1 = createTestMetadata('node-1', new Date('2024-01-03'));
      const metadata2 = createTestMetadata('node-1', new Date('2024-01-01'));
      const metadata3 = createTestMetadata('node-1', new Date('2024-01-02'));
      
      manager.recordBranch(metadata1);
      manager.recordBranch(metadata2);
      manager.recordBranch(metadata3);
      
      const history = manager.getVersionChain('node-1' as NodeId);
      
      expect(history[0]!.branchTimestamp).toEqual(new Date('2024-01-01'));
      expect(history[1]!.branchTimestamp).toEqual(new Date('2024-01-02'));
      expect(history[2]!.branchTimestamp).toEqual(new Date('2024-01-03'));
    });
    
    it('should return immutable array', () => {
      const metadata = createTestMetadata('node-1');
      manager.recordBranch(metadata);
      
      const history = manager.getVersionChain('node-1' as NodeId);
      
      expect(() => {
        (history as any).push({} as any);
      }).toThrow();
    });
  });
  
  describe('getBranches', () => {
    it('should find all branches from a specific node', () => {
      // Create a branching scenario:
      // node-1 -> node-2 (branch)
      // node-1 -> node-3 (branch)
      
      const metadata1: BranchMetadata = {
        ...createTestMetadata('node-2'),
        originalNodeId: 'node-1' as NodeId
      };
      
      const metadata2: BranchMetadata = {
        ...createTestMetadata('node-3'),
        originalNodeId: 'node-1' as NodeId
      };
      
      manager.recordBranch(metadata1);
      manager.recordBranch(metadata2);
      
      const branches = manager.getBranches('node-1' as NodeId);
      expect(branches).toHaveLength(2);
      expect(branches).toContain('node-2' as NodeId);
      expect(branches).toContain('node-3' as NodeId);
    });
    
    it('should return empty array for nodes with no branches', () => {
      const branches = manager.getBranches('node-1' as NodeId);
      expect(branches).toEqual([]);
    });
    
    it('should not include the node itself in branches', () => {
      // Record that node-1 was branched from somewhere
      const metadata = createTestMetadata('node-1');
      manager.recordBranch(metadata);
      
      const branches = manager.getBranches('node-1' as NodeId);
      expect(branches).not.toContain('node-1' as NodeId);
    });
  });
  
  describe('clearNodeHistory', () => {
    it('should remove history for specific node', () => {
      const metadata1 = createTestMetadata('node-1');
      const metadata2 = createTestMetadata('node-2');
      
      manager.recordBranch(metadata1);
      manager.recordBranch(metadata2);
      
      manager.clearNodeHistory('node-1' as NodeId);
      
      expect(manager.getVersionChain('node-1' as NodeId)).toEqual([]);
      expect(manager.getVersionChain('node-2' as NodeId)).toHaveLength(1);
    });
    
    it('should update localStorage after clearing', () => {
      const metadata = createTestMetadata('node-1');
      manager.recordBranch(metadata);
      
      jest.clearAllMocks();
      manager.clearNodeHistory('node-1' as NodeId);
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });
  
  describe('getHistorySummary', () => {
    it('should return correct summary statistics', () => {
      const metadata1 = createTestMetadata('node-1', new Date('2024-01-01'));
      const metadata2 = createTestMetadata('node-2', new Date('2024-01-15'));
      const metadata3 = createTestMetadata('node-1', new Date('2024-01-30'));
      
      manager.recordBranch(metadata1);
      manager.recordBranch(metadata2);
      manager.recordBranch(metadata3);
      
      const summary = manager.getHistorySummary();
      
      expect(summary.totalNodes).toBe(2);
      expect(summary.totalBranches).toBe(3);
      expect(summary.oldestBranch).toEqual(new Date('2024-01-01'));
      expect(summary.newestBranch).toEqual(new Date('2024-01-30'));
    });
    
    it('should handle empty history', () => {
      const summary = manager.getHistorySummary();
      
      expect(summary.totalNodes).toBe(0);
      expect(summary.totalBranches).toBe(0);
      expect(summary.oldestBranch).toBeNull();
      expect(summary.newestBranch).toBeNull();
    });
  });
  
  describe('localStorage integration', () => {
    it('should load history from localStorage on initialization', () => {
      const storedData = {
        version: '1.0.0',
        entries: {
          'node-1': [{
            originalNodeId: 'node-0',
            branchTimestamp: '2024-01-01T00:00:00.000Z',
            changeContext: {
              changedBlockId: 'block-1',
              changeType: ChangeType.CONTENT_EDIT,
              editSummary: 'Loaded from storage',
              previousContent: 'old',
              newContent: 'new'
            },
            branchReason: BranchReason.PROMPT_EDIT
          }]
        },
        lastUpdated: new Date().toISOString()
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData));
      
      const newManager = new VersionHistoryManager();
      const history = newManager.getVersionChain('node-1' as NodeId);
      
      expect(history).toHaveLength(1);
      expect(history[0]!.changeContext.editSummary).toBe('Loaded from storage');
    });
    
    it('should handle corrupted localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json {');
      
      // Should not throw
      expect(() => new VersionHistoryManager()).not.toThrow();
    });
    
    it('should ignore data with wrong version', () => {
      const storedData = {
        version: '0.0.1', // Wrong version
        entries: { 'node-1': [] }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData));
      
      const newManager = new VersionHistoryManager();
      const history = newManager.getVersionChain('node-1' as NodeId);
      
      expect(history).toEqual([]);
    });
  });
  
  // Skip searchByEditType test as the method doesn't exist
  /*
  describe('searchByEditType', () => {
    it('should find branches by edit type', () => {
      // Method not implemented in VersionHistoryManager
    });
  });
  */
  
  describe('cleanup behavior', () => {
    it('should trigger cleanup when threshold is reached', () => {
      // Add 900 entries to approach threshold
      for (let i = 0; i < 900; i++) {
        const metadata = createTestMetadata('node-1', new Date(2024, 0, i + 1));
        manager.recordBranch(metadata);
      }
      
      // Trigger cleanup
      manager.recordBranch(createTestMetadata('node-1', new Date(2024, 11, 31)));
      
      const history = manager.getVersionChain('node-1' as NodeId);
      const oldestRemaining = history[0]!.branchTimestamp;
      
      // Should have removed early dates
      expect(oldestRemaining.getTime()).toBeGreaterThan(new Date(2024, 0, 100).getTime());
    });
  });
  
  describe('clearAll', () => {
    it('should remove all history', () => {
      manager.recordBranch(createTestMetadata('node-1'));
      manager.recordBranch(createTestMetadata('node-2'));
      manager.recordBranch(createTestMetadata('node-3'));
      
      manager.clearAll();
      
      const summary = manager.getHistorySummary();
      expect(summary.totalNodes).toBe(0);
      expect(summary.totalBranches).toBe(0);
    });
    
    it('should remove from localStorage', () => {
      manager.recordBranch(createTestMetadata('node-1'));
      
      jest.clearAllMocks();
      manager.clearAll();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('node-editor-version-history');
    });
    
    it('should handle localStorage errors gracefully', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      expect(() => manager.clearAll()).not.toThrow();
    });
  });
});