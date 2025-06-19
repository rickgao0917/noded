/**
 * Structured logging utility following comprehensive logging requirements
 * Provides trace, debug, info, warn, error, and fatal logging levels
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel["TRACE"] = "TRACE";
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["FATAL"] = "FATAL";
})(LogLevel || (LogLevel = {}));
export class Logger {
    constructor(serviceName) {
        this.debugConfig = null;
        this.serviceName = serviceName;
        this.sessionId = this.generateSessionId();
        this.correlationId = this.generateCorrelationId();
        this.loadDebugConfig();
        // Register with debug helper will be done separately to avoid dynamic import issues
    }
    loadDebugConfig() {
        var _a;
        if (typeof window !== 'undefined' && ((_a = window.NODE_EDITOR_CONFIG) === null || _a === void 0 ? void 0 : _a.DEBUG)) {
            this.debugConfig = window.NODE_EDITOR_CONFIG.DEBUG;
        }
    }
    /**
     * Update debug configuration at runtime
     * Useful for debugging specific issues without reloading
     */
    updateDebugConfig(config) {
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
            this.debugConfig.levels = Object.assign(Object.assign({}, this.debugConfig.levels), config.levels);
        }
        if (config.types) {
            this.debugConfig.types = Object.assign(Object.assign({}, this.debugConfig.types), config.types);
        }
        if (config.services) {
            this.debugConfig.services = Object.assign(Object.assign({}, this.debugConfig.services), config.services);
        }
        if (config.functions) {
            this.debugConfig.functions = Object.assign(Object.assign({}, this.debugConfig.functions), config.functions);
        }
        if (config.performance) {
            this.debugConfig.performance = Object.assign(Object.assign({}, this.debugConfig.performance), config.performance);
        }
        if (config.format) {
            this.debugConfig.format = Object.assign(Object.assign({}, this.debugConfig.format), config.format);
        }
        if (config.enabled !== undefined) {
            this.debugConfig.enabled = config.enabled;
        }
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
        var _a, _b, _c, _d;
        const warnThreshold = ((_b = (_a = this.debugConfig) === null || _a === void 0 ? void 0 : _a.performance) === null || _b === void 0 ? void 0 : _b.warnThreshold) || 10;
        const errorThreshold = ((_d = (_c = this.debugConfig) === null || _c === void 0 ? void 0 : _c.performance) === null || _d === void 0 ? void 0 : _d.errorThreshold) || 100;
        let level = LogLevel.DEBUG;
        if (duration > errorThreshold) {
            level = LogLevel.ERROR;
        }
        else if (duration > warnThreshold) {
            level = LogLevel.WARN;
        }
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
        this.log(LogLevel.INFO, message, Object.assign({ type: 'business_logic', functionName }, (metadata ? this.sanitizeContext(metadata) || {} : {})));
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
    /**
     * Log trace level messages for detailed execution flow
     */
    logTrace(message, functionName, metadata) {
        this.log(LogLevel.TRACE, message, Object.assign({ type: 'trace', functionName }, metadata));
    }
    /**
     * Log debug level messages for variable state information
     */
    logDebug(message, functionName, metadata) {
        this.log(LogLevel.DEBUG, message, Object.assign({ type: 'debug', functionName }, metadata));
    }
    log(level, message, metadata = {}) {
        // Check if logging is enabled
        if (!this.shouldLog(level, metadata)) {
            return;
        }
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
        // Format and output the log
        this.outputLog(logEntry);
    }
    shouldLog(level, metadata) {
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
        const logType = metadata.type;
        if (logType && this.debugConfig.types[logType] === false) {
            return false;
        }
        // Check service filter
        if (this.debugConfig.services[this.serviceName] === false) {
            return false;
        }
        // Check function filters
        const functionName = metadata.functionName;
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
    outputLog(logEntry) {
        var _a;
        try {
            const config = ((_a = this.debugConfig) === null || _a === void 0 ? void 0 : _a.format) || {
                pretty: true,
                includeTimestamp: true,
                includeMetadata: true,
                includeStackTrace: true,
                maxDepth: 3
            };
            // Filter log entry based on config
            const filteredEntry = {};
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
            }
            else {
                console.log(JSON.stringify(filteredEntry));
            }
        }
        catch (error) {
            // Handle JSON.stringify errors (e.g., circular references)
            const safeLogEntry = Object.assign(Object.assign({}, logEntry), { metadata: '[CIRCULAR_REFERENCE]' });
            console.log(JSON.stringify(safeLogEntry));
        }
    }
    truncateObject(obj, maxDepth, currentDepth = 0) {
        if (currentDepth >= maxDepth) {
            return '[TRUNCATED]';
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.truncateObject(item, maxDepth, currentDepth + 1));
        }
        if (obj !== null && typeof obj === 'object') {
            const truncated = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    truncated[key] = this.truncateObject(obj[key], maxDepth, currentDepth + 1);
                }
            }
            return truncated;
        }
        return obj;
    }
    /**
     * Sanitize parameters to remove sensitive data
     */
    sanitizeParameters(parameters) {
        const sanitized = {};
        for (const key in parameters) {
            if (Object.prototype.hasOwnProperty.call(parameters, key)) {
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
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'credential', 'card', 'credit'];
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
