import { Logger } from '../utils/logger';
import type { UserSession } from '../types/auth.types';

export class SessionManager {
  private static instance: SessionManager;
  private readonly logger = new Logger('SessionManager');
  private session: UserSession | null = null;
  private autoSaveInterval: number | null = null;
  private autoSaveCallback: (() => Promise<void>) | null = null;
  private readonly AUTO_SAVE_INTERVAL = 5000; // 5 seconds
  private lastSaveTime = 0;
  private pendingSave = false;

  private constructor() {
    // Check for existing session in localStorage
    this.loadSessionFromStorage();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  private loadSessionFromStorage(): void {
    try {
      const storedSession = localStorage.getItem('userSession');
      if (storedSession) {
        const session = JSON.parse(storedSession) as UserSession;
        // Check if session is expired
        if (new Date(session.expiresAt) > new Date()) {
          this.session = session;
          this.logger.info('Session loaded from storage', { userId: session.userId });
        } else {
          localStorage.removeItem('userSession');
          this.logger.info('Expired session removed from storage');
        }
      }
    } catch (error) {
      this.logger.logError(error as Error, 'loadSessionFromStorage');
      localStorage.removeItem('userSession');
    }
  }

  public setSession(session: UserSession): void {
    this.logger.logFunctionEntry('setSession', { userId: session.userId });
    
    this.session = session;
    
    // Store in localStorage
    try {
      localStorage.setItem('userSession', JSON.stringify(session));
    } catch (error) {
      this.logger.logError(error as Error, 'setSession');
    }
    
    this.logger.logFunctionExit('setSession');
  }

  public clearSession(): void {
    this.logger.logFunctionEntry('clearSession');
    
    this.session = null;
    localStorage.removeItem('userSession');
    this.disableAutoSave();
    
    this.logger.logFunctionExit('clearSession');
  }

  public getSession(): UserSession | null {
    return this.session;
  }

  public isAuthenticated(): boolean {
    if (!this.session) {
      return false;
    }
    
    // Check if session is expired
    if (new Date(this.session.expiresAt) <= new Date()) {
      this.clearSession();
      return false;
    }
    
    return true;
  }

  public async validateSession(): Promise<boolean> {
    this.logger.logFunctionEntry('validateSession');
    
    try {
      if (!this.session) {
        return false;
      }

      const response = await fetch('/api/auth/session', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.session.sessionToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.setSession(data.session);
        return true;
      } else if (response.status === 401) {
        this.clearSession();
        return false;
      }

      return false;
    } catch (error) {
      this.logger.logError(error as Error, 'validateSession');
      return false;
    } finally {
      this.logger.logFunctionExit('validateSession');
    }
  }

  public enableAutoSave(callback: () => Promise<void>): void {
    this.logger.logFunctionEntry('enableAutoSave');
    
    this.autoSaveCallback = callback;
    
    // Clear any existing interval
    this.disableAutoSave();
    
    // Set up new interval
    this.autoSaveInterval = window.setInterval(() => {
      this.performAutoSave();
    }, this.AUTO_SAVE_INTERVAL);
    
    this.logger.info('Auto-save enabled');
    this.logger.logFunctionExit('enableAutoSave');
  }

  public disableAutoSave(): void {
    this.logger.logFunctionEntry('disableAutoSave');
    
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    
    this.autoSaveCallback = null;
    this.logger.info('Auto-save disabled');
    this.logger.logFunctionExit('disableAutoSave');
  }

  private async performAutoSave(): Promise<void> {
    if (!this.autoSaveCallback || this.pendingSave || !this.isAuthenticated()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastSaveTime < this.AUTO_SAVE_INTERVAL) {
      return;
    }

    this.pendingSave = true;
    
    try {
      await this.autoSaveCallback();
      this.lastSaveTime = now;
      this.logger.debug('Auto-save completed');
    } catch (error) {
      this.logger.logError(error as Error, 'performAutoSave');
    } finally {
      this.pendingSave = false;
    }
  }

  public async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.session) {
      throw new Error('Not authenticated');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${this.session.sessionToken}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // If unauthorized, clear session
    if (response.status === 401) {
      this.clearSession();
      // Trigger re-authentication
      window.dispatchEvent(new CustomEvent('sessionExpired'));
    }

    return response;
  }

  public getAuthHeaders(): Record<string, string> {
    if (!this.session) {
      return {};
    }

    return {
      'Authorization': `Bearer ${this.session.sessionToken}`,
      'Content-Type': 'application/json'
    };
  }

  // Trigger immediate save (useful for important changes)
  public async triggerSave(): Promise<void> {
    if (this.autoSaveCallback && this.isAuthenticated()) {
      await this.performAutoSave();
    }
  }
}