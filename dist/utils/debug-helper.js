/**
 * Debug Helper Utilities
 *
 * Provides runtime control over logging configuration
 * Can be used from browser console for debugging
 */
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
    constructor() {
        this.loggers = new Map();
    }
    /**
     * Register a logger instance
     */
    registerLogger(serviceName, logger) {
        this.loggers.set(serviceName, logger);
    }
    /**
     * Enable all logging
     */
    enable() {
        this.updateAllLoggers({ enabled: true });
        console.log('🟢 Logging enabled');
    }
    /**
     * Disable all logging
     */
    disable() {
        this.updateAllLoggers({ enabled: false });
        console.log('🔴 Logging disabled');
    }
    /**
     * Show only logs from specific function(s)
     */
    showOnly(...functionNames) {
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
    hideFunction(...functionNames) {
        var _a, _b;
        const currentConfig = this.getCurrentConfig();
        const exclude = [...(((_a = currentConfig === null || currentConfig === void 0 ? void 0 : currentConfig.functions) === null || _a === void 0 ? void 0 : _a.exclude) || []), ...functionNames];
        this.updateAllLoggers({
            functions: {
                include: ((_b = currentConfig === null || currentConfig === void 0 ? void 0 : currentConfig.functions) === null || _b === void 0 ? void 0 : _b.include) || ['.*'],
                exclude
            }
        });
        console.log(`🚫 Hiding: ${functionNames.join(', ')}`);
    }
    /**
     * Set log level visibility
     */
    setLevel(level, enabled) {
        this.updateAllLoggers({
            levels: { [level]: enabled }
        });
        console.log(`📊 ${level} level ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
     * Set log type visibility
     */
    setType(type, enabled) {
        this.updateAllLoggers({
            types: { [type]: enabled }
        });
        console.log(`📝 ${type} type ${enabled ? 'enabled' : 'disabled'}`);
    }
    /**
     * Show only specific service(s)
     */
    showService(...serviceNames) {
        const services = {};
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
    verbose() {
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
    minimal() {
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
    performanceOnly() {
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
    showConfig() {
        const config = this.getCurrentConfig();
        console.log('📋 Current debug configuration:', config);
    }
    /**
     * Show available commands
     */
    help() {
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
    getCurrentConfig() {
        var _a;
        if (typeof window !== 'undefined') {
            return (_a = window.NODE_EDITOR_CONFIG) === null || _a === void 0 ? void 0 : _a.DEBUG;
        }
        return null;
    }
    updateAllLoggers(config) {
        var _a;
        this.loggers.forEach(logger => {
            logger.updateDebugConfig(config);
        });
        // Also update global config if it exists
        if (typeof window !== 'undefined' && ((_a = window.NODE_EDITOR_CONFIG) === null || _a === void 0 ? void 0 : _a.DEBUG)) {
            const globalConfig = window.NODE_EDITOR_CONFIG.DEBUG;
            Object.assign(globalConfig, config);
        }
    }
}
// Create and export global instance
export const debugHelper = new DebugHelper();
// Expose to window for browser console access
if (typeof window !== 'undefined') {
    window.debug = debugHelper;
}
