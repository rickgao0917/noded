/**
 * Comprehensive test suite for Logger utility
 * 
 * Tests all logging functionality with 100% coverage as required by ts_readme.xml
 * for utility functions. Validates comprehensive logging requirements including
 * function entry/exit, branch coverage, performance metrics, and error handling.
 */

import { Logger } from '../../src/utils/logger';
import { originalConsole } from '../setup';

describe('Logger Utility Functions', () => {
  let logger: Logger;
  let mockConsole: jest.SpyInstance;

  beforeEach(() => {
    logger = new Logger('TestModule');
    mockConsole = jest.spyOn(console, 'log');
  });

  afterEach(() => {
    mockConsole.mockRestore();
  });

  describe('Constructor and Initialization', () => {
    it('should create logger with module name', () => {
      const testLogger = new Logger('TestComponent');
      expect(testLogger).toBeInstanceOf(Logger);
    });

    it('should create logger with different module names', () => {
      const logger1 = new Logger('Module1');
      const logger2 = new Logger('Module2');
      
      expect(logger1).toBeInstanceOf(Logger);
      expect(logger2).toBeInstanceOf(Logger);
    });
  });

  describe('Function Entry/Exit Logging', () => {
    it('should log function entry with parameters', () => {
      const params = { userId: 'test-123', action: 'create' };
      
      logger.logFunctionEntry('testFunction', params);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"level":"TRACE"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"function":"testFunction"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Function entry"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"userId":"test-123"')
      );
    });

    it('should log function entry without parameters', () => {
      logger.logFunctionEntry('simpleFunction');
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"level":"TRACE"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"function":"simpleFunction"')
      );
    });

    it('should log function exit with return value and execution time', () => {
      const returnValue = { success: true, id: 'new-123' };
      const executionTime = 45.67;
      
      logger.logFunctionExit('testFunction', returnValue, executionTime);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"level":"TRACE"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Function exit"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"executionTime":45.67')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"success":true')
      );
    });

    it('should log function exit without return value', () => {
      const executionTime = 12.34;
      
      logger.logFunctionExit('voidFunction', undefined, executionTime);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"executionTime":12.34')
      );
    });
  });

  describe('Branch Coverage Logging', () => {
    it('should log branch execution with context', () => {
      const context = { userId: 'test-123', inputValid: true };
      
      logger.logBranch('validateInput', 'inputValid', true, context);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"level":"DEBUG"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"function":"validateInput"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"branch":"inputValid"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"condition":true')
      );
    });

    it('should log false branch conditions', () => {
      logger.logBranch('checkPermission', 'hasAccess', false);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"condition":false')
      );
    });

    it('should log branch without context', () => {
      logger.logBranch('simpleCheck', 'isEnabled', true);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"branch":"isEnabled"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"condition":true')
      );
    });
  });

  describe('Variable Assignment Logging', () => {
    it('should log variable assignments with values', () => {
      logger.logVariableAssignment('processData', 'resultCount', 42);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"level":"DEBUG"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"function":"processData"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"variable":"resultCount"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"value":42')
      );
    });

    it('should log string variable assignments', () => {
      logger.logVariableAssignment('setupUser', 'username', 'john.doe');
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"value":"john.doe"')
      );
    });

    it('should log boolean variable assignments', () => {
      logger.logVariableAssignment('validateForm', 'isValid', false);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"value":false')
      );
    });

    it('should log null/undefined variable assignments', () => {
      logger.logVariableAssignment('clearData', 'currentUser', null);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"value":null')
      );
    });
  });

  describe('Performance Metrics Logging', () => {
    it('should log performance metrics for normal operations', () => {
      const executionTime = 8.5; // Under 10ms threshold
      
      logger.logPerformance('fastOperation', 'data_processing', executionTime);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"level":"INFO"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"operation":"data_processing"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"executionTime":8.5')
      );
    });

    it('should log warning for slow operations over 10ms threshold', () => {
      const executionTime = 15.7; // Over 10ms threshold
      
      logger.logPerformance('slowOperation', 'heavy_computation', executionTime);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"level":"WARN"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Slow operation detected"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"executionTime":15.7')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"threshold":10')
      );
    });

    it('should log performance for edge case at threshold', () => {
      const executionTime = 10.0; // Exactly at threshold
      
      logger.logPerformance('thresholdOperation', 'boundary_test', executionTime);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"level":"WARN"')
      );
    });

    it('should log performance with additional context', () => {
      const executionTime = 25.3;
      
      logger.logPerformance('databaseQuery', 'user_lookup', executionTime);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"operation":"user_lookup"')
      );
    });
  });

  describe('User Interaction Logging', () => {
    it('should log user interactions with context', () => {
      const context = { buttonId: 'save-btn', formData: { name: 'test' } };
      
      logger.logUserInteraction('button_click', 'save_button', context);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"level":"INFO"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"interaction":"button_click"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"element":"save_button"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"buttonId":"save-btn"')
      );
    });

    it('should log user interactions without context', () => {
      logger.logUserInteraction('page_load', 'dashboard');
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"interaction":"page_load"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"element":"dashboard"')
      );
    });

    it('should log different interaction types', () => {
      logger.logUserInteraction('mouse_hover', 'tooltip_trigger');
      logger.logUserInteraction('keyboard_shortcut', 'ctrl_s');
      logger.logUserInteraction('form_submit', 'login_form');
      
      expect(mockConsole).toHaveBeenCalledTimes(3);
    });
  });

  describe('Loop Iteration Logging', () => {
    it('should log loop start with iteration count', () => {
      logger.logLoop('processItems', 'item_processing', 5);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"level":"DEBUG"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"function":"processItems"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"loop":"item_processing"')
      );
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"iterationCount":5')
      );
    });

    it('should log loop with zero iterations', () => {
      logger.logLoop('emptyLoop', 'no_items', 0);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"iterationCount":0')
      );
    });

    it('should log loop with large iteration count', () => {
      logger.logLoop('bigLoop', 'massive_processing', 10000);
      
      expect(mockConsole).toHaveBeenCalledWith(
        expect.stringContaining('"iterationCount":10000')
      );
    });
  });

  describe('Log Level Methods', () => {
    describe('logTrace', () => {
      it('should log trace level messages', () => {
        logger.logTrace('Detailed execution flow', 'traceFunction', { step: 1 });
        
        expect(mockConsole).toHaveBeenCalledWith(
          expect.stringContaining('"level":"TRACE"')
        );
      });
    });

    describe('logDebug', () => {
      it('should log debug level messages', () => {
        logger.logDebug('Variable state information', 'debugFunction', { var1: 'value' });
        
        expect(mockConsole).toHaveBeenCalledWith(
          expect.stringContaining('"level":"DEBUG"')
        );
      });
    });

    describe('logInfo', () => {
      it('should log info level messages', () => {
        logger.logInfo('Business logic milestone', 'infoFunction', { milestone: 'complete' });
        
        expect(mockConsole).toHaveBeenCalledWith(
          expect.stringContaining('"level":"INFO"')
        );
      });
    });

    describe('logWarn', () => {
      it('should log warning level messages', () => {
        logger.logWarn('Recoverable error occurred', 'warnFunction', { error: 'minor' });
        
        expect(mockConsole).toHaveBeenCalledWith(
          expect.stringContaining('"level":"WARN"')
        );
      });
    });

    describe('logError', () => {
      it('should log error with Error object', () => {
        const error = new Error('Test error message');
        error.stack = 'Error: Test error\\n    at test:1:1';
        
        logger.logError(error, 'errorFunction', { context: 'test' });
        
        expect(mockConsole).toHaveBeenCalledWith(
          expect.stringContaining('"level":"ERROR"')
        );
        expect(mockConsole).toHaveBeenCalledWith(
          expect.stringContaining('"message":"Test error message"')
        );
        expect(mockConsole).toHaveBeenCalledWith(
          expect.stringContaining('"stack":"Error: Test error\\\\n    at test:1:1"')
        );
      });

      it('should log error without stack trace', () => {
        const error = new Error('Error without stack');
        delete error.stack;
        
        logger.logError(error, 'errorFunction');
        
        expect(mockConsole).toHaveBeenCalledWith(
          expect.stringContaining('"level":"ERROR"')
        );
      });
    });

    describe('logFatal', () => {
      it('should log fatal level messages', () => {
        logger.logFatal('System shutdown event', 'fatalFunction', { reason: 'critical' });
        
        expect(mockConsole).toHaveBeenCalledWith(
          expect.stringContaining('"level":"FATAL"')
        );
      });
    });
  });

  describe('Structured Log Format', () => {
    it('should include all mandatory fields per ts_readme.xml', () => {
      logger.logInfo('Test message', 'testFunction');
      
      const logCall = mockConsole.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      // Verify mandatory fields from ts_readme.xml
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('level');
      expect(logEntry).toHaveProperty('service');
      expect(logEntry).toHaveProperty('function');
      expect(logEntry).toHaveProperty('correlationId');
      expect(logEntry).toHaveProperty('message');
      
      expect(logEntry.service).toBe('TestModule');
      expect(logEntry.level).toBe('INFO');
      expect(logEntry.function).toBe('testFunction');
    });

    it('should generate valid ISO 8601 timestamps', () => {
      logger.logInfo('Timestamp test', 'timestampFunction');
      
      const logCall = mockConsole.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      // Verify ISO 8601 format
      expect(logEntry.timestamp).toMatch(/\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z/);
      
      // Verify it's a valid date
      const timestamp = new Date(logEntry.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should include correlation ID in every log entry', () => {
      const testLogger = new Logger('TestService');
      testLogger.logInfo('Correlation test', 'correlationFunction');
      
      const logCall = mockConsole.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      
      expect(logEntry.correlationId).toBeDefined();
      expect(typeof logEntry.correlationId).toBe('string');
      expect(logEntry.correlationId.length).toBeGreaterThan(0);
    });

    it('should properly sanitize sensitive data', () => {
      const sensitiveContext = {
        password: 'secret123',
        apiKey: 'api-key-12345',
        creditCard: '1234-5678-9012-3456',
        normalData: 'this-is-fine',
      };
      
      logger.logInfo('Sensitive data test', 'sanitizeFunction', sensitiveContext);
      
      const logCall = mockConsole.mock.calls[0][0];
      
      // Should not contain sensitive data
      expect(logCall).not.toContain('secret123');
      expect(logCall).not.toContain('api-key-12345');
      expect(logCall).not.toContain('1234-5678-9012-3456');
      
      // Should contain non-sensitive data
      expect(logCall).toContain('this-is-fine');
      
      // Should contain sanitized placeholders
      expect(logCall).toContain('[REDACTED]');
    });
  });

  describe('Error Handling in Logger', () => {
    it('should handle JSON.stringify errors gracefully', () => {
      const circularObj: any = {};
      circularObj.self = circularObj;
      
      expect(() => {
        logger.logInfo('Circular object test', 'circularFunction', circularObj);
      }).not.toThrow();
      
      expect(mockConsole).toHaveBeenCalled();
    });

    it('should handle undefined context gracefully', () => {
      expect(() => {
        logger.logInfo('Undefined context test', 'undefinedFunction', undefined);
      }).not.toThrow();
      
      expect(mockConsole).toHaveBeenCalled();
    });

    it('should handle null context gracefully', () => {
      expect(() => {
        logger.logInfo('Null context test', 'nullFunction', null);
      }).not.toThrow();
      
      expect(mockConsole).toHaveBeenCalled();
    });
  });
});