/**
 * Debug configuration types
 */

export interface DebugConfig {
  enabled: boolean;
  levels: Record<string, boolean>;
  types: Record<string, boolean>;
  services: Record<string, boolean>;
  functions: {
    include: string[];
    exclude: string[];
  };
  performance: {
    warnThreshold: number;
    errorThreshold: number;
  };
  format: {
    pretty: boolean;
    includeTimestamp: boolean;
    includeMetadata: boolean;
    includeStackTrace: boolean;
    maxDepth: number;
  };
}

export interface PartialDebugConfig {
  enabled?: boolean;
  levels?: Record<string, boolean>;
  types?: Record<string, boolean>;
  services?: Record<string, boolean>;
  functions?: {
    include?: string[];
    exclude?: string[];
  };
  performance?: {
    warnThreshold?: number;
    errorThreshold?: number;
  };
  format?: {
    pretty?: boolean;
    includeTimestamp?: boolean;
    includeMetadata?: boolean;
    includeStackTrace?: boolean;
    maxDepth?: number;
  };
}

export interface NodeEditorConfig {
  GEMINI_API_KEY: string;
  DEBUG?: DebugConfig;
}

// Extend Window interface to include our global config
declare global {
  interface Window {
    NODE_EDITOR_CONFIG?: NodeEditorConfig;
    debug?: import('../utils/debug-helper.js').DebugHelper;
  }
}

export {};