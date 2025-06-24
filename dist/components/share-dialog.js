import { Logger } from '../utils/logger.js';
import { SessionManager } from '../services/session-manager.js';
import { ShareErrorHandler } from '../utils/share-error-handler.js';
// interface ShareLink {
//   id: string;
//   token: string;
//   link: string;
//   requiresLogin: boolean;
//   createdAt: string;
//   expiresAt?: string;
//   accessCount: number;
// }
// interface ShareActivity {
//   id: string;
//   action: string;
//   user?: { id: string; username: string };
//   createdAt: string;
// }
export class ShareDialog {
    // private shareLinks: ShareLink[] = [];
    // private activities: ShareActivity[] = [];
    constructor(config) {
        this.dialogElement = null;
        this.searchDebounceTimer = null;
        this.currentTab = 'direct';
        this.shares = [];
        this.logger = new Logger('ShareDialog');
        this.sessionManager = SessionManager.getInstance();
        this.errorHandler = new ShareErrorHandler();
        this.config = config;
        this.logger.logFunctionEntry('constructor', { config });
        this.render();
        this.attachEventListeners();
        this.loadInitialData();
        this.logger.logFunctionExit('constructor', undefined);
    }
    render() {
        this.logger.logFunctionEntry('render', {});
        // Create dialog container
        this.dialogElement = document.createElement('div');
        this.dialogElement.className = 'share-dialog-overlay';
        this.dialogElement.innerHTML = `
      <div class="share-dialog">
        <div class="share-dialog-header">
          <h2>Share "${this.config.workspaceName}"</h2>
          <button class="close-button" aria-label="Close">×</button>
        </div>
        
        <div class="share-dialog-tabs">
          <button class="tab-button active" data-tab="direct">Direct Shares</button>
          <button class="tab-button" data-tab="link">Link Sharing</button>
          <button class="tab-button" data-tab="activity">Activity</button>
        </div>
        
        <div class="share-dialog-content">
          <!-- Direct Shares Tab -->
          <div class="tab-content active" data-tab-content="direct">
            <div class="user-search-section">
              <h3>Share with users</h3>
              <div class="search-container">
                <input 
                  type="text" 
                  class="user-search-input" 
                  placeholder="Search users by username..."
                  autocomplete="off"
                />
                <div class="search-results"></div>
              </div>
            </div>
            
            <div class="current-shares-section">
              <h3>Current shares</h3>
              <div class="shares-list">
                <div class="loading">Loading shares...</div>
              </div>
            </div>
          </div>
          
          <!-- Link Sharing Tab -->
          <div class="tab-content" data-tab-content="link">
            <div class="link-options">
              <h3>Create shareable link</h3>
              <label class="checkbox-label">
                <input type="checkbox" class="require-login-checkbox" checked />
                Require login to view
              </label>
              <div class="expiration-select-container">
                <label>Link expires:</label>
                <select class="expiration-select">
                  <option value="">Never</option>
                  <option value="1">1 hour</option>
                  <option value="24">1 day</option>
                  <option value="168">1 week</option>
                  <option value="720">1 month</option>
                </select>
              </div>
              <button class="generate-link-button">Generate Link</button>
            </div>
            
            <div class="active-links-section">
              <h3>Active links</h3>
              <div class="links-list">
                <div class="loading">Loading links...</div>
              </div>
            </div>
          </div>
          
          <!-- Activity Tab -->
          <div class="tab-content" data-tab-content="activity">
            <h3>Recent activity</h3>
            <div class="activity-list">
              <div class="loading">Loading activity...</div>
            </div>
          </div>
        </div>
      </div>
    `;
        // Add styles
        this.addStyles();
        // Append to body
        document.body.appendChild(this.dialogElement);
        this.logger.logInfo('Share dialog rendered', 'render', {
            workspaceId: this.config.workspaceId
        });
        this.logger.logFunctionExit('render', undefined);
    }
    addStyles() {
        const styleId = 'share-dialog-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
        .share-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }
        
        .share-dialog {
          background: white;
          border-radius: 8px;
          width: 600px;
          max-width: 90vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }
        
        .share-dialog-header {
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .share-dialog-header h2 {
          margin: 0;
          font-size: 20px;
          color: #333;
        }
        
        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .close-button:hover {
          background-color: #f0f0f0;
        }
        
        .share-dialog-tabs {
          display: flex;
          border-bottom: 1px solid #e0e0e0;
          padding: 0 20px;
        }
        
        .tab-button {
          background: none;
          border: none;
          padding: 12px 20px;
          cursor: pointer;
          color: #666;
          font-size: 14px;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        
        .tab-button:hover {
          color: #333;
        }
        
        .tab-button.active {
          color: #2196F3;
          border-bottom-color: #2196F3;
        }
        
        .share-dialog-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        
        .tab-content {
          display: none;
        }
        
        .tab-content.active {
          display: block;
        }
        
        .user-search-section h3,
        .current-shares-section h3,
        .link-options h3,
        .active-links-section h3 {
          margin: 0 0 15px 0;
          font-size: 16px;
          color: #333;
        }
        
        .search-container {
          position: relative;
          margin-bottom: 30px;
        }
        
        .user-search-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .user-search-input:focus {
          outline: none;
          border-color: #2196F3;
        }
        
        .search-results {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-top: 4px;
          max-height: 200px;
          overflow-y: auto;
          display: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .search-results.visible {
          display: block;
        }
        
        .search-result-item {
          padding: 10px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .search-result-item:hover {
          background-color: #f5f5f5;
        }
        
        .share-button {
          background: #2196F3;
          color: white;
          border: none;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }
        
        .share-button:hover {
          background: #1976D2;
        }
        
        .shares-list,
        .links-list,
        .activity-list {
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          min-height: 150px;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .share-item,
        .link-item,
        .activity-item {
          padding: 12px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .share-item:last-child,
        .link-item:last-child,
        .activity-item:last-child {
          border-bottom: none;
        }
        
        .share-info,
        .link-info {
          flex: 1;
        }
        
        .share-username,
        .link-url {
          font-weight: 500;
          color: #333;
          margin-bottom: 4px;
        }
        
        .share-date,
        .link-date,
        .activity-date {
          font-size: 12px;
          color: #666;
        }
        
        .revoke-button {
          background: #f44336;
          color: white;
          border: none;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }
        
        .revoke-button:hover {
          background: #d32f2f;
        }
        
        .copy-button {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          margin-right: 8px;
        }
        
        .copy-button:hover {
          background: #45a049;
        }
        
        .copy-button.copied {
          background: #666;
        }
        
        .link-options {
          margin-bottom: 30px;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          margin: 15px 0;
          cursor: pointer;
        }
        
        .checkbox-label input {
          margin-right: 8px;
        }
        
        .expiration-select-container {
          margin: 15px 0;
        }
        
        .expiration-select-container label {
          display: block;
          margin-bottom: 4px;
          font-size: 14px;
          color: #666;
        }
        
        .expiration-select {
          width: 200px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .generate-link-button {
          background: #4CAF50;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-top: 10px;
        }
        
        .generate-link-button:hover {
          background: #45a049;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #999;
        }
        
        .error-message {
          color: #f44336;
          padding: 10px;
          text-align: center;
        }
      `;
            document.head.appendChild(style);
        }
    }
    attachEventListeners() {
        this.logger.logFunctionEntry('attachEventListeners', {});
        if (!this.dialogElement) {
            return;
        }
        // Close button
        const closeButton = this.dialogElement.querySelector('.close-button');
        closeButton === null || closeButton === void 0 ? void 0 : closeButton.addEventListener('click', () => this.close());
        // Click outside to close
        this.dialogElement.addEventListener('click', (event) => {
            if (event.target === this.dialogElement) {
                this.close();
            }
        });
        // Tab switching
        const tabButtons = this.dialogElement.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const tab = event.target.dataset.tab;
                if (tab) {
                    this.switchTab(tab);
                }
            });
        });
        // User search
        const searchInput = this.dialogElement.querySelector('.user-search-input');
        searchInput === null || searchInput === void 0 ? void 0 : searchInput.addEventListener('input', (event) => {
            this.handleUserSearch(event.target.value);
        });
        // Generate link button
        const generateButton = this.dialogElement.querySelector('.generate-link-button');
        generateButton === null || generateButton === void 0 ? void 0 : generateButton.addEventListener('click', () => this.generateShareLink());
        this.logger.logInfo('Event listeners attached', 'attachEventListeners');
        this.logger.logFunctionExit('attachEventListeners', undefined);
    }
    async loadInitialData() {
        this.logger.logFunctionEntry('loadInitialData', {});
        // Load data based on current tab
        switch (this.currentTab) {
            case 'direct':
                await this.loadShares();
                break;
            case 'link':
                await this.loadShareLinks();
                break;
            case 'activity':
                await this.loadActivity();
                break;
        }
        this.logger.logFunctionExit('loadInitialData', undefined);
    }
    switchTab(tab) {
        this.logger.logFunctionEntry('switchTab', { tab });
        if (!this.dialogElement) {
            return;
        }
        this.currentTab = tab;
        // Update tab buttons
        const tabButtons = this.dialogElement.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            if (button.getAttribute('data-tab') === tab) {
                button.classList.add('active');
            }
            else {
                button.classList.remove('active');
            }
        });
        // Update tab content
        const tabContents = this.dialogElement.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            if (content.getAttribute('data-tab-content') === tab) {
                content.classList.add('active');
            }
            else {
                content.classList.remove('active');
            }
        });
        // Load data for the new tab
        this.loadInitialData();
        this.logger.logInfo('Tab switched', 'switchTab', { newTab: tab });
        this.logger.logFunctionExit('switchTab', undefined);
    }
    handleUserSearch(query) {
        var _a;
        this.logger.logFunctionEntry('handleUserSearch', { query });
        // Clear previous timer
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        const searchResults = (_a = this.dialogElement) === null || _a === void 0 ? void 0 : _a.querySelector('.search-results');
        if (!searchResults) {
            return;
        }
        // Validate username input
        const validation = this.errorHandler.validateUsername(query);
        if (!validation.valid && query.trim().length > 0) {
            searchResults.classList.add('visible');
            searchResults.innerHTML = `<div class="share-message warning">${validation.error}</div>`;
            return;
        }
        // Hide results if query is too short
        if (query.trim().length < 2) {
            searchResults.classList.remove('visible');
            searchResults.innerHTML = '';
            return;
        }
        // Show loading state
        searchResults.innerHTML = '<div class="loading">Searching...</div>';
        searchResults.classList.add('visible');
        // Debounce search
        this.searchDebounceTimer = setTimeout(async () => {
            try {
                const response = await this.sessionManager.makeAuthenticatedRequest(`/api/shares/users/search?q=${encodeURIComponent(query)}&limit=10`);
                if (!response.ok) {
                    throw new Error('Search failed');
                }
                const data = await response.json();
                this.displaySearchResults(data.users);
                this.logger.logInfo('User search completed', 'handleUserSearch', {
                    query,
                    resultCount: data.users.length
                });
            }
            catch (error) {
                this.logger.logError(error, 'handleUserSearch');
                const errorDisplay = this.errorHandler.handleShareError(error);
                searchResults.innerHTML = `<div class="share-message ${errorDisplay.type}">${errorDisplay.message}</div>`;
            }
        }, 300);
        this.logger.logFunctionExit('handleUserSearch', undefined);
    }
    displaySearchResults(users) {
        var _a;
        this.logger.logFunctionEntry('displaySearchResults', { userCount: users.length });
        const searchResults = (_a = this.dialogElement) === null || _a === void 0 ? void 0 : _a.querySelector('.search-results');
        if (!searchResults) {
            return;
        }
        if (users.length === 0) {
            searchResults.innerHTML = '<div class="empty-state">No users found</div>';
            return;
        }
        searchResults.innerHTML = users.map(user => `
      <div class="search-result-item" data-user-id="${user.id}">
        <span>${user.username}</span>
        <button class="share-button" data-user-id="${user.id}" data-username="${user.username}">
          Share
        </button>
      </div>
    `).join('');
        // Attach click handlers
        searchResults.querySelectorAll('.share-button').forEach(button => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                const userId = event.target.dataset.userId;
                const username = event.target.dataset.username;
                await this.shareWithUser(userId, username);
            });
        });
        this.logger.logFunctionExit('displaySearchResults', undefined);
    }
    async shareWithUser(userId, username) {
        var _a, _b;
        this.logger.logFunctionEntry('shareWithUser', { userId, username });
        try {
            const response = await this.sessionManager.makeAuthenticatedRequest(`/api/shares/workspaces/${this.config.workspaceId}/shares`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shareWithUserId: userId })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to share workspace');
            }
            this.logger.logInfo('Workspace shared successfully', 'shareWithUser', {
                workspaceId: this.config.workspaceId,
                sharedWithUserId: userId
            });
            // Clear search
            const searchInput = (_a = this.dialogElement) === null || _a === void 0 ? void 0 : _a.querySelector('.user-search-input');
            if (searchInput) {
                searchInput.value = '';
            }
            const searchResults = (_b = this.dialogElement) === null || _b === void 0 ? void 0 : _b.querySelector('.search-results');
            if (searchResults) {
                searchResults.classList.remove('visible');
                searchResults.innerHTML = '';
            }
            // Reload shares list
            await this.loadShares();
            // Show success message
            this.showToast(`Shared with ${username}`, 'success');
        }
        catch (error) {
            this.logger.logError(error, 'shareWithUser');
            const errorDisplay = this.errorHandler.handleShareError(error);
            this.showToast(errorDisplay.message, errorDisplay.type);
        }
        this.logger.logFunctionExit('shareWithUser', undefined);
    }
    async loadShares() {
        var _a;
        this.logger.logFunctionEntry('loadShares', {});
        const sharesList = (_a = this.dialogElement) === null || _a === void 0 ? void 0 : _a.querySelector('.shares-list');
        if (!sharesList) {
            return;
        }
        try {
            const response = await this.sessionManager.makeAuthenticatedRequest(`/api/shares/workspaces/${this.config.workspaceId}/shares`);
            if (!response.ok) {
                throw new Error('Failed to load shares');
            }
            const data = await response.json();
            this.shares = data.shares;
            if (this.shares.length === 0) {
                sharesList.innerHTML = '<div class="empty-state">No users have access to this workspace</div>';
            }
            else {
                sharesList.innerHTML = this.shares.map(share => `
          <div class="share-item">
            <div class="share-info">
              <div class="share-username">${share.sharedWithUsername}</div>
              <div class="share-date">
                Shared ${this.formatDate(share.createdAt)}
                ${share.lastAccessed ? ` · Last accessed ${this.formatDate(share.lastAccessed)}` : ''}
              </div>
            </div>
            <button class="revoke-button" data-user-id="${share.sharedWithUserId}">
              Revoke
            </button>
          </div>
        `).join('');
                // Attach revoke handlers
                sharesList.querySelectorAll('.revoke-button').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const userId = event.target.dataset.userId;
                        await this.revokeShare(userId);
                    });
                });
            }
            this.logger.logInfo('Shares loaded', 'loadShares', {
                count: this.shares.length
            });
        }
        catch (error) {
            this.logger.logError(error, 'loadShares');
            sharesList.innerHTML = '<div class="error-message">Failed to load shares</div>';
        }
        this.logger.logFunctionExit('loadShares', undefined);
    }
    async revokeShare(userId) {
        this.logger.logFunctionEntry('revokeShare', { userId });
        try {
            const response = await this.sessionManager.makeAuthenticatedRequest(`/api/shares/workspaces/${this.config.workspaceId}/shares/${userId}`, { method: 'DELETE' });
            if (!response.ok) {
                throw new Error('Failed to revoke share');
            }
            this.logger.logInfo('Share revoked successfully', 'revokeShare', {
                workspaceId: this.config.workspaceId,
                revokedUserId: userId
            });
            // Reload shares
            await this.loadShares();
            this.showToast('Share access revoked', 'success');
        }
        catch (error) {
            this.logger.logError(error, 'revokeShare');
            this.showToast('Failed to revoke share', 'error');
        }
        this.logger.logFunctionExit('revokeShare', undefined);
    }
    async generateShareLink() {
        var _a, _b, _c, _d;
        this.logger.logFunctionEntry('generateShareLink', {});
        try {
            const requireLogin = (_b = (_a = this.dialogElement) === null || _a === void 0 ? void 0 : _a.querySelector('.require-login-checkbox')) === null || _b === void 0 ? void 0 : _b.checked;
            const expiresIn = (_d = (_c = this.dialogElement) === null || _c === void 0 ? void 0 : _c.querySelector('.expiration-select')) === null || _d === void 0 ? void 0 : _d.value;
            const body = { requiresLogin: requireLogin };
            if (expiresIn) {
                body.expiresIn = parseInt(expiresIn);
            }
            const response = await this.sessionManager.makeAuthenticatedRequest(`/api/shares/workspaces/${this.config.workspaceId}/share-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                throw new Error('Failed to generate link');
            }
            const data = await response.json();
            this.logger.logInfo('Share link generated', 'generateShareLink', {
                workspaceId: this.config.workspaceId,
                requiresLogin: requireLogin,
                expiresIn
            });
            // Reload links list
            await this.loadShareLinks();
            // Copy to clipboard
            try {
                await navigator.clipboard.writeText(data.link);
                this.showToast('Link copied to clipboard!', 'success');
            }
            catch (clipboardError) {
                // Fallback if clipboard API fails
                this.showToast('Link generated successfully', 'success');
            }
        }
        catch (error) {
            this.logger.logError(error, 'generateShareLink');
            this.showToast('Failed to generate link', 'error');
        }
        this.logger.logFunctionExit('generateShareLink', undefined);
    }
    async loadShareLinks() {
        var _a;
        this.logger.logFunctionEntry('loadShareLinks', {});
        const linksList = (_a = this.dialogElement) === null || _a === void 0 ? void 0 : _a.querySelector('.links-list');
        if (!linksList) {
            return;
        }
        // For now, show a placeholder since we don't have an endpoint to list share links
        linksList.innerHTML = '<div class="empty-state">Share link feature coming soon</div>';
        this.logger.logFunctionExit('loadShareLinks', undefined);
    }
    async loadActivity() {
        var _a;
        this.logger.logFunctionEntry('loadActivity', {});
        const activityList = (_a = this.dialogElement) === null || _a === void 0 ? void 0 : _a.querySelector('.activity-list');
        if (!activityList) {
            return;
        }
        // For now, show a placeholder since we don't have an activity endpoint
        activityList.innerHTML = '<div class="empty-state">Activity tracking coming soon</div>';
        this.logger.logFunctionExit('loadActivity', undefined);
    }
    showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        // Determine background color based on type
        let backgroundColor;
        switch (type) {
            case 'success':
                backgroundColor = '#4CAF50';
                break;
            case 'error':
                backgroundColor = '#f44336';
                break;
            case 'warning':
                backgroundColor = '#ff9800';
                break;
            case 'info':
                backgroundColor = '#2196F3';
                break;
        }
        toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${backgroundColor};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10001;
      animation: slideIn 0.3s ease-out;
    `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1)
            return 'just now';
        if (diffMins < 60)
            return `${diffMins}m ago`;
        if (diffHours < 24)
            return `${diffHours}h ago`;
        if (diffDays < 7)
            return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
    close() {
        var _a;
        this.logger.logFunctionEntry('close', {});
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        (_a = this.dialogElement) === null || _a === void 0 ? void 0 : _a.remove();
        this.config.onClose();
        this.logger.logInfo('Share dialog closed', 'close');
        this.logger.logFunctionExit('close', undefined);
    }
}
