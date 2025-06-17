/**
 * File-based logging system with colored terminal output
 *
 * Writes structured logs to .log files and provides colored terminal output
 * for different interaction levels, filtering out cursor movements.
 */
// Conditional Node.js imports - only available in Node.js environment
let fs = null;
let path = null;
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
        fs = require('fs');
        path = require('path');
    }
    catch (e) {
        // Ignore import errors in browser
    }
}
export var LogLevel;
(function (LogLevel) {
    LogLevel["TRACE"] = "trace";
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
    LogLevel["FATAL"] = "fatal";
})(LogLevel || (LogLevel = {}));
export var InteractionLevel;
(function (InteractionLevel) {
    InteractionLevel["CURSOR_MOVE"] = "cursor_move";
    InteractionLevel["USER_INPUT"] = "user_input";
    InteractionLevel["NAVIGATION"] = "navigation";
    InteractionLevel["DATA_CHANGE"] = "data_change";
    InteractionLevel["ERROR_ACTION"] = "error_action";
    InteractionLevel["SYSTEM_EVENT"] = "system_event"; // Yellow
})(InteractionLevel || (InteractionLevel = {}));
/**
 * ANSI color codes for terminal output
 */
const Colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m'
};
/**
 * File-based logger with colored terminal output and interaction filtering
 */
export class FileLogger {
    constructor(serviceName, logDirectory = 'logs') {
        this.serviceName = serviceName;
        this.sessionId = this.generateSessionId();
        this.correlationId = this.generateCorrelationId();
        this.isNode = typeof process !== 'undefined' && !!process.versions && !!process.versions.node;
        // Create log file path with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFileName = `${serviceName.toLowerCase()}-${timestamp}.log`;
        this.logFilePath = this.isNode && path ? path.join(process.cwd(), logDirectory, logFileName) : '';
        if (this.isNode) {
            this.ensureLogDirectory(logDirectory);
            this.initializeLogFile();
        }
    }
    /**
     * Log function entry with parameters
     */
    logFunctionEntry(functionName, parameters = {}) {
        this.log(LogLevel.TRACE, `Function entry: ${functionName}`, {
            type: 'function_entry',
            functionName,
            parameters: this.sanitizeParameters(parameters),
            interactionLevel: InteractionLevel.SYSTEM_EVENT
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
            executionTime,
            interactionLevel: InteractionLevel.SYSTEM_EVENT
        });
    }
    /**
     * Log conditional branch execution
     */
    logBranch(functionName, condition, result, metadata) {
        this.log(LogLevel.DEBUG, `Branch executed: ${condition} = ${result}`, Object.assign({ type: 'branch_execution', functionName,
            condition,
            result, interactionLevel: InteractionLevel.SYSTEM_EVENT }, metadata));
    }
    /**
     * Log loop iterations
     */
    logLoop(functionName, loopType, iterationCount, metadata) {
        this.log(LogLevel.DEBUG, `Loop completed: ${loopType} (${iterationCount} iterations)`, Object.assign({ type: 'loop_execution', functionName,
            loopType,
            iterationCount, interactionLevel: InteractionLevel.SYSTEM_EVENT }, metadata));
    }
    /**
     * Log variable assignments on critical paths
     */
    logVariableAssignment(functionName, variableName, value, metadata) {
        this.log(LogLevel.DEBUG, `Variable assignment: ${variableName}`, Object.assign({ type: 'variable_assignment', functionName,
            variableName, value: this.sanitizeValue(value), interactionLevel: InteractionLevel.SYSTEM_EVENT }, metadata));
    }
    /**
     * Log user interactions with appropriate interaction level
     */
    logUserInteraction(action, elementId, metadata) {
        let interactionLevel = InteractionLevel.USER_INPUT;
        // Classify interaction level based on action
        if (action.includes('mouse') && action.includes('move')) {
            interactionLevel = InteractionLevel.CURSOR_MOVE;
        }
        else if (action.includes('click') || action.includes('key')) {
            interactionLevel = InteractionLevel.USER_INPUT;
        }
        else if (action.includes('navigate') || action.includes('scroll')) {
            interactionLevel = InteractionLevel.NAVIGATION;
        }
        else if (action.includes('edit') || action.includes('change')) {
            interactionLevel = InteractionLevel.DATA_CHANGE;
        }
        this.log(LogLevel.INFO, `User interaction: ${action}`, Object.assign({ type: 'user_interaction', action,
            elementId,
            interactionLevel }, metadata));
    }
    /**
     * Log performance metrics
     */
    logPerformance(functionName, operation, duration, metadata) {
        const level = duration > 10 ? LogLevel.WARN : LogLevel.DEBUG;
        this.log(level, `Performance: ${operation} completed in ${duration}ms`, Object.assign({ type: 'performance_metric', functionName,
            operation,
            duration, interactionLevel: InteractionLevel.SYSTEM_EVENT }, metadata));
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
            context: this.sanitizeContext(context),
            interactionLevel: InteractionLevel.ERROR_ACTION
        });
    }
    /**
     * Log business logic milestones
     */
    logInfo(message, functionName, metadata) {
        this.log(LogLevel.INFO, message, Object.assign({ type: 'business_logic', functionName, interactionLevel: InteractionLevel.DATA_CHANGE }, metadata));
    }
    /**
     * Log warnings for recoverable issues
     */
    logWarn(message, functionName, metadata) {
        this.log(LogLevel.WARN, message, Object.assign({ type: 'warning', functionName, interactionLevel: InteractionLevel.ERROR_ACTION }, metadata));
    }
    /**
     * Log fatal system events
     */
    logFatal(message, functionName, metadata) {
        this.log(LogLevel.FATAL, message, Object.assign({ type: 'fatal', functionName, interactionLevel: InteractionLevel.ERROR_ACTION }, metadata));
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
            metadata,
            interactionLevel: metadata.interactionLevel
        };
        // Write to log file (Node.js only)
        if (this.isNode) {
            this.writeToFile(logEntry);
        }
        // Output to terminal (filtered and colored)
        this.outputToTerminal(logEntry);
    }
    writeToFile(logEntry) {
        if (!this.isNode || !fs)
            return;
        try {
            const logLine = JSON.stringify(logEntry) + '\n';
            fs.appendFileSync(this.logFilePath, logLine, 'utf8');
        }
        catch (error) {
            // Fallback to console if file writing fails
            console.error('Failed to write to log file:', error);
            console.log(JSON.stringify(logEntry));
        }
    }
    outputToTerminal(logEntry) {
        // Filter out cursor movements from terminal output
        if (logEntry.interactionLevel === InteractionLevel.CURSOR_MOVE) {
            return;
        }
        const color = this.getColorForInteraction(logEntry.interactionLevel);
        const levelColor = this.getColorForLevel(logEntry.level);
        const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
        const terminalMessage = `${Colors.dim}${timestamp}${Colors.reset} ${levelColor}[${logEntry.level.toUpperCase()}]${Colors.reset} ${color}${logEntry.message}${Colors.reset}`;
        // Use appropriate console method based on log level
        switch (logEntry.level) {
            case LogLevel.ERROR:
            case LogLevel.FATAL:
                console.error(terminalMessage);
                break;
            case LogLevel.WARN:
                console.warn(terminalMessage);
                break;
            default:
                console.log(terminalMessage);
        }
    }
    getColorForInteraction(interactionLevel) {
        switch (interactionLevel) {
            case InteractionLevel.CURSOR_MOVE:
                return Colors.white;
            case InteractionLevel.USER_INPUT:
                return Colors.cyan;
            case InteractionLevel.NAVIGATION:
                return Colors.blue;
            case InteractionLevel.DATA_CHANGE:
                return Colors.green;
            case InteractionLevel.ERROR_ACTION:
                return Colors.red;
            case InteractionLevel.SYSTEM_EVENT:
                return Colors.yellow;
            default:
                return Colors.white;
        }
    }
    getColorForLevel(level) {
        switch (level) {
            case LogLevel.FATAL:
                return Colors.bgRed + Colors.white;
            case LogLevel.ERROR:
                return Colors.red;
            case LogLevel.WARN:
                return Colors.yellow;
            case LogLevel.INFO:
                return Colors.blue;
            case LogLevel.DEBUG:
                return Colors.magenta;
            case LogLevel.TRACE:
                return Colors.dim;
            default:
                return Colors.white;
        }
    }
    ensureLogDirectory(logDirectory) {
        if (!this.isNode || !fs || !path)
            return;
        const fullPath = path.join(process.cwd(), logDirectory);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    }
    initializeLogFile() {
        if (!this.isNode || !fs)
            return;
        const initMessage = {
            timestamp: new Date().toISOString(),
            level: LogLevel.INFO,
            service: this.serviceName,
            function: 'initializeLogFile',
            correlationId: this.correlationId,
            sessionId: this.sessionId,
            message: `Log session started for ${this.serviceName}`,
            metadata: { type: 'session_start' }
        };
        this.writeToFile(initMessage);
        console.log(`${Colors.green}Log file created: ${this.logFilePath}${Colors.reset}`);
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
    /**
     * Get current log file path
     */
    getLogFilePath() {
        return this.logFilePath;
    }
}
