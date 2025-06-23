/**
 * Simplified base error class for server-side use
 */
export class BaseError extends Error {
  public readonly errorCode: string;
  
  constructor(errorCode: string, message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    
    // Preserve stack trace (Node.js specific)
    if ('captureStackTrace' in Error && typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}