/**
 * Service for handling node branching operations
 * Creates new branches when prompts/responses are edited
 * Following TypeScript standards from ts_readme.xml
 */

import { NodeId, BlockId } from '../types/branded.types';
import { GraphNode, NodeBlock, NodeBlockType } from '../types/graph.types';
import { 
  BranchMetadata, 
  BranchingResult, 
  ChangeContext, 
  BranchReason, 
  EditSource,
  ChangeType,
  shouldBlockTypeTriggerBranching
} from '../types/branching.types';
import { Logger } from '../utils/logger';
import { ValidationError, NodeEditorError } from '../types/errors';
import { isGraphNode } from '../utils/type-guards';

/**
 * Service for managing node branching operations
 */
export class NodeBranchingService {
  private readonly logger: Logger;
  private readonly nodes: Map<string, GraphNode>;
  private readonly branchHistory: Map<string, BranchMetadata[]>;
  private readonly correlationId: string;
  
  constructor(nodes: Map<string, GraphNode>) {
    this.logger = new Logger('NodeBranchingService');
    this.nodes = nodes;
    this.branchHistory = new Map();
    this.correlationId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    this.logger.logFunctionEntry('constructor', { nodesCount: nodes.size });
  }
  
  /**
   * Creates a new branch from an existing node when content is edited
   * @param nodeId - ID of the node being edited
   * @param blockId - ID of the block being edited
   * @param newContent - New content after edit
   * @param editSource - Source of the edit operation
   * @returns Promise resolving to branching result
   * @throws ValidationError if nodeId/blockId invalid or markdown block
   * @throws NodeEditorError if graph structure is corrupted
   * 
   * @example
   * const result = await branchingService.createBranchFromEdit(
   *   toNodeId('node-123'),
   *   toBlockId('block-456'),
   *   'Updated prompt text',
   *   EditSource.CHAT_INTERFACE
   * );
   */
  async createBranchFromEdit(
    nodeId: NodeId,
    blockId: BlockId,
    newContent: string,
    editSource: EditSource
  ): Promise<BranchingResult> {
    const startTime = performance.now();
    this.logger.logFunctionEntry('createBranchFromEdit', { 
      nodeId, 
      blockId, 
      contentLength: newContent.length,
      editSource 
    });
    
    
    try {
      // Validate inputs
      const originalNode = this.nodes.get(nodeId);
      if (!originalNode) {
        throw new ValidationError(
          'nodeId',
          nodeId,
          'existing node',
          { 
            functionName: 'createBranchFromEdit', 
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId
          }
        );
      }
      
      if (!isGraphNode(originalNode)) {
        throw new ValidationError(
          'node',
          originalNode,
          'valid GraphNode structure',
          { 
            functionName: 'createBranchFromEdit', 
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId
          }
        );
      }
      
      // Find the block being edited
      const blockIndex = originalNode.blocks.findIndex(b => b.id === blockId);
      if (blockIndex === -1) {
        throw new ValidationError(
          'blockId',
          blockId,
          'existing block in node',
          { 
            functionName: 'createBranchFromEdit', 
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId,
            parameters: { nodeId, blockId }
          }
        );
      }
      
      const editedBlock = originalNode.blocks[blockIndex];
      if (!editedBlock) {
        throw new NodeEditorError(
          'Block reference is undefined',
          'BLOCK_UNDEFINED',
          'Unable to find the block being edited',
          { 
            functionName: 'createBranchFromEdit', 
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId,
            parameters: { nodeId, blockId, blockIndex }
          },
          'high'
        );
      }
      
      // Check if branching should occur
      if (!this.shouldCreateBranch(editedBlock.type, editSource)) {
        this.logger.logBranch('createBranchFromEdit', 'markdown_block_skip', true, {
          blockType: editedBlock.type,
          editSource
        });
        
        throw new ValidationError(
          'blockType',
          editedBlock.type,
          'prompt or response block',
          { 
            functionName: 'createBranchFromEdit', 
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId,
            parameters: { nodeId, blockId }
          }
        );
      }
      
      // Determine branch reason based on block type
      const branchReason = editedBlock.type === 'prompt' 
        ? BranchReason.PROMPT_EDIT 
        : BranchReason.RESPONSE_EDIT;
      
      // Create change context
      const changeContext: ChangeContext = {
        changedBlockId: blockId,
        changeType: ChangeType.CONTENT_EDIT,
        editSummary: `Edited ${editedBlock.type} content`,
        previousContent: editedBlock.content,
        newContent
      };
      
      // Create the new branch
      let newNode = this.copyNodeWithoutChildren(nodeId);
      
      // Update the edited block in the new node - use the same index as the original
      if (blockIndex < newNode.blocks.length && newNode.blocks[blockIndex]) {
        newNode.blocks[blockIndex]!.content = newContent;
      }
      
      // The branch should be a sibling of the node being edited
      // It shares the same parent but is not directly connected to the parent
      
      // Set the branch as a sibling of the original node
      const branchNode: GraphNode = {
        ...newNode,
        parentId: originalNode.parentId,  // Same parent as the original node
        depth: originalNode.depth,  // Same depth level
        // Add a reference to the original node this was branched from
        branchedFrom: nodeId
      };
      
      // Add to the branching service's nodes map
      this.nodes.set(branchNode.id, branchNode);
      
      // Store the branch relationship (original node tracks its branches)
      if (!originalNode.branches) {
        originalNode.branches = [];
      }
      originalNode.branches.push(branchNode.id);
      
      this.logger.logBranch('createBranchFromEdit', 'branch_created_as_sibling', true, {
        originalNodeId: nodeId,
        branchNodeId: branchNode.id,
        parentId: branchNode.parentId,
        branchedFrom: nodeId
      });
      
      newNode = branchNode;
      
      // Create branch metadata
      const branchMetadata: BranchMetadata = {
        originalNodeId: nodeId,
        branchTimestamp: new Date(),
        changeContext,
        branchReason
      };
      
      // Record branch history
      this.recordBranchMetadata(newNode.id, branchMetadata);
      
      // Create result
      const result: BranchingResult = {
        newNodeId: newNode.id as NodeId,
        originalNodeId: nodeId,
        branchMetadata,
        success: true
      };
      
      const duration = performance.now() - startTime;
      this.logger.logPerformance('createBranchFromEdit', 'branch_creation', duration);
      this.logger.logFunctionExit('createBranchFromEdit', result);
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const result: BranchingResult = {
        newNodeId: '' as NodeId,
        originalNodeId: nodeId,
        branchMetadata: {
          originalNodeId: nodeId,
          branchTimestamp: new Date(),
          changeContext: {
            changedBlockId: blockId,
            changeType: ChangeType.CONTENT_EDIT,
            editSummary: 'Failed branch attempt',
            newContent
          },
          branchReason: BranchReason.MANUAL_BRANCH
        },
        success: false,
        errorMessage
      };
      
      this.logger.logError(error as Error, 'createBranchFromEdit', { nodeId, blockId });
      this.logger.logFunctionExit('createBranchFromEdit', result);
      
      throw error;
    }
  }
  
  /**
   * Get a node by ID from the branching service's nodes map
   * @param nodeId - ID of the node to retrieve
   * @returns The node if found, undefined otherwise
   */
  public getNode(nodeId: string): GraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Determines if an edit should trigger branching based on block type
   * @param blockType - Type of block being edited
   * @param editSource - Source of the edit
   * @returns true if branching should occur, false otherwise
   */
  shouldCreateBranch(blockType: NodeBlockType, editSource: EditSource): boolean {
    this.logger.logFunctionEntry('shouldCreateBranch', { blockType, editSource });
    
    const shouldBranch = shouldBlockTypeTriggerBranching(blockType);
    
    this.logger.logBranch('shouldCreateBranch', 
      shouldBranch ? 'should_branch' : 'should_not_branch',
      shouldBranch,
      { blockType, editSource }
    );
    
    this.logger.logFunctionExit('shouldCreateBranch', shouldBranch);
    return shouldBranch;
  }
  
  /**
   * Retrieves branch history for a node
   * @param nodeId - ID of the node
   * @returns Array of branch metadata, empty if no history
   */
  getBranchHistory(nodeId: NodeId): readonly BranchMetadata[] {
    this.logger.logFunctionEntry('getBranchHistory', { nodeId });
    
    const history = this.branchHistory.get(nodeId) || [];
    
    this.logger.logFunctionExit('getBranchHistory', { count: history.length });
    return Object.freeze([...history]);
  }
  
  /**
   * Creates a deep copy of a node without its children
   * @param sourceNodeId - ID of node to copy
   * @returns New GraphNode instance with all blocks copied
   * @throws ValidationError if node not found
   */
  copyNodeWithoutChildren(sourceNodeId: NodeId): GraphNode {
    this.logger.logFunctionEntry('copyNodeWithoutChildren', { sourceNodeId });
    
    const sourceNode = this.nodes.get(sourceNodeId);
    if (!sourceNode) {
      throw new ValidationError(
        'sourceNodeId',
        sourceNodeId,
        'existing node',
        { 
          functionName: 'copyNodeWithoutChildren',
          timestamp: new Date().toISOString(),
          correlationId: this.correlationId
        }
      );
    }
    
    // Generate new node ID
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const newNodeId = `node-${timestamp}-${randomSuffix}`;
    
    // Deep copy blocks
    const copiedBlocks: NodeBlock[] = sourceNode.blocks.map((block, index) => {
      const newBlockId = `block-${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
      return {
        ...block,
        id: newBlockId as BlockId,
        content: block.content, // Primitive string, no need for deep copy
        position: index // Ensure position is set
      };
    });
    
    // Create new node without children
    const newNode: GraphNode = {
      id: newNodeId,
      position: { ...sourceNode.position }, // Copy position
      blocks: copiedBlocks,
      children: [], // No children in the copy
      parentId: null, // Will be set by caller
      name: sourceNode.name ? `${sourceNode.name} (branch)` : '',
      depth: sourceNode.depth // Keep same depth as source
    };
    
    this.logger.logFunctionExit('copyNodeWithoutChildren', { 
      newNodeId,
      blockCount: copiedBlocks.length 
    });
    
    return newNode;
  }
  
  
  /**
   * Records branch metadata for version history
   * @param nodeId - ID of the new branch node
   * @param metadata - Branch metadata to record
   */
  private recordBranchMetadata(nodeId: string, metadata: BranchMetadata): void {
    this.logger.logFunctionEntry('recordBranchMetadata', { nodeId });
    
    const history = this.branchHistory.get(nodeId) || [];
    history.push(metadata);
    this.branchHistory.set(nodeId, history);
    
    // Also record for the original node to track all branches
    const originalHistory = this.branchHistory.get(metadata.originalNodeId) || [];
    originalHistory.push(metadata);
    this.branchHistory.set(metadata.originalNodeId, originalHistory);
    
    this.logger.logFunctionExit('recordBranchMetadata', undefined);
  }
}