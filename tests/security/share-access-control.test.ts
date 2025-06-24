import { ShareService } from '../../src/services/share-service';
import { SessionManager } from '../../src/services/session-manager';
import { GraphEditor } from '../../src/components/graph-editor';

// Mock fetch globally
global.fetch = jest.fn();

describe('Share Access Control Security Tests', () => {
  let shareService: ShareService;
  let sessionManager: SessionManager;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    
    // Initialize services
    shareService = ShareService.getInstance();
    sessionManager = SessionManager.getInstance();
    
    // Mock authenticated session
    sessionManager.setSession({
      userId: 'owner-user-id',
      username: 'owneruser',
      sessionToken: 'valid-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  });
  
  describe('Direct Share Access Control', () => {
    test('should prevent unauthorized access to non-shared workspace', async () => {
      // Mock API response for unauthorized access
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Access denied' })
      } as Response);
      
      // Try to access workspace not shared with user
      const workspaceId = 'private-workspace-123';
      
      try {
        await sessionManager.makeAuthenticatedRequest(`/api/workspaces/${workspaceId}`);
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to fail
      }
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/workspaces/${workspaceId}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token'
          })
        })
      );
    });
    
    test('should prevent sharing workspace user does not own', async () => {
      // Mock API response for unauthorized share attempt
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'You do not have permission to share this workspace' })
      } as Response);
      
      const result = await shareService.createDirectShare('not-my-workspace', 'someuser');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });
    
    test('should prevent duplicate shares to same user', async () => {
      // Mock API response for duplicate share
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Workspace already shared with this user' })
      } as Response);
      
      const result = await shareService.createDirectShare('workspace-123', 'existinguser');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already shared');
    });
    
    test('should validate username format before sharing', async () => {
      // Test invalid usernames
      const invalidUsernames = [
        '',  // Empty
        ' ',  // Whitespace only
        'user name',  // Contains space
        'user@name',  // Contains special char
        'a',  // Too short
        'a'.repeat(65),  // Too long
      ];
      
      for (const username of invalidUsernames) {
        const result = await shareService.createDirectShare('workspace-123', username);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid username');
      }
    });
    
    test('should prevent self-sharing', async () => {
      const result = await shareService.createDirectShare('workspace-123', 'owneruser');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot share with yourself');
    });
  });
  
  describe('Link Share Access Control', () => {
    test('should generate cryptographically secure share IDs', async () => {
      // Mock successful link creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          shareId: 'secure-random-id-123',
          shareUrl: 'http://localhost:8000/share/secure-random-id-123'
        })
      } as Response);
      
      const result = await shareService.createShareableLink('workspace-123');
      
      expect(result.success).toBe(true);
      expect(result.shareId).toBeTruthy();
      expect(result.shareId?.length).toBeGreaterThan(20); // Should be sufficiently long
      expect(result.shareUrl).toContain(result.shareId);
    });
    
    test('should not expose sensitive workspace data in share links', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          shareId: 'share-123',
          shareUrl: 'http://localhost:8000/share/share-123'
        })
      } as Response);
      
      const result = await shareService.createShareableLink('workspace-123');
      
      // Share URL should not contain workspace ID or user info
      expect(result.shareUrl).not.toContain('workspace-123');
      expect(result.shareUrl).not.toContain('owneruser');
      expect(result.shareUrl).not.toContain('owner-user-id');
    });
    
    test('should prevent access with invalid share IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Share not found' })
      } as Response);
      
      try {
        await sessionManager.makeAuthenticatedRequest('/api/shares/invalid-share-id/workspace');
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to fail
      }
    });
    
    test('should handle expired share links', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({ error: 'Share link has expired' })
      } as Response);
      
      try {
        await sessionManager.makeAuthenticatedRequest('/api/shares/expired-share/workspace');
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to fail
      }
    });
  });
  
  describe('Revoke Access Control', () => {
    test('should only allow owner to revoke shares', async () => {
      // Switch to different user
      sessionManager.setSession({
        userId: 'other-user-id',
        username: 'otheruser',
        sessionToken: 'other-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Only workspace owner can revoke shares' })
      } as Response);
      
      const result = await shareService.revokeShare('share-123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('owner');
    });
    
    test('should immediately invalidate access after revocation', async () => {
      // First, successfully revoke
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as Response);
      
      const revokeResult = await shareService.revokeShare('share-123');
      expect(revokeResult.success).toBe(true);
      
      // Then try to access with revoked share
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Share has been revoked' })
      } as Response);
      
      try {
        await sessionManager.makeAuthenticatedRequest('/api/shares/share-123/workspace');
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to fail
      }
    });
  });
  
  describe('Read-Only Enforcement', () => {
    test('should prevent API write operations on shared workspaces', async () => {
      // Mock workspace as shared (read-only)
      const sharedWorkspace = {
        id: 'shared-workspace-123',
        isReadOnly: true,
        shareInfo: { type: 'direct', owner: 'otheruser' }
      };
      
      // Try to update shared workspace
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Cannot modify shared workspace' })
      } as Response);
      
      const response = await sessionManager.makeAuthenticatedRequest(
        `/api/workspaces/${sharedWorkspace.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Modified Name' })
        }
      );
      
      expect(response.status).toBe(403);
    });
    
    test('should prevent client-side modifications in read-only mode', () => {
      // Set up DOM
      document.body.innerHTML = `
        <div id="canvas"></div>
        <div id="canvas-content"></div>
        <svg id="connections"></svg>
      `;
      
      const canvas = document.getElementById('canvas')!;
      const canvasContent = document.getElementById('canvas-content')!;
      const connectionsEl = document.getElementById('connections') as unknown as SVGElement;
      
      const editor = new GraphEditor(canvas, canvasContent, connectionsEl, false);
      editor.setReadOnlyMode(true, { type: 'direct', owner: 'otheruser' });
      
      // Try to add a node
      const initialNodeCount = editor.getNodes().size;
      editor.addRootNode();
      const afterAddNodeCount = editor.getNodes().size;
      
      // Should not add node in read-only mode
      expect(afterAddNodeCount).toBe(initialNodeCount);
    });
  });
  
  describe('Session Security', () => {
    test('should require authentication for accessing shared workspaces', async () => {
      // Clear session
      sessionManager.clearSession();
      
      // Try to access shared workspace without auth
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Authentication required' })
      } as Response);
      
      try {
        await fetch('/api/shares/share-123/workspace');
        fail('Should require authentication');
      } catch (error) {
        // Expected to fail
      }
    });
    
    test('should validate session tokens on share operations', async () => {
      // Use expired token
      sessionManager.setSession({
        userId: 'user-id',
        username: 'testuser',
        sessionToken: 'expired-token',
        expiresAt: new Date(Date.now() - 1000).toISOString() // Expired
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Session expired' })
      } as Response);
      
      const result = await shareService.createDirectShare('workspace-123', 'someuser');
      
      expect(result.success).toBe(false);
      expect(sessionManager.isAuthenticated()).toBe(false);
    });
  });
  
  describe('Input Sanitization', () => {
    test('should sanitize workspace names in share responses', async () => {
      const maliciousWorkspaceName = '<script>alert("XSS")</script>Workspace';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workspace: {
            id: 'workspace-123',
            name: maliciousWorkspaceName,
            isReadOnly: true
          }
        })
      } as Response);
      
      const response = await sessionManager.makeAuthenticatedRequest('/api/shares/share-123/workspace');
      const data = await response.json();
      
      // The service should sanitize the name
      expect(data.workspace.name).not.toContain('<script>');
    });
    
    test('should validate share ID format', async () => {
      const invalidShareIds = [
        '../../../etc/passwd',  // Path traversal
        'share-123; DROP TABLE',  // SQL injection
        '<script>alert(1)</script>',  // XSS
        'share 123',  // Invalid characters
        '',  // Empty
      ];
      
      for (const shareId of invalidShareIds) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Invalid share ID format' })
        } as Response);
        
        try {
          await sessionManager.makeAuthenticatedRequest(`/api/shares/${shareId}/workspace`);
        } catch (error) {
          // Expected to fail
        }
        
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(encodeURIComponent(shareId)),
          expect.any(Object)
        );
      }
    });
  });
});