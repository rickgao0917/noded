import { Logger } from '../utils/logger';
import type { 
  UserCredentials, 
  UserSession, 
  LoginResponse,
  RegisterResponse
} from '../types/auth.types';

/**
 * Client-side API client for authentication endpoints
 */
export class AuthApiClient {
  private static instance: AuthApiClient;
  private readonly logger = new Logger('AuthApiClient');
  
  private constructor() {}
  
  public static getInstance(): AuthApiClient {
    if (!AuthApiClient.instance) {
      AuthApiClient.instance = new AuthApiClient();
    }
    return AuthApiClient.instance;
  }
  
  public async login(credentials: UserCredentials): Promise<LoginResponse> {
    this.logger.logFunctionEntry('login', { username: credentials.username });
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      this.logger.info('Login successful', { userId: data.session.userId });
      return data;
    } catch (error) {
      this.logger.logError(error as Error, 'login');
      throw error;
    } finally {
      this.logger.logFunctionExit('login');
    }
  }
  
  public async register(credentials: UserCredentials): Promise<RegisterResponse> {
    this.logger.logFunctionEntry('register', { username: credentials.username });
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      this.logger.info('Registration successful', { userId: data.userId });
      return data;
    } catch (error) {
      this.logger.logError(error as Error, 'register');
      throw error;
    } finally {
      this.logger.logFunctionExit('register');
    }
  }
  
  public async logout(sessionToken: string): Promise<void> {
    this.logger.logFunctionEntry('logout');
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Logout failed');
      }
      
      this.logger.info('Logout successful');
    } catch (error) {
      this.logger.logError(error as Error, 'logout');
      throw error;
    } finally {
      this.logger.logFunctionExit('logout');
    }
  }
  
  public async validateSession(sessionToken: string): Promise<UserSession | null> {
    this.logger.logFunctionEntry('validateSession');
    
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.session;
      }
      
      return null;
    } catch (error) {
      this.logger.logError(error as Error, 'validateSession');
      return null;
    } finally {
      this.logger.logFunctionExit('validateSession');
    }
  }
}