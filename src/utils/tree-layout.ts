/**
 * Tree layout calculation utilities
 * 
 * Provides algorithms for positioning nodes in a tree structure with even spacing
 * and proper depth-based vertical alignment.
 */

import { GraphNode, Position, TreeLayout } from '../types/graph.types.js';

/**
 * Internal representation of a node with its children for layout calculation
 * 
 * @internal
 */
interface NodeWithChildren {
  readonly node: GraphNode;
  readonly children: readonly NodeWithChildren[];
}

/**
 * Result of layout calculation for a single node
 * 
 * @public
 */
interface LayoutResult {
  readonly nodeId: string;
  readonly position: Position;
}

/**
 * Calculate optimal positions for all nodes in a tree structure
 * 
 * Positions nodes so that:
 * - Nodes at the same depth are at the same vertical level
 * - Child nodes are evenly distributed under their parent
 * - No overlapping occurs between node subtrees
 * 
 * @param nodes - Map of all nodes to be positioned
 * @param layout - Layout configuration specifying node dimensions and spacing
 * @returns Map of nodes with updated positions
 * 
 * @example
 * ```typescript
 * const positions = calculateTreeLayout(nodes, {
 *   nodeWidth: 200,
 *   nodeHeight: 150,
 *   horizontalSpacing: 50,
 *   verticalSpacing: 100
 * });
 * ```
 * 
 * @public
 */
export function calculateTreeLayout(
  nodes: Map<string, GraphNode>,
  layout: TreeLayout
): Map<string, GraphNode> {
  if (nodes.size === 0) {
    return new Map();
  }

  const result = new Map(nodes);
  const nodeArray = Array.from(nodes.values());
  const childrenMap = new Map<string, GraphNode[]>();
  
  // Build children map
  for (const node of nodeArray) {
    if (node.parentId) {
      const siblings = childrenMap.get(node.parentId) || [];
      childrenMap.set(node.parentId, [...siblings, node]);
    }
  }
  
  const rootNodes = nodeArray.filter(node => node.parentId === null);
  let rootOffset = 0;
  
  for (const rootNode of rootNodes) {
    const subtreeWidth = calculateSubtreeWidth(rootNode, childrenMap, layout);
    const rootX = rootOffset + subtreeWidth / 2;
    
    layoutSubtree(
      rootNode,
      childrenMap,
      layout,
      rootX,
      0,
      result
    );
    
    rootOffset += subtreeWidth + layout.horizontalSpacing;
  }
  
  return result;
}

/**
 * Calculate the total width required for a node's subtree
 * 
 * @param node - Root node of the subtree
 * @param childrenMap - Map of node IDs to their children
 * @param layout - Layout configuration
 * @returns Total width required for the subtree including spacing
 * 
 * @internal
 */
function calculateSubtreeWidth(
  node: GraphNode,
  childrenMap: Map<string, GraphNode[]>,
  layout: TreeLayout
): number {
  const children = childrenMap.get(node.id) || [];
  
  if (children.length === 0) {
    return layout.nodeWidth;
  }
  
  const childrenWidth = children.reduce((total, child) => {
    return total + calculateSubtreeWidth(child, childrenMap, layout);
  }, 0);
  
  const spacingWidth = (children.length - 1) * layout.horizontalSpacing;
  
  return Math.max(layout.nodeWidth, childrenWidth + spacingWidth);
}

/**
 * Recursively position nodes in a subtree
 * 
 * @param node - Root node of the subtree to position
 * @param childrenMap - Map of node IDs to their children
 * @param layout - Layout configuration
 * @param centerX - Horizontal center position for the root node
 * @param depth - Current depth level (0 = root)
 * @param result - Map to update with new positions
 * 
 * @internal
 */
function layoutSubtree(
  node: GraphNode,
  childrenMap: Map<string, GraphNode[]>,
  layout: TreeLayout,
  centerX: number,
  depth: number,
  result: Map<string, GraphNode>
): void {
  const y = depth * layout.verticalSpacing;
  
  // Update the node's position
  const updatedNode: GraphNode = {
    ...node,
    position: { x: centerX, y }
  };
  result.set(node.id, updatedNode);
  
  const children = childrenMap.get(node.id) || [];
  
  if (children.length === 0) {
    return;
  }
  
  const childWidths = children.map(child => 
    calculateSubtreeWidth(child, childrenMap, layout)
  );
  
  const totalChildWidth = childWidths.reduce((sum, width) => sum + width, 0);
  const totalSpacing = (children.length - 1) * layout.horizontalSpacing;
  const totalWidth = totalChildWidth + totalSpacing;
  
  let currentX = centerX - totalWidth / 2;
  
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const childWidth = childWidths[i];
    
    if (child && childWidth !== undefined) {
      const childCenterX = currentX + childWidth / 2;
      
      layoutSubtree(
        child,
        childrenMap,
        layout,
        childCenterX,
        depth + 1,
        result
      );
      
      currentX += childWidth + layout.horizontalSpacing;
    }
  }
}
