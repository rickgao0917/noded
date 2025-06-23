import { Logger } from '../utils/logger';
import { SessionManager } from '../services/session-manager';
import { AuthApiClient } from '../services/auth-api-client';
import type { UserCredentials, UserSession } from '../types/auth.types';

export class LoginComponent {
  private static instance: LoginComponent;
  private readonly logger = new Logger('LoginComponent');
  private readonly sessionManager = SessionManager.getInstance();
  private readonly authApiClient = AuthApiClient.getInstance();
  private modalElement: HTMLElement | null = null;
  private isLoginMode = true;
  private onSuccessCallback: ((session: UserSession) => void) | null = null;

  private constructor() {}

  public static getInstance(): LoginComponent {
    if (!LoginComponent.instance) {
      LoginComponent.instance = new LoginComponent();
    }
    return LoginComponent.instance;
  }

  public initialize(onSuccess: (session: UserSession) => void): void {
    this.logger.logFunctionEntry('initialize');
    
    this.onSuccessCallback = onSuccess;
    
    // Create modal element
    this.createModal();
    
    // Check if already authenticated
    if (this.sessionManager.isAuthenticated()) {
      this.hideModal();
      const session = this.sessionManager.getSession();
      if (session) {
        onSuccess(session);
      }
    } else {
      this.showModal();
    }
    
    // Listen for session expiry
    window.addEventListener('sessionExpired', () => {
      this.showModal();
    });
    
    this.logger.logFunctionExit('initialize');
  }

  private createModal(): void {
    // Check if modal already exists
    if (document.getElementById('auth-modal')) {
      this.modalElement = document.getElementById('auth-modal');
      return;
    }

    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal';
    modal.innerHTML = `
      <div class="auth-modal-content">
        <h2 id="auth-title">Login</h2>
        <form id="auth-form">
          <div class="auth-form-group">
            <label for="auth-username">Username</label>
            <input 
              type="text" 
              id="auth-username" 
              name="username" 
              required 
              minlength="3"
              maxlength="50"
              pattern="[a-zA-Z0-9_\\-]+"
              title="Username can only contain letters, numbers, underscores, and hyphens"
            />
          </div>
          <div class="auth-form-group">
            <label for="auth-password">Password</label>
            <input 
              type="password" 
              id="auth-password" 
              name="password" 
              required 
              minlength="6"
              maxlength="200"
            />
          </div>
          <div class="auth-error" id="auth-error" style="display: none;"></div>
          <div class="auth-form-actions">
            <button type="submit" id="auth-submit">Login</button>
            <a href="#" id="auth-toggle">Need an account? Register</a>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalElement = modal;

    // Add CSS if not already present
    if (!document.getElementById('auth-styles')) {
      const style = document.createElement('style');
      style.id = 'auth-styles';
      style.textContent = `
        .auth-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
        }

        .auth-modal.hidden {
          display: none;
        }

        .auth-modal-content {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          width: 90%;
          max-width: 400px;
        }

        .auth-modal-content h2 {
          margin: 0 0 1.5rem 0;
          text-align: center;
          color: #333;
        }

        .auth-form-group {
          margin-bottom: 1rem;
        }

        .auth-form-group label {
          display: block;
          margin-bottom: 0.5rem;
          color: #555;
          font-weight: 500;
        }

        .auth-form-group input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
          transition: border-color 0.3s;
          box-sizing: border-box;
        }

        .auth-form-group input:focus {
          outline: none;
          border-color: #007bff;
        }

        .auth-form-group input:invalid {
          border-color: #dc3545;
        }

        .auth-error {
          color: #dc3545;
          margin-bottom: 1rem;
          padding: 0.5rem;
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .auth-form-actions {
          margin-top: 1.5rem;
        }

        .auth-form-actions button {
          width: 100%;
          padding: 0.75rem;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.3s;
        }

        .auth-form-actions button:hover {
          background-color: #0056b3;
        }

        .auth-form-actions button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .auth-form-actions a {
          display: block;
          text-align: center;
          margin-top: 1rem;
          color: #007bff;
          text-decoration: none;
          font-size: 0.875rem;
        }

        .auth-form-actions a:hover {
          text-decoration: underline;
        }

        /* Hide canvas and controls when auth modal is shown */
        body.auth-modal-open #canvas,
        body.auth-modal-open .controls {
          opacity: 0.3;
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);
    }

    // Attach event listeners
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const form = document.getElementById('auth-form') as HTMLFormElement;
    const toggleLink = document.getElementById('auth-toggle') as HTMLAnchorElement;

    form.addEventListener('submit', (e) => this.handleSubmit(e));
    toggleLink.addEventListener('click', (e) => this.handleToggle(e));
  }

  private handleToggle(event: Event): void {
    event.preventDefault();
    this.isLoginMode = !this.isLoginMode;
    
    const title = document.getElementById('auth-title') as HTMLHeadingElement;
    const submitButton = document.getElementById('auth-submit') as HTMLButtonElement;
    const toggleLink = document.getElementById('auth-toggle') as HTMLAnchorElement;
    
    if (this.isLoginMode) {
      title.textContent = 'Login';
      submitButton.textContent = 'Login';
      toggleLink.textContent = 'Need an account? Register';
    } else {
      title.textContent = 'Register';
      submitButton.textContent = 'Register';
      toggleLink.textContent = 'Already have an account? Login';
    }
    
    this.hideError();
  }

  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    
    const form = event.target as HTMLFormElement;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    
    const credentials: UserCredentials = { username, password };
    
    this.setLoading(true);
    this.hideError();
    
    try {
      if (this.isLoginMode) {
        await this.handleLogin(credentials);
      } else {
        await this.handleRegister(credentials);
      }
    } catch (error) {
      this.showError((error as Error).message);
    } finally {
      this.setLoading(false);
    }
  }

  private async handleLogin(credentials: UserCredentials): Promise<void> {
    this.logger.logFunctionEntry('handleLogin');
    
    try {
      const data = await this.authApiClient.login(credentials);
      this.sessionManager.setSession(data.session);
      this.onLoginSuccess(data.session);
    } catch (error) {
      this.logger.logError(error as Error, 'handleLogin');
      throw error;
    } finally {
      this.logger.logFunctionExit('handleLogin');
    }
  }

  private async handleRegister(credentials: UserCredentials): Promise<void> {
    this.logger.logFunctionEntry('handleRegister');
    
    try {
      await this.authApiClient.register(credentials);
      
      // After successful registration, automatically log in
      await this.handleLogin(credentials);
    } catch (error) {
      this.logger.logError(error as Error, 'handleRegister');
      throw error;
    } finally {
      this.logger.logFunctionExit('handleRegister');
    }
  }

  private onLoginSuccess(session: UserSession): void {
    this.logger.info('Login successful', { userId: session.userId });
    
    this.hideModal();
    this.hideError();
    
    // Clear form
    const form = document.getElementById('auth-form') as HTMLFormElement;
    form.reset();
    
    // Call the success callback
    if (this.onSuccessCallback) {
      this.onSuccessCallback(session);
    }
  }

  private showModal(): void {
    if (this.modalElement) {
      this.modalElement.classList.remove('hidden');
      document.body.classList.add('auth-modal-open');
    }
  }

  private hideModal(): void {
    if (this.modalElement) {
      this.modalElement.classList.add('hidden');
      document.body.classList.remove('auth-modal-open');
    }
  }

  private showError(message: string): void {
    const errorElement = document.getElementById('auth-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  private hideError(): void {
    const errorElement = document.getElementById('auth-error');
    if (errorElement) {
      errorElement.style.display = 'none';
      errorElement.textContent = '';
    }
  }

  private setLoading(loading: boolean): void {
    const submitButton = document.getElementById('auth-submit') as HTMLButtonElement;
    const form = document.getElementById('auth-form') as HTMLFormElement;
    
    if (loading) {
      submitButton.disabled = true;
      submitButton.textContent = this.isLoginMode ? 'Logging in...' : 'Registering...';
      form.style.opacity = '0.7';
    } else {
      submitButton.disabled = false;
      submitButton.textContent = this.isLoginMode ? 'Login' : 'Register';
      form.style.opacity = '1';
    }
  }

  public show(): void {
    this.showModal();
  }

  public hide(): void {
    this.hideModal();
  }
}