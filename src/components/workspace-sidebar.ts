import { Logger } from '../utils/logger';
import { SessionManager } from '../services/session-manager';
import { ShareDialog } from './share-dialog';
import type { GraphEditor } from './graph-editor';

export interface WorkspaceInfo {
  id: string;
  name: string;
  updatedAt: Date;
}

export interface SharedWorkspaceInfo extends WorkspaceInfo {
  ownerId: string;
  ownerUsername: string;
  sharedAt: Date;
  expiresAt?: Date;
}

export class WorkspaceSidebar {
  private static instance: WorkspaceSidebar;
  private readonly logger = new Logger('WorkspaceSidebar');
  private readonly sessionManager = SessionManager.getInstance();
  private workspaces: WorkspaceInfo[] = [];
  private sharedWorkspaces: SharedWorkspaceInfo[] = [];
  private currentWorkspaceId: string | null = null;
  private editor: GraphEditor | null = null;
  private onWorkspaceChange: ((workspaceId: string) => void) | null = null;
  private shareDialog: ShareDialog | null = null;

  private constructor() {}

  public static getInstance(): WorkspaceSidebar {
    if (!WorkspaceSidebar.instance) {
      WorkspaceSidebar.instance = new WorkspaceSidebar();
    }
    return WorkspaceSidebar.instance;
  }

  public initialize(
    container: HTMLElement,
    editor: GraphEditor,
    onWorkspaceChange: (workspaceId: string) => void
  ): void {
    this.logger.logFunctionEntry('initialize');
    
    this.editor = editor;
    this.onWorkspaceChange = onWorkspaceChange;
    
    // Create sidebar element
    this.createSidebar(container);
    
    // Load workspaces
    this.loadWorkspaces();
    
    this.logger.logFunctionExit('initialize');
  }

  private createSidebar(container: HTMLElement): void {
    // Check if sidebar already exists
    if (document.getElementById('workspace-sidebar')) {
      return;
    }

    // Create sidebar HTML
    const sidebar = document.createElement('div');
    sidebar.id = 'workspace-sidebar';
    sidebar.className = 'workspace-sidebar';
    sidebar.innerHTML = `
      <div class="workspace-sidebar-header">
        <h3>Workspaces</h3>
        <button class="workspace-new-btn" id="new-workspace-btn" title="New Workspace">+</button>
      </div>
      <div class="workspace-list" id="workspace-list">
        <div class="workspace-loading">Loading...</div>
      </div>
      
      <div class="workspace-section-divider"></div>
      
      <div class="shared-workspace-section">
        <h4 class="shared-workspace-header">Shared with me</h4>
        <div class="shared-workspace-list" id="shared-workspace-list">
          <div class="workspace-loading">Loading...</div>
        </div>
      </div>
      
      <div class="workspace-sidebar-footer">
        <button class="workspace-logout-btn" id="logout-btn" title="Logout">🚪 Logout</button>
      </div>
    `;

    container.appendChild(sidebar);

    // Add CSS if not already present
    if (!document.getElementById('workspace-sidebar-styles')) {
      const style = document.createElement('style');
      style.id = 'workspace-sidebar-styles';
      style.textContent = `
        .workspace-sidebar {
          position: fixed;
          left: 0;
          top: 0;
          width: 250px;
          height: 100vh;
          background: #f5f5f5;
          border-right: 1px solid #ddd;
          display: flex;
          flex-direction: column;
          z-index: 100;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .workspace-sidebar-header {
          padding: 1rem;
          border-bottom: 1px solid #ddd;
          background: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .workspace-sidebar-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: #333;
        }

        .workspace-new-btn {
          width: 30px;
          height: 30px;
          border: none;
          background: #007bff;
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1.2rem;
          line-height: 1;
          transition: background-color 0.2s;
        }

        .workspace-new-btn:hover {
          background: #0056b3;
        }

        .workspace-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .workspace-item {
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: white;
          color: #333;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .workspace-item:hover {
          background: #f8f9fa;
          border-color: #007bff;
        }

        .workspace-item.active {
          background: #e7f3ff;
          color: #333;
          border-color: #007bff;
        }

        .workspace-item.active .workspace-actions button {
          color: #333;
          border-color: #007bff;
          background: white;
        }
        
        .workspace-item.active .workspace-actions button:hover {
          background: #f0f0f0;
        }

        .workspace-info {
          flex: 1;
          min-width: 0;
        }

        .workspace-name {
          font-weight: 500;
          margin-bottom: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .workspace-meta {
          font-size: 0.75rem;
          opacity: 0.7;
        }

        .workspace-actions {
          display: flex;
          gap: 0.25rem;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .workspace-item:hover .workspace-actions {
          opacity: 1;
        }

        .workspace-item.active .workspace-actions {
          opacity: 1;
        }

        .workspace-actions button {
          padding: 0.25rem;
          border: 1px solid #ddd;
          background: white;
          color: #333;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.75rem;
          line-height: 1;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .workspace-actions button:hover {
          background: #f8f9fa;
        }

        .workspace-name-input {
          width: 100%;
          padding: 0.25rem;
          border: 1px solid #007bff;
          border-radius: 3px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .workspace-loading {
          text-align: center;
          padding: 2rem;
          color: #666;
        }

        .workspace-error {
          text-align: center;
          padding: 1rem;
          color: #dc3545;
          font-size: 0.875rem;
        }

        /* Adjust main content to account for sidebar */
        body.has-workspace-sidebar #canvas {
          margin-left: 250px;
        }

        body.has-workspace-sidebar .controls {
          left: 270px;
        }

        .workspace-sidebar-footer {
          padding: 1rem;
          border-top: 1px solid #ddd;
          background: white;
          margin-top: auto;
        }

        .workspace-logout-btn {
          width: 100%;
          padding: 0.75rem;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: background-color 0.2s;
        }

        .workspace-logout-btn:hover {
          background: #c82333;
        }

        .workspace-section-divider {
          border-bottom: 1px solid #ddd;
          margin: 1rem 0;
        }

        .shared-workspace-section {
          padding: 0 0.5rem;
        }

        .shared-workspace-header {
          padding: 0 0.5rem;
          margin: 0.5rem 0;
          font-size: 0.9rem;
          color: #666;
          font-weight: 500;
        }

        .shared-workspace-list {
          padding: 0;
        }

        .workspace-share-btn {
          padding: 0.25rem;
          border: 1px solid #28a745;
          background: white;
          color: #28a745;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.75rem;
          line-height: 1;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .workspace-share-btn:hover {
          background: #28a745;
          color: white;
        }
      `;
      document.head.appendChild(style);
    }

    // Add class to body
    document.body.classList.add('has-workspace-sidebar');

    // Attach event listeners
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const newBtn = document.getElementById('new-workspace-btn');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.createNewWorkspace());
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
  }

  private async loadWorkspaces(): Promise<void> {
    this.logger.logFunctionEntry('loadWorkspaces');
    
    try {
      const response = await this.sessionManager.makeAuthenticatedRequest('/api/workspaces');
      
      if (!response.ok) {
        throw new Error('Failed to load workspaces');
      }

      const workspaces = await response.json();
      this.workspaces = workspaces.map((w: any) => ({
        id: w.id,
        name: w.name,
        updatedAt: new Date(w.updatedAt)
      }));

      this.renderWorkspaces();
      
      // Also load shared workspaces
      await this.loadSharedWorkspaces();
    } catch (error) {
      this.logger.logError(error as Error, 'loadWorkspaces');
      this.showError('Failed to load workspaces');
    } finally {
      this.logger.logFunctionExit('loadWorkspaces');
    }
  }

  private async loadSharedWorkspaces(): Promise<void> {
    this.logger.logFunctionEntry('loadSharedWorkspaces');
    
    try {
      const response = await this.sessionManager.makeAuthenticatedRequest('/api/shares/shared-with-me');
      
      if (!response.ok) {
        throw new Error('Failed to load shared workspaces');
      }

      const data = await response.json();
      this.sharedWorkspaces = data.workspaces.map((w: any) => ({
        id: w.id,
        name: w.name,
        updatedAt: new Date(w.lastAccessed || w.sharedAt),
        ownerId: w.ownerId,
        ownerUsername: w.ownerUsername,
        sharedAt: new Date(w.sharedAt),
        expiresAt: w.expiresAt ? new Date(w.expiresAt) : undefined
      }));

      this.renderSharedWorkspaces();
    } catch (error) {
      this.logger.logError(error as Error, 'loadSharedWorkspaces');
      // Don't show error for shared workspaces - they're optional
    } finally {
      this.logger.logFunctionExit('loadSharedWorkspaces');
    }
  }

  private renderWorkspaces(): void {
    const listEl = document.getElementById('workspace-list');
    if (!listEl) return;

    if (this.workspaces.length === 0) {
      listEl.innerHTML = '<div class="workspace-loading">No workspaces yet</div>';
      return;
    }

    listEl.innerHTML = this.workspaces.map(workspace => `
      <div class="workspace-item ${workspace.id === this.currentWorkspaceId ? 'active' : ''}" 
           data-workspace-id="${workspace.id}">
        <div class="workspace-info">
          <div class="workspace-name">${this.escapeHtml(workspace.name)}</div>
          <div class="workspace-meta">
            ${this.formatDate(workspace.updatedAt)}
          </div>
        </div>
        <div class="workspace-actions">
          <button class="workspace-share-btn" title="Share" data-action="share">🔗</button>
          <button class="workspace-rename-btn" title="Rename" data-action="rename">✏️</button>
          <button class="workspace-delete-btn" title="Delete" data-action="delete">🗑</button>
        </div>
      </div>
    `).join('');

    // Attach click handlers
    const items = listEl.querySelectorAll('.workspace-item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const workspaceId = item.getAttribute('data-workspace-id');
        
        if (!workspaceId) return;

        if (target.getAttribute('data-action') === 'share') {
          e.stopPropagation();
          this.openShareDialog(workspaceId);
        } else if (target.getAttribute('data-action') === 'rename') {
          e.stopPropagation();
          this.startRename(workspaceId);
        } else if (target.getAttribute('data-action') === 'delete') {
          e.stopPropagation();
          this.deleteWorkspace(workspaceId);
        } else {
          this.switchWorkspace(workspaceId);
        }
      });
    });
  }

  private renderSharedWorkspaces(): void {
    const listEl = document.getElementById('shared-workspace-list');
    if (!listEl) return;

    if (this.sharedWorkspaces.length === 0) {
      listEl.innerHTML = '<div class="workspace-loading">No shared workspaces</div>';
      return;
    }

    listEl.innerHTML = this.sharedWorkspaces.map(workspace => `
      <div class="workspace-item ${workspace.id === this.currentWorkspaceId ? 'active' : ''}" 
           data-workspace-id="${workspace.id}">
        <div class="workspace-info">
          <div class="workspace-name">${this.escapeHtml(workspace.name)}</div>
          <div class="workspace-meta">
            Shared by ${this.escapeHtml(workspace.ownerUsername)} · ${this.formatDate(workspace.sharedAt)}
          </div>
        </div>
      </div>
    `).join('');

    // Attach click handlers
    const items = listEl.querySelectorAll('.workspace-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const workspaceId = item.getAttribute('data-workspace-id');
        if (workspaceId) {
          this.switchWorkspace(workspaceId);
        }
      });
    });
  }

  private async openShareDialog(workspaceId: string): Promise<void> {
    this.logger.logFunctionEntry('openShareDialog', { workspaceId });
    
    const workspace = this.workspaces.find(w => w.id === workspaceId);
    if (!workspace) {
      return;
    }

    // Close any existing dialog
    if (this.shareDialog) {
      this.shareDialog.close();
    }

    // Create new share dialog
    this.shareDialog = new ShareDialog({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      onClose: () => {
        this.shareDialog = null;
        // Reload shared workspaces in case something changed
        this.loadSharedWorkspaces();
      }
    });
    
    this.logger.logFunctionExit('openShareDialog');
  }

  private async createNewWorkspace(): Promise<void> {
    this.logger.logFunctionEntry('createNewWorkspace');
    
    const name = prompt('Enter workspace name:');
    if (!name || !name.trim()) {
      return;
    }

    try {
      const response = await this.sessionManager.makeAuthenticatedRequest('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create workspace');
      }

      const workspace = await response.json();
      
      // Add to list and switch to it
      this.workspaces.push({
        id: workspace.id,
        name: workspace.name,
        updatedAt: new Date(workspace.updatedAt)
      });
      
      this.renderWorkspaces();
      await this.switchWorkspace(workspace.id);
    } catch (error) {
      this.logger.logError(error as Error, 'createNewWorkspace');
      alert((error as Error).message);
    } finally {
      this.logger.logFunctionExit('createNewWorkspace');
    }
  }

  private async switchWorkspace(workspaceId: string): Promise<void> {
    this.logger.logFunctionEntry('switchWorkspace', { workspaceId });
    
    if (workspaceId === this.currentWorkspaceId) {
      return;
    }

    try {
      // Save current workspace first
      if (this.currentWorkspaceId && this.editor) {
        await this.saveCurrentWorkspace();
      }

      // Update UI
      this.currentWorkspaceId = workspaceId;
      this.renderWorkspaces();

      // Notify parent to load new workspace
      if (this.onWorkspaceChange) {
        this.onWorkspaceChange(workspaceId);
      }
    } catch (error) {
      this.logger.logError(error as Error, 'switchWorkspace');
      alert('Failed to switch workspace');
    } finally {
      this.logger.logFunctionExit('switchWorkspace');
    }
  }

  private async saveCurrentWorkspace(): Promise<void> {
    if (!this.currentWorkspaceId || !this.editor) {
      return;
    }

    try {
      const graphData = this.editor.exportUserData();
      const canvasState = this.editor.getCanvasState();

      await this.sessionManager.makeAuthenticatedRequest(
        `/api/workspaces/${this.currentWorkspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ graphData, canvasState })
        }
      );
    } catch (error) {
      this.logger.logError(error as Error, 'saveCurrentWorkspace');
      // Don't throw - we still want to switch workspaces
    }
  }

  private async startRename(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;

    const newName = prompt('Enter new name:', workspace.name);
    if (!newName || newName === workspace.name) {
      return;
    }

    try {
      const response = await this.sessionManager.makeAuthenticatedRequest(
        `/api/workspaces/${workspaceId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rename workspace');
      }

      // Update local data
      workspace.name = newName;
      this.renderWorkspaces();
    } catch (error) {
      this.logger.logError(error as Error, 'startRename');
      alert((error as Error).message);
    }
  }

  private async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.find(w => w.id === workspaceId);
    if (!workspace) return;

    if (!confirm(`Delete workspace "${workspace.name}"?`)) {
      return;
    }

    try {
      const response = await this.sessionManager.makeAuthenticatedRequest(
        `/api/workspaces/${workspaceId}`,
        {
          method: 'DELETE'
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete workspace');
      }

      // Remove from list
      this.workspaces = this.workspaces.filter(w => w.id !== workspaceId);
      
      // If it was the current workspace, switch to another
      if (workspaceId === this.currentWorkspaceId) {
        this.currentWorkspaceId = null;
        if (this.workspaces.length > 0) {
          await this.switchWorkspace(this.workspaces[0]!.id);
        }
      }
      
      this.renderWorkspaces();
    } catch (error) {
      this.logger.logError(error as Error, 'deleteWorkspace');
      alert((error as Error).message);
    }
  }

  private showError(message: string): void {
    const listEl = document.getElementById('workspace-list');
    if (listEl) {
      listEl.innerHTML = `<div class="workspace-error">${message}</div>`;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }

  public setCurrentWorkspace(workspaceId: string): void {
    this.currentWorkspaceId = workspaceId;
    this.renderWorkspaces();
  }

  public async saveWorkspace(): Promise<void> {
    await this.saveCurrentWorkspace();
  }

  private async handleLogout(): Promise<void> {
    this.logger.logFunctionEntry('handleLogout');
    
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }
    
    try {
      // Save current workspace before logout
      await this.saveCurrentWorkspace();
      
      // Call logout API
      await this.sessionManager.makeAuthenticatedRequest('/api/auth/logout', {
        method: 'POST'
      });
      
      // Clear local session
      localStorage.removeItem('sessionToken');
      
      // Reload page to show login screen
      window.location.reload();
      
      this.logger.logInfo('Logout successful', 'handleLogout');
    } catch (error) {
      this.logger.logError(error as Error, 'handleLogout');
      // Even if API call fails, clear local session and reload
      localStorage.removeItem('sessionToken');
      window.location.reload();
    } finally {
      this.logger.logFunctionExit('handleLogout');
    }
  }
}