/**
 * Structured logging utility following comprehensive logging requirements
 * Provides trace, debug, info, warn, error, and fatal logging levels
 */

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

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.sessionId = this.generateSessionId();
    this.correlationId = this.generateCorrelationId();
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
    const level = duration > 10 ? LogLevel.WARN : LogLevel.DEBUG;
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
      ...(metadata || {})
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

    // Output structured JSON log
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Sanitize parameters to remove sensitive data
   */
  private sanitizeParameters(parameters: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const key in parameters) {
      if (parameters.hasOwnProperty(key)) {
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
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential'];
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