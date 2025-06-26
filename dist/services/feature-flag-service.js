/**
 * Feature Flag Service
 *
 * Manages runtime feature flags for experimental functionality
 */
import { Logger } from '../utils/logger.js';
import { DEFAULT_FEATURE_FLAGS } from '../types/feature-flags.types.js';
export class FeatureFlagService {
    constructor() {
        this.logger = new Logger('FeatureFlagService');
        this.flags = Object.assign({}, DEFAULT_FEATURE_FLAGS);
        this.loadFeatureFlags();
    }
    static getInstance() {
        if (!FeatureFlagService.instance) {
            FeatureFlagService.instance = new FeatureFlagService();
        }
        return FeatureFlagService.instance;
    }
    /**
     * Load feature flags from configuration or localStorage
     */
    loadFeatureFlags() {
        this.logger.logFunctionEntry('loadFeatureFlags');
        try {
            // Check for configuration override
            const config = this.getConfigFromWindow();
            if (config === null || config === void 0 ? void 0 : config.enabled) {
                this.flags = Object.assign(Object.assign({}, DEFAULT_FEATURE_FLAGS), config.enabled);
                this.logger.info('Feature flags loaded from window config', { flags: this.flags });
                return;
            }
            // Check localStorage for user preferences
            const stored = localStorage.getItem('noded-feature-flags');
            if (stored) {
                const parsed = JSON.parse(stored);
                // Ensure all values are booleans and fall back to defaults for undefined
                const validatedFlags = {
                    userDiscovery: typeof parsed.userDiscovery === 'boolean' ? parsed.userDiscovery : DEFAULT_FEATURE_FLAGS.userDiscovery
                };
                this.flags = validatedFlags;
                this.logger.info('Feature flags loaded from localStorage', { flags: this.flags });
                return;
            }
            this.logger.info('Using default feature flags', { flags: this.flags });
        }
        catch (error) {
            this.logger.logError(error, 'loadFeatureFlags');
            this.flags = Object.assign({}, DEFAULT_FEATURE_FLAGS);
        }
        this.logger.logFunctionExit('loadFeatureFlags');
    }
    /**
     * Get feature flag configuration from window object
     */
    getConfigFromWindow() {
        var _a;
        if (typeof window !== 'undefined' && ((_a = window.NODE_EDITOR_CONFIG) === null || _a === void 0 ? void 0 : _a.FEATURE_FLAGS)) {
            return window.NODE_EDITOR_CONFIG.FEATURE_FLAGS;
        }
        return null;
    }
    /**
     * Check if a feature is enabled
     */
    isEnabled(feature) {
        this.logger.logFunctionEntry('isEnabled', { feature });
        const enabled = this.flags[feature] === true;
        this.logger.logFunctionExit('isEnabled', { enabled });
        return enabled;
    }
    /**
     * Toggle a feature flag
     */
    toggle(feature) {
        this.logger.logFunctionEntry('toggle', { feature, currentValue: this.flags[feature] });
        this.flags = Object.assign(Object.assign({}, this.flags), { [feature]: !this.flags[feature] });
        // Save to localStorage
        try {
            localStorage.setItem('noded-feature-flags', JSON.stringify(this.flags));
            this.logger.info('Feature flag toggled and saved', {
                feature,
                newValue: this.flags[feature],
                allFlags: this.flags
            });
        }
        catch (error) {
            this.logger.logError(error, 'toggle.saveToStorage');
        }
        this.logger.logFunctionExit('toggle');
    }
    /**
     * Set a specific feature flag value
     */
    setFlag(feature, enabled) {
        this.logger.logFunctionEntry('setFlag', { feature, enabled });
        this.flags = Object.assign(Object.assign({}, this.flags), { [feature]: enabled });
        // Save to localStorage
        try {
            localStorage.setItem('noded-feature-flags', JSON.stringify(this.flags));
            this.logger.info('Feature flag set and saved', {
                feature,
                enabled,
                allFlags: this.flags
            });
        }
        catch (error) {
            this.logger.logError(error, 'setFlag.saveToStorage');
        }
        this.logger.logFunctionExit('setFlag');
    }
    /**
     * Get all current feature flags
     */
    getAllFlags() {
        return Object.assign({}, this.flags);
    }
    /**
     * Reset all flags to defaults
     */
    resetToDefaults() {
        this.logger.logFunctionEntry('resetToDefaults');
        this.flags = Object.assign({}, DEFAULT_FEATURE_FLAGS);
        try {
            localStorage.removeItem('noded-feature-flags');
            this.logger.info('Feature flags reset to defaults');
        }
        catch (error) {
            this.logger.logError(error, 'resetToDefaults.removeStorage');
        }
        this.logger.logFunctionExit('resetToDefaults');
    }
}
