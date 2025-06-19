/**
 * Structured logging utility following comprehensive logging requirements
 * Provides trace, debug, info, warn, error, and fatal logging levels
 */

import type { DebugConfig, PartialDebugConfig } from '../types/debug.types.js';

export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG', 
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly service: string;
  readonly function: string;
  readonly correlationId: string;
  readonly userId?: string;
  readonly sessionId: string;
  readonly requestId?: string;
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
  readonly executionTime?: number;
  readonly parameters?: Record<string, unknown>;
  readonly returnValue?: unknown;
}


export class Logger {
  private readonly serviceName: string;
  private readonly sessionId: string;
  private correlationId: string;
  private debugConfig: DebugConfig | null = null;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.sessionId = this.generateSessionId();
    this.correlationId = this.generateCorrelationId();
    this.loadDebugConfig();
    
    // Register with debug helper will be done separately to avoid dynamic import issues
  }

  private loadDebugConfig(): void {
    if (typeof window !== 'undefined' && window.NODE_EDITOR_CONFIG?.DEBUG) {
      this.debugConfig = window.NODE_EDITOR_CONFIG.DEBUG;
    }
  }

  /**
   * Update debug configuration at runtime
   * Useful for debugging specific issues without reloading
   */
  public updateDebugConfig(config: PartialDebugConfig): void {
    if (!this.debugConfig) {
      this.debugConfig = {
        enabled: true,
        levels: {},
        types: {},
        services: {},
        functions: { include: ['.*'], exclude: [] },
        performance: { warnThreshold: 10, errorThreshold: 100 },
        format: {
          pretty: true,
          includeTimestamp: true,
          includeMetadata: true,
          includeStackTrace: true,
          maxDepth: 3
        }
      };
    }
    
    // Merge the new config
    if (config.levels) {
      this.debugConfig.levels = { ...this.debugConfig.levels, ...config.levels };
    }
    if (config.types) {
      this.debugConfig.types = { ...this.debugConfig.types, ...config.types };
    }
    if (config.services) {
      this.debugConfig.services = { ...this.debugConfig.services, ...config.services };
    }
    if (config.functions) {
      this.debugConfig.functions = { ...this.debugConfig.functions, ...config.functions };
    }
    if (config.performance) {
      this.debugConfig.performance = { ...this.debugConfig.performance, ...config.performance };
    }
    if (config.format) {
      this.debugConfig.format = { ...this.debugConfig.format, ...config.format };
    }
    if (config.enabled !== undefined) {
      this.debugConfig.enabled = config.enabled;
    }
  }

  /**
   * Log function entry with parameters
   */
  public logFunctionEntry(functionName: string, parameters: Record<string, unknown> = {}): void {
    this.log(LogLevel.TRACE, `Function entry: ${functionName}`, {
      type: 'function_entry',
      functionName,
      parameters: this.sanitizeParameters(parameters)
    });
  }

  /**
   * Log function exit with return value and execution time
   */
  public logFunctionExit(functionName: string, returnValue?: unknown, executionTime?: number): void {
    this.log(LogLevel.TRACE, `Function exit: ${functionName}`, {
      type: 'function_exit',
      functionName,
      returnValue: this.sanitizeReturnValue(returnValue),
      executionTime
    });
  }

  /**
   * Log conditional branch execution
   */
  public logBranch(functionName: string, condition: string, result: boolean, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `Branch executed: ${condition} = ${result}`, {
      type: 'branch_execution',
      functionName,
      condition,
      result,
      ...metadata
    });
  }

  /**
   * Log loop iterations
   */
  public logLoop(functionName: string, loopType: string, iterationCount: number, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `Loop completed: ${loopType} (${iterationCount} iterations)`, {
      type: 'loop_execution',
      functionName,
      loopType,
      iterationCount,
      ...metadata
    });
  }

  /**
   * Log variable assignments on critical paths
   */
  public logVariableAssignment(functionName: string, variableName: string, value: unknown, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `Variable assignment: ${variableName}`, {
      type: 'variable_assignment',
      functionName,
      variableName,
      value: this.sanitizeValue(value),
      ...metadata
    });
  }

  /**
   * Log user interactions
   */
  public logUserInteraction(action: string, elementId?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `User interaction: ${action}`, {
      type: 'user_interaction',
      action,
      elementId,
      ...metadata
    });
  }

  /**
   * Log performance metrics
   */
  public logPerformance(functionName: string, operation: string, duration: number, metadata?: Record<string, unknown>): void {
    const warnThreshold = this.debugConfig?.performance?.warnThreshold || 10;
    const errorThreshold = this.debugConfig?.performance?.errorThreshold || 100;
    
    let level = LogLevel.DEBUG;
    if (duration > errorThreshold) {
      level = LogLevel.ERROR;
    } else if (duration > warnThreshold) {
      level = LogLevel.WARN;
    }
    
    this.log(level, `Performance: ${operation} completed in ${duration}ms`, {
      type: 'performance_metric',
      functionName,
      operation,
      duration,
      ...metadata
    });
  }

  /**
   * Log errors with comprehensive context
   */
  public logError(error: Error, functionName: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, `Error in ${functionName}: ${error.message}`, {
      type: 'error',
      functionName,
      errorName: error.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      context: this.sanitizeContext(context)
    });
  }

  /**
   * Log business logic milestones
   */
  public logInfo(message: string, functionName?: string, metadata?: Record<string, unknown> | null): void {
    this.log(LogLevel.INFO, message, {
      type: 'business_logic',
      functionName,
      ...(metadata ? this.sanitizeContext(metadata) || {} : {})
    });
  }

  /**
   * Log warnings for recoverable issues
   */
  public logWarn(message: string, functionName?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, {
      type: 'warning',
      functionName,
      ...metadata
    });
  }

  /**
   * Log fatal system events
   */
  public logFatal(message: string, functionName?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.FATAL, message, {
      type: 'fatal',
      functionName,
      ...metadata
    });
  }

  /**
   * Log trace level messages for detailed execution flow
   */
  public logTrace(message: string, functionName?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, {
      type: 'trace',
      functionName,
      ...metadata
    });
  }

  /**
   * Log debug level messages for variable state information
   */
  public logDebug(message: string, functionName?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, {
      type: 'debug',
      functionName,
      ...metadata
    });
  }

  private log(level: LogLevel, message: string, metadata: Record<string, unknown> = {}): void {
    // Check if logging is enabled
    if (!this.shouldLog(level, metadata)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      function: metadata.functionName as string || 'unknown',
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      message,
      metadata
    };

    // Format and output the log
    this.outputLog(logEntry);
  }

  private shouldLog(level: LogLevel, metadata: Record<string, unknown>): boolean {
    // If no config, default to logging everything
    if (!this.debugConfig) {
      return true;
    }

    // Check if globally enabled
    if (!this.debugConfig.enabled) {
      return false;
    }

    // Check log level
    if (this.debugConfig.levels[level] === false) {
      return false;
    }

    // Check log type
    const logType = metadata.type as string;
    if (logType && this.debugConfig.types[logType] === false) {
      return false;
    }

    // Check service filter
    if (this.debugConfig.services[this.serviceName] === false) {
      return false;
    }

    // Check function filters
    const functionName = metadata.functionName as string;
    if (functionName) {
      // Check exclude patterns first
      if (this.debugConfig.functions.exclude) {
        for (const pattern of this.debugConfig.functions.exclude) {
          if (pattern && new RegExp(pattern).test(functionName)) {
            return false;
          }
        }
      }

      // Check include patterns
      if (this.debugConfig.functions.include && this.debugConfig.functions.include.length > 0) {
        let included = false;
        for (const pattern of this.debugConfig.functions.include) {
          if (pattern && new RegExp(pattern).test(functionName)) {
            included = true;
            break;
          }
        }
        if (!included) {
          return false;
        }
      }
    }

    return true;
  }

  private outputLog(logEntry: LogEntry): void {
    try {
      const config = this.debugConfig?.format || {
        pretty: true,
        includeTimestamp: true,
        includeMetadata: true,
        includeStackTrace: true,
        maxDepth: 3
      };
      
      // Filter log entry based on config
      const filteredEntry: any = {};
      
      if (config.includeTimestamp !== false) {
        filteredEntry.timestamp = logEntry.timestamp;
      }
      
      filteredEntry.level = logEntry.level;
      filteredEntry.service = logEntry.service;
      filteredEntry.function = logEntry.function;
      filteredEntry.correlationId = logEntry.correlationId;
      filteredEntry.sessionId = logEntry.sessionId;
      filteredEntry.message = logEntry.message;
      
      if (config.includeMetadata !== false && logEntry.metadata) {
        filteredEntry.metadata = this.truncateObject(logEntry.metadata, config.maxDepth || 3);
        
        // Remove stack trace if configured
        if (!config.includeStackTrace && filteredEntry.metadata.stackTrace) {
          delete filteredEntry.metadata.stackTrace;
        }
      }
      
      // Output with pretty printing if configured
      if (config.pretty) {
        console.log(JSON.stringify(filteredEntry, null, 2));
      } else {
        console.log(JSON.stringify(filteredEntry));
      }
    } catch (error) {
      // Handle JSON.stringify errors (e.g., circular references)
      const safeLogEntry = {
        ...logEntry,
        metadata: '[CIRCULAR_REFERENCE]'
      };
      console.log(JSON.stringify(safeLogEntry));
    }
  }

  private truncateObject(obj: unknown, maxDepth: number, currentDepth: number = 0): unknown {
    if (currentDepth >= maxDepth) {
      return '[TRUNCATED]';
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.truncateObject(item, maxDepth, currentDepth + 1));
    }

    if (obj !== null && typeof obj === 'object') {
      const truncated: Record<string, unknown> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          truncated[key] = this.truncateObject((obj as Record<string, unknown>)[key], maxDepth, currentDepth + 1);
        }
      }
      return truncated;
    }

    return obj;
  }

  /**
   * Sanitize parameters to remove sensitive data
   */
  private sanitizeParameters(parameters: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const key in parameters) {
      if (Object.prototype.hasOwnProperty.call(parameters, key)) {
        const value = parameters[key];
        if (this.isSensitiveField(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeValue(value);
        }
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize return values
   */
  private sanitizeReturnValue(value: unknown): unknown {
    if (typeof value === 'object' && value !== null) {
      return '[OBJECT]';
    }
    return value;
  }

  /**
   * Sanitize arbitrary values
   */
  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    return value;
  }

  /**
   * Sanitize context objects
   */
  private sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!context) return undefined;
    return this.sanitizeParameters(context);
  }

  /**
   * Check if field contains sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential', 'card', 'credit'];
    return sensitiveFields.some(sensitive => 
      fieldName.toLowerCase().includes(sensitive)
    );
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique correlation ID
   */
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update correlation ID for request tracing
   */
  public setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }
}