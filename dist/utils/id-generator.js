/**
 * ID generator utilities for branded types
 * Creates properly formatted IDs for nodes and blocks
 */
/**
 * Generates a UUID v4
 */
function generateUUID() {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
/**
 * Creates a new NodeId
 */
export function createNodeId() {
    return `node_${generateUUID()}`;
}
/**
 * Creates a new BlockId
 */
export function createBlockId() {
    return `block_${generateUUID()}`;
}
/**
 * Creates a new CorrelationId
 */
export function createCorrelationId() {
    return generateUUID();
}
/**
 * Creates a new SessionId
 */
export function createSessionId() {
    return `session_${generateUUID()}`;
}
