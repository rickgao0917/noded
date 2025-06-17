/**
 * Logger factory that creates appropriate logger based on environment
 *
 * Creates FileLogger for Node.js environments and falls back to original Logger for browsers
 */
import { Logger } from './logger.js';
import { FileLogger } from './file-logger.js';
/**
 * Create appropriate logger based on runtime environment
 *
 * @param serviceName - Name of the service/component using the logger
 * @param logDirectory - Directory for log files (Node.js only)
 * @returns Logger instance appropriate for the current environment
 *
 * @public
 */
export function createLogger(serviceName, logDirectory = 'logs') {
    const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
    if (isNode) {
        // Node.js environment - use file-based logger
        return new FileLogger(serviceName, logDirectory);
    }
    else {
        // Browser environment - use console-based logger
        return new Logger(serviceName);
    }
}
/**
 * Export FileLogger for direct use when Node.js environment is guaranteed
 */
export { FileLogger } from './file-logger.js';
/**
 * Export original Logger for backward compatibility
 */
export { Logger } from './logger.js';
