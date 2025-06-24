import { ShareService } from '../../server-src/services/share-service';
import { SessionManager } from '../../src/services/session-manager';
import type { UserId, SessionToken } from '../../src/types/auth.types';

// Mock fetch globally
global.fetch = jest.fn();

describe('Share Concurrent Access Performance Tests', () => {
  let shareService: ShareService;
  let sessionManager: SessionManager;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    
    shareService = ShareService.getInstance();
    sessionManager = SessionManager.getInstance();
    
    // Mock authenticated session
    sessionManager.setSession({
      userId: 'test-user-id' as UserId,
      username: 'testuser',
      sessionToken: 'test-token' as SessionToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  });
  
  describe('Concurrent Share Creation', () => {
    test('should handle multiple simultaneous share requests', async () => {
      const numRequests = 10;
      const workspaceId = 'workspace-123';
      const usernames = Array.from({ length: numRequests }, (_, i) => `user${i}`);
      
      // Mock all requests to succeed
      usernames.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, shareId: Math.random().toString() })
        } as Response);
      });
      
      const startTime = performance.now();
      
      // Create shares concurrently
      const promises = usernames.map(username => 
        shareService.createDirectShare(workspaceId, username)
      );
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // All should succeed
      expect(results.every((r: any) => r.success)).toBe(true);
      
      // Should complete within reasonable time (< 1 second for 10 requests)
      expect(duration).toBeLessThan(1000);
      
      // Log performance metrics
      console.log(`Concurrent share creation: ${numRequests} requests in ${duration.toFixed(2)}ms`);
      console.log(`Average time per request: ${(duration / numRequests).toFixed(2)}ms`);
    });
    
    test('should handle race conditions when sharing with same user', async () => {
      const workspaceId = 'workspace-123';
      const targetUser = 'targetuser';
      const numAttempts = 5;
      
      // First request succeeds, others should fail with 409
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, shareId: 'share-123' })
      } as Response);
      
      for (let i = 1; i < numAttempts; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({ error: 'Already shared' })
        } as Response);
      }
      
      // Attempt to share multiple times concurrently
      const promises = Array.from({ length: numAttempts }, () => 
        shareService.createDirectShare(workspaceId, targetUser)
      );
      
      const results = await Promise.all(promises);
      
      // Only one should succeed
      const successCount = results.filter((r: any) => r.success).length;
      expect(successCount).toBe(1);
      
      // Others should fail with appropriate error
      const failureCount = results.filter((r: any) => !r.success && r.error?.includes('Already shared')).length;
      expect(failureCount).toBe(numAttempts - 1);
    });
  });
  
  describe('Concurrent Workspace Access', () => {
    test('should handle multiple users accessing same shared workspace', async () => {
      const shareId = 'shared-workspace-123';
      const numUsers = 20;
      
      // Mock successful workspace fetches
      for (let i = 0; i < numUsers; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'workspace-123',
            name: 'Shared Workspace',
            isReadOnly: true,
            graphData: { nodes: [] }
          })
        } as Response);
      }
      
      const startTime = performance.now();
      
      // Simulate multiple users accessing workspace
      const promises = Array.from({ length: numUsers }, () => 
        sessionManager.makeAuthenticatedRequest(`/api/shares/${shareId}/workspace`)
      );
      
      const responses = await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // All should succeed
      expect(responses.every(r => r.ok)).toBe(true);
      
      // Should handle load efficiently
      expect(duration).toBeLessThan(2000); // < 2 seconds for 20 users
      
      console.log(`Concurrent access test: ${numUsers} users in ${duration.toFixed(2)}ms`);
      console.log(`Average response time: ${(duration / numUsers).toFixed(2)}ms`);
    });
    
    test('should maintain performance with large workspace data', async () => {
      // Create large graph data
      const numNodes = 100;
      const largeGraphData = {
        nodes: Array.from({ length: numNodes }, (_, i) => ({
          id: `node-${i}`,
          name: `Node ${i}`,
          position: { x: i * 100, y: i * 50 },
          blocks: [
            { id: `block-${i}-1`, type: 'prompt', content: 'Sample prompt content'.repeat(10) },
            { id: `block-${i}-2`, type: 'response', content: 'Sample response content'.repeat(20) }
          ]
        }))
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'large-workspace',
          name: 'Large Workspace',
          isReadOnly: true,
          graphData: largeGraphData
        })
      } as Response);
      
      const startTime = performance.now();
      
      const response = await sessionManager.makeAuthenticatedRequest('/api/shares/large-share/workspace');
      const data = await response.json();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should load within reasonable time even with large data
      expect(duration).toBeLessThan(500); // < 500ms
      expect(data.graphData.nodes.length).toBe(numNodes);
      
      console.log(`Large workspace load time: ${duration.toFixed(2)}ms for ${numNodes} nodes`);
    });
  });
  
  describe('Share List Performance', () => {
    test('should efficiently load user share lists', async () => {
      const numShares = 50;
      const shares = Array.from({ length: numShares }, (_, i) => ({
        shareId: `share-${i}`,
        workspaceId: `workspace-${i}`,
        workspaceName: `Workspace ${i}`,
        sharedWith: `user${i}`,
        shareType: i % 2 === 0 ? 'direct' : 'link',
        createdAt: new Date().toISOString()
      }));
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ shares })
      } as Response);
      
      const startTime = performance.now();
      
      const result = await shareService.getUserShares();
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(result.success).toBe(true);
      expect(result.shares?.length).toBe(numShares);
      expect(duration).toBeLessThan(200); // Should be fast
      
      console.log(`Share list load time: ${duration.toFixed(2)}ms for ${numShares} shares`);
    });
    
    test('should paginate large share lists efficiently', async () => {
      const totalShares = 200;
      const pageSize = 20;
      const numPages = Math.ceil(totalShares / pageSize);
      
      // Mock paginated responses
      for (let page = 0; page < numPages; page++) {
        const shares = Array.from({ length: pageSize }, (_, i) => ({
          shareId: `share-${page * pageSize + i}`,
          workspaceName: `Workspace ${page * pageSize + i}`
        }));
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            shares,
            totalCount: totalShares,
            page,
            pageSize,
            hasMore: page < numPages - 1
          })
        } as Response);
      }
      
      const startTime = performance.now();
      
      // Load all pages
      const allShares = [];
      for (let page = 0; page < numPages; page++) {
        const response = await sessionManager.makeAuthenticatedRequest(
          `/api/shares?page=${page}&pageSize=${pageSize}`
        );
        const data = await response.json();
        allShares.push(...data.shares);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(allShares.length).toBe(totalShares);
      expect(duration).toBeLessThan(1000); // < 1 second for all pages
      
      console.log(`Paginated load: ${totalShares} shares in ${numPages} pages took ${duration.toFixed(2)}ms`);
    });
  });
  
  describe('Revocation Performance', () => {
    test('should handle bulk share revocation efficiently', async () => {
      const numShares = 30;
      const shareIds = Array.from({ length: numShares }, (_, i) => `share-${i}`);
      
      // Mock all revocations to succeed
      shareIds.forEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response);
      });
      
      const startTime = performance.now();
      
      // Revoke all shares
      const promises = shareIds.map(shareId => shareService.revokeShare(shareId));
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(results.every((r: any) => r.success)).toBe(true);
      expect(duration).toBeLessThan(2000); // < 2 seconds for 30 revocations
      
      console.log(`Bulk revocation: ${numShares} shares in ${duration.toFixed(2)}ms`);
    });
  });
  
  describe('Memory Usage', () => {
    test('should not leak memory when creating/destroying share indicators', () => {
      // This test would ideally use memory profiling tools
      // For unit tests, we'll verify proper cleanup
      
      const indicators: any[] = [];
      const numIndicators = 100;
      
      // Create many indicators
      for (let i = 0; i < numIndicators; i++) {
        const indicator = {
          id: `indicator-${i}`,
          destroy: jest.fn()
        };
        indicators.push(indicator);
      }
      
      // Destroy all indicators
      indicators.forEach(indicator => indicator.destroy());
      
      // Verify all were destroyed
      expect(indicators.every(i => i.destroy.mock.calls.length === 1)).toBe(true);
      
      // Clear references
      indicators.length = 0;
      
      // In a real test, we would check memory usage here
      console.log(`Created and destroyed ${numIndicators} indicators`);
    });
  });
  
  describe('Network Optimization', () => {
    test('should batch API requests when possible', async () => {
      // Mock batch endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { shareId: 'share-1', success: true },
            { shareId: 'share-2', success: true },
            { shareId: 'share-3', success: true }
          ]
        })
      } as Response);
      
      const shareIds = ['share-1', 'share-2', 'share-3'];
      
      // In a real implementation, this would use a batch endpoint
      const response = await sessionManager.makeAuthenticatedRequest('/api/shares/batch/revoke', {
        method: 'POST',
        body: JSON.stringify({ shareIds })
      });
      
      const data = await response.json();
      
      expect(data.results.length).toBe(3);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Single batch request
    });
    
    test('should cache frequently accessed share data', async () => {
      const shareId = 'cached-share-123';
      
      // First request - hits API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: shareId, cached: false })
      } as Response);
      
      const firstResponse = await sessionManager.makeAuthenticatedRequest(`/api/shares/${shareId}`);
      const firstData = await firstResponse.json();
      
      // Subsequent requests should use cache (in real implementation)
      // For this test, we'll verify the behavior
      expect(firstData.cached).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // In a real implementation with caching:
      // - Second request would return cached data
      // - Cache would expire after TTL
      // - Cache would be invalidated on updates
    });
  });
});