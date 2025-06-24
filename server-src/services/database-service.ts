import { Database } from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { Logger } from '../utils/logger';
import { BaseError } from '../types/errors';

export interface DatabaseUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: Date;
  lastLogin: Date | null;
  isActive: boolean;
}

export interface DatabaseSession {
  id: string;
  userId: string;
  sessionToken: string;
  expiresAt: Date;
  createdAt: Date;
  lastActivity: Date;
}

export interface DatabaseWorkspace {
  id: string;
  userId: string;
  name: string;
  graphData: string; // JSON
  canvasState: string; // JSON
  metadata: string; // JSON
  createdAt: Date;
  updatedAt: Date;
}

export class DatabaseError extends BaseError {
  constructor(message: string, cause?: Error) {
    super('DatabaseError', message, cause);
  }
}

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database | null = null;
  private readonly logger = new Logger('DatabaseService');
  private readonly dbPath: string;

  private constructor() {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'noded.db');
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private runQuery(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private getQuery<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as T | undefined);
        }
      });
    });
  }

  private allQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  public async initialize(): Promise<void> {
    this.logger.logFunctionEntry('initialize');
    
    try {
      this.db = new Database(this.dbPath);
      
      // Create tables
      await this.runQuery(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          is_active BOOLEAN DEFAULT 1
        )
      `);

      await this.runQuery(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          session_token TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      await this.runQuery(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          graph_data TEXT NOT NULL,
          canvas_state TEXT NOT NULL,
          metadata TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          UNIQUE(user_id, name)
        )
      `);

      // Create indexes
      await this.runQuery('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
      await this.runQuery('CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token)');
      await this.runQuery('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at)');
      await this.runQuery('CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id)');

      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.logError(error as Error, 'initialize');
      throw new DatabaseError('Failed to initialize database', error as Error);
    } finally {
      this.logger.logFunctionExit('initialize');
    }
  }

  public async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            this.logger.logError(err, 'close');
            reject(err);
          } else {
            this.db = null;
            resolve();
          }
        });
      });
    }
  }

  private ensureConnected(): void {
    if (!this.db) {
      throw new DatabaseError('Database not initialized');
    }
  }

  public async getUserByUsername(username: string): Promise<DatabaseUser | null> {
    this.logger.logFunctionEntry('getUserByUsername', { username });
    this.ensureConnected();

    try {
      const row = await this.getQuery<any>(
        'SELECT * FROM users WHERE username = ?',
        [username]
      );

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        salt: row.salt,
        createdAt: new Date(row.created_at),
        lastLogin: row.last_login ? new Date(row.last_login) : null,
        isActive: Boolean(row.is_active)
      };
    } catch (error) {
      this.logger.logError(error as Error, 'getUserByUsername');
      throw new DatabaseError('Failed to get user', error as Error);
    } finally {
      this.logger.logFunctionExit('getUserByUsername');
    }
  }

  public async getUserById(userId: string): Promise<DatabaseUser | null> {
    this.logger.logFunctionEntry('getUserById', { userId });
    this.ensureConnected();

    try {
      const row = await this.getQuery<any>(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        salt: row.salt,
        createdAt: new Date(row.created_at),
        lastLogin: row.last_login ? new Date(row.last_login) : null,
        isActive: Boolean(row.is_active)
      };
    } catch (error) {
      this.logger.logError(error as Error, 'getUserById');
      throw new DatabaseError('Failed to get user', error as Error);
    } finally {
      this.logger.logFunctionExit('getUserById');
    }
  }

  public async createUser(
    username: string,
    passwordHash: string,
    salt: string
  ): Promise<DatabaseUser> {
    this.logger.logFunctionEntry('createUser', { username });
    this.ensureConnected();

    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await this.runQuery(
        'INSERT INTO users (id, username, password_hash, salt) VALUES (?, ?, ?, ?)',
        [userId, username, passwordHash, salt]
      );

      const user = await this.getUserByUsername(username);
      if (!user) {
        throw new DatabaseError('Failed to retrieve created user');
      }

      return user;
    } catch (error) {
      this.logger.logError(error as Error, 'createUser');
      if ((error as any).code === 'SQLITE_CONSTRAINT') {
        throw new DatabaseError('Username already exists');
      }
      throw new DatabaseError('Failed to create user', error as Error);
    } finally {
      this.logger.logFunctionExit('createUser');
    }
  }

  public async createSession(
    userId: string,
    sessionToken: string,
    expiresAt: Date
  ): Promise<DatabaseSession> {
    this.logger.logFunctionEntry('createSession', { userId });
    this.ensureConnected();

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await this.runQuery(
        'INSERT INTO user_sessions (id, user_id, session_token, expires_at) VALUES (?, ?, ?, ?)',
        [sessionId, userId, sessionToken, expiresAt.toISOString()]
      );

      return {
        id: sessionId,
        userId,
        sessionToken,
        expiresAt,
        createdAt: new Date(),
        lastActivity: new Date()
      };
    } catch (error) {
      this.logger.logError(error as Error, 'createSession');
      throw new DatabaseError('Failed to create session', error as Error);
    } finally {
      this.logger.logFunctionExit('createSession');
    }
  }

  public async getSessionByToken(sessionToken: string): Promise<DatabaseSession | null> {
    this.logger.logFunctionEntry('getSessionByToken');
    this.ensureConnected();

    try {
      const row = await this.getQuery<any>(
        'SELECT * FROM user_sessions WHERE session_token = ?',
        [sessionToken]
      );

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: row.user_id,
        sessionToken: row.session_token,
        expiresAt: new Date(row.expires_at),
        createdAt: new Date(row.created_at),
        lastActivity: new Date(row.last_activity)
      };
    } catch (error) {
      this.logger.logError(error as Error, 'getSessionByToken');
      throw new DatabaseError('Failed to get session', error as Error);
    } finally {
      this.logger.logFunctionExit('getSessionByToken');
    }
  }

  public async deleteSession(sessionToken: string): Promise<void> {
    this.logger.logFunctionEntry('deleteSession');
    this.ensureConnected();

    try {
      await this.runQuery('DELETE FROM user_sessions WHERE session_token = ?', [sessionToken]);
    } catch (error) {
      this.logger.logError(error as Error, 'deleteSession');
      throw new DatabaseError('Failed to delete session', error as Error);
    } finally {
      this.logger.logFunctionExit('deleteSession');
    }
  }

  public async saveWorkspace(
    userId: string,
    name: string,
    graphData: any,
    canvasState: any,
    metadata: any = {}
  ): Promise<string> {
    this.logger.logFunctionEntry('saveWorkspace', { userId, name });
    this.ensureConnected();

    try {
      // Check if workspace exists
      const existing = await this.getQuery<any>(
        'SELECT id FROM workspaces WHERE user_id = ? AND name = ?',
        [userId, name]
      );

      const graphDataJson = JSON.stringify(graphData);
      const canvasStateJson = JSON.stringify(canvasState);
      const metadataJson = JSON.stringify(metadata);

      if (existing) {
        // Update existing workspace
        await this.runQuery(
          'UPDATE workspaces SET graph_data = ?, canvas_state = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [graphDataJson, canvasStateJson, metadataJson, existing.id]
        );
        return existing.id;
      } else {
        // Create new workspace
        const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await this.runQuery(
          'INSERT INTO workspaces (id, user_id, name, graph_data, canvas_state, metadata) VALUES (?, ?, ?, ?, ?, ?)',
          [workspaceId, userId, name, graphDataJson, canvasStateJson, metadataJson]
        );
        return workspaceId;
      }
    } catch (error) {
      this.logger.logError(error as Error, 'saveWorkspace');
      throw new DatabaseError('Failed to save workspace', error as Error);
    } finally {
      this.logger.logFunctionExit('saveWorkspace');
    }
  }

  public async getWorkspace(
    userId: string,
    name: string
  ): Promise<DatabaseWorkspace | null> {
    this.logger.logFunctionEntry('getWorkspace', { userId, name });
    this.ensureConnected();

    try {
      const row = await this.getQuery<any>(
        'SELECT * FROM workspaces WHERE user_id = ? AND name = ?',
        [userId, name]
      );

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        graphData: row.graph_data,
        canvasState: row.canvas_state,
        metadata: row.metadata,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      this.logger.logError(error as Error, 'getWorkspace');
      throw new DatabaseError('Failed to get workspace', error as Error);
    } finally {
      this.logger.logFunctionExit('getWorkspace');
    }
  }

  public async listWorkspaces(userId: string): Promise<Array<{
    id: string;
    name: string;
    updatedAt: Date;
    metadata: any;
  }>> {
    this.logger.logFunctionEntry('listWorkspaces', { userId });
    this.ensureConnected();

    try {
      const rows = await this.allQuery<any>(
        'SELECT id, name, updated_at, metadata FROM workspaces WHERE user_id = ? AND name NOT LIKE "_deleted_%" ORDER BY updated_at DESC',
        [userId]
      );

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        updatedAt: new Date(row.updated_at),
        metadata: JSON.parse(row.metadata || '{}')
      }));
    } catch (error) {
      this.logger.logError(error as Error, 'listWorkspaces');
      throw new DatabaseError('Failed to list workspaces', error as Error);
    } finally {
      this.logger.logFunctionExit('listWorkspaces');
    }
  }

  public async updateLastLogin(userId: string): Promise<void> {
    this.logger.logFunctionEntry('updateLastLogin', { userId });
    this.ensureConnected();

    try {
      await this.runQuery(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [userId]
      );
    } catch (error) {
      this.logger.logError(error as Error, 'updateLastLogin');
      throw new DatabaseError('Failed to update last login', error as Error);
    } finally {
      this.logger.logFunctionExit('updateLastLogin');
    }
  }

  public async cleanupExpiredSessions(): Promise<void> {
    this.logger.logFunctionEntry('cleanupExpiredSessions');
    this.ensureConnected();

    try {
      await this.runQuery(
        'DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP'
      );
    } catch (error) {
      this.logger.logError(error as Error, 'cleanupExpiredSessions');
    } finally {
      this.logger.logFunctionExit('cleanupExpiredSessions');
    }
  }

  public async runMigration(): Promise<void> {
    const correlationId = this.logger.generateCorrelationId();
    
    try {
      this.logger.logFunctionEntry('runMigration', {});
      
      const migrationPath = path.join(__dirname, '../migrations/001_add_sharing_tables.sql');
      const migrationSql = await fsPromises.readFile(migrationPath, 'utf-8');
      
      // Split migration into individual statements
      const statements = migrationSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        await this.runQuery(statement);
        this.logger.logBusinessLogic('Migration statement executed', {
          statementPreview: statement.substring(0, 50) + '...'
        }, correlationId);
      }
      
      this.logger.logFunctionExit('runMigration', undefined);
    } catch (error) {
      this.logger.logError(error as Error, 'runMigration', { correlationId });
      throw new DatabaseError('Failed to run sharing tables migration', error as Error);
    }
  }

  // Public wrapper methods for share service
  public async run(sql: string, params: any[] = []): Promise<void> {
    return this.runQuery(sql, params);
  }

  public async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return this.getQuery<T>(sql, params);
  }

  public async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    return this.allQuery<T>(sql, params);
  }

  // Static method to initialize in-memory database for testing
  public static async initialize(dbPath?: string): Promise<DatabaseService> {
    const instance = new DatabaseService();
    if (dbPath) {
      // Override the default path for testing
      (instance as any).dbPath = dbPath;
    }
    await instance.initialize();
    return instance;
  }
}