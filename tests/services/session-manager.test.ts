import { SessionManager } from '../../src/services/session-manager';
import type { UserId, SessionToken } from '../../src/types/auth.types';

// Mock window.dispatchEvent
const mockDispatchEvent = jest.fn();
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent,
  writable: true
});

// Mock fetch
global.fetch = jest.fn();

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionManager = SessionManager.getInstance();
  });

  describe('loadSharedWorkspace', () => {
    it('should load shared workspace successfully', async () => {
      // Set up authentication
      sessionManager.setSession({
        userId: 'test-user' as UserId,
        username: 'testuser',
        sessionToken: 'test-token' as SessionToken,
        expiresAt: new Date(Date.now() + 3600000)
      });

      // Mock successful workspace response
      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Shared Workspace',
        isReadOnly: true,
        shareInfo: {
          type: 'direct',
          owner: 'john_doe'
        },
        graphData: JSON.stringify({ nodes: [] })
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkspace
      });

      // Call loadSharedWorkspace
      await sessionManager.loadSharedWorkspace('workspace-123');

      // Verify API call
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/workspaces/workspace-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );

      // Verify event was dispatched
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loadSharedWorkspace',
          detail: {
            workspace: mockWorkspace,
            isReadOnly: true,
            shareInfo: mockWorkspace.shareInfo
          }
        })
      );
    });

    it('should throw error if workspace is not read-only', async () => {
      // Set up authentication
      sessionManager.setSession({
        userId: 'test-user' as UserId,
        username: 'testuser',
        sessionToken: 'test-token' as SessionToken,
        expiresAt: new Date(Date.now() + 3600000)
      });

      // Mock workspace response that is not read-only
      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Regular Workspace',
        isReadOnly: false
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkspace
      });

      // Call should throw error
      await expect(sessionManager.loadSharedWorkspace('workspace-123'))
        .rejects.toThrow('This is not a shared workspace');
    });

    it('should throw error if workspace fetch fails', async () => {
      // Set up authentication
      sessionManager.setSession({
        userId: 'test-user' as UserId,
        username: 'testuser',
        sessionToken: 'test-token' as SessionToken,
        expiresAt: new Date(Date.now() + 3600000)
      });

      // Mock failed response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      // Call should throw error
      await expect(sessionManager.loadSharedWorkspace('workspace-123'))
        .rejects.toThrow('Failed to load shared workspace');
    });

    it('should disable auto-save when loading shared workspace', async () => {
      // Set up authentication and auto-save
      sessionManager.setSession({
        userId: 'test-user' as UserId,
        username: 'testuser',
        sessionToken: 'test-token' as SessionToken,
        expiresAt: new Date(Date.now() + 3600000)
      });

      const mockAutoSaveCallback = jest.fn();
      sessionManager.enableAutoSave(mockAutoSaveCallback);

      // Mock successful workspace response
      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Shared Workspace',
        isReadOnly: true,
        shareInfo: {
          type: 'direct',
          owner: 'john_doe'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkspace
      });

      // Spy on disableAutoSave
      const disableAutoSaveSpy = jest.spyOn(sessionManager, 'disableAutoSave');

      // Call loadSharedWorkspace
      await sessionManager.loadSharedWorkspace('workspace-123');

      // Verify auto-save was disabled
      expect(disableAutoSaveSpy).toHaveBeenCalled();
    });
  });
});