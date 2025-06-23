import * as crypto from 'crypto';
import { Logger } from '../utils/logger';
import { BaseError } from '../types/errors';
import { DatabaseService } from './database-service';
import type { 
  UserCredentials, 
  UserSession, 
  UserId, 
  SessionToken,
  LoginResponse,
  RegisterResponse
} from '../types/auth.types';

export class AuthenticationError extends BaseError {
  constructor(message: string, cause?: Error) {
    super('AuthenticationError', message, cause);
  }
}

export class AuthenticationService {
  private static instance: AuthenticationService;
  private readonly logger = new Logger('AuthenticationService');
  private readonly database: DatabaseService;
  private readonly SESSION_DURATION = parseInt(process.env.SESSION_DURATION || '86400'); // 24 hours in seconds

  private constructor() {
    this.database = DatabaseService.getInstance();
  }

  public static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  private generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateSessionToken(): SessionToken {
    return crypto.randomBytes(64).toString('hex') as SessionToken;
  }

  private validateUsername(username: string): void {
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

  private validatePassword(password: string): void {
    if (!password || password.length < 6) {
      throw new AuthenticationError('Password must be at least 6 characters long');
    }
    if (password.length > 200) {
      throw new AuthenticationError('Password is too long');
    }
  }

  public async register(credentials: UserCredentials): Promise<RegisterResponse> {
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
      const user = await this.database.createUser(
        credentials.username,
        passwordHash,
        salt
      );

      this.logger.info('User registered successfully', { userId: user.id });

      return {
        userId: user.id as UserId,
        username: user.username,
        message: 'Registration successful'
      };
    } catch (error) {
      this.logger.logError(error as Error, 'register');
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Registration failed', error as Error);
    } finally {
      this.logger.logFunctionExit('register');
    }
  }

  public async login(credentials: UserCredentials): Promise<LoginResponse> {
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

      const session: UserSession = {
        userId: user.id as UserId,
        username: user.username,
        sessionToken,
        expiresAt
      };

      this.logger.info('User logged in successfully', { userId: user.id });

      return {
        session,
        message: 'Login successful'
      };
    } catch (error) {
      this.logger.logError(error as Error, 'login');
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Login failed', error as Error);
    } finally {
      this.logger.logFunctionExit('login');
    }
  }

  public async validateSession(sessionToken: string): Promise<UserSession | null> {
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
      const user = await this.database.getUserById(session.userId);
      if (!user || !user.isActive) {
        await this.database.deleteSession(sessionToken);
        return null;
      }

      return {
        userId: session.userId as UserId,
        username: user.username,
        sessionToken: session.sessionToken as SessionToken,
        expiresAt: session.expiresAt
      };
    } catch (error) {
      this.logger.logError(error as Error, 'validateSession');
      return null;
    } finally {
      this.logger.logFunctionExit('validateSession');
    }
  }

  public async logout(sessionToken: string): Promise<void> {
    this.logger.logFunctionEntry('logout');

    try {
      await this.database.deleteSession(sessionToken);
      this.logger.info('User logged out successfully');
    } catch (error) {
      this.logger.logError(error as Error, 'logout');
      throw new AuthenticationError('Logout failed', error as Error);
    } finally {
      this.logger.logFunctionExit('logout');
    }
  }

  public async refreshSession(sessionToken: string): Promise<UserSession | null> {
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

      await this.database.createSession(
        currentSession.userId as string,
        newSessionToken,
        expiresAt
      );

      // Delete old session
      await this.database.deleteSession(sessionToken);

      return {
        ...currentSession,
        sessionToken: newSessionToken,
        expiresAt
      };
    } catch (error) {
      this.logger.logError(error as Error, 'refreshSession');
      return null;
    } finally {
      this.logger.logFunctionExit('refreshSession');
    }
  }
}