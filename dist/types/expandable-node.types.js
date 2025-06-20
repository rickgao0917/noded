/**
 * Type definitions for expandable node system
 * Provides core interfaces and types for nodes with dynamic dimensions and blocks
 */
/**
 * Constants for dimension limits
 */
export const NODE_DIMENSION_CONSTANTS = {
    MIN_WIDTH: 100,
    MAX_WIDTH: 1200,
    DEFAULT_WIDTH: 400,
    MIN_HEIGHT: 100,
    MAX_HEIGHT: 1200,
    DEFAULT_HEIGHT: 400,
    RESIZE_INCREMENT: 20,
    GRID_SIZE: 20,
    THROTTLE_MS: 16
};
export const BLOCK_DIMENSION_CONSTANTS = {
    MIN_HEIGHT: 60,
    MAX_HEIGHT: 400,
    DEFAULT_HEIGHT: 100,
    PADDING_HORIZONTAL: 32,
    PADDING_VERTICAL: 16,
    BASE_FONT_SIZE: 14,
    LINE_HEIGHT_RATIO: 1.5
};
