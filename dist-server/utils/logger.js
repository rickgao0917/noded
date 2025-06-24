"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
/**
 * Simple logger for server-side Node.js environment
 */
class Logger {
    constructor(context) {
        this.context = context;
    }
    logFunctionEntry(functionName, parameters) {
        console.log(`[${this.context}] ${functionName} - Entry`, parameters);
    }
    logFunctionExit(functionName, returnValue, executionTime) {
        const message = `[${this.context}] ${functionName} - Exit`;
        if (executionTime !== undefined) {
            console.log(`${message} (${executionTime.toFixed(2)}ms)`, returnValue);
        }
        else {
            console.log(message, returnValue);
        }
    }
    logError(error, functionName, additionalContext) {
        console.error(`[${this.context}] Error in ${functionName || 'unknown'}:`, error.message, additionalContext);
    }
    info(message, additionalContext) {
        console.log(`[${this.context}] INFO: ${message}`, additionalContext || '');
    }
    warn(message, additionalContext) {
        console.warn(`[${this.context}] WARN: ${message}`, additionalContext || '');
    }
    debug(message, additionalContext) {
        console.log(`[${this.context}] DEBUG: ${message}`, additionalContext || '');
    }
    logBranch(functionName, branchName, condition, additionalContext) {
        console.log(`[${this.context}] ${functionName} - Branch: ${branchName} = ${condition}`, additionalContext || '');
    }
    logVariableAssignment(functionName, variableName, value) {
        console.log(`[${this.context}] ${functionName} - Variable: ${variableName} =`, value);
    }
    logInfo(message, functionName, additionalContext) {
        console.log(`[${this.context}] ${functionName} - INFO: ${message}`, additionalContext || '');
    }
    logWarn(message, functionName, additionalContext) {
        console.warn(`[${this.context}] ${functionName} - WARN: ${message}`, additionalContext || '');
    }
    logPerformance(functionName, operationName, executionTime) {
        console.log(`[${this.context}] ${functionName} - Performance: ${operationName} took ${executionTime.toFixed(2)}ms`);
    }
    logFatal(message, functionName, additionalContext) {
        console.error(`[${this.context}] ${functionName} - FATAL: ${message}`, additionalContext || '');
    }
    generateCorrelationId() {
        return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    logBusinessLogic(message, additionalContext, correlationId) {
        console.log(`[${this.context}] Business Logic: ${message}`, Object.assign(Object.assign({}, additionalContext), { correlationId }));
    }
}
exports.Logger = Logger;
