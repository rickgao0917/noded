import { Database } from 'sqlite3';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../utils/logger.js';
import { BaseError } from '../types/errors.js';
export class DatabaseError extends BaseError {
    constructor(message, cause) {
        super('DatabaseError', message, cause);
    }
}
export class DatabaseService {
    constructor() {
        this.db = null;
        this.logger = new Logger('DatabaseService');
        // Ensure data directory exists
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.dbPath = path.join(dataDir, 'noded.db');
    }
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    async initialize() {
        this.logger.logFunctionEntry('initialize');
        try {
            this.db = new Database(this.dbPath);
            // Promisify database methods
            const run = promisify(this.db.run.bind(this.db));
            // Create tables
            await run(`
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
            await run(`
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
            await run(`
        CREATE TABLE IF NOT EXISTS user_files (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          graph_data TEXT NOT NULL,
          canvas_state TEXT NOT NULL,
          metadata TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          UNIQUE(user_id, file_name)
        )
      `);
            // Create indexes
            await run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
            await run('CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token)');
            await run('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at)');
            await run('CREATE INDEX IF NOT EXISTS idx_files_user ON user_files(user_id)');
            this.logger.info('Database initialized successfully');
        }
        catch (error) {
            this.logger.logError('Failed to initialize database', error);
            throw new DatabaseError('Failed to initialize database', error);
        }
        finally {
            this.logger.logFunctionExit('initialize');
        }
    }
    async close() {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db.close((err) => {
                    if (err) {
                        this.logger.logError('Failed to close database', err);
                        reject(err);
                    }
                    else {
                        this.db = null;
                        resolve();
                    }
                });
            });
        }
    }
    ensureConnected() {
        if (!this.db) {
            throw new DatabaseError('Database not initialized');
        }
    }
    async getUserByUsername(username) {
        this.logger.logFunctionEntry('getUserByUsername', { username });
        this.ensureConnected();
        const get = promisify(this.db.get.bind(this.db));
        try {
            const row = await get('SELECT * FROM users WHERE username = ?', [username]);
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
        }
        catch (error) {
            this.logger.logError('Failed to get user by username', error);
            throw new DatabaseError('Failed to get user', error);
        }
        finally {
            this.logger.logFunctionExit('getUserByUsername');
        }
    }
    async createUser(username, passwordHash, salt) {
        this.logger.logFunctionEntry('createUser', { username });
        this.ensureConnected();
        const run = promisify(this.db.run.bind(this.db));
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        try {
            await run('INSERT INTO users (id, username, password_hash, salt) VALUES (?, ?, ?, ?)', [userId, username, passwordHash, salt]);
            const user = await this.getUserByUsername(username);
            if (!user) {
                throw new DatabaseError('Failed to retrieve created user');
            }
            return user;
        }
        catch (error) {
            this.logger.logError('Failed to create user', error);
            if (error.code === 'SQLITE_CONSTRAINT') {
                throw new DatabaseError('Username already exists');
            }
            throw new DatabaseError('Failed to create user', error);
        }
        finally {
            this.logger.logFunctionExit('createUser');
        }
    }
    async createSession(userId, sessionToken, expiresAt) {
        this.logger.logFunctionEntry('createSession', { userId });
        this.ensureConnected();
        const run = promisify(this.db.run.bind(this.db));
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        try {
            await run('INSERT INTO user_sessions (id, user_id, session_token, expires_at) VALUES (?, ?, ?, ?)', [sessionId, userId, sessionToken, expiresAt.toISOString()]);
            return {
                id: sessionId,
                userId,
                sessionToken,
                expiresAt,
                createdAt: new Date(),
                lastActivity: new Date()
            };
        }
        catch (error) {
            this.logger.logError('Failed to create session', error);
            throw new DatabaseError('Failed to create session', error);
        }
        finally {
            this.logger.logFunctionExit('createSession');
        }
    }
    async getSessionByToken(sessionToken) {
        this.logger.logFunctionEntry('getSessionByToken');
        this.ensureConnected();
        const get = promisify(this.db.get.bind(this.db));
        try {
            const row = await get('SELECT * FROM user_sessions WHERE session_token = ?', [sessionToken]);
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
        }
        catch (error) {
            this.logger.logError('Failed to get session', error);
            throw new DatabaseError('Failed to get session', error);
        }
        finally {
            this.logger.logFunctionExit('getSessionByToken');
        }
    }
    async deleteSession(sessionToken) {
        this.logger.logFunctionEntry('deleteSession');
        this.ensureConnected();
        const run = promisify(this.db.run.bind(this.db));
        try {
            await run('DELETE FROM user_sessions WHERE session_token = ?', [sessionToken]);
        }
        catch (error) {
            this.logger.logError('Failed to delete session', error);
            throw new DatabaseError('Failed to delete session', error);
        }
        finally {
            this.logger.logFunctionExit('deleteSession');
        }
    }
    async saveUserFile(userId, fileName, graphData, canvasState, metadata = {}) {
        this.logger.logFunctionEntry('saveUserFile', { userId, fileName });
        this.ensureConnected();
        const run = promisify(this.db.run.bind(this.db));
        const get = promisify(this.db.get.bind(this.db));
        try {
            // Check if file exists
            const existing = await get('SELECT id FROM user_files WHERE user_id = ? AND file_name = ?', [userId, fileName]);
            const graphDataJson = JSON.stringify(graphData);
            const canvasStateJson = JSON.stringify(canvasState);
            const metadataJson = JSON.stringify(metadata);
            if (existing) {
                // Update existing file
                await run('UPDATE user_files SET graph_data = ?, canvas_state = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [graphDataJson, canvasStateJson, metadataJson, existing.id]);
                return existing.id;
            }
            else {
                // Create new file
                const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await run('INSERT INTO user_files (id, user_id, file_name, graph_data, canvas_state, metadata) VALUES (?, ?, ?, ?, ?, ?)', [fileId, userId, fileName, graphDataJson, canvasStateJson, metadataJson]);
                return fileId;
            }
        }
        catch (error) {
            this.logger.logError('Failed to save user file', error);
            throw new DatabaseError('Failed to save file', error);
        }
        finally {
            this.logger.logFunctionExit('saveUserFile');
        }
    }
    async getUserFile(userId, fileName) {
        this.logger.logFunctionEntry('getUserFile', { userId, fileName });
        this.ensureConnected();
        const get = promisify(this.db.get.bind(this.db));
        try {
            const row = await get('SELECT * FROM user_files WHERE user_id = ? AND file_name = ?', [userId, fileName]);
            if (!row) {
                return null;
            }
            return {
                id: row.id,
                userId: row.user_id,
                fileName: row.file_name,
                graphData: row.graph_data,
                canvasState: row.canvas_state,
                metadata: row.metadata,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            };
        }
        catch (error) {
            this.logger.logError('Failed to get user file', error);
            throw new DatabaseError('Failed to get file', error);
        }
        finally {
            this.logger.logFunctionExit('getUserFile');
        }
    }
    async listUserFiles(userId) {
        this.logger.logFunctionEntry('listUserFiles', { userId });
        this.ensureConnected();
        const all = promisify(this.db.all.bind(this.db));
        try {
            const rows = await all('SELECT id, file_name, updated_at, metadata FROM user_files WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
            return rows.map(row => ({
                id: row.id,
                fileName: row.file_name,
                updatedAt: new Date(row.updated_at),
                metadata: JSON.parse(row.metadata || '{}')
            }));
        }
        catch (error) {
            this.logger.logError('Failed to list user files', error);
            throw new DatabaseError('Failed to list files', error);
        }
        finally {
            this.logger.logFunctionExit('listUserFiles');
        }
    }
    async updateLastLogin(userId) {
        this.logger.logFunctionEntry('updateLastLogin', { userId });
        this.ensureConnected();
        const run = promisify(this.db.run.bind(this.db));
        try {
            await run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
        }
        catch (error) {
            this.logger.logError('Failed to update last login', error);
            throw new DatabaseError('Failed to update last login', error);
        }
        finally {
            this.logger.logFunctionExit('updateLastLogin');
        }
    }
    async cleanupExpiredSessions() {
        this.logger.logFunctionEntry('cleanupExpiredSessions');
        this.ensureConnected();
        const run = promisify(this.db.run.bind(this.db));
        try {
            await run('DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP');
        }
        catch (error) {
            this.logger.logError('Failed to cleanup expired sessions', error);
        }
        finally {
            this.logger.logFunctionExit('cleanupExpiredSessions');
        }
    }
}
