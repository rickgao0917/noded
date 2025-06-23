"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationService = exports.AuthenticationError = void 0;
const logger_1 = require("../utils/logger");
const errors_1 = require("../types/errors");
class AuthenticationError extends errors_1.BaseError {
    constructor(message, cause) {
        super('AuthenticationError', message, cause);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthenticationService {
    constructor() {
        this.logger = new logger_1.Logger('AuthenticationService');
        this.SESSION_DURATION = parseInt(process.env.SESSION_DURATION || '86400'); // 24 hours in seconds
        this.database = DatabaseService.getInstance();
    }
    static getInstance() {
        if (!AuthenticationService.instance) {
            AuthenticationService.instance = new AuthenticationService();
        }
        return AuthenticationService.instance;
    }
    hashPassword(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    }
    generateSalt() {
        return crypto.randomBytes(16).toString('hex');
    }
    generateSessionToken() {
        return crypto.randomBytes(64).toString('hex');
    }
    validateUsername(username) {
        if (!username || username.length < 3) {
            throw new AuthenticationError('Username must be at least 3 characters long');
        }
        if (username.length > 50) {
            throw new AuthenticationError('Username must be less than 50 characters');
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            throw new AuthenticationError('Username can only contain letters, numbers, underscores, and hyphens');
        }
    }
    validatePassword(password) {
        if (!password || password.length < 6) {
            throw new AuthenticationError('Password must be at least 6 characters long');
        }
        if (password.length > 200) {
            throw new AuthenticationError('Password is too long');
        }
    }
    async register(credentials) {
        this.logger.logFunctionEntry('register', { username: credentials.username });
        try {
            // Validate input
            this.validateUsername(credentials.username);
            this.validatePassword(credentials.password);
            // Check if user already exists
            const existingUser = await this.database.getUserByUsername(credentials.username);
            if (existingUser) {
                throw new AuthenticationError('Username already exists');
            }
            // Hash password
            const salt = this.generateSalt();
            const passwordHash = this.hashPassword(credentials.password, salt);
            // Create user
            const user = await this.database.createUser(credentials.username, passwordHash, salt);
            this.logger.info('User registered successfully', { userId: user.id });
            return {
                userId: user.id,
                username: user.username,
                message: 'Registration successful'
            };
        }
        catch (error) {
            this.logger.logError('Registration failed', error);
            if (error instanceof AuthenticationError) {
                throw error;
            }
            throw new AuthenticationError('Registration failed', error);
        }
        finally {
            this.logger.logFunctionExit('register');
        }
    }
    async login(credentials) {
        this.logger.logFunctionEntry('login', { username: credentials.username });
        try {
            // Validate input
            this.validateUsername(credentials.username);
            this.validatePassword(credentials.password);
            // Get user
            const user = await this.database.getUserByUsername(credentials.username);
            if (!user) {
                throw new AuthenticationError('Invalid username or password');
            }
            // Verify password
            const passwordHash = this.hashPassword(credentials.password, user.salt);
            if (passwordHash !== user.passwordHash) {
                throw new AuthenticationError('Invalid username or password');
            }
            // Check if user is active
            if (!user.isActive) {
                throw new AuthenticationError('Account is disabled');
            }
            // Generate session
            const sessionToken = this.generateSessionToken();
            const expiresAt = new Date(Date.now() + this.SESSION_DURATION * 1000);
            await this.database.createSession(user.id, sessionToken, expiresAt);
            await this.database.updateLastLogin(user.id);
            const session = {
                userId: user.id,
                username: user.username,
                sessionToken,
                expiresAt
            };
            this.logger.info('User logged in successfully', { userId: user.id });
            return {
                session,
                message: 'Login successful'
            };
        }
        catch (error) {
            this.logger.logError('Login failed', error);
            if (error instanceof AuthenticationError) {
                throw error;
            }
            throw new AuthenticationError('Login failed', error);
        }
        finally {
            this.logger.logFunctionExit('login');
        }
    }
    async validateSession(sessionToken) {
        this.logger.logFunctionEntry('validateSession');
        try {
            const session = await this.database.getSessionByToken(sessionToken);
            if (!session) {
                return null;
            }
            // Check if session is expired
            if (session.expiresAt < new Date()) {
                await this.database.deleteSession(sessionToken);
                return null;
            }
            // Get user info
            const user = await this.database.getUserByUsername(session.userId);
            if (!user || !user.isActive) {
                await this.database.deleteSession(sessionToken);
                return null;
            }
            return {
                userId: session.userId,
                username: user.username,
                sessionToken: session.sessionToken,
                expiresAt: session.expiresAt
            };
        }
        catch (error) {
            this.logger.logError('Session validation failed', error);
            return null;
        }
        finally {
            this.logger.logFunctionExit('validateSession');
        }
    }
    async logout(sessionToken) {
        this.logger.logFunctionEntry('logout');
        try {
            await this.database.deleteSession(sessionToken);
            this.logger.info('User logged out successfully');
        }
        catch (error) {
            this.logger.logError('Logout failed', error);
            throw new AuthenticationError('Logout failed', error);
        }
        finally {
            this.logger.logFunctionExit('logout');
        }
    }
    async refreshSession(sessionToken) {
        this.logger.logFunctionEntry('refreshSession');
        try {
            const currentSession = await this.validateSession(sessionToken);
            if (!currentSession) {
                return null;
            }
            // If session is still valid for more than half its duration, don't refresh
            const halfDuration = this.SESSION_DURATION * 500; // Half duration in milliseconds
            const timeRemaining = currentSession.expiresAt.getTime() - Date.now();
            if (timeRemaining > halfDuration) {
                return currentSession;
            }
            // Create new session
            const newSessionToken = this.generateSessionToken();
            const expiresAt = new Date(Date.now() + this.SESSION_DURATION * 1000);
            await this.database.createSession(currentSession.userId, newSessionToken, expiresAt);
            // Delete old session
            await this.database.deleteSession(sessionToken);
            return Object.assign(Object.assign({}, currentSession), { sessionToken: newSessionToken, expiresAt });
        }
        catch (error) {
            this.logger.logError('Session refresh failed', error);
            return null;
        }
        finally {
            this.logger.logFunctionExit('refreshSession');
        }
    }
}
exports.AuthenticationService = AuthenticationService;
