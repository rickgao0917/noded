/**
 * Feature Flag Service
 * 
 * Manages runtime feature flags for experimental functionality
 */

import { Logger } from '../utils/logger.js';
import type { FeatureFlags, FeatureFlagConfig } from '../types/feature-flags.types.js';
import { DEFAULT_FEATURE_FLAGS } from '../types/feature-flags.types.js';

export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private readonly logger = new Logger('FeatureFlagService');
  private flags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

  private constructor() {
    this.loadFeatureFlags();
  }

  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  /**
   * Load feature flags from configuration or localStorage
   */
  private loadFeatureFlags(): void {
    this.logger.logFunctionEntry('loadFeatureFlags');

    try {
      // Check for configuration override
      const config = this.getConfigFromWindow();
      if (config?.enabled) {
        this.flags = { ...DEFAULT_FEATURE_FLAGS, ...config.enabled };
        this.logger.info('Feature flags loaded from window config', { flags: this.flags });
        return;
      }

      // Check localStorage for user preferences
      const stored = localStorage.getItem('noded-feature-flags');
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<FeatureFlags>;
        // Ensure all values are booleans and fall back to defaults for undefined
        const validatedFlags: FeatureFlags = {
          userDiscovery: typeof parsed.userDiscovery === 'boolean' ? parsed.userDiscovery : DEFAULT_FEATURE_FLAGS.userDiscovery
        };
        this.flags = validatedFlags;
        this.logger.info('Feature flags loaded from localStorage', { flags: this.flags });
        return;
      }

      this.logger.info('Using default feature flags', { flags: this.flags });
    } catch (error) {
      this.logger.logError(error as Error, 'loadFeatureFlags');
      this.flags = { ...DEFAULT_FEATURE_FLAGS };
    }

    this.logger.logFunctionExit('loadFeatureFlags');
  }

  /**
   * Get feature flag configuration from window object
   */
  private getConfigFromWindow(): FeatureFlagConfig | null {
    if (typeof window !== 'undefined' && (window as any).NODE_EDITOR_CONFIG?.FEATURE_FLAGS) {
      return (window as any).NODE_EDITOR_CONFIG.FEATURE_FLAGS as FeatureFlagConfig;
    }
    return null;
  }

  /**
   * Check if a feature is enabled
   */
  public isEnabled(feature: keyof FeatureFlags): boolean {
    this.logger.logFunctionEntry('isEnabled', { feature });
    
    const enabled = this.flags[feature] === true;
    
    this.logger.logFunctionExit('isEnabled', { enabled });
    return enabled;
  }

  /**
   * Toggle a feature flag
   */
  public toggle(feature: keyof FeatureFlags): void {
    this.logger.logFunctionEntry('toggle', { feature, currentValue: this.flags[feature] });

    this.flags = {
      ...this.flags,
      [feature]: !this.flags[feature]
    };

    // Save to localStorage
    try {
      localStorage.setItem('noded-feature-flags', JSON.stringify(this.flags));
      this.logger.info('Feature flag toggled and saved', { 
        feature, 
        newValue: this.flags[feature],
        allFlags: this.flags 
      });
    } catch (error) {
      this.logger.logError(error as Error, 'toggle.saveToStorage');
    }

    this.logger.logFunctionExit('toggle');
  }

  /**
   * Set a specific feature flag value
   */
  public setFlag(feature: keyof FeatureFlags, enabled: boolean): void {
    this.logger.logFunctionEntry('setFlag', { feature, enabled });

    this.flags = {
      ...this.flags,
      [feature]: enabled
    };

    // Save to localStorage
    try {
      localStorage.setItem('noded-feature-flags', JSON.stringify(this.flags));
      this.logger.info('Feature flag set and saved', { 
        feature, 
        enabled,
        allFlags: this.flags 
      });
    } catch (error) {
      this.logger.logError(error as Error, 'setFlag.saveToStorage');
    }

    this.logger.logFunctionExit('setFlag');
  }

  /**
   * Get all current feature flags
   */
  public getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Reset all flags to defaults
   */
  public resetToDefaults(): void {
    this.logger.logFunctionEntry('resetToDefaults');

    this.flags = { ...DEFAULT_FEATURE_FLAGS };

    try {
      localStorage.removeItem('noded-feature-flags');
      this.logger.info('Feature flags reset to defaults');
    } catch (error) {
      this.logger.logError(error as Error, 'resetToDefaults.removeStorage');
    }

    this.logger.logFunctionExit('resetToDefaults');
  }
}