import { Logger } from '../utils/logger.js';
export class SessionManager {
    constructor() {
        this.logger = new Logger('SessionManager');
        this.session = null;
        this.autoSaveInterval = null;
        this.autoSaveCallback = null;
        this.AUTO_SAVE_INTERVAL = 5000; // 5 seconds
        this.lastSaveTime = 0;
        this.pendingSave = false;
        // Check for existing session in localStorage
        this.loadSessionFromStorage();
    }
    static getInstance() {
        if (!SessionManager.instance) {
            SessionManager.instance = new SessionManager();
        }
        return SessionManager.instance;
    }
    loadSessionFromStorage() {
        try {
            const storedSession = localStorage.getItem('userSession');
            if (storedSession) {
                const session = JSON.parse(storedSession);
                // Check if session is expired
                if (new Date(session.expiresAt) > new Date()) {
                    this.session = session;
                    this.logger.info('Session loaded from storage', { userId: session.userId });
                }
                else {
                    localStorage.removeItem('userSession');
                    this.logger.info('Expired session removed from storage');
                }
            }
        }
        catch (error) {
            this.logger.logError(error, 'loadSessionFromStorage');
            localStorage.removeItem('userSession');
        }
    }
    setSession(session) {
        this.logger.logFunctionEntry('setSession', { userId: session.userId });
        this.session = session;
        // Store in localStorage
        try {
            localStorage.setItem('userSession', JSON.stringify(session));
        }
        catch (error) {
            this.logger.logError(error, 'setSession');
        }
        this.logger.logFunctionExit('setSession');
    }
    clearSession() {
        this.logger.logFunctionEntry('clearSession');
        this.session = null;
        localStorage.removeItem('userSession');
        this.disableAutoSave();
        this.logger.logFunctionExit('clearSession');
    }
    getSession() {
        return this.session;
    }
    isAuthenticated() {
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
    async validateSession() {
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
            }
            else if (response.status === 401) {
                this.clearSession();
                return false;
            }
            return false;
        }
        catch (error) {
            this.logger.logError(error, 'validateSession');
            return false;
        }
        finally {
            this.logger.logFunctionExit('validateSession');
        }
    }
    enableAutoSave(callback) {
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
    disableAutoSave() {
        this.logger.logFunctionEntry('disableAutoSave');
        if (this.autoSaveInterval !== null) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        this.autoSaveCallback = null;
        this.logger.info('Auto-save disabled');
        this.logger.logFunctionExit('disableAutoSave');
    }
    async performAutoSave() {
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
        }
        catch (error) {
            this.logger.logError(error, 'performAutoSave');
        }
        finally {
            this.pendingSave = false;
        }
    }
    async makeAuthenticatedRequest(url, options = {}) {
        if (!this.session) {
            throw new Error('Not authenticated');
        }
        const headers = Object.assign(Object.assign({}, options.headers), { 'Authorization': `Bearer ${this.session.sessionToken}`, 'Content-Type': 'application/json' });
        const response = await fetch(url, Object.assign(Object.assign({}, options), { headers }));
        // If unauthorized, clear session
        if (response.status === 401) {
            this.clearSession();
            // Trigger re-authentication
            window.dispatchEvent(new CustomEvent('sessionExpired'));
        }
        return response;
    }
    getAuthHeaders() {
        if (!this.session) {
            return {};
        }
        return {
            'Authorization': `Bearer ${this.session.sessionToken}`,
            'Content-Type': 'application/json'
        };
    }
    // Trigger immediate save (useful for important changes)
    async triggerSave() {
        if (this.autoSaveCallback && this.isAuthenticated()) {
            await this.performAutoSave();
        }
    }
    async loadSharedWorkspace(workspaceId) {
        var _a;
        this.logger.logFunctionEntry('loadSharedWorkspace', { workspaceId });
        try {
            // Stop auto-save for current workspace
            this.disableAutoSave();
            // Fetch shared workspace
            const response = await this.makeAuthenticatedRequest(`/api/shares/${workspaceId}/workspace`);
            if (!response.ok) {
                throw new Error('Failed to load shared workspace');
            }
            const workspace = await response.json();
            // Check if it's a shared workspace
            if (!workspace.isReadOnly) {
                throw new Error('This is not a shared workspace');
            }
            // Dispatch event for GraphEditor to load
            const event = new CustomEvent('loadSharedWorkspace', {
                detail: {
                    workspace,
                    isReadOnly: true,
                    shareInfo: workspace.shareInfo
                }
            });
            window.dispatchEvent(event);
            this.logger.info('Shared workspace loaded', {
                workspaceId,
                workspaceName: workspace.name,
                shareType: (_a = workspace.shareInfo) === null || _a === void 0 ? void 0 : _a.type
            });
        }
        catch (error) {
            this.logger.logError(error, 'loadSharedWorkspace');
            throw error;
        }
        this.logger.logFunctionExit('loadSharedWorkspace');
    }
}
