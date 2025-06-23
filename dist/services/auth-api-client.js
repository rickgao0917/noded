import { Logger } from '../utils/logger.js';
/**
 * Client-side API client for authentication endpoints
 */
export class AuthApiClient {
    constructor() {
        this.logger = new Logger('AuthApiClient');
    }
    static getInstance() {
        if (!AuthApiClient.instance) {
            AuthApiClient.instance = new AuthApiClient();
        }
        return AuthApiClient.instance;
    }
    async login(credentials) {
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
        }
        catch (error) {
            this.logger.logError(error, 'login');
            throw error;
        }
        finally {
            this.logger.logFunctionExit('login');
        }
    }
    async register(credentials) {
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
        }
        catch (error) {
            this.logger.logError(error, 'register');
            throw error;
        }
        finally {
            this.logger.logFunctionExit('register');
        }
    }
    async logout(sessionToken) {
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
        }
        catch (error) {
            this.logger.logError(error, 'logout');
            throw error;
        }
        finally {
            this.logger.logFunctionExit('logout');
        }
    }
    async validateSession(sessionToken) {
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
        }
        catch (error) {
            this.logger.logError(error, 'validateSession');
            return null;
        }
        finally {
            this.logger.logFunctionExit('validateSession');
        }
    }
}
