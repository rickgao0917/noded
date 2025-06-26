/**
 * User Discovery Types for frontend components
 */

export interface PublicUserInfo {
  readonly id: string;
  readonly username: string;
  readonly lastLogin: Date | null;
  readonly workspaceCount: number;
}

export interface PublicWorkspaceInfo {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: Date;
  readonly nodeCount?: number;
}

export interface UserDiscoveryResult {
  readonly users: PublicUserInfo[];
  readonly totalCount: number;
  readonly hasMore: boolean;
}

export interface UserStatistics {
  readonly totalUsers: number;
  readonly activeUsers: number;
  readonly totalWorkspaces: number;
}

export interface UserDiscoveryState {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly searchQuery: string;
  readonly results: UserDiscoveryResult | null;
  readonly selectedUser: PublicUserInfo | null;
  readonly selectedUserWorkspaces: PublicWorkspaceInfo[];
  readonly statistics: UserStatistics | null;
}