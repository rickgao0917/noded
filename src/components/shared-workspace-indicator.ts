import { Logger } from '../utils/logger';

interface SharedWorkspaceIndicatorConfig {
  type: 'direct' | 'link';
  owner: string;
  onClose?: () => void;
}

export class SharedWorkspaceIndicator {
  private readonly logger: Logger;
  private readonly config: SharedWorkspaceIndicatorConfig;
  private element: HTMLElement | null = null;

  constructor(config: SharedWorkspaceIndicatorConfig) {
    this.logger = new Logger('SharedWorkspaceIndicator');
    this.config = config;
    
    this.logger.logFunctionEntry('constructor', { config });
    
    this.render();
    
    this.logger.logFunctionExit('constructor', undefined);
  }

  private render(): void {
    this.logger.logFunctionEntry('render', {});
    
    // Create the indicator element
    this.element = document.createElement('div');
    this.element.className = 'shared-workspace-indicator';
    
    const iconType = this.config.type === 'direct' ? '👥' : '🔗';
    const shareType = this.config.type === 'direct' ? 'Shared by' : 'Shared via link by';
    
    this.element.innerHTML = `
      <div class="shared-indicator-content">
        <span class="shared-icon">${iconType}</span>
        <span class="shared-text">${shareType} <strong>${this.escapeHtml(this.config.owner)}</strong></span>
        ${this.config.onClose ? '<button class="shared-close-btn" aria-label="Close">×</button>' : ''}
      </div>
    `;
    
    // Add styles if not already present
    this.addStyles();
    
    // Append to controls container
    const controls = document.querySelector('.controls');
    if (controls) {
      controls.appendChild(this.element);
    } else {
      // Fallback to body if controls not found
      document.body.appendChild(this.element);
    }
    
    // Attach event listeners
    if (this.config.onClose) {
      const closeBtn = this.element.querySelector('.shared-close-btn');
      closeBtn?.addEventListener('click', () => {
        this.destroy();
        this.config.onClose?.();
      });
    }
    
    this.logger.logInfo('Shared workspace indicator rendered', 'render', {
      type: this.config.type,
      owner: this.config.owner
    });
    
    this.logger.logFunctionExit('render', undefined);
  }

  private addStyles(): void {
    const styleId = 'shared-workspace-indicator-styles';
    
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .shared-workspace-indicator {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 4px;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: slideDown 0.3s ease-out;
        }
        
        @keyframes slideDown {
          from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
        
        .shared-indicator-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .shared-icon {
          font-size: 18px;
        }
        
        .shared-text {
          color: #856404;
          font-size: 14px;
        }
        
        .shared-text strong {
          color: #533f03;
          font-weight: 600;
        }
        
        .shared-close-btn {
          background: none;
          border: none;
          font-size: 20px;
          color: #856404;
          cursor: pointer;
          padding: 0;
          margin-left: 10px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 3px;
          transition: background-color 0.2s;
        }
        
        .shared-close-btn:hover {
          background-color: rgba(0,0,0,0.1);
        }
        
        /* Adjust for workspace sidebar if present */
        body.has-workspace-sidebar .shared-workspace-indicator {
          left: calc(50% + 125px); /* Half of sidebar width */
        }
      `;
      document.head.appendChild(style);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  public destroy(): void {
    this.logger.logFunctionEntry('destroy', {});
    
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    
    this.logger.logInfo('Shared workspace indicator destroyed', 'destroy');
    this.logger.logFunctionExit('destroy', undefined);
  }

  /**
   * Update the indicator with new information
   * 
   * @param config - New configuration
   */
  public update(config: Partial<SharedWorkspaceIndicatorConfig>): void {
    this.logger.logFunctionEntry('update', { config });
    
    // Update config
    Object.assign(this.config, config);
    
    // Re-render
    this.destroy();
    this.render();
    
    this.logger.logFunctionExit('update', undefined);
  }
}