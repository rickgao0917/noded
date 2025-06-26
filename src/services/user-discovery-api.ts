/**
 * User Discovery API Client
 * 
 * Frontend service for interacting with user discovery endpoints
 */

import { Logger } from '../utils/logger.js';
import { SessionManager } from './session-manager.js';
import type { 
  UserDiscoveryResult, 
  PublicWorkspaceInfo, 
  UserStatistics 
} from '../types/user-discovery.types.js';

export class UserDiscoveryApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'UserDiscoveryApiError';
  }
}

export class UserDiscoveryApi {
  private static instance: UserDiscoveryApi;
  private readonly logger = new Logger('UserDiscoveryApi');
  private readonly sessionManager = SessionManager.getInstance();

  private constructor() {}

  public static getInstance(): UserDiscoveryApi {
    if (!UserDiscoveryApi.instance) {
      UserDiscoveryApi.instance = new UserDiscoveryApi();
    }
    return UserDiscoveryApi.instance;
  }

  /**
   * Search for users by username
   */
  public async searchUsers(
    query: string, 
    limit: number = 10, 
    offset: number = 0
  ): Promise<UserDiscoveryResult> {
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

      const response = await this.sessionManager.makeAuthenticatedRequest(
        `/api/discovery/users/search?${params.toString()}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new UserDiscoveryApiError(
          error.error || 'Failed to search users',
          response.status
        );
      }

      const result = await response.json() as UserDiscoveryResult;
      
      // Convert date strings back to Date objects
      const processedResult: UserDiscoveryResult = {
        ...result,
        users: result.users.map(user => ({
          ...user,
          lastLogin: user.lastLogin ? new Date(user.lastLogin) : null
        }))
      };

      this.logger.info('User search completed', {
        resultsCount: processedResult.users.length,
        totalCount: processedResult.totalCount
      });

      this.logger.logFunctionExit('searchUsers', { userCount: processedResult.users.length });
      return processedResult;

    } catch (error) {
      this.logger.logError(error as Error, 'searchUsers');
      throw error instanceof UserDiscoveryApiError 
        ? error 
        : new UserDiscoveryApiError('Failed to search users');
    }
  }

  /**
   * Get public workspaces for a specific user
   */
  public async getUserWorkspaces(userId: string): Promise<PublicWorkspaceInfo[]> {
    this.logger.logFunctionEntry('getUserWorkspaces', { userId });

    try {
      const response = await this.sessionManager.makeAuthenticatedRequest(
        `/api/discovery/users/${userId}/workspaces`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new UserDiscoveryApiError(
          error.error || 'Failed to get user workspaces',
          response.status
        );
      }

      const workspaces = await response.json() as PublicWorkspaceInfo[];
      
      // Convert date strings back to Date objects
      const processedWorkspaces: PublicWorkspaceInfo[] = workspaces.map(workspace => ({
        ...workspace,
        updatedAt: new Date(workspace.updatedAt)
      }));

      this.logger.info('Retrieved user workspaces', {
        userId,
        workspaceCount: processedWorkspaces.length
      });

      this.logger.logFunctionExit('getUserWorkspaces', { workspaceCount: processedWorkspaces.length });
      return processedWorkspaces;

    } catch (error) {
      this.logger.logError(error as Error, 'getUserWorkspaces');
      throw error instanceof UserDiscoveryApiError 
        ? error 
        : new UserDiscoveryApiError('Failed to get user workspaces');
    }
  }

  /**
   * Get general user statistics
   */
  public async getUserStatistics(): Promise<UserStatistics> {
    this.logger.logFunctionEntry('getUserStatistics');

    try {
      const response = await this.sessionManager.makeAuthenticatedRequest(
        `/api/discovery/statistics`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new UserDiscoveryApiError(
          error.error || 'Failed to get user statistics',
          response.status
        );
      }

      const statistics = await response.json() as UserStatistics;

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

    } catch (error) {
      this.logger.logError(error as Error, 'getUserStatistics');
      throw error instanceof UserDiscoveryApiError 
        ? error 
        : new UserDiscoveryApiError('Failed to get user statistics');
    }
  }
}