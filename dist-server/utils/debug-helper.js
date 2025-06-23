"use strict";
/**
 * Debug Helper Utilities
 *
 * Provides runtime control over logging configuration
 * Can be used from browser console for debugging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugHelper = exports.DebugHelper = void 0;
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
class DebugHelper {
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
        const exclude = [...(((_a = currentConfig.functions) === null || _a === void 0 ? void 0 : _a.exclude) || []), ...functionNames];
        this.updateAllLoggers({
            functions: {
                include: ((_b = currentConfig.functions) === null || _b === void 0 ? void 0 : _b.include) || ['.*'],
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
     * Reset configuration to defaults
     */
    reset() {
        this.updateAllLoggers(this.getDefaultConfig());
        console.log('🔄 Configuration reset to defaults');
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
        if (typeof window !== 'undefined') {
            // Ensure NODE_EDITOR_CONFIG exists
            if (!window.NODE_EDITOR_CONFIG) {
                window.NODE_EDITOR_CONFIG = {
                    GEMINI_API_KEY: ''
                };
            }
            // Now we know NODE_EDITOR_CONFIG exists, ensure DEBUG config exists with defaults
            const config = window.NODE_EDITOR_CONFIG;
            if (!config.DEBUG) {
                config.DEBUG = this.getDefaultConfig();
            }
            return config.DEBUG;
        }
        return this.getDefaultConfig();
    }
    updateAllLoggers(config) {
        this.loggers.forEach(logger => {
            logger.updateDebugConfig(config);
        });
        // Always update global config (create if needed)
        if (typeof window !== 'undefined') {
            const globalConfig = this.getCurrentConfig(); // This ensures it exists
            this.deepMergeConfig(globalConfig, config);
        }
    }
    deepMergeConfig(target, source) {
        // Handle enabled
        if (source.enabled !== undefined) {
            target.enabled = source.enabled;
        }
        // Handle levels
        if (source.levels) {
            Object.assign(target.levels, source.levels);
        }
        // Handle types
        if (source.types) {
            Object.assign(target.types, source.types);
        }
        // Handle services
        if (source.services) {
            Object.assign(target.services, source.services);
        }
        // Handle functions with proper array merging
        if (source.functions) {
            if (source.functions.include !== undefined) {
                target.functions.include = source.functions.include;
            }
            if (source.functions.exclude !== undefined) {
                target.functions.exclude = source.functions.exclude;
            }
        }
        // Handle performance
        if (source.performance) {
            Object.assign(target.performance, source.performance);
        }
        // Handle format
        if (source.format) {
            Object.assign(target.format, source.format);
        }
    }
    getDefaultConfig() {
        return {
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
                performance_metric: true,
                business_logic: true,
                error: true,
                warning: true,
                trace: false,
                debug: false
            },
            services: {},
            functions: {
                include: ['.*'],
                exclude: []
            },
            performance: {
                warnThreshold: 10,
                errorThreshold: 100
            },
            format: {
                pretty: true,
                includeTimestamp: true,
                includeMetadata: true,
                includeStackTrace: false,
                maxDepth: 3
            }
        };
    }
}
exports.DebugHelper = DebugHelper;
// Create and export global instance
exports.debugHelper = new DebugHelper();
// Expose to window for browser console access
if (typeof window !== 'undefined') {
    window.debug = exports.debugHelper;
}
