/**
 * Additional tests for Logger utility to improve coverage
 */

import { Logger, LogLevel } from '../../src/utils/logger';
import { parseLoggerOutput } from './logger-test-helper';

describe('Logger Additional Coverage', () => {
  let logger: Logger;
  let consoleSpy: jest.SpyInstance;
  let originalWindow: any;

  beforeEach(() => {
    logger = new Logger('TestService');
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Store original window
    originalWindow = global.window;
    
    // Mock window with config
    (global as any).window = {
      NODE_EDITOR_CONFIG: {
        DEBUG: {
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
          },
          services: { TestService: true },
          functions: { include: ['.*'], exclude: [] },
          performance: { warnThreshold: 10, errorThreshold: 100 },
          format: { 
            pretty: true, 
            includeTimestamp: true, 
            includeMetadata: true,
            includeStackTrace: true,
            maxDepth: 3 
          }
        }
      }
    };
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    (global as any).window = originalWindow;
  });

  describe('Logging Methods', () => {
    it('should log trace messages', () => {
      logger.logTrace('Trace message', 'testFunction', { data: 'value' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TRACE')
      );
    });

    it('should log debug messages', () => {
      logger.logDebug('Debug message', 'testFunction', { data: 'value' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG')
      );
    });

    it('should log branch execution', () => {
      logger.logBranch('testFunction', 'condition', true, { extra: 'data' });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.message).toBe('Branch executed: condition = true');
      expect(logData.level).toBe('DEBUG');
    });

    it('should log loop execution', () => {
      logger.logLoop('testFunction', 'processing', 5);
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.message).toBe('Loop completed: processing (5 iterations)');
      expect(logData.level).toBe('DEBUG');
    });

    it('should log variable assignment', () => {
      logger.logVariableAssignment('testFunction', 'myVar', 'value');
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.message).toBe('Variable assignment: myVar');
      expect(logData.level).toBe('DEBUG');
    });

    it('should log user interaction', () => {
      logger.logUserInteraction('click', 'button-1', { x: 100, y: 200 });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.message).toBe('User interaction: click');
      expect(logData.level).toBe('INFO');
    });

    it('should log info messages as business logic', () => {
      logger.logInfo('Processing payment', 'processPayment', { amount: 100 });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing payment')
      );
    });
  });

  describe('Configuration Handling', () => {
    it('should handle missing debug config', () => {
      // Save current window and set to undefined
      const savedWindow = (global as any).window;
      (global as any).window = undefined;
      
      // Create new logger without window
      const loggerWithoutConfig = new Logger('TestService');
      
      // Clear existing spy and create new one
      consoleSpy.mockRestore();
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Should still log without config
      loggerWithoutConfig.logInfo('Test message', 'testFunction');
      expect(consoleSpy).toHaveBeenCalled();
      
      // Restore window
      (global as any).window = savedWindow;
    });

    it('should respect disabled logging', () => {
      // Clear console spy before test
      consoleSpy.mockRestore();
      
      // Set up window with disabled logging
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          DEBUG: {
            enabled: false
          }
        }
      };
      
      // Create new logger with disabled config
      const disabledLogger = new Logger('TestService');
      
      // Create new spy after logger creation
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      disabledLogger.logInfo('Should not log', 'testFunction');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should respect level filtering', () => {
      // Clear console spy before test
      consoleSpy.mockRestore();
      
      // Set up window with INFO disabled
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          DEBUG: {
            enabled: true,
            levels: { 
              INFO: false,
              WARN: true,
              ERROR: true,
              FATAL: true
            }
          }
        }
      };
      
      // Create new logger with filtered config
      const filteredLogger = new Logger('TestService');
      
      // Create new spy after logger creation
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      filteredLogger.logInfo('Should not log', 'testFunction');
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // But WARN should still log
      filteredLogger.logWarn('Should log', 'testFunction');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should respect type filtering', () => {
      // Clear console spy before test
      consoleSpy.mockRestore();
      
      // Set up window with user_interaction disabled
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          DEBUG: {
            enabled: true,
            types: { 
              user_interaction: false,
              business_logic: true
            }
          }
        }
      };
      
      // Create new logger with filtered config
      const typeFilteredLogger = new Logger('TestService');
      
      // Create new spy after logger creation
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      typeFilteredLogger.logUserInteraction('click', 'button', {});
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // But business logic should still log
      typeFilteredLogger.logInfo('Should log', 'testFunction');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should respect service filtering', () => {
      // Clear console spy before test
      consoleSpy.mockRestore();
      
      // Set up window with TestService disabled
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          DEBUG: {
            enabled: true,
            services: { 
              TestService: false,
              OtherService: true
            }
          }
        }
      };
      
      // Create new logger with filtered config
      const serviceFilteredLogger = new Logger('TestService');
      
      // Create new spy after logger creation
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      serviceFilteredLogger.logInfo('Should not log', 'testFunction');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should respect function exclude patterns', () => {
      // Clear console spy before test
      consoleSpy.mockRestore();
      
      // Set up window with testFunction excluded
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          DEBUG: {
            enabled: true,
            functions: {
              include: ['.*'],
              exclude: ['testFunction']
            }
          }
        }
      };
      
      // Create new logger with filtered config
      const functionFilteredLogger = new Logger('TestService');
      
      // Create new spy after logger creation
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      functionFilteredLogger.logFunctionEntry('testFunction', {});
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // But other functions should log
      functionFilteredLogger.logFunctionEntry('otherFunction', {});
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should respect function include patterns', () => {
      // Clear console spy before test
      consoleSpy.mockRestore();
      
      // Set up window with only allowedFunction included
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          DEBUG: {
            enabled: true,
            functions: {
              include: ['allowedFunction'],
              exclude: []
            }
          }
        }
      };
      
      // Create new logger with filtered config
      const functionIncludeLogger = new Logger('TestService');
      
      // Create new spy after logger creation
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      functionIncludeLogger.logFunctionEntry('testFunction', {});
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // But allowedFunction should log
      consoleSpy.mockClear();
      functionIncludeLogger.logFunctionEntry('allowedFunction', {});
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Output Formatting', () => {
    it('should handle non-pretty printing', () => {
      // Clear console spy before test
      consoleSpy.mockRestore();
      
      // Set up window with pretty printing disabled
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          DEBUG: {
            enabled: true,
            format: {
              pretty: false
            }
          }
        }
      };
      
      // Create new logger with non-pretty config
      const nonPrettyLogger = new Logger('TestService');
      
      // Create new spy after logger creation
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      nonPrettyLogger.logInfo('Test message', 'testFunction');
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      // Non-pretty format should be compact JSON without newlines
      expect(logCall).toContain('"message":"Test message"');
      expect(logCall).not.toContain('\n');
    });

    it('should exclude metadata when configured', () => {
      // Clear console spy before test
      consoleSpy.mockRestore();
      
      // Set up window with metadata disabled
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          DEBUG: {
            enabled: true,
            format: {
              includeMetadata: false,
              pretty: true
            }
          }
        }
      };
      
      // Create new logger with no metadata config
      const noMetadataLogger = new Logger('TestService');
      
      // Create new spy after logger creation
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      noMetadataLogger.logInfo('Test message', 'testFunction', { extra: 'data' });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.params).toBeUndefined();
      expect(logData.metadata).toBeUndefined();
    });

    it('should exclude stack trace when configured', () => {
      // Clear console spy before test
      consoleSpy.mockRestore();
      
      // Set up window with stack trace disabled
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          DEBUG: {
            enabled: true,
            format: {
              includeStackTrace: false,
              pretty: true
            }
          }
        }
      };
      
      // Create new logger with no stack trace config
      const noStackLogger = new Logger('TestService');
      
      // Create new spy after logger creation
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const error = new Error('Test error');
      noStackLogger.logError(error, 'testFunction');
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.stack).toBeUndefined();
    });
  });

  describe('Performance Handling', () => {
    it('should elevate log level based on performance thresholds', () => {
      // Clear console spy before test
      consoleSpy.mockRestore();
      
      // Set up window with performance thresholds
      (global as any).window = {
        NODE_EDITOR_CONFIG: {
          DEBUG: {
            enabled: true,
            performance: {
              warnThreshold: 10,
              errorThreshold: 50
            }
          }
        }
      };
      
      // Create new logger with performance config
      const perfLogger = new Logger('TestService');
      
      // Create new spy after logger creation
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Log performance under threshold - should be INFO
      perfLogger.logPerformance('testFunction', 'operation', 5);
      let logData = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logData.level).toBe('INFO');
      
      // Log performance over warn threshold - should be WARN
      consoleSpy.mockClear();
      perfLogger.logPerformance('testFunction', 'operation', 25);
      logData = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logData.level).toBe('WARN');
      
      // Log performance over error threshold - should be ERROR
      consoleSpy.mockClear();
      perfLogger.logPerformance('testFunction', 'operation', 75);
      logData = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logData.level).toBe('ERROR');
    });
  });

  describe('Dynamic Configuration Updates', () => {
    it('should update configuration dynamically', () => {
      // Start with logging enabled
      logger.logInfo('Should log', 'testFunction');
      expect(consoleSpy).toHaveBeenCalled();
      
      // Update config to disable logging
      consoleSpy.mockClear();
      logger.updateDebugConfig({ enabled: false });
      
      logger.logInfo('Should not log', 'testFunction');
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // Re-enable logging
      consoleSpy.mockClear();
      logger.updateDebugConfig({ enabled: true });
      
      logger.logInfo('Should log again', 'testFunction');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should merge configuration updates', () => {
      // Update only specific levels
      logger.updateDebugConfig({
        levels: { INFO: false }
      });
      
      consoleSpy.mockClear();
      logger.logInfo('Should not log', 'testFunction');
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // But other levels should still work
      logger.logWarn('Should log', 'testFunction');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Special Cases', () => {
    it('should handle circular references in parameters', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      
      // Should not throw when logging circular reference
      expect(() => {
        logger.logInfo('Test with circular', 'testFunction', circular);
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle very large parameters', () => {
      const largeArray = new Array(1000).fill('test');
      
      logger.logInfo('Test with large array', 'testFunction', { data: largeArray });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      // Should have truncated the large array
      expect(logData.params.data).toContain('[truncated]');
    });

    it('should handle functions in parameters', () => {
      const params = {
        callback: () => console.log('test'),
        value: 42
      };
      
      logger.logInfo('Test with function', 'testFunction', params);
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      expect(logData.params.callback).toBe('[Function: callback]');
      expect(logData.params.value).toBe(42);
    });
  });
});