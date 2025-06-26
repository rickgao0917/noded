import { UserDiscoveryService } from '../../server-src/services/user-discovery-service';
import { DatabaseService } from '../../server-src/services/database-service';

// Mock DatabaseService
const mockDbService = {
  query: jest.fn(),
  get: jest.fn()
};

jest.mock('../../server-src/services/database-service', () => ({
  DatabaseService: {
    getInstance: jest.fn(() => mockDbService)
  }
}));

describe('UserDiscoveryService', () => {
  let service: UserDiscoveryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = UserDiscoveryService.getInstance();
  });

  describe('searchUsers', () => {
    it('should return user search results', async () => {
      const mockUsers = [
        {
          id: 'user1',
          username: 'john_doe',
          last_login: '2023-06-25T10:00:00Z',
          workspace_count: '3'
        },
        {
          id: 'user2', 
          username: 'jane_smith',
          last_login: null,
          workspace_count: '1'
        }
      ];

      const mockCountResult = { total: 2 };

      mockDbService.query.mockResolvedValueOnce(mockUsers);
      mockDbService.get.mockResolvedValueOnce(mockCountResult);

      const result = await service.searchUsers('john', 'current-user', 10, 0);

      expect(result).toEqual({
        users: [
          {
            id: 'user1',
            username: 'john_doe',
            lastLogin: new Date('2023-06-25T10:00:00Z'),
            workspaceCount: 3
          },
          {
            id: 'user2',
            username: 'jane_smith', 
            lastLogin: null,
            workspaceCount: 1
          }
        ],
        totalCount: 2,
        hasMore: false
      });
    });

    it('should throw error for short search query', async () => {
      await expect(service.searchUsers('a', 'current-user'))
        .rejects.toThrow('Search query must be at least 2 characters');
    });

    it('should limit results to maximum of 50', async () => {
      mockDbService.query.mockResolvedValueOnce([]);
      mockDbService.get.mockResolvedValueOnce({ total: 0 });

      await service.searchUsers('test', 'current-user', 100);

      // Check that the query was called with limit 50
      expect(mockDbService.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['current-user', '%test%', 51, 0])
      );
    });

    it('should detect when there are more results', async () => {
      const mockUsers = new Array(11).fill(null).map((_, i) => ({
        id: `user${i}`,
        username: `user${i}`,
        last_login: null,
        workspace_count: '0'
      }));

      mockDbService.query.mockResolvedValueOnce(mockUsers);
      mockDbService.get.mockResolvedValueOnce({ total: 20 });

      const result = await service.searchUsers('user', 'current-user', 10);

      expect(result.hasMore).toBe(true);
      expect(result.users).toHaveLength(10); // Should slice to limit
    });
  });

  describe('getUserWorkspaces', () => {
    it('should return user workspaces', async () => {
      const mockUser = {
        id: 'user1',
        username: 'john_doe',
        is_active: 1
      };

      const mockWorkspaces = [
        {
          id: 'ws1',
          name: 'Project A',
          updated_at: '2023-06-25T10:00:00Z',
          data_size: 1000
        },
        {
          id: 'ws2',
          name: 'Project B', 
          updated_at: '2023-06-24T15:30:00Z',
          data_size: 50
        }
      ];

      mockDbService.get.mockResolvedValueOnce(mockUser);
      mockDbService.query.mockResolvedValueOnce(mockWorkspaces);

      const result = await service.getUserWorkspaces('user1', 'requesting-user');

      expect(result).toEqual([
        {
          id: 'ws1',
          name: 'Project A',
          updatedAt: new Date('2023-06-25T10:00:00Z'),
          nodeCount: 2
        },
        {
          id: 'ws2',
          name: 'Project B',
          updatedAt: new Date('2023-06-24T15:30:00Z'),
          nodeCount: 0
        }
      ]);
    });

    it('should throw error for non-existent user', async () => {
      mockDbService.get.mockResolvedValueOnce(null);

      await expect(service.getUserWorkspaces('non-existent', 'requesting-user'))
        .rejects.toThrow('User not found');
    });

    it('should throw error for inactive user', async () => {
      const mockUser = {
        id: 'user1',
        username: 'john_doe',
        is_active: 0
      };

      mockDbService.get.mockResolvedValueOnce(mockUser);

      await expect(service.getUserWorkspaces('user1', 'requesting-user'))
        .rejects.toThrow('User account is inactive');
    });
  });

  describe('getUserStatistics', () => {
    it('should return user statistics', async () => {
      const mockStats = {
        total_users: '10',
        active_users: '8',
        total_workspaces: '25'
      };

      mockDbService.get.mockResolvedValueOnce(mockStats);

      const result = await service.getUserStatistics();

      expect(result).toEqual({
        totalUsers: 10,
        activeUsers: 8,
        totalWorkspaces: 25
      });
    });

    it('should handle null database response', async () => {
      mockDbService.get.mockResolvedValueOnce(null);

      const result = await service.getUserStatistics();

      expect(result).toEqual({
        totalUsers: 0,
        activeUsers: 0,
        totalWorkspaces: 0
      });
    });
  });
});