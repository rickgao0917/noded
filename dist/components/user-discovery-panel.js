/**
 * User Discovery Panel Component
 *
 * Provides UI for searching users and viewing their workspaces
 * when the user discovery feature flag is enabled
 */
import { Logger } from '../utils/logger.js';
import { FeatureFlagService } from '../services/feature-flag-service.js';
import { UserDiscoveryApi } from '../services/user-discovery-api.js';
export class UserDiscoveryPanel {
    constructor() {
        this.logger = new Logger('UserDiscoveryPanel');
        this.featureFlags = FeatureFlagService.getInstance();
        this.discoveryApi = UserDiscoveryApi.getInstance();
        this.state = {
            isLoading: false,
            error: null,
            searchQuery: '',
            results: null,
            selectedUser: null,
            selectedUserWorkspaces: [],
            statistics: null
        };
        this.panelElement = null;
        this.searchTimeout = null;
    }
    static getInstance() {
        if (!UserDiscoveryPanel.instance) {
            UserDiscoveryPanel.instance = new UserDiscoveryPanel();
        }
        return UserDiscoveryPanel.instance;
    }
    /**
     * Initialize the user discovery panel
     */
    initialize(container) {
        this.logger.logFunctionEntry('initialize');
        if (!this.featureFlags.isEnabled('userDiscovery')) {
            this.logger.info('User discovery feature is disabled');
            return;
        }
        this.createPanel(container);
        this.loadStatistics();
        this.logger.logFunctionExit('initialize');
    }
    /**
     * Toggle the visibility of the user discovery panel
     */
    toggle() {
        this.logger.logFunctionEntry('toggle');
        if (!this.featureFlags.isEnabled('userDiscovery')) {
            this.logger.info('User discovery feature is disabled');
            return;
        }
        if (!this.panelElement) {
            this.logger.warn('Panel not initialized');
            return;
        }
        const isVisible = this.panelElement.style.display !== 'none';
        this.panelElement.style.display = isVisible ? 'none' : 'block';
        this.logger.info('Panel visibility toggled', { isVisible: !isVisible });
        this.logger.logFunctionExit('toggle');
    }
    /**
     * Create the panel DOM structure
     */
    createPanel(container) {
        this.logger.logFunctionEntry('createPanel');
        // Remove existing panel if any
        const existing = document.getElementById('user-discovery-panel');
        if (existing) {
            existing.remove();
        }
        this.panelElement = document.createElement('div');
        this.panelElement.id = 'user-discovery-panel';
        this.panelElement.className = 'user-discovery-panel';
        this.panelElement.style.display = 'none';
        this.panelElement.innerHTML = `
      <div class="discovery-header">
        <h3>User Discovery</h3>
        <button class="close-btn" id="discovery-close-btn">✕</button>
      </div>
      
      <div class="discovery-stats" id="discovery-stats">
        <div class="stat-item">
          <span class="stat-label">Total Users:</span>
          <span class="stat-value" id="total-users">-</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Active Users:</span>
          <span class="stat-value" id="active-users">-</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Workspaces:</span>
          <span class="stat-value" id="total-workspaces">-</span>
        </div>
      </div>

      <div class="discovery-search">
        <input 
          type="text" 
          id="user-search-input" 
          placeholder="Search users by username..." 
          class="search-input"
        >
        <div class="search-results" id="search-results"></div>
      </div>

      <div class="user-details" id="user-details" style="display: none;">
        <div class="user-info">
          <h4 id="selected-username"></h4>
          <p class="user-meta">
            <span id="user-workspace-count"></span> workspaces •
            Last seen: <span id="user-last-login"></span>
          </p>
        </div>
        <div class="workspace-list">
          <h5>Workspaces</h5>
          <div id="workspace-list-content"></div>
        </div>
      </div>
    `;
        // Add CSS styles
        this.addStyles();
        // Attach event listeners
        this.attachEventListeners();
        container.appendChild(this.panelElement);
        this.logger.logFunctionExit('createPanel');
    }
    /**
     * Add CSS styles for the panel
     */
    addStyles() {
        if (document.getElementById('user-discovery-styles')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'user-discovery-styles';
        style.textContent = `
      .user-discovery-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        max-height: 80vh;
        background: #2a2a2a;
        border: 1px solid #404040;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .discovery-header {
        padding: 1rem;
        border-bottom: 1px solid #404040;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #333;
      }

      .discovery-header h3 {
        margin: 0;
        font-size: 1.1rem;
        color: #fff;
      }

      .close-btn {
        background: none;
        border: none;
        color: #ccc;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .close-btn:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }

      .discovery-stats {
        padding: 1rem;
        border-bottom: 1px solid #404040;
        background: #262626;
      }

      .stat-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
      }

      .stat-item:last-child {
        margin-bottom: 0;
      }

      .stat-label {
        color: #ccc;
      }

      .stat-value {
        color: #4CAF50;
        font-weight: 500;
      }

      .discovery-search {
        padding: 1rem;
        border-bottom: 1px solid #404040;
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .search-input {
        width: 100%;
        padding: 0.75rem;
        background: #1a1a1a;
        border: 1px solid #404040;
        border-radius: 4px;
        color: #fff;
        font-size: 0.9rem;
        margin-bottom: 1rem;
      }

      .search-input:focus {
        outline: none;
        border-color: #007bff;
      }

      .search-results {
        flex: 1;
        overflow-y: auto;
        max-height: 300px;
      }

      .user-result {
        padding: 0.75rem;
        border: 1px solid #404040;
        border-radius: 4px;
        margin-bottom: 0.5rem;
        cursor: pointer;
        transition: all 0.2s;
        background: #1a1a1a;
      }

      .user-result:hover {
        background: #333;
        border-color: #007bff;
      }

      .user-result.selected {
        background: #007bff;
        border-color: #0056b3;
      }

      .user-result-name {
        font-weight: 500;
        color: #fff;
        margin-bottom: 0.25rem;
      }

      .user-result-meta {
        font-size: 0.8rem;
        color: #ccc;
      }

      .user-details {
        padding: 1rem;
        background: #262626;
        max-height: 300px;
        overflow-y: auto;
      }

      .user-info h4 {
        margin: 0 0 0.5rem 0;
        color: #fff;
      }

      .user-meta {
        margin: 0 0 1rem 0;
        font-size: 0.9rem;
        color: #ccc;
      }

      .workspace-list h5 {
        margin: 0 0 0.75rem 0;
        color: #fff;
        font-size: 1rem;
      }

      .workspace-item {
        padding: 0.5rem;
        background: #1a1a1a;
        border: 1px solid #404040;
        border-radius: 4px;
        margin-bottom: 0.5rem;
      }

      .workspace-item:last-child {
        margin-bottom: 0;
      }

      .workspace-name {
        font-weight: 500;
        color: #fff;
        margin-bottom: 0.25rem;
      }

      .workspace-meta {
        font-size: 0.8rem;
        color: #ccc;
      }

      .loading-message, .error-message, .empty-message {
        text-align: center;
        padding: 2rem;
        color: #ccc;
      }

      .error-message {
        color: #ff6b6b;
      }
    `;
        document.head.appendChild(style);
    }
    /**
     * Attach event listeners to panel elements
     */
    attachEventListeners() {
        if (!this.panelElement)
            return;
        // Close button
        const closeBtn = this.panelElement.querySelector('#discovery-close-btn');
        closeBtn === null || closeBtn === void 0 ? void 0 : closeBtn.addEventListener('click', () => this.toggle());
        // Search input
        const searchInput = this.panelElement.querySelector('#user-search-input');
        searchInput === null || searchInput === void 0 ? void 0 : searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            this.handleSearchInput(query);
        });
    }
    /**
     * Handle search input with debouncing
     */
    handleSearchInput(query) {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        this.state = Object.assign(Object.assign({}, this.state), { searchQuery: query });
        if (query.length < 2) {
            this.renderSearchResults([]);
            this.hideUserDetails();
            return;
        }
        this.searchTimeout = window.setTimeout(() => {
            this.performSearch(query);
        }, 300);
    }
    /**
     * Perform user search
     */
    async performSearch(query) {
        this.logger.logFunctionEntry('performSearch', { queryLength: query.length });
        this.setState({ isLoading: true, error: null });
        this.renderSearchResults(null, true);
        try {
            const results = await this.discoveryApi.searchUsers(query);
            this.setState({ results, isLoading: false });
            this.renderSearchResults(results.users);
        }
        catch (error) {
            this.logger.logError(error, 'performSearch');
            const errorMessage = error instanceof Error ? error.message : 'Search failed';
            this.setState({ isLoading: false, error: errorMessage });
            this.renderSearchResults(null, false, errorMessage);
        }
        this.logger.logFunctionExit('performSearch');
    }
    /**
     * Load and display user statistics
     */
    async loadStatistics() {
        this.logger.logFunctionEntry('loadStatistics');
        try {
            const statistics = await this.discoveryApi.getUserStatistics();
            this.setState({ statistics });
            this.renderStatistics(statistics);
        }
        catch (error) {
            this.logger.logError(error, 'loadStatistics');
        }
        this.logger.logFunctionExit('loadStatistics');
    }
    /**
     * Render user statistics
     */
    renderStatistics(stats) {
        if (!this.panelElement)
            return;
        const totalUsersEl = this.panelElement.querySelector('#total-users');
        const activeUsersEl = this.panelElement.querySelector('#active-users');
        const totalWorkspacesEl = this.panelElement.querySelector('#total-workspaces');
        if (totalUsersEl)
            totalUsersEl.textContent = stats.totalUsers.toString();
        if (activeUsersEl)
            activeUsersEl.textContent = stats.activeUsers.toString();
        if (totalWorkspacesEl)
            totalWorkspacesEl.textContent = stats.totalWorkspaces.toString();
    }
    /**
     * Render search results
     */
    renderSearchResults(users, isLoading = false, error) {
        if (!this.panelElement)
            return;
        const resultsContainer = this.panelElement.querySelector('#search-results');
        if (!resultsContainer)
            return;
        if (isLoading) {
            resultsContainer.innerHTML = '<div class="loading-message">Searching...</div>';
            return;
        }
        if (error) {
            resultsContainer.innerHTML = `<div class="error-message">${error}</div>`;
            return;
        }
        if (!users || users.length === 0) {
            resultsContainer.innerHTML = '<div class="empty-message">No users found</div>';
            return;
        }
        resultsContainer.innerHTML = users.map(user => `
      <div class="user-result" data-user-id="${user.id}">
        <div class="user-result-name">${this.escapeHtml(user.username)}</div>
        <div class="user-result-meta">
          ${user.workspaceCount} workspaces • 
          ${user.lastLogin ? this.formatDate(user.lastLogin) : 'Never logged in'}
        </div>
      </div>
    `).join('');
        // Attach click handlers
        resultsContainer.querySelectorAll('.user-result').forEach(element => {
            element.addEventListener('click', () => {
                const userId = element.getAttribute('data-user-id');
                if (userId) {
                    const user = users.find(u => u.id === userId);
                    if (user) {
                        this.selectUser(user);
                    }
                }
            });
        });
    }
    /**
     * Select a user and load their workspaces
     */
    async selectUser(user) {
        var _a;
        this.logger.logFunctionEntry('selectUser', { userId: user.id, username: user.username });
        // Update UI selection
        if (this.panelElement) {
            this.panelElement.querySelectorAll('.user-result').forEach(el => {
                el.classList.remove('selected');
            });
            (_a = this.panelElement.querySelector(`[data-user-id="${user.id}"]`)) === null || _a === void 0 ? void 0 : _a.classList.add('selected');
        }
        this.setState({ selectedUser: user, selectedUserWorkspaces: [] });
        this.showUserDetails(user);
        try {
            const workspaces = await this.discoveryApi.getUserWorkspaces(user.id);
            this.setState({ selectedUserWorkspaces: workspaces });
            this.renderUserWorkspaces(workspaces);
        }
        catch (error) {
            this.logger.logError(error, 'selectUser');
            this.renderUserWorkspaces([], error instanceof Error ? error.message : 'Failed to load workspaces');
        }
        this.logger.logFunctionExit('selectUser');
    }
    /**
     * Show user details panel
     */
    showUserDetails(user) {
        if (!this.panelElement)
            return;
        const userDetails = this.panelElement.querySelector('#user-details');
        const usernameEl = this.panelElement.querySelector('#selected-username');
        const workspaceCountEl = this.panelElement.querySelector('#user-workspace-count');
        const lastLoginEl = this.panelElement.querySelector('#user-last-login');
        if (usernameEl)
            usernameEl.textContent = user.username;
        if (workspaceCountEl)
            workspaceCountEl.textContent = user.workspaceCount.toString();
        if (lastLoginEl) {
            lastLoginEl.textContent = user.lastLogin ? this.formatDate(user.lastLogin) : 'Never';
        }
        if (userDetails) {
            userDetails.style.display = 'block';
        }
    }
    /**
     * Hide user details panel
     */
    hideUserDetails() {
        if (!this.panelElement)
            return;
        const userDetails = this.panelElement.querySelector('#user-details');
        if (userDetails) {
            userDetails.style.display = 'none';
        }
        this.setState({ selectedUser: null, selectedUserWorkspaces: [] });
    }
    /**
     * Render user workspaces
     */
    renderUserWorkspaces(workspaces, error) {
        if (!this.panelElement)
            return;
        const workspaceContainer = this.panelElement.querySelector('#workspace-list-content');
        if (!workspaceContainer)
            return;
        if (error) {
            workspaceContainer.innerHTML = `<div class="error-message">${error}</div>`;
            return;
        }
        if (workspaces.length === 0) {
            workspaceContainer.innerHTML = '<div class="empty-message">No workspaces found</div>';
            return;
        }
        workspaceContainer.innerHTML = workspaces.map(workspace => `
      <div class="workspace-item">
        <div class="workspace-name">${this.escapeHtml(workspace.name)}</div>
        <div class="workspace-meta">
          ${workspace.nodeCount ? `~${workspace.nodeCount} nodes • ` : ''}
          Updated ${this.formatDate(workspace.updatedAt)}
        </div>
      </div>
    `).join('');
    }
    /**
     * Update component state
     */
    setState(updates) {
        this.state = Object.assign(Object.assign({}, this.state), updates);
    }
    /**
     * Format date for display
     */
    formatDate(date) {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1)
            return 'Just now';
        if (minutes < 60)
            return `${minutes}m ago`;
        if (hours < 24)
            return `${hours}h ago`;
        if (days < 7)
            return `${days}d ago`;
        return date.toLocaleDateString();
    }
    /**
     * Escape HTML for safe rendering
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
