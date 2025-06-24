/**
 * Simple logger for server-side Node.js environment
 */
export class Logger {
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
  }

  public logFunctionEntry(functionName: string, parameters?: Record<string, any>): void {
    console.log(`[${this.context}] ${functionName} - Entry`, parameters);
  }

  public logFunctionExit(functionName: string, returnValue?: any, executionTime?: number): void {
    const message = `[${this.context}] ${functionName} - Exit`;
    if (executionTime !== undefined) {
      console.log(`${message} (${executionTime.toFixed(2)}ms)`, returnValue);
    } else {
      console.log(message, returnValue);
    }
  }

  public logError(error: Error, functionName?: string, additionalContext?: Record<string, any>): void {
    console.error(`[${this.context}] Error in ${functionName || 'unknown'}:`, error.message, additionalContext);
  }

  public info(message: string, additionalContext?: Record<string, any>): void {
    console.log(`[${this.context}] INFO: ${message}`, additionalContext || '');
  }

  public warn(message: string, additionalContext?: Record<string, any>): void {
    console.warn(`[${this.context}] WARN: ${message}`, additionalContext || '');
  }

  public debug(message: string, additionalContext?: Record<string, any>): void {
    console.log(`[${this.context}] DEBUG: ${message}`, additionalContext || '');
  }

  public logBranch(functionName: string, branchName: string, condition: boolean, additionalContext?: Record<string, any>): void {
    console.log(`[${this.context}] ${functionName} - Branch: ${branchName} = ${condition}`, additionalContext || '');
  }

  public logVariableAssignment(functionName: string, variableName: string, value: any): void {
    console.log(`[${this.context}] ${functionName} - Variable: ${variableName} =`, value);
  }

  public logInfo(message: string, functionName: string, additionalContext?: Record<string, any>): void {
    console.log(`[${this.context}] ${functionName} - INFO: ${message}`, additionalContext || '');
  }

  public logWarn(message: string, functionName: string, additionalContext?: Record<string, any>): void {
    console.warn(`[${this.context}] ${functionName} - WARN: ${message}`, additionalContext || '');
  }

  public logPerformance(functionName: string, operationName: string, executionTime: number): void {
    console.log(`[${this.context}] ${functionName} - Performance: ${operationName} took ${executionTime.toFixed(2)}ms`);
  }

  public logFatal(message: string, functionName: string, additionalContext?: Record<string, any>): void {
    console.error(`[${this.context}] ${functionName} - FATAL: ${message}`, additionalContext || '');
  }

  public generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public logBusinessLogic(message: string, additionalContext?: Record<string, any>, correlationId?: string): void {
    console.log(`[${this.context}] Business Logic: ${message}`, { ...additionalContext, correlationId });
  }
}