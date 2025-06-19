/**
 * Debug Helper Utilities
 * 
 * Provides runtime control over logging configuration
 * Can be used from browser console for debugging
 */

import { Logger } from './logger.js';

/**
 * Global debug helper for runtime configuration
 * Usage from browser console:
 * - window.debug.enable() - Enable all logging
 * - window.debug.disable() - Disable all logging
 * - window.debug.showOnly('submitToLLM') - Show only specific function
 * - window.debug.hideFunction('updateConnections') - Hide specific function
 * - window.debug.setLevel('DEBUG', true) - Enable DEBUG level
 * - window.debug.showService('GeminiService') - Show only specific service
 */
export class DebugHelper {
  private loggers: Map<string, Logger> = new Map();

  /**
   * Register a logger instance
   */
  public registerLogger(serviceName: string, logger: Logger): void {
    this.loggers.set(serviceName, logger);
  }

  /**
   * Enable all logging
   */
  public enable(): void {
    this.updateAllLoggers({ enabled: true });
    console.log('🟢 Logging enabled');
  }

  /**
   * Disable all logging
   */
  public disable(): void {
    this.updateAllLoggers({ enabled: false });
    console.log('🔴 Logging disabled');
  }

  /**
   * Show only logs from specific function(s)
   */
  public showOnly(...functionNames: string[]): void {
    this.updateAllLoggers({
      functions: {
        include: functionNames,
        exclude: []
      }
    });
    console.log(`🎯 Showing only: ${functionNames.join(', ')}`);
  }

  /**
   * Hide specific function(s)
   */
  public hideFunction(...functionNames: string[]): void {
    const currentConfig = this.getCurrentConfig();
    const exclude = [...(currentConfig?.functions?.exclude || []), ...functionNames];
    
    this.updateAllLoggers({
      functions: {
        include: currentConfig?.functions?.include || ['.*'],
        exclude
      }
    });
    console.log(`🚫 Hiding: ${functionNames.join(', ')}`);
  }

  /**
   * Set log level visibility
   */
  public setLevel(level: string, enabled: boolean): void {
    this.updateAllLoggers({
      levels: { [level]: enabled }
    });
    console.log(`📊 ${level} level ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set log type visibility
   */
  public setType(type: string, enabled: boolean): void {
    this.updateAllLoggers({
      types: { [type]: enabled }
    });
    console.log(`📝 ${type} type ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Show only specific service(s)
   */
  public showService(...serviceNames: string[]): void {
    const services: Record<string, boolean> = {};
    
    // Disable all services first
    this.loggers.forEach((_, name) => {
      services[name] = false;
    });
    
    // Enable specific services
    serviceNames.forEach(name => {
      services[name] = true;
    });
    
    this.updateAllLoggers({ services });
    console.log(`🏢 Showing only services: ${serviceNames.join(', ')}`);
  }

  /**
   * Enable verbose mode (all TRACE and DEBUG)
   */
  public verbose(): void {
    this.updateAllLoggers({
      enabled: true,
      levels: {
        TRACE: true,
        DEBUG: true,
        INFO: true,
        WARN: true,
        ERROR: true,
        FATAL: true
      },
      types: {
        function_entry: true,
        function_exit: true,
        branch_execution: true,
        loop_execution: true,
        variable_assignment: true,
        user_interaction: true,
        performance_metric: true,
        business_logic: true,
        error: true,
        warning: true,
        trace: true,
        debug: true
      }
    });
    console.log('🔊 Verbose mode enabled');
  }

  /**
   * Enable minimal mode (only INFO, WARN, ERROR, FATAL)
   */
  public minimal(): void {
    this.updateAllLoggers({
      enabled: true,
      levels: {
        TRACE: false,
        DEBUG: false,
        INFO: true,
        WARN: true,
        ERROR: true,
        FATAL: true
      },
      types: {
        function_entry: false,
        function_exit: false,
        branch_execution: false,
        loop_execution: false,
        variable_assignment: false,
        user_interaction: true,
        performance_metric: false,
        business_logic: true,
        error: true,
        warning: true,
        trace: false,
        debug: false
      }
    });
    console.log('🔇 Minimal mode enabled');
  }

  /**
   * Show performance metrics only
   */
  public performanceOnly(): void {
    this.updateAllLoggers({
      enabled: true,
      types: {
        function_entry: false,
        function_exit: false,
        branch_execution: false,
        loop_execution: false,
        variable_assignment: false,
        user_interaction: false,
        performance_metric: true,
        business_logic: false,
        error: false,
        warning: false,
        trace: false,
        debug: false
      }
    });
    console.log('⏱️ Showing performance metrics only');
  }

  /**
   * Show current configuration
   */
  public showConfig(): void {
    const config = this.getCurrentConfig();
    console.log('📋 Current debug configuration:', config);
  }

  /**
   * Show available commands
   */
  public help(): void {
    console.log(`
🛠️ Debug Helper Commands:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Basic Controls:
  debug.enable()                    - Enable all logging
  debug.disable()                   - Disable all logging
  debug.verbose()                   - Enable verbose mode (all logs)
  debug.minimal()                   - Enable minimal mode (INFO+ only)

Function Filtering:
  debug.showOnly('submitToLLM')     - Show only specific function
  debug.hideFunction('render*')     - Hide specific function pattern

Level Control:
  debug.setLevel('DEBUG', true)     - Enable/disable log level
  debug.setLevel('TRACE', false)    

Type Control:
  debug.setType('function_entry', true)   - Enable/disable log type
  debug.setType('branch_execution', false)

Service Filtering:
  debug.showService('GeminiService')       - Show only specific service

Specialized Views:
  debug.performanceOnly()           - Show only performance metrics

Info:
  debug.showConfig()                - Show current configuration
  debug.help()                      - Show this help message
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  }

  private getCurrentConfig(): any {
    if (typeof window !== 'undefined') {
      return (window as any).NODE_EDITOR_CONFIG?.DEBUG;
    }
    return null;
  }

  private updateAllLoggers(config: any): void {
    this.loggers.forEach(logger => {
      logger.updateDebugConfig(config);
    });
    
    // Also update global config if it exists
    if (typeof window !== 'undefined' && (window as any).NODE_EDITOR_CONFIG?.DEBUG) {
      const globalConfig = (window as any).NODE_EDITOR_CONFIG.DEBUG;
      Object.assign(globalConfig, config);
    }
  }
}

// Create and export global instance
export const debugHelper = new DebugHelper();

// Expose to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).debug = debugHelper;
}