import { Logger } from './logger.js';
/**
 * Share-specific error types for better error handling
 */
export var ShareErrorType;
(function (ShareErrorType) {
    ShareErrorType["USER_NOT_FOUND"] = "USER_NOT_FOUND";
    ShareErrorType["ALREADY_SHARED"] = "ALREADY_SHARED";
    ShareErrorType["PERMISSION_DENIED"] = "PERMISSION_DENIED";
    ShareErrorType["INVALID_WORKSPACE"] = "INVALID_WORKSPACE";
    ShareErrorType["SHARE_LIMIT_REACHED"] = "SHARE_LIMIT_REACHED";
    ShareErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    ShareErrorType["EXPIRED_LINK"] = "EXPIRED_LINK";
    ShareErrorType["INVALID_INPUT"] = "INVALID_INPUT";
    ShareErrorType["SELF_SHARE"] = "SELF_SHARE";
    ShareErrorType["SERVER_ERROR"] = "SERVER_ERROR";
})(ShareErrorType || (ShareErrorType = {}));
/**
 * User-friendly error messages for sharing operations
 */
const USER_FRIENDLY_MESSAGES = {
    [ShareErrorType.USER_NOT_FOUND]: 'The username you entered could not be found. Please check the spelling and try again.',
    [ShareErrorType.ALREADY_SHARED]: 'This workspace is already shared with that user. You can update their permissions in the share list.',
    [ShareErrorType.PERMISSION_DENIED]: 'You don\'t have permission to share this workspace. Only the workspace owner can manage sharing.',
    [ShareErrorType.INVALID_WORKSPACE]: 'This workspace could not be found or may have been deleted. Please refresh the page.',
    [ShareErrorType.SHARE_LIMIT_REACHED]: 'You\'ve reached the maximum number of shares for this workspace. Please remove some existing shares first.',
    [ShareErrorType.NETWORK_ERROR]: 'Unable to connect to the server. Please check your internet connection and try again.',
    [ShareErrorType.EXPIRED_LINK]: 'This share link has expired. Please request a new link from the workspace owner.',
    [ShareErrorType.INVALID_INPUT]: 'Please enter a valid username. Usernames must be 3-64 characters and contain only letters, numbers, and underscores.',
    [ShareErrorType.SELF_SHARE]: 'You cannot share a workspace with yourself. Try sharing with another user.',
    [ShareErrorType.SERVER_ERROR]: 'Something went wrong on our end. Please try again later or contact support if the problem persists.'
};
/**
 * Maps API error messages to error types
 */
const ERROR_MESSAGE_MAPPING = {
    'User not found': ShareErrorType.USER_NOT_FOUND,
    'Workspace already shared': ShareErrorType.ALREADY_SHARED,
    'Permission denied': ShareErrorType.PERMISSION_DENIED,
    'Workspace not found': ShareErrorType.INVALID_WORKSPACE,
    'Share limit reached': ShareErrorType.SHARE_LIMIT_REACHED,
    'Network error': ShareErrorType.NETWORK_ERROR,
    'Share link expired': ShareErrorType.EXPIRED_LINK,
    'Invalid username': ShareErrorType.INVALID_INPUT,
    'Cannot share with yourself': ShareErrorType.SELF_SHARE
};
export class ShareErrorHandler {
    constructor() {
        this.logger = new Logger('ShareErrorHandler');
    }
    /**
     * Handles errors from share operations and returns user-friendly display info
     */
    handleShareError(error) {
        this.logger.logFunctionEntry('handleShareError', { error });
        // Determine error type
        const errorType = this.determineErrorType(error);
        // Get user-friendly message
        const message = USER_FRIENDLY_MESSAGES[errorType] || USER_FRIENDLY_MESSAGES[ShareErrorType.SERVER_ERROR];
        // Determine display type
        const displayType = this.getDisplayType(errorType);
        // Add action if applicable
        const action = this.getErrorAction(errorType);
        // Determine duration
        const duration = errorType === ShareErrorType.NETWORK_ERROR ? 10000 : 5000;
        const result = Object.assign({ message, type: displayType, duration }, (action && { action }));
        this.logger.logFunctionExit('handleShareError', result);
        return result;
    }
    /**
     * Validates username input before making API call
     */
    validateUsername(username) {
        this.logger.logFunctionEntry('validateUsername', { username });
        if (!username || username.trim().length === 0) {
            return {
                valid: false,
                error: 'Please enter a username'
            };
        }
        const trimmed = username.trim();
        if (trimmed.length < 3) {
            return {
                valid: false,
                error: 'Username must be at least 3 characters long'
            };
        }
        if (trimmed.length > 64) {
            return {
                valid: false,
                error: 'Username must be less than 64 characters'
            };
        }
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
            return {
                valid: false,
                error: 'Username can only contain letters, numbers, and underscores'
            };
        }
        return { valid: true };
    }
    /**
     * Creates a DOM element for displaying errors
     */
    createErrorElement(display) {
        const element = document.createElement('div');
        element.className = `share-message ${display.type}`;
        const messageSpan = document.createElement('span');
        messageSpan.textContent = display.message;
        element.appendChild(messageSpan);
        if (display.action) {
            const actionButton = document.createElement('button');
            actionButton.className = 'share-error-action';
            actionButton.textContent = display.action.label;
            actionButton.onclick = display.action.callback;
            element.appendChild(actionButton);
        }
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'share-error-close';
        closeButton.innerHTML = '×';
        closeButton.onclick = () => element.remove();
        element.appendChild(closeButton);
        // Auto-remove after duration
        if (display.duration) {
            setTimeout(() => {
                element.classList.add('fade-out');
                setTimeout(() => element.remove(), 300);
            }, display.duration);
        }
        return element;
    }
    /**
     * Displays error in the UI
     */
    displayError(container, error) {
        this.logger.logFunctionEntry('displayError', { error });
        const display = this.handleShareError(error);
        const element = this.createErrorElement(display);
        // Remove any existing error messages
        container.querySelectorAll('.share-message').forEach(el => el.remove());
        // Add new error message
        container.appendChild(element);
        this.logger.logFunctionExit('displayError', undefined);
    }
    determineErrorType(error) {
        var _a, _b;
        // Check for network errors
        if (((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('NetworkError')) || ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('Failed to fetch'))) {
            return ShareErrorType.NETWORK_ERROR;
        }
        // Check for specific error messages
        const errorMessage = error.error || error.message || '';
        for (const [key, type] of Object.entries(ERROR_MESSAGE_MAPPING)) {
            if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
                return type;
            }
        }
        // Check status codes
        if (error.status === 404) {
            return ShareErrorType.USER_NOT_FOUND;
        }
        else if (error.status === 403) {
            return ShareErrorType.PERMISSION_DENIED;
        }
        else if (error.status === 409) {
            return ShareErrorType.ALREADY_SHARED;
        }
        else if (error.status === 410) {
            return ShareErrorType.EXPIRED_LINK;
        }
        return ShareErrorType.SERVER_ERROR;
    }
    getDisplayType(errorType) {
        switch (errorType) {
            case ShareErrorType.ALREADY_SHARED:
            case ShareErrorType.SELF_SHARE:
                return 'warning';
            case ShareErrorType.NETWORK_ERROR:
            case ShareErrorType.SERVER_ERROR:
            case ShareErrorType.PERMISSION_DENIED:
                return 'error';
            default:
                return 'info';
        }
    }
    getErrorAction(errorType) {
        switch (errorType) {
            case ShareErrorType.NETWORK_ERROR:
                return {
                    label: 'Retry',
                    callback: () => window.location.reload()
                };
            case ShareErrorType.EXPIRED_LINK:
                return {
                    label: 'Go to Workspaces',
                    callback: () => window.location.href = '/'
                };
            default:
                return undefined;
        }
    }
}
