"use strict";
/**
 * User Discovery Service
 *
 * Provides functionality to search for users and view their workspaces
 * when the user discovery feature flag is enabled
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserDiscoveryService = exports.UserDiscoveryError = void 0;
const database_service_1 = require("./database-service");
const logger_1 = require("../utils/logger");
const errors_1 = require("../types/errors");
class UserDiscoveryError extends errors_1.BaseError {
    constructor(message, cause) {
        super('UserDiscoveryError', message, cause);
    }
}
exports.UserDiscoveryError = UserDiscoveryError;
class UserDiscoveryService {
    constructor() {
        this.logger = new logger_1.Logger('UserDiscoveryService');
        this.dbService = database_service_1.DatabaseService.getInstance();
    }
    static getInstance() {
        if (!UserDiscoveryService.instance) {
            UserDiscoveryService.instance = new UserDiscoveryService();
        }
        return UserDiscoveryService.instance;
    }
    /**
     * Search for users by username pattern
     *
     * @param searchQuery - Username search pattern
     * @param currentUserId - ID of the user making the request (to exclude from results)
     * @param limit - Maximum number of results to return
     * @param offset - Number of results to skip
     * @returns Promise resolving to user discovery results
     */
    async searchUsers(searchQuery, currentUserId, limit = 10, offset = 0) {
        this.logger.logFunctionEntry('searchUsers', {
            searchQuery: searchQuery.length,
            currentUserId,
            limit,
            offset
        });
        try {
            // Validate inputs
            if (!searchQuery || searchQuery.trim().length < 2) {
                throw new UserDiscoveryError('Search query must be at least 2 characters');
            }
            if (limit > 50) {
                limit = 50; // Cap at reasonable limit
            }
            const searchPattern = `%${searchQuery.trim().toLowerCase()}%`;
            // Get users matching search pattern (excluding current user)
            const users = await this.dbService.query(`
        SELECT 
          u.id,
          u.username,
          u.last_login,
          COUNT(w.id) as workspace_count
        FROM users u
        LEFT JOIN workspaces w ON u.id = w.user_id AND w.name NOT LIKE '_deleted_%'
        WHERE u.id != ? 
          AND u.is_active = 1
          AND LOWER(u.username) LIKE ?
        GROUP BY u.id, u.username, u.last_login
        ORDER BY u.last_login DESC, u.username ASC
        LIMIT ? OFFSET ?
      `, [currentUserId, searchPattern, limit + 1, offset]);
            // Check if there are more results
            const hasMore = users.length > limit;
            const resultUsers = hasMore ? users.slice(0, limit) : users;
            // Get total count for pagination
            const countResult = await this.dbService.get(`
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        WHERE u.id != ? 
          AND u.is_active = 1
          AND LOWER(u.username) LIKE ?
      `, [currentUserId, searchPattern]);
            const totalCount = (countResult === null || countResult === void 0 ? void 0 : countResult.total) || 0;
            // Transform results
            const publicUsers = resultUsers.map(user => ({
                id: user.id,
                username: user.username,
                lastLogin: user.last_login ? new Date(user.last_login) : null,
                workspaceCount: parseInt(user.workspace_count) || 0
            }));
            const result = {
                users: publicUsers,
                totalCount,
                hasMore
            };
            this.logger.info('User search completed', {
                resultsCount: publicUsers.length,
                totalCount,
                hasMore
            });
            this.logger.logFunctionExit('searchUsers', { userCount: publicUsers.length });
            return result;
        }
        catch (error) {
            this.logger.logError(error, 'searchUsers');
            throw new UserDiscoveryError('Failed to search users', error);
        }
    }
    /**
     * Get public workspace information for a specific user
     *
     * @param userId - ID of the user whose workspaces to retrieve
     * @param requestingUserId - ID of the user making the request
     * @returns Promise resolving to array of public workspace info
     */
    async getUserWorkspaces(userId, requestingUserId) {
        this.logger.logFunctionEntry('getUserWorkspaces', { userId, requestingUserId });
        try {
            // Verify the target user exists and is active
            const targetUser = await this.dbService.get(`
        SELECT id, username, is_active
        FROM users
        WHERE id = ?
      `, [userId]);
            if (!targetUser) {
                throw new UserDiscoveryError('User not found');
            }
            if (!targetUser.is_active) {
                throw new UserDiscoveryError('User account is inactive');
            }
            // Get public workspace information (no actual content)
            const workspaces = await this.dbService.query(`
        SELECT 
          id,
          name,
          updated_at,
          LENGTH(graph_data) as data_size
        FROM workspaces
        WHERE user_id = ?
          AND name NOT LIKE '_deleted_%'
        ORDER BY updated_at DESC
        LIMIT 20
      `, [userId]);
            // Transform to public workspace info
            const publicWorkspaces = workspaces.map(workspace => {
                // Estimate node count from data size (very rough approximation)
                const estimatedNodeCount = workspace.data_size > 100
                    ? Math.max(1, Math.floor(workspace.data_size / 500))
                    : 0;
                return {
                    id: workspace.id,
                    name: workspace.name,
                    updatedAt: new Date(workspace.updated_at),
                    nodeCount: estimatedNodeCount
                };
            });
            this.logger.info('Retrieved user workspaces', {
                userId,
                workspaceCount: publicWorkspaces.length
            });
            this.logger.logFunctionExit('getUserWorkspaces', { workspaceCount: publicWorkspaces.length });
            return publicWorkspaces;
        }
        catch (error) {
            this.logger.logError(error, 'getUserWorkspaces');
            throw new UserDiscoveryError('Failed to retrieve user workspaces', error);
        }
    }
    /**
     * Get general statistics about the user base
     *
     * @returns Promise resolving to user statistics
     */
    async getUserStatistics() {
        this.logger.logFunctionEntry('getUserStatistics');
        try {
            const stats = await this.dbService.get(`
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN u.is_active = 1 THEN u.id END) as active_users,
          COUNT(DISTINCT w.id) as total_workspaces
        FROM users u
        LEFT JOIN workspaces w ON u.id = w.user_id AND w.name NOT LIKE '_deleted_%'
      `);
            const result = {
                totalUsers: parseInt(stats === null || stats === void 0 ? void 0 : stats.total_users) || 0,
                activeUsers: parseInt(stats === null || stats === void 0 ? void 0 : stats.active_users) || 0,
                totalWorkspaces: parseInt(stats === null || stats === void 0 ? void 0 : stats.total_workspaces) || 0
            };
            this.logger.info('Retrieved user statistics', result);
            this.logger.logFunctionExit('getUserStatistics', result);
            return result;
        }
        catch (error) {
            this.logger.logError(error, 'getUserStatistics');
            throw new UserDiscoveryError('Failed to retrieve user statistics', error);
        }
    }
}
exports.UserDiscoveryService = UserDiscoveryService;
