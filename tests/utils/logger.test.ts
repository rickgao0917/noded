/**
 * Comprehensive test suite for Logger utility
 * 
 * Tests all logging functionality with 100% coverage as required by ts_readme.xml
 * for utility functions. Validates comprehensive logging requirements including
 * function entry/exit, branch coverage, performance metrics, and error handling.
 */

import { Logger } from '../../src/utils/logger';
import { originalConsole } from '../setup';
import { parseLoggerOutput } from './logger-test-helper';

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
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('TRACE');
      expect(logData.function).toBe('testFunction');
      expect(logData.message).toBe('Function entry: testFunction');
      expect(logData.metadata.parameters.userId).toBe('test-123');
      expect(logData.metadata.parameters.action).toBe('create');
    });

    it('should log function entry without parameters', () => {
      logger.logFunctionEntry('simpleFunction');
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('TRACE');
      expect(logData.function).toBe('simpleFunction');
      expect(logData.message).toBe('Function entry: simpleFunction');
      expect(logData.metadata.parameters).toEqual({});
    });

    it('should log function exit with return value and execution time', () => {
      const returnValue = { success: true, id: 'new-123' };
      const executionTime = 45.67;
      
      logger.logFunctionExit('testFunction', returnValue, executionTime);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('TRACE');
      expect(logData.message).toBe('Function exit: testFunction');
      expect(logData.metadata.executionTime).toBe(45.67);
      expect(logData.metadata.returnValue).toBe('[OBJECT]');
    });

    it('should log function exit without return value', () => {
      const executionTime = 12.34;
      
      logger.logFunctionExit('voidFunction', undefined, executionTime);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('TRACE');
      expect(logData.message).toBe('Function exit: voidFunction');
      expect(logData.metadata.executionTime).toBe(12.34);
    });
  });

  describe('Branch Coverage Logging', () => {
    it('should log branch execution with context', () => {
      const context = { userId: 'test-123', inputValid: true };
      
      logger.logBranch('validateInput', 'inputValid', true, context);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.function).toBe('validateInput');
      expect(logData.metadata.condition).toBe('inputValid');
      expect(logData.metadata.result).toBe(true);
      // Context is spread directly into metadata
      expect(logData.metadata.userId).toBe('test-123');
      expect(logData.metadata.inputValid).toBe(true);
    });

    it('should log false branch conditions', () => {
      logger.logBranch('checkPermission', 'hasAccess', false);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.function).toBe('checkPermission');
      expect(logData.metadata.condition).toBe('hasAccess');
      expect(logData.metadata.result).toBe(false);
    });

    it('should log branch without context', () => {
      logger.logBranch('simpleCheck', 'isEnabled', true);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.function).toBe('simpleCheck');
      expect(logData.metadata.condition).toBe('isEnabled');
      expect(logData.metadata.result).toBe(true);
    });
  });

  describe('Variable Assignment Logging', () => {
    it('should log variable assignments with values', () => {
      logger.logVariableAssignment('processData', 'resultCount', 42);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.function).toBe('processData');
      expect(logData.metadata.variableName).toBe('resultCount');
      expect(logData.metadata.value).toBe(42);
    });

    it('should log string variable assignments', () => {
      logger.logVariableAssignment('setupUser', 'username', 'john.doe');
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.function).toBe('setupUser');
      expect(logData.metadata.variableName).toBe('username');
      expect(logData.metadata.value).toBe('john.doe');
    });

    it('should log boolean variable assignments', () => {
      logger.logVariableAssignment('validateForm', 'isValid', false);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.function).toBe('validateForm');
      expect(logData.metadata.variableName).toBe('isValid');
      expect(logData.metadata.value).toBe(false);
    });

    it('should log null/undefined variable assignments', () => {
      logger.logVariableAssignment('clearData', 'currentUser', null);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.function).toBe('clearData');
      expect(logData.metadata.variableName).toBe('currentUser');
      expect(logData.metadata.value).toBe(null);
    });
  });

  describe('Performance Metrics Logging', () => {
    it('should log performance metrics for normal operations', () => {
      const executionTime = 8.5; // Under 10ms threshold
      
      logger.logPerformance('fastOperation', 'data_processing', executionTime);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.function).toBe('fastOperation');
      expect(logData.metadata.operation).toBe('data_processing');
      expect(logData.metadata.duration).toBe(8.5);
    });

    it('should log warning for slow operations over 10ms threshold', () => {
      const executionTime = 15.7; // Over 10ms threshold
      
      logger.logPerformance('slowOperation', 'heavy_computation', executionTime);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('WARN');
      expect(logData.message).toBe('Performance: heavy_computation completed in 15.7ms');
      expect(logData.metadata.duration).toBe(15.7);
    });

    it('should log performance for edge case at threshold', () => {
      const executionTime = 10.1; // Just over threshold
      
      logger.logPerformance('thresholdOperation', 'boundary_test', executionTime);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('WARN');
      expect(logData.metadata.operation).toBe('boundary_test');
      expect(logData.metadata.duration).toBe(10.1);
    });

    it('should log performance with additional context', () => {
      const executionTime = 25.3;
      
      logger.logPerformance('databaseQuery', 'user_lookup', executionTime);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('WARN');
      expect(logData.function).toBe('databaseQuery');
      expect(logData.metadata.operation).toBe('user_lookup');
      expect(logData.metadata.duration).toBe(25.3);
    });
  });

  describe('User Interaction Logging', () => {
    it('should log user interactions with context', () => {
      const context = { buttonId: 'save-btn', formData: { name: 'test' } };
      
      logger.logUserInteraction('button_click', 'save_button', context);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('INFO');
      expect(logData.metadata.action).toBe('button_click');
      expect(logData.metadata.elementId).toBe('save_button');
      // Context is spread directly into metadata
      expect(logData.metadata.buttonId).toBe('save-btn');
      expect(logData.metadata.formData.name).toBe('test');
    });

    it('should log user interactions without context', () => {
      logger.logUserInteraction('page_load', 'dashboard');
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('INFO');
      expect(logData.metadata.action).toBe('page_load');
      expect(logData.metadata.elementId).toBe('dashboard');
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
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.function).toBe('processItems');
      expect(logData.metadata.loopType).toBe('item_processing');
      expect(logData.metadata.iterationCount).toBe(5);
    });

    it('should log loop with zero iterations', () => {
      logger.logLoop('emptyLoop', 'no_items', 0);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.metadata.loopType).toBe('no_items');
      expect(logData.metadata.iterationCount).toBe(0);
    });

    it('should log loop with large iteration count', () => {
      logger.logLoop('bigLoop', 'massive_processing', 10000);
      
      expect(mockConsole).toHaveBeenCalledTimes(1);
      const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
      
      expect(logData.level).toBe('DEBUG');
      expect(logData.metadata.loopType).toBe('massive_processing');
      expect(logData.metadata.iterationCount).toBe(10000);
    });
  });

  describe('Log Level Methods', () => {
    describe('logTrace', () => {
      it('should log trace level messages', () => {
        logger.logTrace('Detailed execution flow', 'traceFunction', { step: 1 });
        
        expect(mockConsole).toHaveBeenCalledTimes(1);
        const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
        
        expect(logData.level).toBe('TRACE');
        expect(logData.message).toBe('Detailed execution flow');
        expect(logData.function).toBe('traceFunction');
        expect(logData.metadata.step).toBe(1);
      });
    });

    describe('logDebug', () => {
      it('should log debug level messages', () => {
        logger.logDebug('Variable state information', 'debugFunction', { var1: 'value' });
        
        expect(mockConsole).toHaveBeenCalledTimes(1);
        const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
        
        expect(logData.level).toBe('DEBUG');
        expect(logData.message).toBe('Variable state information');
        expect(logData.function).toBe('debugFunction');
        expect(logData.metadata.var1).toBe('value');
      });
    });

    describe('logInfo', () => {
      it('should log info level messages', () => {
        logger.logInfo('Business logic milestone', 'infoFunction', { milestone: 'complete' });
        
        expect(mockConsole).toHaveBeenCalledTimes(1);
        const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
        
        expect(logData.level).toBe('INFO');
        expect(logData.message).toBe('Business logic milestone');
        expect(logData.function).toBe('infoFunction');
        expect(logData.metadata.milestone).toBe('complete');
      });
    });

    describe('logWarn', () => {
      it('should log warning level messages', () => {
        logger.logWarn('Recoverable error occurred', 'warnFunction', { error: 'minor' });
        
        expect(mockConsole).toHaveBeenCalledTimes(1);
        const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
        
        expect(logData.level).toBe('WARN');
        expect(logData.message).toBe('Recoverable error occurred');
        expect(logData.function).toBe('warnFunction');
        expect(logData.metadata.error).toBe('minor');
      });
    });

    describe('logError', () => {
      it('should log error with Error object', () => {
        const error = new Error('Test error message');
        error.stack = 'Error: Test error\\n    at test:1:1';
        
        logger.logError(error, 'errorFunction', { context: 'test' });
        
        expect(mockConsole).toHaveBeenCalledTimes(1);
        const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
        
        expect(logData.level).toBe('ERROR');
        expect(logData.message).toBe('Error in errorFunction: Test error message');
        expect(logData.metadata.stackTrace).toBe('Error: Test error\\n    at test:1:1');
        // Context is stored as a nested object in logError
        expect(logData.metadata.context).toEqual({ context: 'test' });
      });

      it('should log error without stack trace', () => {
        const error = new Error('Error without stack');
        delete error.stack;
        
        logger.logError(error, 'errorFunction');
        
        expect(mockConsole).toHaveBeenCalledTimes(1);
        const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
        
        expect(logData.level).toBe('ERROR');
        expect(logData.message).toBe('Error in errorFunction: Error without stack');
        expect(logData.metadata.stackTrace).toBeUndefined();
      });
    });

    describe('logFatal', () => {
      it('should log fatal level messages', () => {
        logger.logFatal('System shutdown event', 'fatalFunction', { reason: 'critical' });
        
        expect(mockConsole).toHaveBeenCalledTimes(1);
        const logData = parseLoggerOutput(mockConsole.mock.calls[0][0]);
        
        expect(logData.level).toBe('FATAL');
        expect(logData.message).toBe('System shutdown event');
        expect(logData.function).toBe('fatalFunction');
        expect(logData.metadata.reason).toBe('critical');
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
      expect(logEntry.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
      
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
      const logData = parseLoggerOutput(logCall);
      
      // Should not contain sensitive data in the raw output
      expect(logCall).not.toContain('secret123');
      expect(logCall).not.toContain('api-key-12345');
      expect(logCall).not.toContain('1234-5678-9012-3456');
      
      // Should contain non-sensitive data
      expect(logData.metadata.normalData).toBe('this-is-fine');
      
      // Should contain sanitized placeholders
      expect(logData.metadata.password).toBe('[REDACTED]');
      expect(logData.metadata.apiKey).toBe('[REDACTED]');
      expect(logData.metadata.creditCard).toBe('[REDACTED]');
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