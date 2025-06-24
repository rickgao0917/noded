"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.ShareError = exports.BaseError = void 0;
/**
 * Simplified base error class for server-side use
 */
class BaseError extends Error {
    constructor(errorCode, message, cause) {
        super(message);
        this.cause = cause;
        this.name = this.constructor.name;
        this.errorCode = errorCode;
        // Preserve stack trace (Node.js specific)
        if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
exports.BaseError = BaseError;
/**
 * Error for sharing-related operations
 */
class ShareError extends BaseError {
    constructor(message, cause) {
        super('SHARE_ERROR', message, cause);
    }
}
exports.ShareError = ShareError;
/**
 * Error for validation failures
 */
class ValidationError extends BaseError {
    constructor(message, cause) {
        super('VALIDATION_ERROR', message, cause);
    }
}
exports.ValidationError = ValidationError;
