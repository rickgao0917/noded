"use strict";
/**
 * Validator utility class
 * Provides assertion-style validation methods
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
const errors_1 = require("../types/errors");
/**
 * Validator class for runtime validation
 */
class Validator {
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * Asserts that a value is defined (not null or undefined)
     */
    assertDefined(value, fieldName, correlationId) {
        if (value === null || value === undefined) {
            this.logger.error('Validation failed: value is not defined', null, { fieldName }, correlationId);
            const context = {
                functionName: 'assertDefined',
                parameters: { fieldName },
                timestamp: new Date().toISOString(),
                correlationId: correlationId || 'unknown'
            };
            throw new errors_1.ValidationError(fieldName, value, 'defined value', context);
        }
    }
    /**
     * Asserts that a string is not empty
     */
    assertNotEmpty(value, fieldName, correlationId) {
        this.assertDefined(value, fieldName, correlationId);
        if (value.trim().length === 0) {
            this.logger.error('Validation failed: string is empty', null, { fieldName }, correlationId);
            const context = {
                functionName: 'assertNotEmpty',
                parameters: { fieldName },
                timestamp: new Date().toISOString(),
                correlationId: correlationId || 'unknown'
            };
            throw new errors_1.ValidationError(fieldName, value, 'non-empty string', context);
        }
    }
    /**
     * Asserts that a number is within range
     */
    assertInRange(value, min, max, fieldName, correlationId) {
        this.assertDefined(value, fieldName, correlationId);
        if (value < min || value > max) {
            this.logger.error('Validation failed: number out of range', null, {
                fieldName,
                value,
                min,
                max
            }, correlationId);
            const context = {
                functionName: 'assertInRange',
                parameters: { fieldName, min, max, value },
                timestamp: new Date().toISOString(),
                correlationId: correlationId || 'unknown'
            };
            throw new errors_1.ValidationError(fieldName, value, `number between ${min} and ${max}`, context);
        }
    }
    /**
     * Asserts that an array is not empty
     */
    assertArrayNotEmpty(value, fieldName, correlationId) {
        this.assertDefined(value, fieldName, correlationId);
        if (value.length === 0) {
            this.logger.error('Validation failed: array is empty', null, { fieldName }, correlationId);
            const context = {
                functionName: 'assertArrayNotEmpty',
                parameters: { fieldName },
                timestamp: new Date().toISOString(),
                correlationId: correlationId || 'unknown'
            };
            throw new errors_1.ValidationError(fieldName, value, 'non-empty array', context);
        }
    }
    /**
     * Validates that a value matches a pattern
     */
    assertPattern(value, pattern, fieldName, correlationId) {
        this.assertDefined(value, fieldName, correlationId);
        if (!pattern.test(value)) {
            this.logger.error('Validation failed: pattern mismatch', null, {
                fieldName,
                value,
                pattern: pattern.toString()
            }, correlationId);
            const context = {
                functionName: 'assertPattern',
                parameters: { fieldName, pattern: pattern.toString() },
                timestamp: new Date().toISOString(),
                correlationId: correlationId || 'unknown'
            };
            throw new errors_1.ValidationError(fieldName, value, `string matching ${pattern}`, context);
        }
    }
    /**
     * Validates an object against a type guard
     */
    assertType(value, typeGuard, typeName, correlationId) {
        if (!typeGuard(value)) {
            this.logger.error('Validation failed: type mismatch', null, {
                typeName,
                value
            }, correlationId);
            const context = {
                functionName: 'assertType',
                parameters: { typeName },
                timestamp: new Date().toISOString(),
                correlationId: correlationId || 'unknown'
            };
            throw new errors_1.ValidationError(typeName, value, typeName, context);
        }
    }
    /**
     * Validates multiple conditions and collects all errors
     */
    validateAll(validations, correlationId) {
        const errors = [];
        for (const validation of validations) {
            try {
                validation();
            }
            catch (error) {
                if (error instanceof errors_1.ValidationError) {
                    errors.push(error);
                }
                else {
                    this.logger.error('Unexpected error during validation', error, {}, correlationId);
                    throw error;
                }
            }
        }
        return errors;
    }
}
exports.Validator = Validator;
