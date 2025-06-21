/**
 * Type definitions for node branching feature
 * Following TypeScript standards from ts_readme.xml
 */
/**
 * Factory functions for branded types
 */
export const toBranchId = (id) => id;
export const toVersionId = (id) => id;
/**
 * Types of changes that can trigger branching
 */
export var ChangeType;
(function (ChangeType) {
    ChangeType["CONTENT_EDIT"] = "CONTENT_EDIT";
    ChangeType["BLOCK_ADDITION"] = "BLOCK_ADDITION";
    ChangeType["BLOCK_DELETION"] = "BLOCK_DELETION";
})(ChangeType || (ChangeType = {}));
/**
 * Reasons for creating a branch
 */
export var BranchReason;
(function (BranchReason) {
    BranchReason["PROMPT_EDIT"] = "PROMPT_EDIT";
    BranchReason["RESPONSE_EDIT"] = "RESPONSE_EDIT";
    BranchReason["MANUAL_BRANCH"] = "MANUAL_BRANCH";
})(BranchReason || (BranchReason = {}));
/**
 * Source of edit operation
 */
export var EditSource;
(function (EditSource) {
    EditSource["NODE_BLOCK_DIRECT"] = "NODE_BLOCK_DIRECT";
    EditSource["CHAT_INTERFACE"] = "CHAT_INTERFACE";
    EditSource["PROGRAMMATIC"] = "PROGRAMMATIC";
})(EditSource || (EditSource = {}));
/**
 * Type guard to check if a block type should trigger branching
 */
export function shouldBlockTypeTriggerBranching(blockType) {
    return blockType === 'prompt' || blockType === 'response';
}
/**
 * Type guard for BranchMetadata
 */
export function isBranchMetadata(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const metadata = value;
    return (typeof metadata.originalNodeId === 'string' &&
        metadata.branchTimestamp instanceof Date &&
        typeof metadata.changeContext === 'object' &&
        metadata.changeContext !== null &&
        Object.values(BranchReason).includes(metadata.branchReason));
}
/**
 * Type guard for BranchingResult
 */
export function isBranchingResult(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const result = value;
    return (typeof result.newNodeId === 'string' &&
        typeof result.originalNodeId === 'string' &&
        isBranchMetadata(result.branchMetadata) &&
        typeof result.success === 'boolean' &&
        (result.errorMessage === undefined || typeof result.errorMessage === 'string'));
}
