/**
 * Tree layout calculation utilities
 *
 * Provides algorithms for positioning nodes in a tree structure with even spacing
 * and proper depth-based vertical alignment.
 */
// Types are defined in graph.types.ts
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
export function calculateTreeLayout(nodes, layout) {
    if (nodes.size === 0) {
        return new Map();
    }
    const result = new Map(nodes);
    const nodeArray = Array.from(nodes.values());
    const childrenMap = new Map();
    const branchMap = new Map();
    // Build children map and branch map
    for (const node of nodeArray) {
        if (node.parentId && !node.branchedFrom) {
            // Regular child node (not a branch)
            const siblings = childrenMap.get(node.parentId) || [];
            childrenMap.set(node.parentId, [...siblings, node]);
        }
        if (node.branchedFrom) {
            // This is a branch node
            const branches = branchMap.get(node.branchedFrom) || [];
            branchMap.set(node.branchedFrom, [...branches, node]);
        }
    }
    const rootNodes = nodeArray.filter(node => node.parentId === null);
    let rootOffset = 0;
    for (const rootNode of rootNodes) {
        const subtreeWidth = calculateSubtreeWidth(rootNode, childrenMap, branchMap, layout);
        const rootX = rootOffset + subtreeWidth / 2;
        layoutSubtree(rootNode, childrenMap, branchMap, layout, rootX, 0, result);
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
function calculateSubtreeWidth(node, childrenMap, branchMap, layout) {
    const children = childrenMap.get(node.id) || [];
    const branches = branchMap.get(node.id) || [];
    // Calculate width needed for branches (they extend to the right)
    const branchWidth = branches.length > 0
        ? (branches.length * (layout.nodeWidth + layout.horizontalSpacing))
        : 0;
    // Calculate width for children
    if (children.length === 0) {
        return layout.nodeWidth + branchWidth;
    }
    const childrenWidth = children.reduce((total, child) => {
        return total + calculateSubtreeWidth(child, childrenMap, branchMap, layout);
    }, 0);
    const spacingWidth = (children.length - 1) * layout.horizontalSpacing;
    // The total width is the max of the node's own width (including branches) and its children's width
    return Math.max(layout.nodeWidth + branchWidth, childrenWidth + spacingWidth);
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
function layoutSubtree(node, childrenMap, branchMap, layout, centerX, depth, result) {
    const y = depth * layout.verticalSpacing;
    // Update the node's position
    const updatedNode = Object.assign(Object.assign({}, node), { position: { x: centerX, y } });
    result.set(node.id, updatedNode);
    // Position branches to the right of the node
    const branches = branchMap.get(node.id) || [];
    for (let i = 0; i < branches.length; i++) {
        const branch = branches[i];
        if (branch) {
            const branchX = centerX + layout.nodeWidth + (i + 1) * (layout.nodeWidth + layout.horizontalSpacing);
            layoutSubtree(branch, childrenMap, branchMap, layout, branchX, depth, // Same depth as original node
            result);
        }
    }
    const children = childrenMap.get(node.id) || [];
    if (children.length === 0) {
        return;
    }
    const childWidths = children.map(child => calculateSubtreeWidth(child, childrenMap, branchMap, layout));
    const totalChildWidth = childWidths.reduce((sum, width) => sum + width, 0);
    const totalSpacing = (children.length - 1) * layout.horizontalSpacing;
    const totalWidth = totalChildWidth + totalSpacing;
    let currentX = centerX - totalWidth / 2;
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childWidth = childWidths[i];
        if (child && childWidth !== undefined) {
            const childCenterX = currentX + childWidth / 2;
            layoutSubtree(child, childrenMap, branchMap, layout, childCenterX, depth + 1, result);
            currentX += childWidth + layout.horizontalSpacing;
        }
    }
}
