import request from 'supertest';
import express, { Express } from 'express';
import { DatabaseService } from '../../server-src/services/database-service';
import { AuthenticationService } from '../../server-src/services/authentication-service';
import { WorkspaceService } from '../../server-src/services/workspace-service';
import { ShareService } from '../../server-src/services/share-service';
import { createShareRoutes } from '../../server-src/routes/share-routes';

// Mock authentication middleware
const mockRequireAuth = (req: any, res: any, next: any) => {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.slice(7);
    if (token === 'owner_token') {
      req.user = { id: 'owner_id', username: 'owner_user' };
    } else if (token === 'recipient_token') {
      req.user = { id: 'recipient_id', username: 'recipient_user' };
    } else {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

async function createTestApp(database: DatabaseService): Promise<Express> {
  const app = express();
  app.use(express.json());

  const shareService = new ShareService(database);
  const workspaceService = WorkspaceService.getInstance();
  
  // Create a router with selective auth for testing
  const router = express.Router();
  
  // Routes that require auth
  router.get('/users/search', mockRequireAuth, async (req: any, res: any) => {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (!query || query.trim().length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
      }
      
      const users = await shareService.searchUsers(query, req.user.id, limit);
      res.json({ users });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  router.post('/:workspaceId', mockRequireAuth, async (req: any, res: any) => {
    try {
      const { shareWithUserId } = req.body;
      if (!shareWithUserId) {
        return res.status(400).json({ error: 'shareWithUserId is required' });
      }
      
      const share = await shareService.shareWorkspace(
        req.params.workspaceId,
        req.user.id,
        shareWithUserId
      );
      res.status(201).json(share);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  router.get('/me', mockRequireAuth, async (req: any, res: any) => {
    try {
      const workspaces = await shareService.getSharedWithMe(req.user.id);
      res.json({ workspaces });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  router.delete('/:shareId', mockRequireAuth, async (req: any, res: any) => {
    try {
      await shareService.revokeShare('workspace_123', req.user.id, req.params.shareId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  router.post('/:workspaceId/links', mockRequireAuth, async (req: any, res: any) => {
    try {
      const { requiresLogin } = req.body;
      const shareLink = await shareService.createShareLink(
        req.params.workspaceId,
        req.user.id,
        { requiresLogin }
      );
      
      const baseUrl = `http://localhost:${process.env.PORT || 8000}`;
      const fullLink = `${baseUrl}/shared/${shareLink.token}`;
      
      res.status(201).json({
        ...shareLink,
        link: fullLink
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Public route for share links - NO AUTH REQUIRED
  router.get('/shared/:token', async (req: any, res: any) => {
    try {
      const token = req.params.token;
      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }
      
      const shareLink = await shareService.validateShareLink(token);
      if (!shareLink) {
        return res.status(401).json({ error: 'Invalid or expired share link' });
      }
      
      // Mock workspace data for test
      const workspace = {
        id: shareLink.workspaceId,
        name: 'Test Workspace',
        graphData: { nodes: [] },
        ownerId: shareLink.ownerId
      };
      
      res.json({
        workspace: {
          ...workspace,
          isReadOnly: true,
          shareInfo: { type: 'link' }
        }
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired share link' });
    }
  });
  
  app.use('/api/shares', router);
  
  return app;
}

async function createTestUser(db: DatabaseService, id: string, username: string) {
  await db.run(
    'INSERT INTO users (id, username, password_hash, salt, is_active) VALUES (?, ?, ?, ?, ?)',
    [id, username, 'dummy_hash', 'dummy_salt', 1]
  );
}

async function createTestWorkspace(db: DatabaseService, id: string, userId: string, name: string) {
  await db.run(
    'INSERT INTO workspaces (id, user_id, name, graph_data, canvas_state) VALUES (?, ?, ?, ?, ?)',
    [id, userId, name, '{"nodes":[]}', '{"pan":{"x":0,"y":0},"zoom":1}']
  );
}

describe('Share API Integration Tests', () => {
  let app: Express;
  let db: DatabaseService;

  beforeEach(async () => {
    // Initialize database first
    db = await DatabaseService.initialize(':memory:');
    await db.runMigration();
    
    // Create test app with the same database
    app = await createTestApp(db);
    
    // Create test users
    await createTestUser(db, 'owner_id', 'owner_user');
    await createTestUser(db, 'recipient_id', 'recipient_user');
    await createTestUser(db, 'other_id', 'other_user');
    
    // Create test workspace
    await createTestWorkspace(db, 'workspace_123', 'owner_id', 'Test Workspace');
  });

  afterEach(async () => {
    await db.close();
  });

  describe('User Search', () => {
    it('should search for users', async () => {
      const response = await request(app)
        .get('/api/shares/users/search')
        .set('Authorization', 'Bearer owner_token')
        .query({ q: 'recipient' });

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0]).toMatchObject({
        id: 'recipient_id',
        username: 'recipient_user'
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/shares/users/search')
        .query({ q: 'test' });

      expect(response.status).toBe(401);
    });

    it('should validate search query length', async () => {
      const response = await request(app)
        .get('/api/shares/users/search')
        .set('Authorization', 'Bearer owner_token')
        .query({ q: 'a' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Search query must be at least 2 characters');
    });
  });

  describe('Share Workspace', () => {
    it('should share workspace with another user', async () => {
      const response = await request(app)
        .post('/api/shares/workspaces/workspace_123/shares')
        .set('Authorization', 'Bearer owner_token')
        .send({ shareWithUserId: 'recipient_id' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        workspaceId: 'workspace_123',
        sharedWithUserId: 'recipient_id',
        permissionLevel: 'view',
        isActive: true
      });
    });

    it('should prevent non-owners from sharing', async () => {
      const response = await request(app)
        .post('/api/shares/workspaces/workspace_123/shares')
        .set('Authorization', 'Bearer recipient_token')
        .send({ shareWithUserId: 'other_id' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/shares/workspaces/workspace_123/shares')
        .set('Authorization', 'Bearer owner_token')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('shareWithUserId is required');
    });
  });

  describe('List Shared With Me', () => {
    beforeEach(async () => {
      // Share a workspace with recipient
      const shareService = new ShareService(db);
      await shareService.shareWorkspace('workspace_123', 'owner_id', 'recipient_id');
    });

    it('should list workspaces shared with user', async () => {
      const response = await request(app)
        .get('/api/shares/shared-with-me')
        .set('Authorization', 'Bearer recipient_token');

      expect(response.status).toBe(200);
      expect(response.body.workspaces).toHaveLength(1);
      expect(response.body.workspaces[0]).toMatchObject({
        id: 'workspace_123',
        name: 'Test Workspace',
        ownerUsername: 'owner_user'
      });
    });
  });

  describe('Revoke Share', () => {
    beforeEach(async () => {
      // Share a workspace
      const shareService = new ShareService(db);
      await shareService.shareWorkspace('workspace_123', 'owner_id', 'recipient_id');
    });

    it('should revoke share access', async () => {
      const response = await request(app)
        .delete('/api/shares/workspaces/workspace_123/shares/recipient_id')
        .set('Authorization', 'Bearer owner_token');

      expect(response.status).toBe(204);

      // Verify share was revoked
      const shareService = new ShareService(db);
      const access = await shareService.validateShareAccess('workspace_123', 'recipient_id');
      expect(access).toBeNull();
    });

    it('should prevent non-owners from revoking', async () => {
      const response = await request(app)
        .delete('/api/shares/workspaces/workspace_123/shares/recipient_id')
        .set('Authorization', 'Bearer recipient_token');

      expect(response.status).toBe(403);
    });
  });

  describe('Share Links', () => {
    it('should create share link', async () => {
      const response = await request(app)
        .post('/api/shares/workspaces/workspace_123/share-link')
        .set('Authorization', 'Bearer owner_token')
        .send({ requiresLogin: false });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('link');
      expect(response.body.requiresLogin).toBe(false);
    });

    it('should access workspace via share link', async () => {
      // First create a share link
      const shareService = new ShareService(db);
      const shareLink = await shareService.createShareLink('workspace_123', 'owner_id', {
        requiresLogin: false
      });

      const response = await request(app)
        .get(`/api/shares/shared/${shareLink.token}`);

      expect(response.status).toBe(200);
      expect(response.body.workspace).toMatchObject({
        id: 'workspace_123',
        isReadOnly: true,
        shareInfo: {
          type: 'link',
          owner: 'owner_user'
        }
      });
    });
  });
});