"use strict";
/**
 * Branded types for domain-specific values
 *
 * These types provide compile-time safety for values that are semantically
 * different but have the same underlying type (e.g., different kinds of IDs).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNodeId = isNodeId;
exports.isBlockId = isBlockId;
exports.isCorrelationId = isCorrelationId;
exports.isSessionId = isSessionId;
exports.createNodeId = createNodeId;
exports.createBlockId = createBlockId;
exports.createCorrelationId = createCorrelationId;
exports.createSessionId = createSessionId;
exports.generateNodeId = generateNodeId;
exports.generateBlockId = generateBlockId;
exports.generateCorrelationId = generateCorrelationId;
exports.generateSessionId = generateSessionId;
// Type guard functions
function isNodeId(value) {
    return typeof value === 'string' && value.startsWith('node_');
}
function isBlockId(value) {
    return typeof value === 'string' && value.startsWith('block_');
}
function isCorrelationId(value) {
    return typeof value === 'string' && value.startsWith('corr_');
}
function isSessionId(value) {
    return typeof value === 'string' && value.startsWith('session_');
}
// Factory functions for creating branded types
function createNodeId(id) {
    if (!id.startsWith('node_')) {
        throw new Error(`Invalid node ID format: ${id}. Must start with 'node_'`);
    }
    return id;
}
function createBlockId(id) {
    if (!id.startsWith('block_')) {
        throw new Error(`Invalid block ID format: ${id}. Must start with 'block_'`);
    }
    return id;
}
function createCorrelationId(id) {
    if (!id.startsWith('corr_')) {
        throw new Error(`Invalid correlation ID format: ${id}. Must start with 'corr_'`);
    }
    return id;
}
function createSessionId(id) {
    if (!id.startsWith('session_')) {
        throw new Error(`Invalid session ID format: ${id}. Must start with 'session_'`);
    }
    return id;
}
// Utility function to generate new IDs
function generateNodeId() {
    return createNodeId(`node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}
function generateBlockId() {
    return createBlockId(`block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}
function generateCorrelationId() {
    return createCorrelationId(`corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}
function generateSessionId() {
    return createSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}
