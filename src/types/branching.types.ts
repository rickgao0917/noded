/**
 * Type definitions for node branching feature
 * Following TypeScript standards from ts_readme.xml
 */

import { NodeId, BlockId } from './branded.types';
import { NodeBlockType } from './graph.types';

/**
 * Branded types for branching feature
 */
export type BranchId = string & { __brand: 'BranchId' };
export type VersionId = string & { __brand: 'VersionId' };

/**
 * Factory functions for branded types
 */
export const toBranchId = (id: string): BranchId => id as BranchId;
export const toVersionId = (id: string): VersionId => id as VersionId;

/**
 * Types of changes that can trigger branching
 */
export enum ChangeType {
  CONTENT_EDIT = 'CONTENT_EDIT',
  BLOCK_ADDITION = 'BLOCK_ADDITION',
  BLOCK_DELETION = 'BLOCK_DELETION'
}

/**
 * Reasons for creating a branch
 */
export enum BranchReason {
  PROMPT_EDIT = 'PROMPT_EDIT',
  RESPONSE_EDIT = 'RESPONSE_EDIT',
  MANUAL_BRANCH = 'MANUAL_BRANCH'
}

/**
 * Source of edit operation
 */
export enum EditSource {
  NODE_BLOCK_DIRECT = 'NODE_BLOCK_DIRECT',
  CHAT_INTERFACE = 'CHAT_INTERFACE',
  PROGRAMMATIC = 'PROGRAMMATIC'
}

/**
 * Context information about the change that triggered branching
 */
export interface ChangeContext {
  readonly changedBlockId: BlockId;
  readonly changeType: ChangeType;
  readonly editSummary: string;
  readonly previousContent?: string;
  readonly newContent: string;
}

/**
 * Metadata about a branch operation
 */
export interface BranchMetadata {
  readonly originalNodeId: NodeId;
  readonly branchTimestamp: Date;
  readonly changeContext: ChangeContext;
  readonly branchReason: BranchReason;
}

/**
 * Result of a branching operation
 */
export interface BranchingResult {
  readonly newNodeId: NodeId;
  readonly originalNodeId: NodeId;
  readonly branchMetadata: BranchMetadata;
  readonly success: boolean;
  readonly errorMessage?: string;
}

/**
 * Configuration for branching behavior
 */
export interface BranchingConfig {
  readonly maxBranchDepth: number;
  readonly enableVersionHistory: boolean;
  readonly preserveBlockSizes: boolean;
}

/**
 * Size constraints for block preservation
 */
export interface SizeConstraints {
  readonly width: number;
  readonly height: number;
  readonly minHeight: number;
  readonly maxHeight: number;
}

/**
 * Type guard to check if a block type should trigger branching
 */
export function shouldBlockTypeTriggerBranching(blockType: NodeBlockType): boolean {
  return blockType === 'prompt' || blockType === 'response';
}

/**
 * Type guard for BranchMetadata
 */
export function isBranchMetadata(value: unknown): value is BranchMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const metadata = value as Record<string, unknown>;
  
  return (
    typeof metadata.originalNodeId === 'string' &&
    metadata.branchTimestamp instanceof Date &&
    typeof metadata.changeContext === 'object' &&
    metadata.changeContext !== null &&
    Object.values(BranchReason).includes(metadata.branchReason as BranchReason)
  );
}

/**
 * Type guard for BranchingResult
 */
export function isBranchingResult(value: unknown): value is BranchingResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  
  const result = value as Record<string, unknown>;
  
  return (
    typeof result.newNodeId === 'string' &&
    typeof result.originalNodeId === 'string' &&
    isBranchMetadata(result.branchMetadata) &&
    typeof result.success === 'boolean' &&
    (result.errorMessage === undefined || typeof result.errorMessage === 'string')
  );
}