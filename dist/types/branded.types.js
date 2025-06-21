/**
 * Branded types for domain-specific values
 *
 * These types provide compile-time safety for values that are semantically
 * different but have the same underlying type (e.g., different kinds of IDs).
 */
// Type guard functions
export function isNodeId(value) {
    return typeof value === 'string' && value.startsWith('node_');
}
export function isBlockId(value) {
    return typeof value === 'string' && value.startsWith('block_');
}
export function isCorrelationId(value) {
    return typeof value === 'string' && value.startsWith('corr_');
}
export function isSessionId(value) {
    return typeof value === 'string' && value.startsWith('session_');
}
// Factory functions for creating branded types
export function createNodeId(id) {
    if (!id.startsWith('node_')) {
        throw new Error(`Invalid node ID format: ${id}. Must start with 'node_'`);
    }
    return id;
}
export function createBlockId(id) {
    if (!id.startsWith('block_')) {
        throw new Error(`Invalid block ID format: ${id}. Must start with 'block_'`);
    }
    return id;
}
export function createCorrelationId(id) {
    if (!id.startsWith('corr_')) {
        throw new Error(`Invalid correlation ID format: ${id}. Must start with 'corr_'`);
    }
    return id;
}
export function createSessionId(id) {
    if (!id.startsWith('session_')) {
        throw new Error(`Invalid session ID format: ${id}. Must start with 'session_'`);
    }
    return id;
}
// Utility function to generate new IDs
export function generateNodeId() {
    return createNodeId(`node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}
export function generateBlockId() {
    return createBlockId(`block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}
export function generateCorrelationId() {
    return createCorrelationId(`corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}
export function generateSessionId() {
    return createSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
}
