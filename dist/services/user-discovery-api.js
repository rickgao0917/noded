/**
 * User Discovery API Client
 *
 * Frontend service for interacting with user discovery endpoints
 */
import { Logger } from '../utils/logger.js';
import { SessionManager } from './session-manager.js';
export class UserDiscoveryApiError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'UserDiscoveryApiError';
    }
}
export class UserDiscoveryApi {
    constructor() {
        this.logger = new Logger('UserDiscoveryApi');
        this.sessionManager = SessionManager.getInstance();
    }
    static getInstance() {
        if (!UserDiscoveryApi.instance) {
            UserDiscoveryApi.instance = new UserDiscoveryApi();
        }
        return UserDiscoveryApi.instance;
    }
    /**
     * Search for users by username
     */
    async searchUsers(query, limit = 10, offset = 0) {
        this.logger.logFunctionEntry('searchUsers', {
            queryLength: query.length,
            limit,
            offset
        });
        try {
            const params = new URLSearchParams({
                q: query,
                limit: limit.toString(),
                offset: offset.toString()
            });
            const response = await this.sessionManager.makeAuthenticatedRequest(`/api/discovery/users/search?${params.toString()}`);
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new UserDiscoveryApiError(error.error || 'Failed to search users', response.status);
            }
            const result = await response.json();
            // Convert date strings back to Date objects
            const processedResult = Object.assign(Object.assign({}, result), { users: result.users.map(user => (Object.assign(Object.assign({}, user), { lastLogin: user.lastLogin ? new Date(user.lastLogin) : null }))) });
            this.logger.info('User search completed', {
                resultsCount: processedResult.users.length,
                totalCount: processedResult.totalCount
            });
            this.logger.logFunctionExit('searchUsers', { userCount: processedResult.users.length });
            return processedResult;
        }
        catch (error) {
            this.logger.logError(error, 'searchUsers');
            throw error instanceof UserDiscoveryApiError
                ? error
                : new UserDiscoveryApiError('Failed to search users');
        }
    }
    /**
     * Get public workspaces for a specific user
     */
    async getUserWorkspaces(userId) {
        this.logger.logFunctionEntry('getUserWorkspaces', { userId });
        try {
            const response = await this.sessionManager.makeAuthenticatedRequest(`/api/discovery/users/${userId}/workspaces`);
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new UserDiscoveryApiError(error.error || 'Failed to get user workspaces', response.status);
            }
            const workspaces = await response.json();
            // Convert date strings back to Date objects
            const processedWorkspaces = workspaces.map(workspace => (Object.assign(Object.assign({}, workspace), { updatedAt: new Date(workspace.updatedAt) })));
            this.logger.info('Retrieved user workspaces', {
                userId,
                workspaceCount: processedWorkspaces.length
            });
            this.logger.logFunctionExit('getUserWorkspaces', { workspaceCount: processedWorkspaces.length });
            return processedWorkspaces;
        }
        catch (error) {
            this.logger.logError(error, 'getUserWorkspaces');
            throw error instanceof UserDiscoveryApiError
                ? error
                : new UserDiscoveryApiError('Failed to get user workspaces');
        }
    }
    /**
     * Get general user statistics
     */
    async getUserStatistics() {
        this.logger.logFunctionEntry('getUserStatistics');
        try {
            const response = await this.sessionManager.makeAuthenticatedRequest(`/api/discovery/statistics`);
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new UserDiscoveryApiError(error.error || 'Failed to get user statistics', response.status);
            }
            const statistics = await response.json();
            this.logger.info('Retrieved user statistics', {
                totalUsers: statistics.totalUsers,
                activeUsers: statistics.activeUsers,
                totalWorkspaces: statistics.totalWorkspaces
            });
            this.logger.logFunctionExit('getUserStatistics', {
                totalUsers: statistics.totalUsers,
                activeUsers: statistics.activeUsers,
                totalWorkspaces: statistics.totalWorkspaces
            });
            return statistics;
        }
        catch (error) {
            this.logger.logError(error, 'getUserStatistics');
            throw error instanceof UserDiscoveryApiError
                ? error
                : new UserDiscoveryApiError('Failed to get user statistics');
        }
    }
}
