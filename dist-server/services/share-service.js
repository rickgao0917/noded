"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareService = void 0;
const logger_1 = require("../utils/logger");
const errors_1 = require("../types/errors");
const crypto = __importStar(require("crypto"));
class ShareService {
    constructor(db) {
        this.db = db;
        this.logger = new logger_1.Logger('ShareService');
    }
    async searchUsers(query, excludeUserId, limit = 10) {
        const correlationId = this.logger.generateCorrelationId();
        try {
            this.logger.logFunctionEntry('searchUsers', { query, excludeUserId, limit });
            // Validate input
            if (!query || query.trim().length < 2) {
                throw new errors_1.ValidationError('Search query must be at least 2 characters');
            }
            // Sanitize query for SQL LIKE - SQLite uses backslash for escaping
            const sanitizedQuery = query.trim().replace(/[%_\\]/g, '\\$&');
            // Search for users with username containing the query
            const users = await this.db.query(`SELECT id, username 
         FROM users 
         WHERE username LIKE ? 
           AND id != ? 
           AND is_active = 1
         ORDER BY 
           CASE WHEN username = ? THEN 0 ELSE 1 END,
           LENGTH(username),
           username
         LIMIT ?`, [`%${sanitizedQuery}%`, excludeUserId, query, limit]);
            this.logger.logBusinessLogic('User search completed', {
                query,
                resultCount: users.length
            }, correlationId);
            this.logger.logFunctionExit('searchUsers', users);
            return users;
        }
        catch (error) {
            this.logger.logError(error, 'searchUsers', { correlationId });
            throw error;
        }
    }
    async shareWorkspace(workspaceId, ownerId, shareWithUserId, expiresAt) {
        const correlationId = this.logger.generateCorrelationId();
        try {
            this.logger.logFunctionEntry('shareWorkspace', {
                workspaceId,
                ownerId,
                shareWithUserId,
                expiresAt
            });
            // Validate workspace ownership
            const workspace = await this.db.get('SELECT id FROM workspaces WHERE id = ? AND user_id = ?', [workspaceId, ownerId]);
            if (!workspace) {
                throw new errors_1.ValidationError('Workspace not found or you do not have permission');
            }
            // Prevent self-sharing
            if (ownerId === shareWithUserId) {
                throw new errors_1.ValidationError('Cannot share workspace with yourself');
            }
            // Check if user exists
            const targetUser = await this.db.get('SELECT id FROM users WHERE id = ? AND is_active = 1', [shareWithUserId]);
            if (!targetUser) {
                throw new errors_1.ValidationError('User not found');
            }
            // Check for existing active share
            const existingShare = await this.db.get(`SELECT id FROM workspace_shares 
         WHERE workspace_id = ? AND shared_with_user_id = ? AND is_active = 1`, [workspaceId, shareWithUserId]);
            if (existingShare) {
                throw new errors_1.ValidationError('Workspace is already shared with this user');
            }
            // Create share record
            const shareId = `share_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
            const now = new Date().toISOString();
            await this.db.run(`INSERT INTO workspace_shares 
         (id, workspace_id, owner_id, shared_with_user_id, permission_level, created_at, expires_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [shareId, workspaceId, ownerId, shareWithUserId, 'view', now, expiresAt || null, 1]);
            // Log activity
            await this.logShareActivity(workspaceId, ownerId, 'share_granted', {
                sharedWithUserId: shareWithUserId
            });
            const share = Object.assign(Object.assign({ id: shareId, workspaceId,
                ownerId, sharedWithUserId: shareWithUserId, permissionLevel: 'view', createdAt: now }, (expiresAt && { expiresAt })), { isActive: true });
            this.logger.logBusinessLogic('Workspace shared successfully', {
                shareId,
                workspaceId,
                sharedWithUserId: shareWithUserId
            }, correlationId);
            this.logger.logFunctionExit('shareWorkspace', share);
            return share;
        }
        catch (error) {
            this.logger.logError(error, 'shareWorkspace', { correlationId });
            throw error;
        }
    }
    async validateShareAccess(workspaceId, userId) {
        const correlationId = this.logger.generateCorrelationId();
        try {
            this.logger.logFunctionEntry('validateShareAccess', { workspaceId, userId });
            // Check if user owns the workspace
            const ownership = await this.db.get('SELECT id FROM workspaces WHERE id = ? AND user_id = ?', [workspaceId, userId]);
            if (ownership) {
                this.logger.logBusinessLogic('User is owner', { workspaceId, userId }, correlationId);
                return 'owner';
            }
            // Check for active share
            const share = await this.db.get(`SELECT permission_level, expires_at 
         FROM workspace_shares 
         WHERE workspace_id = ? 
           AND shared_with_user_id = ? 
           AND is_active = 1`, [workspaceId, userId]);
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
                await this.db.run('UPDATE workspace_shares SET is_active = 0 WHERE workspace_id = ? AND shared_with_user_id = ?', [workspaceId, userId]);
                return null;
            }
            // Update last accessed
            await this.db.run('UPDATE workspace_shares SET last_accessed = ? WHERE workspace_id = ? AND shared_with_user_id = ?', [new Date().toISOString(), workspaceId, userId]);
            this.logger.logFunctionExit('validateShareAccess', share.permission_level);
            return share.permission_level;
        }
        catch (error) {
            this.logger.logError(error, 'validateShareAccess', { correlationId });
            throw error;
        }
    }
    async getSharedWithMe(userId) {
        const correlationId = this.logger.generateCorrelationId();
        try {
            this.logger.logFunctionEntry('getSharedWithMe', { userId });
            const sharedWorkspaces = await this.db.query(`SELECT 
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
         ORDER BY ws.last_accessed DESC, ws.created_at DESC`, [userId]);
            this.logger.logBusinessLogic('Retrieved shared workspaces', {
                userId,
                count: sharedWorkspaces.length
            }, correlationId);
            this.logger.logFunctionExit('getSharedWithMe', sharedWorkspaces);
            return sharedWorkspaces;
        }
        catch (error) {
            this.logger.logError(error, 'getSharedWithMe', { correlationId });
            throw error;
        }
    }
    async getWorkspaceShares(workspaceId, ownerId) {
        const correlationId = this.logger.generateCorrelationId();
        try {
            this.logger.logFunctionEntry('getWorkspaceShares', { workspaceId, ownerId });
            // Verify ownership
            const workspace = await this.db.get('SELECT id FROM workspaces WHERE id = ? AND user_id = ?', [workspaceId, ownerId]);
            if (!workspace) {
                throw new errors_1.ValidationError('Workspace not found or you do not have permission');
            }
            const shares = await this.db.query(`SELECT 
          ws.*,
          u.username as sharedWithUsername
         FROM workspace_shares ws
         JOIN users u ON ws.shared_with_user_id = u.id
         WHERE ws.workspace_id = ?
           AND ws.is_active = 1
         ORDER BY ws.created_at DESC`, [workspaceId]);
            this.logger.logBusinessLogic('Retrieved workspace shares', {
                workspaceId,
                shareCount: shares.length
            }, correlationId);
            this.logger.logFunctionExit('getWorkspaceShares', shares);
            return shares;
        }
        catch (error) {
            this.logger.logError(error, 'getWorkspaceShares', { correlationId });
            throw error;
        }
    }
    async getMyShares(ownerId, workspaceId) {
        // Delegate to existing getWorkspaceShares method
        return this.getWorkspaceShares(workspaceId, ownerId);
    }
    async revokeShare(workspaceId, ownerId, shareIdOrUserId) {
        const correlationId = this.logger.generateCorrelationId();
        try {
            this.logger.logFunctionEntry('revokeShare', { workspaceId, ownerId, shareIdOrUserId });
            // Try to find share by user ID first
            let share = await this.db.get(`SELECT ws.id, ws.shared_with_user_id 
         FROM workspace_shares ws
         JOIN workspaces w ON ws.workspace_id = w.id
         WHERE ws.workspace_id = ? AND ws.shared_with_user_id = ? AND w.user_id = ? AND ws.is_active = 1`, [workspaceId, shareIdOrUserId, ownerId]);
            if (!share) {
                // Try to find by share ID
                share = await this.db.get(`SELECT ws.id, ws.shared_with_user_id 
           FROM workspace_shares ws
           JOIN workspaces w ON ws.workspace_id = w.id
           WHERE ws.id = ? AND ws.workspace_id = ? AND w.user_id = ? AND ws.is_active = 1`, [shareIdOrUserId, workspaceId, ownerId]);
                if (!share) {
                    return false;
                }
            }
            // Mark share as inactive
            await this.db.run('UPDATE workspace_shares SET is_active = 0 WHERE id = ?', [share.id]);
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
        }
        catch (error) {
            this.logger.logError(error, 'revokeShare', { correlationId });
            throw error;
        }
    }
    async createShareLink(workspaceId, ownerId, options = {}) {
        const correlationId = this.logger.generateCorrelationId();
        try {
            this.logger.logFunctionEntry('createShareLink', {
                workspaceId,
                ownerId,
                options
            });
            // Validate workspace ownership
            const workspace = await this.db.get('SELECT id FROM workspaces WHERE id = ? AND user_id = ?', [workspaceId, ownerId]);
            if (!workspace) {
                throw new errors_1.ValidationError('Workspace not found or you do not have permission');
            }
            // Generate unique token
            const token = crypto.randomBytes(32).toString('hex');
            const linkId = `link_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
            const now = new Date();
            let expiresAt = null;
            if (options.expiresIn) {
                const expDate = new Date(now.getTime() + options.expiresIn * 60 * 60 * 1000);
                expiresAt = expDate.toISOString();
            }
            await this.db.run(`INSERT INTO share_links 
         (id, workspace_id, owner_id, share_token, requires_login, created_at, expires_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                linkId,
                workspaceId,
                ownerId,
                token,
                options.requiresLogin !== false ? 1 : 0,
                now.toISOString(),
                expiresAt,
                1
            ]);
            const shareLink = Object.assign(Object.assign({ id: linkId, workspaceId,
                ownerId,
                token, requiresLogin: options.requiresLogin !== false, createdAt: now.toISOString() }, (expiresAt && { expiresAt })), { accessCount: 0, isActive: true });
            // Log activity
            await this.logShareActivity(workspaceId, ownerId, 'link_created', { linkId });
            this.logger.logBusinessLogic('Share link created', {
                linkId,
                workspaceId,
                token
            }, correlationId);
            this.logger.logFunctionExit('createShareLink', shareLink);
            return shareLink;
        }
        catch (error) {
            this.logger.logError(error, 'createShareLink', { correlationId });
            throw error;
        }
    }
    async validateShareLink(token) {
        const correlationId = this.logger.generateCorrelationId();
        try {
            this.logger.logFunctionEntry('validateShareLink', { token });
            const shareLink = await this.db.get(`SELECT sl.*, u.username as ownerUsername
         FROM share_links sl
         JOIN users u ON sl.owner_id = u.id
         WHERE sl.share_token = ? AND sl.is_active = 1`, [token]);
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
                await this.db.run('UPDATE share_links SET is_active = 0 WHERE share_token = ?', [token]);
                return null;
            }
            this.logger.logFunctionExit('validateShareLink', shareLink);
            return shareLink;
        }
        catch (error) {
            this.logger.logError(error, 'validateShareLink', { correlationId });
            throw error;
        }
    }
    async incrementShareLinkAccess(linkId) {
        const correlationId = this.logger.generateCorrelationId();
        try {
            await this.db.run('UPDATE share_links SET access_count = access_count + 1 WHERE id = ?', [linkId]);
            this.logger.logBusinessLogic('Share link access incremented', { linkId }, correlationId);
        }
        catch (error) {
            this.logger.logError(error, 'incrementShareLinkAccess', { correlationId });
            // Don't throw - this is not critical
        }
    }
    async logShareActivity(workspaceId, userId, action, metadata) {
        const correlationId = this.logger.generateCorrelationId();
        try {
            const activityId = `activity_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
            const shareType = (metadata === null || metadata === void 0 ? void 0 : metadata.shareType) || 'direct_share';
            await this.db.run(`INSERT INTO share_activity 
         (id, workspace_id, user_id, share_type, action, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`, [
                activityId,
                workspaceId,
                userId,
                shareType,
                action,
                new Date().toISOString()
            ]);
            this.logger.logBusinessLogic('Share activity logged', {
                activityId,
                workspaceId,
                action,
                metadata
            }, correlationId);
        }
        catch (error) {
            // Log error but don't throw - activity logging shouldn't break main flow
            this.logger.logError(error, 'logShareActivity', { correlationId });
        }
    }
}
exports.ShareService = ShareService;
