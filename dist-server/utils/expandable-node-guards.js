"use strict";
/**
 * Type guards for expandable node system
 * Provides runtime validation for node and block structures
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBlockType = validateBlockType;
exports.isNodeDimensions = isNodeDimensions;
exports.isNodePosition = isNodePosition;
exports.isNodeMetadata = isNodeMetadata;
exports.isBlockDimensions = isBlockDimensions;
exports.isBlockMetadata = isBlockMetadata;
exports.isBasicBlock = isBasicBlock;
exports.isExpandableNode = isExpandableNode;
exports.createDefaultNodeDimensions = createDefaultNodeDimensions;
exports.createDefaultBlockDimensions = createDefaultBlockDimensions;
exports.clampNodeDimensions = clampNodeDimensions;
exports.snapToGrid = snapToGrid;
const expandable_node_types_1 = require("../types/expandable-node.types");
/**
 * Checks if a value has a required property of a specific type
 */
function hasRequiredProperty(value, property, validator) {
    return (typeof value === 'object' &&
        value !== null &&
        property in value &&
        validator(value[property]));
}
/**
 * Checks if a value has a required string property
 */
function hasRequiredStringProperty(value, property) {
    return hasRequiredProperty(value, property, (val) => typeof val === 'string');
}
/**
 * Checks if a value has a required number property
 */
function hasRequiredNumberProperty(value, property) {
    return hasRequiredProperty(value, property, (val) => typeof val === 'number' && !isNaN(val));
}
/**
 * Checks if a value has a required boolean property
 */
function hasRequiredBooleanProperty(value, property) {
    return hasRequiredProperty(value, property, (val) => typeof val === 'boolean');
}
/**
 * Checks if a value has a required object property
 */
function hasRequiredObjectProperty(value, property) {
    return hasRequiredProperty(value, property, (val) => typeof val === 'object' && val !== null);
}
/**
 * Checks if a value has a required array property
 */
function hasRequiredArrayProperty(value, property) {
    return hasRequiredProperty(value, property, (val) => Array.isArray(val));
}
/**
 * Validates a block type value
 */
function validateBlockType(value) {
    return typeof value === 'string' && ['prompt', 'response', 'markdown'].includes(value);
}
/**
 * Type guard for NodeDimensions
 */
function isNodeDimensions(value) {
    if (!hasRequiredNumberProperty(value, 'width'))
        return false;
    if (!hasRequiredNumberProperty(value, 'height'))
        return false;
    if (!hasRequiredNumberProperty(value, 'minWidth'))
        return false;
    if (!hasRequiredNumberProperty(value, 'maxWidth'))
        return false;
    if (!hasRequiredNumberProperty(value, 'minHeight'))
        return false;
    if (!hasRequiredNumberProperty(value, 'maxHeight'))
        return false;
    const dimensions = value;
    // Validate dimension constraints
    if (dimensions.width < dimensions.minWidth || dimensions.width > dimensions.maxWidth)
        return false;
    if (dimensions.height < dimensions.minHeight || dimensions.height > dimensions.maxHeight)
        return false;
    if (dimensions.minWidth < expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MIN_WIDTH)
        return false;
    if (dimensions.maxWidth > expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MAX_WIDTH)
        return false;
    if (dimensions.minHeight < expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MIN_HEIGHT)
        return false;
    if (dimensions.maxHeight > expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MAX_HEIGHT)
        return false;
    return true;
}
/**
 * Type guard for NodePosition
 */
function isNodePosition(value) {
    return (hasRequiredNumberProperty(value, 'x') &&
        hasRequiredNumberProperty(value, 'y') &&
        hasRequiredNumberProperty(value, 'zIndex'));
}
/**
 * Type guard for NodeMetadata
 */
function isNodeMetadata(value) {
    if (!hasRequiredObjectProperty(value, 'createdAt'))
        return false;
    if (!hasRequiredObjectProperty(value, 'lastModified'))
        return false;
    if (!hasRequiredNumberProperty(value, 'version'))
        return false;
    const metadata = value;
    // Validate dates
    if (!(metadata.createdAt instanceof Date))
        return false;
    if (!(metadata.lastModified instanceof Date))
        return false;
    return true;
}
/**
 * Type guard for BlockDimensions
 */
function isBlockDimensions(value) {
    if (!hasRequiredNumberProperty(value, 'width'))
        return false;
    if (!hasRequiredNumberProperty(value, 'height'))
        return false;
    if (!hasRequiredNumberProperty(value, 'minHeight'))
        return false;
    if (!hasRequiredNumberProperty(value, 'maxHeight'))
        return false;
    if (!hasRequiredBooleanProperty(value, 'autoHeight'))
        return false;
    const dimensions = value;
    // Validate dimension constraints
    const height = dimensions.height;
    const minHeight = dimensions.minHeight;
    const maxHeight = dimensions.maxHeight;
    if (height < minHeight || height > maxHeight)
        return false;
    if (minHeight < expandable_node_types_1.BLOCK_DIMENSION_CONSTANTS.MIN_HEIGHT)
        return false;
    if (maxHeight > expandable_node_types_1.BLOCK_DIMENSION_CONSTANTS.MAX_HEIGHT)
        return false;
    return true;
}
/**
 * Type guard for BlockMetadata
 */
function isBlockMetadata(value) {
    if (!hasRequiredObjectProperty(value, 'createdAt'))
        return false;
    if (!hasRequiredObjectProperty(value, 'lastModified'))
        return false;
    const metadata = value;
    // Validate dates
    if (!(metadata.createdAt instanceof Date))
        return false;
    if (!(metadata.lastModified instanceof Date))
        return false;
    return true;
}
/**
 * Type guard for BasicBlock
 */
function isBasicBlock(value) {
    if (!hasRequiredStringProperty(value, 'id'))
        return false;
    if (!hasRequiredStringProperty(value, 'type'))
        return false;
    if (!hasRequiredStringProperty(value, 'content'))
        return false;
    if (!hasRequiredObjectProperty(value, 'dimensions'))
        return false;
    if (!hasRequiredBooleanProperty(value, 'isMinimized'))
        return false;
    if (!hasRequiredObjectProperty(value, 'metadata'))
        return false;
    const block = value;
    // Validate branded types
    if (!isValidBlockId(block.id))
        return false;
    if (!validateBlockType(block.type))
        return false;
    // Validate nested objects
    if (!isBlockDimensions(block.dimensions))
        return false;
    if (!isBlockMetadata(block.metadata))
        return false;
    // Validate optional title
    if ('title' in block && typeof block.title !== 'string')
        return false;
    return true;
}
/**
 * Type guard for ExpandableNode
 */
function isExpandableNode(value) {
    if (!hasRequiredStringProperty(value, 'id'))
        return false;
    if (!hasRequiredStringProperty(value, 'title'))
        return false;
    if (!hasRequiredObjectProperty(value, 'dimensions'))
        return false;
    if (!hasRequiredObjectProperty(value, 'position'))
        return false;
    if (!hasRequiredArrayProperty(value, 'blocks'))
        return false;
    if (!hasRequiredBooleanProperty(value, 'isCollapsed'))
        return false;
    if (!hasRequiredBooleanProperty(value, 'isSelected'))
        return false;
    if (!hasRequiredObjectProperty(value, 'metadata'))
        return false;
    const node = value;
    // Validate branded types
    if (!isValidNodeId(node.id))
        return false;
    // Validate title length
    const title = node.title;
    if (title.length === 0 || title.length > 100)
        return false;
    // Validate nested objects
    if (!isNodeDimensions(node.dimensions))
        return false;
    if (!isNodePosition(node.position))
        return false;
    if (!isNodeMetadata(node.metadata))
        return false;
    // Validate blocks array
    const blocks = node.blocks;
    if (!blocks.every(isBasicBlock))
        return false;
    return true;
}
/**
 * Creates a default NodeDimensions object
 */
function createDefaultNodeDimensions() {
    return {
        width: expandable_node_types_1.NODE_DIMENSION_CONSTANTS.DEFAULT_WIDTH,
        height: expandable_node_types_1.NODE_DIMENSION_CONSTANTS.DEFAULT_HEIGHT,
        minWidth: expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MIN_WIDTH,
        maxWidth: expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MAX_WIDTH,
        minHeight: expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MIN_HEIGHT,
        maxHeight: expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MAX_HEIGHT
    };
}
/**
 * Creates a default BlockDimensions object
 */
function createDefaultBlockDimensions() {
    return {
        width: expandable_node_types_1.NODE_DIMENSION_CONSTANTS.DEFAULT_WIDTH - expandable_node_types_1.BLOCK_DIMENSION_CONSTANTS.PADDING_HORIZONTAL,
        height: expandable_node_types_1.BLOCK_DIMENSION_CONSTANTS.DEFAULT_HEIGHT,
        minHeight: expandable_node_types_1.BLOCK_DIMENSION_CONSTANTS.MIN_HEIGHT,
        maxHeight: expandable_node_types_1.BLOCK_DIMENSION_CONSTANTS.MAX_HEIGHT,
        autoHeight: true
    };
}
/**
 * Validates and clamps node dimensions
 */
function clampNodeDimensions(dimensions) {
    const result = {};
    if (dimensions.width !== undefined) {
        result.width = Math.max(expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MIN_WIDTH, Math.min(expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MAX_WIDTH, dimensions.width));
    }
    if (dimensions.height !== undefined) {
        result.height = Math.max(expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MIN_HEIGHT, Math.min(expandable_node_types_1.NODE_DIMENSION_CONSTANTS.MAX_HEIGHT, dimensions.height));
    }
    return result;
}
/**
 * Snaps a value to grid
 */
function snapToGrid(value, gridSize = expandable_node_types_1.NODE_DIMENSION_CONSTANTS.GRID_SIZE) {
    return Math.round(value / gridSize) * gridSize;
}
/**
 * Validates a NodeId format
 */
function isValidNodeId(value) {
    return /^node_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
}
/**
 * Validates a BlockId format
 */
function isValidBlockId(value) {
    return /^block_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
}
