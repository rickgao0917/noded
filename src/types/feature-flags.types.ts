/**
 * Feature flag system types for toggling experimental features
 */

export interface FeatureFlags {
  readonly userDiscovery: boolean;
  readonly [key: string]: boolean;
}

export interface FeatureFlagConfig {
  readonly enabled: FeatureFlags;
  readonly overrides?: Partial<FeatureFlags>;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  userDiscovery: false
} as const;