"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = exports.DatabaseError = void 0;
const sqlite3_1 = require("sqlite3");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const logger_1 = require("../utils/logger");
const errors_1 = require("../types/errors");
class DatabaseError extends errors_1.BaseError {
    constructor(message, cause) {
        super('DatabaseError', message, cause);
    }
}
exports.DatabaseError = DatabaseError;
class DatabaseService {
    constructor() {
        this.db = null;
        this.logger = new logger_1.Logger('DatabaseService');
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
    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            this.db.run(sql, params, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    getQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
    }
    allQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    }
    async initialize() {
        this.logger.logFunctionEntry('initialize');
        try {
            this.db = new sqlite3_1.Database(this.dbPath);
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
        }
        catch (error) {
            this.logger.logError(error, 'initialize');
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
                        this.logger.logError(err, 'close');
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
        try {
            const row = await this.getQuery('SELECT * FROM users WHERE username = ?', [username]);
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
            this.logger.logError(error, 'getUserByUsername');
            throw new DatabaseError('Failed to get user', error);
        }
        finally {
            this.logger.logFunctionExit('getUserByUsername');
        }
    }
    async getUserById(userId) {
        this.logger.logFunctionEntry('getUserById', { userId });
        this.ensureConnected();
        try {
            const row = await this.getQuery('SELECT * FROM users WHERE id = ?', [userId]);
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
            this.logger.logError(error, 'getUserById');
            throw new DatabaseError('Failed to get user', error);
        }
        finally {
            this.logger.logFunctionExit('getUserById');
        }
    }
    async createUser(username, passwordHash, salt) {
        this.logger.logFunctionEntry('createUser', { username });
        this.ensureConnected();
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        try {
            await this.runQuery('INSERT INTO users (id, username, password_hash, salt) VALUES (?, ?, ?, ?)', [userId, username, passwordHash, salt]);
            const user = await this.getUserByUsername(username);
            if (!user) {
                throw new DatabaseError('Failed to retrieve created user');
            }
            return user;
        }
        catch (error) {
            this.logger.logError(error, 'createUser');
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
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        try {
            await this.runQuery('INSERT INTO user_sessions (id, user_id, session_token, expires_at) VALUES (?, ?, ?, ?)', [sessionId, userId, sessionToken, expiresAt.toISOString()]);
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
            this.logger.logError(error, 'createSession');
            throw new DatabaseError('Failed to create session', error);
        }
        finally {
            this.logger.logFunctionExit('createSession');
        }
    }
    async getSessionByToken(sessionToken) {
        this.logger.logFunctionEntry('getSessionByToken');
        this.ensureConnected();
        try {
            const row = await this.getQuery('SELECT * FROM user_sessions WHERE session_token = ?', [sessionToken]);
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
            this.logger.logError(error, 'getSessionByToken');
            throw new DatabaseError('Failed to get session', error);
        }
        finally {
            this.logger.logFunctionExit('getSessionByToken');
        }
    }
    async deleteSession(sessionToken) {
        this.logger.logFunctionEntry('deleteSession');
        this.ensureConnected();
        try {
            await this.runQuery('DELETE FROM user_sessions WHERE session_token = ?', [sessionToken]);
        }
        catch (error) {
            this.logger.logError(error, 'deleteSession');
            throw new DatabaseError('Failed to delete session', error);
        }
        finally {
            this.logger.logFunctionExit('deleteSession');
        }
    }
    async saveWorkspace(userId, name, graphData, canvasState, metadata = {}) {
        this.logger.logFunctionEntry('saveWorkspace', { userId, name });
        this.ensureConnected();
        try {
            // Check if workspace exists
            const existing = await this.getQuery('SELECT id FROM workspaces WHERE user_id = ? AND name = ?', [userId, name]);
            const graphDataJson = JSON.stringify(graphData);
            const canvasStateJson = JSON.stringify(canvasState);
            const metadataJson = JSON.stringify(metadata);
            if (existing) {
                // Update existing workspace
                await this.runQuery('UPDATE workspaces SET graph_data = ?, canvas_state = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [graphDataJson, canvasStateJson, metadataJson, existing.id]);
                return existing.id;
            }
            else {
                // Create new workspace
                const workspaceId = `workspace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await this.runQuery('INSERT INTO workspaces (id, user_id, name, graph_data, canvas_state, metadata) VALUES (?, ?, ?, ?, ?, ?)', [workspaceId, userId, name, graphDataJson, canvasStateJson, metadataJson]);
                return workspaceId;
            }
        }
        catch (error) {
            this.logger.logError(error, 'saveWorkspace');
            throw new DatabaseError('Failed to save workspace', error);
        }
        finally {
            this.logger.logFunctionExit('saveWorkspace');
        }
    }
    async getWorkspace(userId, name) {
        this.logger.logFunctionEntry('getWorkspace', { userId, name });
        this.ensureConnected();
        try {
            const row = await this.getQuery('SELECT * FROM workspaces WHERE user_id = ? AND name = ?', [userId, name]);
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
        }
        catch (error) {
            this.logger.logError(error, 'getWorkspace');
            throw new DatabaseError('Failed to get workspace', error);
        }
        finally {
            this.logger.logFunctionExit('getWorkspace');
        }
    }
    async listWorkspaces(userId) {
        this.logger.logFunctionEntry('listWorkspaces', { userId });
        this.ensureConnected();
        try {
            const rows = await this.allQuery('SELECT id, name, updated_at, metadata FROM workspaces WHERE user_id = ? AND name NOT LIKE "_deleted_%" ORDER BY updated_at DESC', [userId]);
            return rows.map(row => ({
                id: row.id,
                name: row.name,
                updatedAt: new Date(row.updated_at),
                metadata: JSON.parse(row.metadata || '{}')
            }));
        }
        catch (error) {
            this.logger.logError(error, 'listWorkspaces');
            throw new DatabaseError('Failed to list workspaces', error);
        }
        finally {
            this.logger.logFunctionExit('listWorkspaces');
        }
    }
    async updateLastLogin(userId) {
        this.logger.logFunctionEntry('updateLastLogin', { userId });
        this.ensureConnected();
        try {
            await this.runQuery('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
        }
        catch (error) {
            this.logger.logError(error, 'updateLastLogin');
            throw new DatabaseError('Failed to update last login', error);
        }
        finally {
            this.logger.logFunctionExit('updateLastLogin');
        }
    }
    async cleanupExpiredSessions() {
        this.logger.logFunctionEntry('cleanupExpiredSessions');
        this.ensureConnected();
        try {
            await this.runQuery('DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP');
        }
        catch (error) {
            this.logger.logError(error, 'cleanupExpiredSessions');
        }
        finally {
            this.logger.logFunctionExit('cleanupExpiredSessions');
        }
    }
}
exports.DatabaseService = DatabaseService;
