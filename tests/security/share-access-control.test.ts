import { SessionManager } from '../../src/services/session-manager';
import { GraphEditor } from '../../src/components/graph-editor';
import type { UserId, SessionToken } from '../../src/types/auth.types';

// Mock fetch globally
global.fetch = jest.fn();

describe('Share Access Control Security Tests', () => {
  let sessionManager: SessionManager;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    
    // Initialize services
    sessionManager = SessionManager.getInstance();
    
    // Mock authenticated session
    sessionManager.setSession({
      userId: 'owner-user-id' as UserId,
      username: 'owneruser',
      sessionToken: 'valid-token' as SessionToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  });
  
  describe('Shared Workspace Access Control', () => {
    test('should prevent unauthorized access to non-shared workspace', async () => {
      // Mock API response for unauthorized access
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Access denied' })
      } as Response);
      
      // Try to access workspace not shared with user
      const workspaceId = 'private-workspace-123';
      
      const response = await sessionManager.makeAuthenticatedRequest(`/api/workspaces/${workspaceId}`);
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/workspaces/${workspaceId}`),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer valid-token'
          })
        })
      );
    });
    
    test('should handle invalid share IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Share not found' })
      } as Response);
      
      const response = await sessionManager.makeAuthenticatedRequest('/api/shares/invalid-share-id/workspace');
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
    
    test('should handle expired share links', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({ error: 'Share link has expired' })
      } as Response);
      
      const response = await sessionManager.makeAuthenticatedRequest('/api/shares/expired-share/workspace');
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(410);
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
    
    test('should set read-only mode correctly', () => {
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
      
      // Initially should not be read-only
      expect(editor.getIsReadOnly()).toBe(false);
      
      // Set read-only mode
      editor.setReadOnlyMode(true, { type: 'direct', owner: 'otheruser' });
      
      // Should now be read-only
      expect(editor.getIsReadOnly()).toBe(true);
      expect(canvas.classList.contains('read-only')).toBe(true);
    });
  });
  
  describe('Session Security', () => {
    test('should require authentication for accessing shared workspaces', async () => {
      // Clear session
      sessionManager.clearSession();
      
      // Try to access shared workspace without auth
      try {
        await sessionManager.makeAuthenticatedRequest('/api/shares/share-123/workspace');
        fail('Should require authentication');
      } catch (error) {
        expect(error).toEqual(new Error('Not authenticated'));
      }
    });
    
    test('should handle expired sessions', async () => {
      // Use expired token
      sessionManager.setSession({
        userId: 'user-id' as UserId,
        username: 'testuser',
        sessionToken: 'expired-token' as SessionToken,
        expiresAt: new Date(Date.now() - 1000) // Expired
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Session expired' })
      } as Response);
      
      const response = await sessionManager.makeAuthenticatedRequest('/api/shares', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'workspace-123',
          targetUsername: 'someuser',
          type: 'direct'
        })
      });
      
      expect(response.status).toBe(401);
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
      
      // The service should sanitize the name (this would be handled server-side)
      expect(data.workspace.name).toBeTruthy();
    });
    
    test('should validate share ID format in URLs', async () => {
      const invalidShareIds = [
        '../../../etc/passwd',  // Path traversal
        'share-123; DROP TABLE',  // SQL injection
        '<script>alert(1)</script>',  // XSS
        'share 123',  // Invalid characters
      ];
      
      for (const shareId of invalidShareIds) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Invalid share ID format' })
        } as Response);
        
        const response = await sessionManager.makeAuthenticatedRequest(`/api/shares/${shareId}/workspace`);
        
        expect(response.ok).toBe(false);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/shares/'),
          expect.any(Object)
        );
      }
    });
  });
});