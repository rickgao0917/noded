import { DatabaseService } from '../../server-src/services/database-service';
import * as crypto from 'crypto';

export interface TestUser {
  id: string;
  username: string;
  passwordHash?: string;
  salt?: string;
}

export interface TestWorkspace {
  id: string;
  userId: string;
  name: string;
  graphData?: string;
  canvasState?: string;
}

export interface TestShare {
  id: string;
  workspaceId: string;
  ownerId: string;
  sharedWithUserId: string;
  permissionLevel: string;
  createdAt: string;
  isActive: boolean;
}

/**
 * Creates a test user in the database
 */
export async function createTestUser(
  db: DatabaseService,
  username: string,
  password: string = 'password123'
): Promise<TestUser> {
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  
  await db.run(
    'INSERT INTO users (id, username, password_hash, salt, is_active) VALUES (?, ?, ?, ?, ?)',
    [userId, username, passwordHash, salt, 1]
  );
  
  return { id: userId, username, passwordHash, salt };
}

/**
 * Creates a test workspace in the database
 */
export async function createTestWorkspace(
  db: DatabaseService,
  userId: string,
  name: string,
  graphData?: any,
  canvasState?: any
): Promise<TestWorkspace> {
  const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const defaultGraphData = graphData || { nodes: new Map() };
  const defaultCanvasState = canvasState || { pan: { x: 0, y: 0 }, zoom: 1 };
  
  const graphDataJson = JSON.stringify(defaultGraphData);
  const canvasStateJson = JSON.stringify(defaultCanvasState);
  
  await db.run(
    'INSERT INTO workspaces (id, user_id, name, graph_data, canvas_state) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, userId, name, graphDataJson, canvasStateJson]
  );
  
  return { 
    id: workspaceId, 
    userId, 
    name, 
    graphData: graphDataJson, 
    canvasState: canvasStateJson 
  };
}

/**
 * Creates a test share between users
 */
export async function createTestShare(
  db: DatabaseService,
  workspaceId: string,
  ownerId: string,
  sharedWithUserId: string,
  expiresAt?: string
): Promise<TestShare> {
  const shareId = `share_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();
  
  await db.run(
    `INSERT INTO workspace_shares 
     (id, workspace_id, owner_id, shared_with_user_id, permission_level, created_at, expires_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [shareId, workspaceId, ownerId, sharedWithUserId, 'view', now, expiresAt || null, 1]
  );
  
  return {
    id: shareId,
    workspaceId,
    ownerId,
    sharedWithUserId,
    permissionLevel: 'view',
    createdAt: now,
    isActive: true
  };
}

/**
 * Creates a test share link for a workspace
 */
export async function createTestShareLink(
  db: DatabaseService,
  workspaceId: string,
  ownerId: string,
  options: { requiresLogin?: boolean; expiresIn?: number } = {}
): Promise<{ id: string; token: string; expiresAt?: string }> {
  const linkId = `link_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  
  let expiresAt: string | null = null;
  if (options.expiresIn) {
    const expDate = new Date(now.getTime() + options.expiresIn * 60 * 60 * 1000);
    expiresAt = expDate.toISOString();
  }
  
  await db.run(
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
  
  return { id: linkId, token, ...(expiresAt && { expiresAt }) };
}

/**
 * Sets up a complete test environment with users, workspaces, and shares
 */
export async function setupTestEnvironment(db: DatabaseService) {
  // Create users
  const owner = await createTestUser(db, 'workspace_owner');
  const recipient = await createTestUser(db, 'share_recipient');
  const otherUser = await createTestUser(db, 'other_user');
  
  // Create workspaces
  const workspace1 = await createTestWorkspace(db, owner.id, 'Test Workspace 1');
  const workspace2 = await createTestWorkspace(db, owner.id, 'Test Workspace 2');
  const recipientWorkspace = await createTestWorkspace(db, recipient.id, 'Recipient Workspace');
  
  // Create shares
  const share1 = await createTestShare(db, workspace1.id, owner.id, recipient.id);
  const share2 = await createTestShare(db, workspace2.id, owner.id, otherUser.id);
  
  // Create share link
  const shareLink = await createTestShareLink(db, workspace1.id, owner.id, { requiresLogin: true });
  
  return {
    users: { owner, recipient, otherUser },
    workspaces: { workspace1, workspace2, recipientWorkspace },
    shares: { share1, share2 },
    shareLinks: { shareLink }
  };
}

/**
 * Cleans up test data for a specific user
 */
export async function cleanupTestUser(db: DatabaseService, userId: string) {
  // Delete shares where user is owner or recipient
  await db.run(
    'DELETE FROM workspace_shares WHERE owner_id = ? OR shared_with_user_id = ?',
    [userId, userId]
  );
  
  // Delete share links for user's workspaces
  await db.run(
    'DELETE FROM share_links WHERE owner_id = ?',
    [userId]
  );
  
  // Delete workspaces
  await db.run('DELETE FROM workspaces WHERE user_id = ?', [userId]);
  
  // Delete sessions
  await db.run('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
  
  // Delete user
  await db.run('DELETE FROM users WHERE id = ?', [userId]);
}

/**
 * Verifies database integrity for sharing tables
 */
export async function verifyDatabaseIntegrity(db: DatabaseService): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  // Check for orphaned shares
  const orphanedShares = await db.query<any>(
    `SELECT ws.id 
     FROM workspace_shares ws
     LEFT JOIN workspaces w ON ws.workspace_id = w.id
     WHERE w.id IS NULL`
  );
  
  if (orphanedShares.length > 0) {
    errors.push(`Found ${orphanedShares.length} orphaned shares`);
  }
  
  // Check for shares with non-existent users
  const invalidUserShares = await db.query<any>(
    `SELECT ws.id 
     FROM workspace_shares ws
     LEFT JOIN users u1 ON ws.owner_id = u1.id
     LEFT JOIN users u2 ON ws.shared_with_user_id = u2.id
     WHERE u1.id IS NULL OR u2.id IS NULL`
  );
  
  if (invalidUserShares.length > 0) {
    errors.push(`Found ${invalidUserShares.length} shares with non-existent users`);
  }
  
  // Check for duplicate active shares
  const duplicateShares = await db.query<any>(
    `SELECT workspace_id, shared_with_user_id, COUNT(*) as count
     FROM workspace_shares
     WHERE is_active = 1
     GROUP BY workspace_id, shared_with_user_id
     HAVING COUNT(*) > 1`
  );
  
  if (duplicateShares.length > 0) {
    errors.push(`Found ${duplicateShares.length} duplicate active shares`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates a mock database connection for unit testing
 */
export function createMockDatabase(): DatabaseService {
  const mockDb = {
    run: jest.fn(),
    get: jest.fn(),
    query: jest.fn(),
    close: jest.fn(),
    runMigration: jest.fn(),
    initialize: jest.fn(),
    // Add other required methods
    getUserByUsername: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
    createSession: jest.fn(),
    getSessionByToken: jest.fn(),
    deleteSession: jest.fn(),
    saveWorkspace: jest.fn(),
    getWorkspace: jest.fn(),
    listWorkspaces: jest.fn(),
    updateLastLogin: jest.fn(),
    cleanupExpiredSessions: jest.fn()
  } as any;
  
  return mockDb;
}