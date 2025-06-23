"use strict";
/**
 * Type definitions for node branching feature
 * Following TypeScript standards from ts_readme.xml
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditSource = exports.BranchReason = exports.ChangeType = exports.toVersionId = exports.toBranchId = void 0;
exports.shouldBlockTypeTriggerBranching = shouldBlockTypeTriggerBranching;
exports.isBranchMetadata = isBranchMetadata;
exports.isBranchingResult = isBranchingResult;
/**
 * Factory functions for branded types
 */
const toBranchId = (id) => id;
exports.toBranchId = toBranchId;
const toVersionId = (id) => id;
exports.toVersionId = toVersionId;
/**
 * Types of changes that can trigger branching
 */
var ChangeType;
(function (ChangeType) {
    ChangeType["CONTENT_EDIT"] = "CONTENT_EDIT";
    ChangeType["BLOCK_ADDITION"] = "BLOCK_ADDITION";
    ChangeType["BLOCK_DELETION"] = "BLOCK_DELETION";
})(ChangeType || (exports.ChangeType = ChangeType = {}));
/**
 * Reasons for creating a branch
 */
var BranchReason;
(function (BranchReason) {
    BranchReason["PROMPT_EDIT"] = "PROMPT_EDIT";
    BranchReason["RESPONSE_EDIT"] = "RESPONSE_EDIT";
    BranchReason["MANUAL_BRANCH"] = "MANUAL_BRANCH";
})(BranchReason || (exports.BranchReason = BranchReason = {}));
/**
 * Source of edit operation
 */
var EditSource;
(function (EditSource) {
    EditSource["NODE_BLOCK_DIRECT"] = "NODE_BLOCK_DIRECT";
    EditSource["CHAT_INTERFACE"] = "CHAT_INTERFACE";
    EditSource["PROGRAMMATIC"] = "PROGRAMMATIC";
})(EditSource || (exports.EditSource = EditSource = {}));
/**
 * Type guard to check if a block type should trigger branching
 */
function shouldBlockTypeTriggerBranching(blockType) {
    return blockType === 'prompt' || blockType === 'response';
}
/**
 * Type guard for BranchMetadata
 */
function isBranchMetadata(value) {
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
function isBranchingResult(value) {
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
