import { DatabaseService } from '../../server-src/services/database-service';
import { ShareService } from '../../server-src/services/share-service';
import * as crypto from 'crypto';

// Test helper functions
async function createTestUser(db: DatabaseService, username: string) {
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.pbkdf2Sync('password123', salt, 100000, 64, 'sha512').toString('hex');
  
  await db.run(
    'INSERT INTO users (id, username, password_hash, salt, is_active) VALUES (?, ?, ?, ?, ?)',
    [userId, username, passwordHash, salt, 1]
  );
  
  return { id: userId, username };
}

async function createTestWorkspace(db: DatabaseService, userId: string, name: string) {
  const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const graphData = JSON.stringify({ nodes: new Map() });
  const canvasState = JSON.stringify({ pan: { x: 0, y: 0 }, zoom: 1 });
  
  await db.run(
    'INSERT INTO workspaces (id, user_id, name, graph_data, canvas_state) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, userId, name, graphData, canvasState]
  );
  
  return { id: workspaceId, name };
}

describe('ShareService', () => {
  let db: DatabaseService;
  let shareService: ShareService;
  let testUsers: { owner: any; recipient: any; other: any };
  let testWorkspace: any;

  beforeEach(async () => {
    // Initialize in-memory database
    db = await DatabaseService.initialize(':memory:');
    await db.runMigration();
    
    shareService = new ShareService(db);
    
    // Create test users
    testUsers = {
      owner: await createTestUser(db, 'workspace_owner'),
      recipient: await createTestUser(db, 'share_recipient'),
      other: await createTestUser(db, 'other_user')
    };
    
    // Create test workspace
    testWorkspace = await createTestWorkspace(db, testUsers.owner.id, 'Test Workspace');
  });

  afterEach(async () => {
    await db.close();
  });

  describe('searchUsers', () => {
    it('should find users by partial username', async () => {
      const results = await shareService.searchUsers('recip', testUsers.owner.id);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: testUsers.recipient.id,
        username: 'share_recipient'
      });
    });

    it('should exclude the requesting user', async () => {
      const results = await shareService.searchUsers('owner', testUsers.owner.id);

      expect(results).toHaveLength(0);
    });

    it('should find users with exact match first', async () => {
      await createTestUser(db, 'john_doe');
      await createTestUser(db, 'johnny_smith');
      
      const results = await shareService.searchUsers('john', testUsers.owner.id);
      
      expect(results.length).toBeGreaterThan(0);
      // Exact match should be first due to ORDER BY
      expect(results[0]?.username).toBe('john_doe');
    });

    it('should respect the limit parameter', async () => {
      // Create multiple users
      for (let i = 0; i < 15; i++) {
        await createTestUser(db, `test_user_${i}`);
      }
      
      const results = await shareService.searchUsers('test', testUsers.owner.id, 5);
      
      expect(results).toHaveLength(5);
    });

    it('should throw error for short search queries', async () => {
      await expect(
        shareService.searchUsers('a', testUsers.owner.id)
      ).rejects.toThrow('Search query must be at least 2 characters');
    });
  });

  describe('shareWorkspace', () => {
    it('should create a share record', async () => {
      const share = await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      expect(share).toMatchObject({
        workspaceId: testWorkspace.id,
        ownerId: testUsers.owner.id,
        sharedWithUserId: testUsers.recipient.id,
        permissionLevel: 'view',
        isActive: true
      });

      // Verify share was saved
      const savedShare = await db.get(
        'SELECT * FROM workspace_shares WHERE id = ?',
        [share.id]
      );
      expect(savedShare).toBeTruthy();
    });

    it('should prevent self-sharing', async () => {
      await expect(
        shareService.shareWorkspace(
          testWorkspace.id,
          testUsers.owner.id,
          testUsers.owner.id
        )
      ).rejects.toThrow('Cannot share workspace with yourself');
    });

    it('should prevent duplicate shares', async () => {
      // First share should succeed
      await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      // Second share should fail
      await expect(
        shareService.shareWorkspace(
          testWorkspace.id,
          testUsers.owner.id,
          testUsers.recipient.id
        )
      ).rejects.toThrow('Workspace is already shared with this user');
    });

    it('should reject shares for non-existent workspace', async () => {
      await expect(
        shareService.shareWorkspace(
          'non_existent_workspace',
          testUsers.owner.id,
          testUsers.recipient.id
        )
      ).rejects.toThrow('Workspace not found or you do not have permission');
    });

    it('should reject shares from non-owner', async () => {
      await expect(
        shareService.shareWorkspace(
          testWorkspace.id,
          testUsers.other.id,
          testUsers.recipient.id
        )
      ).rejects.toThrow('Workspace not found or you do not have permission');
    });

    it('should support expiration dates', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
      
      const share = await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id,
        futureDate
      );

      expect(share.expiresAt).toBe(futureDate);
    });
  });

  describe('validateShareAccess', () => {
    it('should return owner for workspace owner', async () => {
      const access = await shareService.validateShareAccess(
        testWorkspace.id,
        testUsers.owner.id
      );

      expect(access).toBe('owner');
    });

    it('should return view for shared user', async () => {
      await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      const access = await shareService.validateShareAccess(
        testWorkspace.id,
        testUsers.recipient.id
      );

      expect(access).toBe('view');
    });

    it('should return null for non-shared user', async () => {
      const access = await shareService.validateShareAccess(
        testWorkspace.id,
        testUsers.other.id
      );

      expect(access).toBeNull();
    });

    it('should return null for expired shares', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday

      await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id,
        pastDate
      );

      const access = await shareService.validateShareAccess(
        testWorkspace.id,
        testUsers.recipient.id
      );

      expect(access).toBeNull();
    });

    it('should update last accessed time', async () => {
      await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      // First access
      await shareService.validateShareAccess(
        testWorkspace.id,
        testUsers.recipient.id
      );

      // Check last accessed was updated
      const share = await db.get<any>(
        'SELECT last_accessed FROM workspace_shares WHERE workspace_id = ? AND shared_with_user_id = ?',
        [testWorkspace.id, testUsers.recipient.id]
      );

      expect(share.last_accessed).toBeTruthy();
    });
  });

  describe('getSharedWithMe', () => {
    it('should return workspaces shared with user', async () => {
      // Create multiple shares
      const workspace2 = await createTestWorkspace(db, testUsers.other.id, 'Other Workspace');

      await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      await shareService.shareWorkspace(
        workspace2.id,
        testUsers.other.id,
        testUsers.recipient.id
      );

      const shared = await shareService.getSharedWithMe(testUsers.recipient.id);

      expect(shared).toHaveLength(2);
      
      // Check both workspaces are present (order may vary)
      const workspaceIds = shared.map(w => w.id);
      expect(workspaceIds).toContain(testWorkspace.id);
      expect(workspaceIds).toContain(workspace2.id);
      
      const testWs = shared.find(w => w.id === testWorkspace.id);
      expect(testWs).toMatchObject({
        id: testWorkspace.id,
        name: 'Test Workspace',
        ownerUsername: 'workspace_owner'
      });
      
      const otherWs = shared.find(w => w.id === workspace2.id);
      expect(otherWs).toMatchObject({
        id: workspace2.id,
        name: 'Other Workspace',
        ownerUsername: 'other_user'
      });
    });

    it('should exclude expired shares', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();

      await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id,
        pastDate
      );

      const shared = await shareService.getSharedWithMe(testUsers.recipient.id);

      expect(shared).toHaveLength(0);
    });

    it('should exclude deleted workspaces', async () => {
      // Share workspace
      await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      // "Delete" workspace by renaming
      await db.run(
        'UPDATE workspaces SET name = ? WHERE id = ?',
        ['_deleted_' + testWorkspace.name, testWorkspace.id]
      );

      const shared = await shareService.getSharedWithMe(testUsers.recipient.id);

      expect(shared).toHaveLength(0);
    });
  });

  describe('getWorkspaceShares', () => {
    it('should return all shares for a workspace', async () => {
      await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.other.id
      );

      const shares = await shareService.getWorkspaceShares(
        testWorkspace.id,
        testUsers.owner.id
      );

      expect(shares).toHaveLength(2);
      // Check that both usernames are present, order may vary
      const usernames = shares.map(s => s.sharedWithUsername).sort();
      expect(usernames).toEqual(['other_user', 'share_recipient']);
    });

    it('should reject request from non-owner', async () => {
      await expect(
        shareService.getWorkspaceShares(
          testWorkspace.id,
          testUsers.other.id
        )
      ).rejects.toThrow('Workspace not found or you do not have permission');
    });
  });

  describe('revokeShare', () => {
    it('should revoke an active share', async () => {
      const share = await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      await shareService.revokeShare(
        testWorkspace.id,
        testUsers.owner.id,
        share.id
      );

      // Verify share is inactive
      const revokedShare = await db.get<any>(
        'SELECT is_active FROM workspace_shares WHERE id = ?',
        [share.id]
      );

      expect(revokedShare.is_active).toBe(0);
    });

    it('should reject revoke from non-owner', async () => {
      const share = await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      const result = await shareService.revokeShare(
        testWorkspace.id,
        testUsers.other.id,
        share.id
      );
      
      expect(result).toBe(false);
    });

    it('should reject revoke for non-existent share', async () => {
      const result = await shareService.revokeShare(
        testWorkspace.id,
        testUsers.owner.id,
        'non_existent_share'
      );
      
      expect(result).toBe(false);
    });
  });

  describe('share activity logging', () => {
    it('should log share creation', async () => {
      await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      const activity = await db.get<any>(
        'SELECT * FROM share_activity WHERE workspace_id = ? AND action = ?',
        [testWorkspace.id, 'share_granted']
      );

      expect(activity).toBeTruthy();
      expect(activity.user_id).toBe(testUsers.owner.id);
      expect(activity.share_type).toBe('direct_share');
    });

    it('should log share revocation', async () => {
      const share = await shareService.shareWorkspace(
        testWorkspace.id,
        testUsers.owner.id,
        testUsers.recipient.id
      );

      await shareService.revokeShare(
        testWorkspace.id,
        testUsers.owner.id,
        share.id
      );

      const activity = await db.get<any>(
        'SELECT * FROM share_activity WHERE workspace_id = ? AND action = ?',
        [testWorkspace.id, 'share_revoked']
      );

      expect(activity).toBeTruthy();
      expect(activity.user_id).toBe(testUsers.owner.id);
    });
  });
});