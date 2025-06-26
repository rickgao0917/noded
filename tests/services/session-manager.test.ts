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

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SessionManager.getInstance();
      const instance2 = SessionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('session management', () => {
    it('should set and get session', () => {
      const session = {
        userId: 'test-user' as UserId,
        username: 'testuser',
        sessionToken: 'test-token' as SessionToken,
        expiresAt: new Date(Date.now() + 3600000)
      };

      sessionManager.setSession(session);
      const retrievedSession = sessionManager.getSession();
      
      expect(retrievedSession).toEqual(session);
    });

    it('should clear session', () => {
      const session = {
        userId: 'test-user' as UserId,
        username: 'testuser', 
        sessionToken: 'test-token' as SessionToken,
        expiresAt: new Date(Date.now() + 3600000)
      };

      sessionManager.setSession(session);
      sessionManager.clearSession();
      
      expect(sessionManager.getSession()).toBeNull();
    });
  });

});