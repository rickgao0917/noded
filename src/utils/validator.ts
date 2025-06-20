/**
 * Validator utility class
 * Provides assertion-style validation methods
 */

import { ValidationError, ErrorContext } from '../types/errors';
import { Logger } from './logger';
import type { CorrelationId } from '../types/branded.types';

/**
 * Validator class for runtime validation
 */
export class Validator {
  constructor(private readonly logger: Logger) {}

  /**
   * Asserts that a value is defined (not null or undefined)
   */
  public assertDefined<T>(
    value: T | null | undefined,
    fieldName: string,
    correlationId?: CorrelationId
  ): asserts value is T {
    if (value === null || value === undefined) {
      this.logger.error('Validation failed: value is not defined', null, { fieldName }, correlationId);
      const context: ErrorContext = {
        functionName: 'assertDefined',
        parameters: { fieldName },
        timestamp: new Date().toISOString(),
        correlationId: correlationId || 'unknown'
      };
      throw new ValidationError(fieldName, value, 'defined value', context);
    }
  }

  /**
   * Asserts that a string is not empty
   */
  public assertNotEmpty(
    value: string,
    fieldName: string,
    correlationId?: CorrelationId
  ): void {
    this.assertDefined(value, fieldName, correlationId);
    if (value.trim().length === 0) {
      this.logger.error('Validation failed: string is empty', null, { fieldName }, correlationId);
      const context: ErrorContext = {
        functionName: 'assertNotEmpty',
        parameters: { fieldName },
        timestamp: new Date().toISOString(),
        correlationId: correlationId || 'unknown'
      };
      throw new ValidationError(fieldName, value, 'non-empty string', context);
    }
  }

  /**
   * Asserts that a number is within range
   */
  public assertInRange(
    value: number,
    min: number,
    max: number,
    fieldName: string,
    correlationId?: CorrelationId
  ): void {
    this.assertDefined(value, fieldName, correlationId);
    if (value < min || value > max) {
      this.logger.error('Validation failed: number out of range', null, {
        fieldName,
        value,
        min,
        max
      }, correlationId);
      const context: ErrorContext = {
        functionName: 'assertInRange',
        parameters: { fieldName, min, max, value },
        timestamp: new Date().toISOString(),
        correlationId: correlationId || 'unknown'
      };
      throw new ValidationError(fieldName, value, `number between ${min} and ${max}`, context);
    }
  }

  /**
   * Asserts that an array is not empty
   */
  public assertArrayNotEmpty<T>(
    value: T[],
    fieldName: string,
    correlationId?: CorrelationId
  ): void {
    this.assertDefined(value, fieldName, correlationId);
    if (value.length === 0) {
      this.logger.error('Validation failed: array is empty', null, { fieldName }, correlationId);
      const context: ErrorContext = {
        functionName: 'assertArrayNotEmpty',
        parameters: { fieldName },
        timestamp: new Date().toISOString(),
        correlationId: correlationId || 'unknown'
      };
      throw new ValidationError(fieldName, value, 'non-empty array', context);
    }
  }

  /**
   * Validates that a value matches a pattern
   */
  public assertPattern(
    value: string,
    pattern: RegExp,
    fieldName: string,
    correlationId?: CorrelationId
  ): void {
    this.assertDefined(value, fieldName, correlationId);
    if (!pattern.test(value)) {
      this.logger.error('Validation failed: pattern mismatch', null, {
        fieldName,
        value,
        pattern: pattern.toString()
      }, correlationId);
      const context: ErrorContext = {
        functionName: 'assertPattern',
        parameters: { fieldName, pattern: pattern.toString() },
        timestamp: new Date().toISOString(),
        correlationId: correlationId || 'unknown'
      };
      throw new ValidationError(fieldName, value, `string matching ${pattern}`, context);
    }
  }

  /**
   * Validates an object against a type guard
   */
  public assertType<T>(
    value: unknown,
    typeGuard: (val: unknown) => val is T,
    typeName: string,
    correlationId?: CorrelationId
  ): asserts value is T {
    if (!typeGuard(value)) {
      this.logger.error('Validation failed: type mismatch', null, {
        typeName,
        value
      }, correlationId);
      const context: ErrorContext = {
        functionName: 'assertType',
        parameters: { typeName },
        timestamp: new Date().toISOString(),
        correlationId: correlationId || 'unknown'
      };
      throw new ValidationError(typeName, value, typeName, context);
    }
  }

  /**
   * Validates multiple conditions and collects all errors
   */
  public validateAll(
    validations: Array<() => void>,
    correlationId?: CorrelationId
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    
    for (const validation of validations) {
      try {
        validation();
      } catch (error) {
        if (error instanceof ValidationError) {
          errors.push(error);
        } else {
          this.logger.error('Unexpected error during validation', error, {}, correlationId);
          throw error;
        }
      }
    }
    
    return errors;
  }
}
