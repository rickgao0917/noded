import { Logger } from '../utils/logger';
import { DatabaseService } from './database-service';
import { ValidationError } from '../types/errors';
import * as crypto from 'crypto';

interface UserSearchResult {
  id: string;
  username: string;
}

interface ShareRecord {
  id: string;
  workspaceId: string;
  ownerId: string;
  sharedWithUserId: string;
  permissionLevel: 'view';
  createdAt: string;
  expiresAt?: string;
  lastAccessed?: string;
  isActive: boolean;
}

interface ShareWithUserInfo extends ShareRecord {
  sharedWithUsername: string;
}

interface SharedWorkspace {
  id: string;
  name: string;
  ownerId: string;
  ownerUsername: string;
  sharedAt: string;
  lastAccessed?: string;
  expiresAt?: string;
}

interface ShareLink {
  id: string;
  workspaceId: string;
  ownerId: string;
  token: string;
  requiresLogin: boolean;
  createdAt: string;
  expiresAt?: string;
  accessCount: number;
  isActive: boolean;
}

interface ShareLinkWithOwner extends ShareLink {
  ownerUsername: string;
}

export class ShareService {
  private logger: Logger;

  constructor(private db: DatabaseService) {
    this.logger = new Logger('ShareService');
  }

  async searchUsers(
    query: string,
    excludeUserId: string,
    limit: number = 10
  ): Promise<UserSearchResult[]> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      this.logger.logFunctionEntry('searchUsers', { query, excludeUserId, limit });
      
      // Validate input
      if (!query || query.trim().length < 2) {
        throw new ValidationError('Search query must be at least 2 characters');
      }
      
      // Sanitize query for SQL LIKE - SQLite uses backslash for escaping
      const sanitizedQuery = query.trim().replace(/[%_\\]/g, '\\$&');
      
      // Search for users with username containing the query
      const users = await this.db.query<UserSearchResult>(
        `SELECT id, username 
         FROM users 
         WHERE username LIKE ? 
           AND id != ? 
           AND is_active = 1
         ORDER BY 
           CASE WHEN username = ? THEN 0 ELSE 1 END,
           LENGTH(username),
           username
         LIMIT ?`,
        [`%${sanitizedQuery}%`, excludeUserId, query, limit]
      );
      
      this.logger.logBusinessLogic('User search completed', {
        query,
        resultCount: users.length
      }, correlationId);
      
      this.logger.logFunctionExit('searchUsers', users);
      return users;
      
    } catch (error) {
      this.logger.logError(error as Error, 'searchUsers', { correlationId });
      throw error;
    }
  }

  async shareWorkspace(
    workspaceId: string,
    ownerId: string,
    shareWithUserId: string,
    expiresAt?: string
  ): Promise<ShareRecord> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      this.logger.logFunctionEntry('shareWorkspace', {
        workspaceId,
        ownerId,
        shareWithUserId,
        expiresAt
      });
      
      // Validate workspace ownership
      const workspace = await this.db.get(
        'SELECT id FROM workspaces WHERE id = ? AND user_id = ?',
        [workspaceId, ownerId]
      );
      
      if (!workspace) {
        throw new ValidationError('Workspace not found or you do not have permission');
      }
      
      // Prevent self-sharing
      if (ownerId === shareWithUserId) {
        throw new ValidationError('Cannot share workspace with yourself');
      }
      
      // Check if user exists
      const targetUser = await this.db.get(
        'SELECT id FROM users WHERE id = ? AND is_active = 1',
        [shareWithUserId]
      );
      
      if (!targetUser) {
        throw new ValidationError('User not found');
      }
      
      // Check for existing active share
      const existingShare = await this.db.get(
        `SELECT id FROM workspace_shares 
         WHERE workspace_id = ? AND shared_with_user_id = ? AND is_active = 1`,
        [workspaceId, shareWithUserId]
      );
      
      if (existingShare) {
        throw new ValidationError('Workspace is already shared with this user');
      }
      
      // Create share record
      const shareId = `share_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const now = new Date().toISOString();
      
      await this.db.run(
        `INSERT INTO workspace_shares 
         (id, workspace_id, owner_id, shared_with_user_id, permission_level, created_at, expires_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [shareId, workspaceId, ownerId, shareWithUserId, 'view', now, expiresAt || null, 1]
      );
      
      // Log activity
      await this.logShareActivity(workspaceId, ownerId, 'share_granted', {
        sharedWithUserId: shareWithUserId
      });
      
      const share: ShareRecord = {
        id: shareId,
        workspaceId,
        ownerId,
        sharedWithUserId: shareWithUserId,
        permissionLevel: 'view',
        createdAt: now,
        ...(expiresAt && { expiresAt }),
        isActive: true
      };
      
      this.logger.logBusinessLogic('Workspace shared successfully', {
        shareId,
        workspaceId,
        sharedWithUserId: shareWithUserId
      }, correlationId);
      
      this.logger.logFunctionExit('shareWorkspace', share);
      return share;
      
    } catch (error) {
      this.logger.logError(error as Error, 'shareWorkspace', { correlationId });
      throw error;
    }
  }

  async validateShareAccess(
    workspaceId: string,
    userId: string
  ): Promise<'owner' | 'view' | null> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      this.logger.logFunctionEntry('validateShareAccess', { workspaceId, userId });
      
      // Check if user owns the workspace
      const ownership = await this.db.get(
        'SELECT id FROM workspaces WHERE id = ? AND user_id = ?',
        [workspaceId, userId]
      );
      
      if (ownership) {
        this.logger.logBusinessLogic('User is owner', { workspaceId, userId }, correlationId);
        return 'owner';
      }
      
      // Check for active share
      const share = await this.db.get<{ permission_level: string; expires_at?: string }>(
        `SELECT permission_level, expires_at 
         FROM workspace_shares 
         WHERE workspace_id = ? 
           AND shared_with_user_id = ? 
           AND is_active = 1`,
        [workspaceId, userId]
      );
      
      if (!share) {
        this.logger.logBusinessLogic('No share found', { workspaceId, userId }, correlationId);
        return null;
      }
      
      // Check expiration
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        this.logger.logBusinessLogic('Share expired', { 
          workspaceId, 
          userId,
          expiresAt: share.expires_at 
        }, correlationId);
        
        // Mark as inactive
        await this.db.run(
          'UPDATE workspace_shares SET is_active = 0 WHERE workspace_id = ? AND shared_with_user_id = ?',
          [workspaceId, userId]
        );
        
        return null;
      }
      
      // Update last accessed
      await this.db.run(
        'UPDATE workspace_shares SET last_accessed = ? WHERE workspace_id = ? AND shared_with_user_id = ?',
        [new Date().toISOString(), workspaceId, userId]
      );
      
      this.logger.logFunctionExit('validateShareAccess', share.permission_level);
      return share.permission_level as 'view';
      
    } catch (error) {
      this.logger.logError(error as Error, 'validateShareAccess', { correlationId });
      throw error;
    }
  }

  async getSharedWithMe(userId: string): Promise<SharedWorkspace[]> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      this.logger.logFunctionEntry('getSharedWithMe', { userId });
      
      const sharedWorkspaces = await this.db.query<SharedWorkspace>(
        `SELECT 
          w.id,
          w.name,
          w.user_id as ownerId,
          u.username as ownerUsername,
          ws.created_at as sharedAt,
          ws.last_accessed as lastAccessed,
          ws.expires_at as expiresAt
         FROM workspace_shares ws
         JOIN workspaces w ON ws.workspace_id = w.id
         JOIN users u ON w.user_id = u.id
         WHERE ws.shared_with_user_id = ?
           AND ws.is_active = 1
           AND (ws.expires_at IS NULL OR ws.expires_at > datetime('now'))
           AND w.name NOT LIKE '\\_deleted\\_%' ESCAPE '\\'
         ORDER BY ws.last_accessed DESC, ws.created_at DESC`,
        [userId]
      );
      
      this.logger.logBusinessLogic('Retrieved shared workspaces', {
        userId,
        count: sharedWorkspaces.length
      }, correlationId);
      
      this.logger.logFunctionExit('getSharedWithMe', sharedWorkspaces);
      return sharedWorkspaces;
      
    } catch (error) {
      this.logger.logError(error as Error, 'getSharedWithMe', { correlationId });
      throw error;
    }
  }

  async getWorkspaceShares(workspaceId: string, ownerId: string): Promise<ShareWithUserInfo[]> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      this.logger.logFunctionEntry('getWorkspaceShares', { workspaceId, ownerId });
      
      // Verify ownership
      const workspace = await this.db.get(
        'SELECT id FROM workspaces WHERE id = ? AND user_id = ?',
        [workspaceId, ownerId]
      );
      
      if (!workspace) {
        throw new ValidationError('Workspace not found or you do not have permission');
      }
      
      const shares = await this.db.query<ShareWithUserInfo>(
        `SELECT 
          ws.*,
          u.username as sharedWithUsername
         FROM workspace_shares ws
         JOIN users u ON ws.shared_with_user_id = u.id
         WHERE ws.workspace_id = ?
           AND ws.is_active = 1
         ORDER BY ws.created_at DESC`,
        [workspaceId]
      );
      
      this.logger.logBusinessLogic('Retrieved workspace shares', {
        workspaceId,
        shareCount: shares.length
      }, correlationId);
      
      this.logger.logFunctionExit('getWorkspaceShares', shares);
      return shares;
      
    } catch (error) {
      this.logger.logError(error as Error, 'getWorkspaceShares', { correlationId });
      throw error;
    }
  }

  async getMyShares(ownerId: string, workspaceId: string): Promise<ShareWithUserInfo[]> {
    // Delegate to existing getWorkspaceShares method
    return this.getWorkspaceShares(workspaceId, ownerId);
  }

  async revokeShare(workspaceId: string, ownerId: string, shareIdOrUserId: string): Promise<boolean> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      this.logger.logFunctionEntry('revokeShare', { workspaceId, ownerId, shareIdOrUserId });
      
      // Try to find share by user ID first
      let share = await this.db.get<{ id: string; shared_with_user_id: string }>(
        `SELECT ws.id, ws.shared_with_user_id 
         FROM workspace_shares ws
         JOIN workspaces w ON ws.workspace_id = w.id
         WHERE ws.workspace_id = ? AND ws.shared_with_user_id = ? AND w.user_id = ? AND ws.is_active = 1`,
        [workspaceId, shareIdOrUserId, ownerId]
      );
      
      if (!share) {
        // Try to find by share ID
        share = await this.db.get<{ id: string; shared_with_user_id: string }>(
          `SELECT ws.id, ws.shared_with_user_id 
           FROM workspace_shares ws
           JOIN workspaces w ON ws.workspace_id = w.id
           WHERE ws.id = ? AND ws.workspace_id = ? AND w.user_id = ? AND ws.is_active = 1`,
          [shareIdOrUserId, workspaceId, ownerId]
        );
        
        if (!share) {
          return false;
        }
      }
      
      // Mark share as inactive
      await this.db.run(
        'UPDATE workspace_shares SET is_active = 0 WHERE id = ?',
        [share.id]
      );
      
      // Log activity
      await this.logShareActivity(workspaceId, ownerId, 'share_revoked', {
        shareId: share.id,
        sharedWithUserId: share.shared_with_user_id
      });
      
      this.logger.logBusinessLogic('Share revoked successfully', {
        shareId: share.id,
        workspaceId
      }, correlationId);
      
      this.logger.logFunctionExit('revokeShare', true);
      return true;
      
    } catch (error) {
      this.logger.logError(error as Error, 'revokeShare', { correlationId });
      throw error;
    }
  }

  async createShareLink(
    workspaceId: string,
    ownerId: string,
    options: { requiresLogin?: boolean; expiresIn?: number } = {}
  ): Promise<ShareLink> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      this.logger.logFunctionEntry('createShareLink', {
        workspaceId,
        ownerId,
        options
      });
      
      // Validate workspace ownership
      const workspace = await this.db.get(
        'SELECT id FROM workspaces WHERE id = ? AND user_id = ?',
        [workspaceId, ownerId]
      );
      
      if (!workspace) {
        throw new ValidationError('Workspace not found or you do not have permission');
      }
      
      // Generate unique token
      const token = crypto.randomBytes(32).toString('hex');
      const linkId = `link_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const now = new Date();
      
      let expiresAt: string | null = null;
      if (options.expiresIn) {
        const expDate = new Date(now.getTime() + options.expiresIn * 60 * 60 * 1000);
        expiresAt = expDate.toISOString();
      }
      
      await this.db.run(
        `INSERT INTO share_links 
         (id, workspace_id, owner_id, share_token, requires_login, created_at, expires_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          linkId,
          workspaceId,
          ownerId,
          token,
          options.requiresLogin !== false ? 1 : 0,
          now.toISOString(),
          expiresAt,
          1
        ]
      );
      
      const shareLink: ShareLink = {
        id: linkId,
        workspaceId,
        ownerId,
        token,
        requiresLogin: options.requiresLogin !== false,
        createdAt: now.toISOString(),
        ...(expiresAt && { expiresAt }),
        accessCount: 0,
        isActive: true
      };
      
      // Log activity
      await this.logShareActivity(workspaceId, ownerId, 'link_created', { linkId });
      
      this.logger.logBusinessLogic('Share link created', {
        linkId,
        workspaceId,
        token
      }, correlationId);
      
      this.logger.logFunctionExit('createShareLink', shareLink);
      return shareLink;
      
    } catch (error) {
      this.logger.logError(error as Error, 'createShareLink', { correlationId });
      throw error;
    }
  }

  async validateShareLink(token: string): Promise<ShareLinkWithOwner | null> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      this.logger.logFunctionEntry('validateShareLink', { token });
      
      const shareLink = await this.db.get<ShareLinkWithOwner>(
        `SELECT sl.*, u.username as ownerUsername
         FROM share_links sl
         JOIN users u ON sl.owner_id = u.id
         WHERE sl.share_token = ? AND sl.is_active = 1`,
        [token]
      );
      
      if (!shareLink) {
        this.logger.logBusinessLogic('Share link not found', { token }, correlationId);
        return null;
      }
      
      // Check expiration
      if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
        this.logger.logBusinessLogic('Share link expired', {
          token,
          expiresAt: shareLink.expiresAt
        }, correlationId);
        
        // Mark as inactive
        await this.db.run(
          'UPDATE share_links SET is_active = 0 WHERE share_token = ?',
          [token]
        );
        
        return null;
      }
      
      this.logger.logFunctionExit('validateShareLink', shareLink);
      return shareLink;
      
    } catch (error) {
      this.logger.logError(error as Error, 'validateShareLink', { correlationId });
      throw error;
    }
  }

  async incrementShareLinkAccess(linkId: string): Promise<void> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      await this.db.run(
        'UPDATE share_links SET access_count = access_count + 1 WHERE id = ?',
        [linkId]
      );
      
      this.logger.logBusinessLogic('Share link access incremented', { linkId }, correlationId);
      
    } catch (error) {
      this.logger.logError(error as Error, 'incrementShareLinkAccess', { correlationId });
      // Don't throw - this is not critical
    }
  }

  async logShareActivity(
    workspaceId: string,
    userId: string | null,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      const activityId = `activity_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const shareType = metadata?.shareType || 'direct_share';
      
      await this.db.run(
        `INSERT INTO share_activity 
         (id, workspace_id, user_id, share_type, action, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          activityId,
          workspaceId,
          userId,
          shareType,
          action,
          new Date().toISOString()
        ]
      );
      
      this.logger.logBusinessLogic('Share activity logged', {
        activityId,
        workspaceId,
        action,
        metadata
      }, correlationId);
      
    } catch (error) {
      // Log error but don't throw - activity logging shouldn't break main flow
      this.logger.logError(error as Error, 'logShareActivity', { correlationId });
    }
  }
}