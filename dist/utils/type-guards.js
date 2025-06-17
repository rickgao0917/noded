/**
 * Type guards and runtime validation utilities
 *
 * Provides comprehensive runtime type checking and validation for all
 * data structures used in the graph editor, following strict type safety requirements.
 */
import { ErrorFactory } from '../types/errors.js';
/**
 * Type guard for NodeBlockType
 *
 * @param value - Value to check
 * @returns True if value is a valid NodeBlockType
 *
 * @public
 */
export function isNodeBlockType(value) {
    return typeof value === 'string' &&
        ['prompt', 'response', 'markdown'].includes(value);
}
/**
 * Type guard for Position interface
 *
 * @param value - Value to check
 * @returns True if value is a valid Position with finite x and y coordinates
 *
 * @public
 */
export function isPosition(value) {
    return typeof value === 'object' &&
        value !== null &&
        typeof value.x === 'number' &&
        typeof value.y === 'number' &&
        Number.isFinite(value.x) &&
        Number.isFinite(value.y);
}
/**
 * Type guard for NodeBlock interface
 *
 * @param value - Value to check
 * @returns True if value is a valid NodeBlock with all required properties
 *
 * @public
 */
export function isNodeBlock(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const block = value;
    return typeof block.id === 'string' &&
        block.id.length > 0 &&
        isNodeBlockType(block.type) &&
        typeof block.content === 'string' &&
        typeof block.position === 'number' &&
        Number.isInteger(block.position) &&
        block.position >= 0;
}
/**
 * Type guard for GraphNode interface
 *
 * @param value - Value to check
 * @returns True if value is a valid GraphNode with proper tree structure
 *
 * @public
 */
export function isGraphNode(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const node = value;
    return typeof node.id === 'string' &&
        node.id.length > 0 &&
        (node.parentId === null || typeof node.parentId === 'string') &&
        Array.isArray(node.children) &&
        node.children.every(child => typeof child === 'string') &&
        Array.isArray(node.blocks) &&
        node.blocks.every(block => isNodeBlock(block)) &&
        isPosition(node.position) &&
        typeof node.depth === 'number' &&
        Number.isInteger(node.depth) &&
        node.depth >= 0;
}
/**
 * Validation utility class with comprehensive error reporting
 *
 * Provides assertion-style validation methods that throw detailed errors
 * when validation fails, with full context and user-friendly messages.
 *
 * @public
 */
export class Validator {
    constructor(correlationId) {
        this.errorFactory = new ErrorFactory(correlationId);
    }
    /**
     * Validate node ID format and uniqueness
     */
    validateNodeId(nodeId, functionName, existingIds) {
        if (typeof nodeId !== 'string') {
            throw this.errorFactory.createValidationError('nodeId', nodeId, 'string', functionName);
        }
        if (nodeId.length === 0) {
            throw this.errorFactory.createValidationError('nodeId', nodeId, 'non-empty string', functionName);
        }
        if (existingIds && existingIds.has(nodeId)) {
            throw this.errorFactory.createValidationError('nodeId', nodeId, 'unique string', functionName);
        }
    }
    /**
     * Validate DOM element exists and has correct type
     */
    validateDOMElement(element, expectedType, functionName) {
        if (!element) {
            throw this.errorFactory.createDOMError(`Required DOM element not found`, 'ELEMENT_NOT_FOUND', 'Unable to initialize the editor. Please refresh the page.', functionName);
        }
        if (!(element instanceof Element)) {
            throw this.errorFactory.createDOMError(`Expected DOM element, got ${typeof element}`, 'INVALID_ELEMENT_TYPE', 'Invalid element type detected.', functionName);
        }
    }
    /**
     * Validate position coordinates
     */
    validatePosition(position, functionName) {
        if (!isPosition(position)) {
            throw this.errorFactory.createValidationError('position', position, 'Position with finite x and y coordinates', functionName);
        }
    }
    /**
     * Validate node block structure
     */
    validateNodeBlock(block, functionName) {
        if (!isNodeBlock(block)) {
            throw this.errorFactory.createValidationError('nodeBlock', block, 'valid NodeBlock interface', functionName);
        }
    }
    /**
     * Validate graph node structure
     */
    validateGraphNode(node, functionName) {
        if (!isGraphNode(node)) {
            throw this.errorFactory.createValidationError('graphNode', node, 'valid GraphNode interface', functionName);
        }
    }
    /**
     * Validate tree structure integrity
     */
    validateTreeIntegrity(nodes, functionName) {
        const visitedNodes = new Set();
        const currentPath = new Set();
        // Check each node for cycles and orphaned references
        for (const [nodeId, node] of nodes) {
            if (!visitedNodes.has(nodeId)) {
                this.validateNodePath(node, nodes, visitedNodes, currentPath, functionName);
            }
            // Validate children references
            for (const childId of node.children) {
                const childNode = nodes.get(childId);
                if (!childNode) {
                    throw this.errorFactory.createTreeStructureError(nodeId, 'validate', `Node ${nodeId} references non-existent child ${childId}`, functionName);
                }
                if (childNode.parentId !== nodeId) {
                    throw this.errorFactory.createTreeStructureError(nodeId, 'validate', `Child node ${childId} has incorrect parent reference`, functionName);
                }
            }
        }
    }
    /**
     * Validate individual node path for cycles
     */
    validateNodePath(node, nodes, visitedNodes, currentPath, functionName) {
        if (currentPath.has(node.id)) {
            throw this.errorFactory.createTreeStructureError(node.id, 'validate', `Cycle detected in tree structure at node ${node.id}`, functionName);
        }
        if (visitedNodes.has(node.id)) {
            return;
        }
        currentPath.add(node.id);
        visitedNodes.add(node.id);
        // Validate parent reference
        if (node.parentId) {
            const parentNode = nodes.get(node.parentId);
            if (!parentNode) {
                throw this.errorFactory.createTreeStructureError(node.id, 'validate', `Node ${node.id} references non-existent parent ${node.parentId}`, functionName);
            }
            if (!parentNode.children.includes(node.id)) {
                throw this.errorFactory.createTreeStructureError(node.id, 'validate', `Parent node ${node.parentId} does not reference child ${node.id}`, functionName);
            }
        }
        // Recursively validate children
        for (const childId of node.children) {
            const childNode = nodes.get(childId);
            if (childNode) {
                this.validateNodePath(childNode, nodes, visitedNodes, currentPath, functionName);
            }
        }
        currentPath.delete(node.id);
    }
    /**
     * Validate numeric range
     */
    validateRange(value, min, max, fieldName, functionName) {
        if (!Number.isFinite(value) || value < min || value > max) {
            throw this.errorFactory.createValidationError(fieldName, value, `number between ${min} and ${max}`, functionName);
        }
    }
    /**
     * Validate array is not empty
     */
    validateNonEmptyArray(array, fieldName, functionName) {
        if (!Array.isArray(array) || array.length === 0) {
            throw this.errorFactory.createValidationError(fieldName, array, 'non-empty array', functionName);
        }
    }
}
