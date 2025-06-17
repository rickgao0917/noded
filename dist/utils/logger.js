/**
 * Structured logging utility following comprehensive logging requirements
 * Provides trace, debug, info, warn, error, and fatal logging levels
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel["TRACE"] = "trace";
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
    LogLevel["FATAL"] = "fatal";
})(LogLevel || (LogLevel = {}));
export class Logger {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.sessionId = this.generateSessionId();
        this.correlationId = this.generateCorrelationId();
    }
    /**
     * Log function entry with parameters
     */
    logFunctionEntry(functionName, parameters = {}) {
        this.log(LogLevel.TRACE, `Function entry: ${functionName}`, {
            type: 'function_entry',
            functionName,
            parameters: this.sanitizeParameters(parameters)
        });
    }
    /**
     * Log function exit with return value and execution time
     */
    logFunctionExit(functionName, returnValue, executionTime) {
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
    logBranch(functionName, condition, result, metadata) {
        this.log(LogLevel.DEBUG, `Branch executed: ${condition} = ${result}`, Object.assign({ type: 'branch_execution', functionName,
            condition,
            result }, metadata));
    }
    /**
     * Log loop iterations
     */
    logLoop(functionName, loopType, iterationCount, metadata) {
        this.log(LogLevel.DEBUG, `Loop completed: ${loopType} (${iterationCount} iterations)`, Object.assign({ type: 'loop_execution', functionName,
            loopType,
            iterationCount }, metadata));
    }
    /**
     * Log variable assignments on critical paths
     */
    logVariableAssignment(functionName, variableName, value, metadata) {
        this.log(LogLevel.DEBUG, `Variable assignment: ${variableName}`, Object.assign({ type: 'variable_assignment', functionName,
            variableName, value: this.sanitizeValue(value) }, metadata));
    }
    /**
     * Log user interactions
     */
    logUserInteraction(action, elementId, metadata) {
        this.log(LogLevel.INFO, `User interaction: ${action}`, Object.assign({ type: 'user_interaction', action,
            elementId }, metadata));
    }
    /**
     * Log performance metrics
     */
    logPerformance(functionName, operation, duration, metadata) {
        const level = duration > 10 ? LogLevel.WARN : LogLevel.DEBUG;
        this.log(level, `Performance: ${operation} completed in ${duration}ms`, Object.assign({ type: 'performance_metric', functionName,
            operation,
            duration }, metadata));
    }
    /**
     * Log errors with comprehensive context
     */
    logError(error, functionName, context) {
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
    logInfo(message, functionName, metadata) {
        this.log(LogLevel.INFO, message, Object.assign({ type: 'business_logic', functionName }, metadata));
    }
    /**
     * Log warnings for recoverable issues
     */
    logWarn(message, functionName, metadata) {
        this.log(LogLevel.WARN, message, Object.assign({ type: 'warning', functionName }, metadata));
    }
    /**
     * Log fatal system events
     */
    logFatal(message, functionName, metadata) {
        this.log(LogLevel.FATAL, message, Object.assign({ type: 'fatal', functionName }, metadata));
    }
    log(level, message, metadata = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            service: this.serviceName,
            function: metadata.functionName || 'unknown',
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
    sanitizeParameters(parameters) {
        const sanitized = {};
        for (const key in parameters) {
            if (parameters.hasOwnProperty(key)) {
                const value = parameters[key];
                if (this.isSensitiveField(key)) {
                    sanitized[key] = '[REDACTED]';
                }
                else {
                    sanitized[key] = this.sanitizeValue(value);
                }
            }
        }
        return sanitized;
    }
    /**
     * Sanitize return values
     */
    sanitizeReturnValue(value) {
        if (typeof value === 'object' && value !== null) {
            return '[OBJECT]';
        }
        return value;
    }
    /**
     * Sanitize arbitrary values
     */
    sanitizeValue(value) {
        if (typeof value === 'string' && value.length > 100) {
            return value.substring(0, 100) + '...';
        }
        return value;
    }
    /**
     * Sanitize context objects
     */
    sanitizeContext(context) {
        if (!context)
            return undefined;
        return this.sanitizeParameters(context);
    }
    /**
     * Check if field contains sensitive data
     */
    isSensitiveField(fieldName) {
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential'];
        return sensitiveFields.some(sensitive => fieldName.toLowerCase().includes(sensitive));
    }
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Generate unique correlation ID
     */
    generateCorrelationId() {
        return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Update correlation ID for request tracing
     */
    setCorrelationId(correlationId) {
        this.correlationId = correlationId;
    }
}
