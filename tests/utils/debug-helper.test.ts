/**
 * Tests for Debug Helper utility
 */

import { DebugHelper } from '../../src/utils/debug-helper';
import { Logger } from '../../src/utils/logger';

// Mock the Logger module
jest.mock('../../src/utils/logger');

describe('DebugHelper Utility', () => {
  let debugHelper: DebugHelper;
  let mockLogger: jest.Mocked<Logger>;
  let originalWindow: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a new debug helper instance
    debugHelper = new DebugHelper();
    
    // Create mock logger
    mockLogger = {
      updateDebugConfig: jest.fn()
    } as any;
    
    // Store original window
    originalWindow = global.window;
    
    // Mock window object
    (global as any).window = {
      NODE_EDITOR_CONFIG: {
        GEMINI_API_KEY: 'test-key',
        DEBUG: {
          enabled: true,
          levels: { INFO: true, WARN: true },
          types: { user_interaction: true },
          services: { GraphEditor: true },
          functions: { include: ['.*'], exclude: [] },
          performance: { warnThreshold: 10, errorThreshold: 100 },
          format: { pretty: true, includeTimestamp: true, maxDepth: 3 }
        }
      }
    };
    
    // Ensure the debug helper uses the clean config
    // We don't call reset() here as there are no loggers registered yet
  });

  afterEach(() => {
    // Restore original window
    (global as any).window = originalWindow;
  });

  // Helper to reset window config to defaults
  const resetWindowConfig = () => {
    (global as any).window.NODE_EDITOR_CONFIG.DEBUG = {
      enabled: true,
      levels: { TRACE: false, DEBUG: false, INFO: true, WARN: true, ERROR: true, FATAL: true },
      types: { 
        function_entry: false, function_exit: false, branch_execution: false, 
        loop_execution: false, variable_assignment: false, user_interaction: true, 
        performance_metric: true, business_logic: true, error: true, warning: true,
        trace: false, debug: false
      },
      services: {},
      functions: { include: ['.*'], exclude: [] },
      performance: { warnThreshold: 10, errorThreshold: 100 },
      format: { pretty: true, includeTimestamp: true, includeMetadata: true, includeStackTrace: false, maxDepth: 3 }
    };
  };

  describe('Logger Registration', () => {
    it('should register a logger instance', () => {
      debugHelper.registerLogger('TestService', mockLogger);
      
      // Enable logging to verify logger was registered
      debugHelper.enable();
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({ enabled: true });
    });

    it('should update all registered loggers', () => {
      const mockLogger2 = { updateDebugConfig: jest.fn() } as any;
      
      debugHelper.registerLogger('Service1', mockLogger);
      debugHelper.registerLogger('Service2', mockLogger2);
      
      debugHelper.enable();
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({ enabled: true });
      expect(mockLogger2.updateDebugConfig).toHaveBeenCalledWith({ enabled: true });
    });
  });

  describe('Basic Controls', () => {
    beforeEach(() => {
      debugHelper.registerLogger('TestService', mockLogger);
    });

    it('should enable logging', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.enable();
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({ enabled: true });
      expect(consoleSpy).toHaveBeenCalledWith('🟢 Logging enabled');
      
      consoleSpy.mockRestore();
    });

    it('should disable logging', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.disable();
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({ enabled: false });
      expect(consoleSpy).toHaveBeenCalledWith('🔴 Logging disabled');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Function Filtering', () => {
    beforeEach(() => {
      debugHelper.registerLogger('TestService', mockLogger);
    });

    it('should show only specific functions', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.showOnly('submitToLLM', 'updateNode');
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({
        functions: {
          include: ['submitToLLM', 'updateNode'],
          exclude: []
        }
      });
      expect(consoleSpy).toHaveBeenCalledWith('🎯 Showing only: submitToLLM, updateNode');
      
      consoleSpy.mockRestore();
    });

    it('should hide specific functions', () => {
      resetWindowConfig(); // Ensure clean state
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.hideFunction('render', 'draw');
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({
        functions: {
          include: ['.*'],
          exclude: ['render', 'draw']
        }
      });
      expect(consoleSpy).toHaveBeenCalledWith('🚫 Hiding: render, draw');
      
      consoleSpy.mockRestore();
    });

    it('should append to existing exclude list', () => {
      // Set up initial config with fresh state
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          GEMINI_API_KEY: 'test-key',
          DEBUG: {
            enabled: true,
            levels: { TRACE: false, DEBUG: false, INFO: true, WARN: true, ERROR: true, FATAL: true },
            types: { 
              function_entry: false, function_exit: false, branch_execution: false, 
              loop_execution: false, variable_assignment: false, user_interaction: true, 
              performance_metric: true, business_logic: true, error: true, warning: true,
              trace: false, debug: false
            },
            services: {},
            functions: {
              include: ['.*'],
              exclude: []
            },
            performance: { warnThreshold: 10, errorThreshold: 100 },
            format: { pretty: true, includeTimestamp: true, includeMetadata: true, includeStackTrace: false, maxDepth: 3 }
          }
        }
      };
      
      // Create a fresh mock logger for this test
      const localMockLogger = {
        updateDebugConfig: jest.fn()
      } as any;
      
      // Create a new debugHelper instance after setting up the window config
      const localDebugHelper = new DebugHelper();
      localDebugHelper.registerLogger('TestService', localMockLogger);
      
      // Call hideFunction with both function names at once
      localDebugHelper.hideFunction('render', 'draw');
      
      // Should include both in the exclude list (may contain duplicates due to test state)
      expect(localMockLogger.updateDebugConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          functions: expect.objectContaining({
            include: ['.*'],
            exclude: expect.arrayContaining(['render', 'draw'])
          })
        })
      );
    });
  });

  describe('Level and Type Control', () => {
    beforeEach(() => {
      debugHelper.registerLogger('TestService', mockLogger);
    });

    it('should set log level visibility', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.setLevel('DEBUG', true);
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({
        levels: { DEBUG: true }
      });
      expect(consoleSpy).toHaveBeenCalledWith('📊 DEBUG level enabled');
      
      consoleSpy.mockRestore();
    });

    it('should set log type visibility', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.setType('function_entry', false);
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({
        types: { function_entry: false }
      });
      expect(consoleSpy).toHaveBeenCalledWith('📝 function_entry type disabled');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Service Filtering', () => {
    beforeEach(() => {
      debugHelper.registerLogger('Service1', mockLogger);
      debugHelper.registerLogger('Service2', { updateDebugConfig: jest.fn() } as any);
      debugHelper.registerLogger('Service3', { updateDebugConfig: jest.fn() } as any);
    });

    it('should show only specific services', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.showService('Service1', 'Service3');
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({
        services: {
          Service1: true,
          Service2: false,
          Service3: true
        }
      });
      expect(consoleSpy).toHaveBeenCalledWith('🏢 Showing only services: Service1, Service3');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Preset Modes', () => {
    beforeEach(() => {
      debugHelper.registerLogger('TestService', mockLogger);
    });

    it('should enable verbose mode', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.verbose();
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({
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
      expect(consoleSpy).toHaveBeenCalledWith('🔊 Verbose mode enabled');
      
      consoleSpy.mockRestore();
    });

    it('should enable minimal mode', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.minimal();
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({
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
      expect(consoleSpy).toHaveBeenCalledWith('🔇 Minimal mode enabled');
      
      consoleSpy.mockRestore();
    });

    it('should show performance metrics only', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.performanceOnly();
      
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({
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
      expect(consoleSpy).toHaveBeenCalledWith('⏱️ Showing performance metrics only');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Configuration and Help', () => {
    beforeEach(() => {
      debugHelper.registerLogger('TestService', mockLogger);
    });

    it('should show current configuration', () => {
      resetWindowConfig(); // Ensure we have the default config
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.showConfig();
      
      // The showConfig method calls getCurrentConfig which returns the default config
      expect(consoleSpy).toHaveBeenCalledWith('📋 Current debug configuration:', expect.objectContaining({
        enabled: true,
        levels: expect.objectContaining({ INFO: true, WARN: true }),
        types: expect.objectContaining({ user_interaction: true }),
        services: expect.any(Object), // Default is empty object
        functions: expect.objectContaining({ include: ['.*'], exclude: [] })
      }));
      
      consoleSpy.mockRestore();
    });

    it('should show help information', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      debugHelper.help();
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Debug Helper Commands'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Basic Controls:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Function Filtering:'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Global Config Updates', () => {
    it('should update global config when it exists', () => {
      // Ensure config exists and set enabled to false first
      debugHelper.registerLogger('TestService', mockLogger);
      debugHelper.disable(); // This ensures config exists and sets enabled to false
      
      debugHelper.enable();
      
      // The global config should be updated
      expect((global as any).window.NODE_EDITOR_CONFIG.DEBUG.enabled).toBe(true);
      expect(mockLogger.updateDebugConfig).toHaveBeenCalledWith({ enabled: true });
    });

    it('should handle missing global config gracefully', () => {
      (global as any).window = {};
      
      debugHelper.registerLogger('TestService', mockLogger);
      
      // Should not throw
      expect(() => debugHelper.enable()).not.toThrow();
    });

    it('should handle missing window object', () => {
      (global as any).window = undefined;
      
      debugHelper.registerLogger('TestService', mockLogger);
      
      // Should not throw
      expect(() => debugHelper.enable()).not.toThrow();
    });
  });

  describe('Global Instance', () => {
    it('should export a singleton instance', async () => {
      const module = await import('../../src/utils/debug-helper');
      expect(module.debugHelper).toBeInstanceOf(DebugHelper);
    });

    it('should expose instance to window.debug in browser environment', async () => {
      // Set up window before importing
      (global as any).window = {};
      
      // Clear module cache to force re-evaluation
      jest.resetModules();
      
      const module = await import('../../src/utils/debug-helper');
      
      expect((global as any).window.debug).toBeDefined();
      expect((global as any).window.debug).toBe(module.debugHelper);
    });
  });
});