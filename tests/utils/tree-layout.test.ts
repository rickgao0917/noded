/**
 * Comprehensive test suite for tree layout utility
 * 
 * Tests the tree positioning algorithm with 100% coverage as required
 * by ts_readme.xml for utility functions. Includes edge cases and
 * boundary testing for all layout scenarios.
 */

import { calculateTreeLayout } from '../../src/utils/tree-layout';
import { GraphNode, TreeLayout, Position } from '../../src/types/graph.types';
import { createMockNode } from '../setup';

describe('Tree Layout Utility Functions', () => {
  const defaultLayout: TreeLayout = {
    nodeWidth: 300,
    nodeHeight: 200,
    horizontalSpacing: 200,
    verticalSpacing: 300,
  };

  describe('calculateTreeLayout', () => {
    it('should position single root node at origin', () => {
      const root = createMockNode('root');
      const nodes = new Map([['root', root]]);
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      // Single node is centered in its available space (nodeWidth/2)
      expect(result.get('root')!.position.x).toBe(150); // nodeWidth (300) / 2
      expect(result.get('root')!.position.y).toBe(0);
    });

    it('should position multiple root nodes horizontally', () => {
      const root1 = createMockNode('root1');
      const root2 = createMockNode('root2');
      const nodes = new Map([
        ['root1', root1],
        ['root2', root2],
      ]);
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      const node1 = result.get('root1')!;
      const node2 = result.get('root2')!;
      
      expect(node1.position.y).toBe(0);
      expect(node2.position.y).toBe(0);
      expect(Math.abs(node1.position.x - node2.position.x)).toBeGreaterThan(0);
    });

    it('should position child nodes below parent', () => {
      const root = createMockNode('root');
      const child = createMockNode('child', { parentId: 'root', depth: 1 });
      root.children = ['child'];
      
      const nodes = new Map([
        ['root', root],
        ['child', child],
      ]);
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      const rootNode = result.get('root')!;
      const childNode = result.get('child')!;
      
      expect(childNode.position.y).toBe(rootNode.position.y + defaultLayout.verticalSpacing);
    });

    it('should space sibling nodes horizontally', () => {
      const root = createMockNode('root');
      const child1 = createMockNode('child1', { parentId: 'root', depth: 1 });
      const child2 = createMockNode('child2', { parentId: 'root', depth: 1 });
      root.children = ['child1', 'child2'];
      
      const nodes = new Map([
        ['root', root],
        ['child1', child1],
        ['child2', child2],
      ]);
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      const child1Node = result.get('child1')!;
      const child2Node = result.get('child2')!;
      
      expect(child1Node.position.y).toBe(child2Node.position.y);
      expect(Math.abs(child1Node.position.x - child2Node.position.x)).toBeGreaterThanOrEqual(
        defaultLayout.nodeWidth + defaultLayout.horizontalSpacing
      );
    });

    it('should handle complex tree with multiple levels', () => {
      const root = createMockNode('root');
      const child1 = createMockNode('child1', { parentId: 'root', depth: 1 });
      const child2 = createMockNode('child2', { parentId: 'root', depth: 1 });
      const grandchild1 = createMockNode('grandchild1', { parentId: 'child1', depth: 2 });
      const grandchild2 = createMockNode('grandchild2', { parentId: 'child1', depth: 2 });
      const grandchild3 = createMockNode('grandchild3', { parentId: 'child2', depth: 2 });
      
      root.children = ['child1', 'child2'];
      child1.children = ['grandchild1', 'grandchild2'];
      child2.children = ['grandchild3'];
      
      const nodes = new Map([
        ['root', root],
        ['child1', child1],
        ['child2', child2],
        ['grandchild1', grandchild1],
        ['grandchild2', grandchild2],
        ['grandchild3', grandchild3],
      ]);
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      // Verify all nodes are positioned
      expect(result.size).toBe(6);
      
      // Verify depth-based vertical positioning
      const rootNode = result.get('root')!;
      const child1Node = result.get('child1')!;
      const grandchild1Node = result.get('grandchild1')!;
      
      expect(child1Node.position.y).toBe(rootNode.position.y + defaultLayout.verticalSpacing);
      expect(grandchild1Node.position.y).toBe(child1Node.position.y + defaultLayout.verticalSpacing);
    });

    it('should center parent nodes over their children subtrees', () => {
      const root = createMockNode('root');
      const child1 = createMockNode('child1', { parentId: 'root', depth: 1 });
      const child2 = createMockNode('child2', { parentId: 'root', depth: 1 });
      const child3 = createMockNode('child3', { parentId: 'root', depth: 1 });
      
      root.children = ['child1', 'child2', 'child3'];
      
      const nodes = new Map([
        ['root', root],
        ['child1', child1],
        ['child2', child2],
        ['child3', child3],
      ]);
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      const rootNode = result.get('root')!;
      const child1Node = result.get('child1')!;
      const child3Node = result.get('child3')!;
      
      // Root should be centered between first and last child
      const expectedRootX = (child1Node.position.x + child3Node.position.x) / 2;
      expect(Math.abs(rootNode.position.x - expectedRootX)).toBeLessThan(1);
    });

    it('should handle empty nodes map', () => {
      const nodes = new Map<string, GraphNode>();
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      expect(result.size).toBe(0);
    });

    it('should handle single-child chains', () => {
      const root = createMockNode('root');
      const child = createMockNode('child', { parentId: 'root', depth: 1 });
      const grandchild = createMockNode('grandchild', { parentId: 'child', depth: 2 });
      const greatGrandchild = createMockNode('greatGrandchild', { parentId: 'grandchild', depth: 3 });
      
      root.children = ['child'];
      child.children = ['grandchild'];
      grandchild.children = ['greatGrandchild'];
      
      const nodes = new Map([
        ['root', root],
        ['child', child],
        ['grandchild', grandchild],
        ['greatGrandchild', greatGrandchild],
      ]);
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      // All nodes should be vertically aligned in a single column
      const rootNode = result.get('root')!;
      const childNode = result.get('child')!;
      const grandchildNode = result.get('grandchild')!;
      const greatGrandchildNode = result.get('greatGrandchild')!;
      
      expect(rootNode.position.x).toBe(childNode.position.x);
      expect(childNode.position.x).toBe(grandchildNode.position.x);
      expect(grandchildNode.position.x).toBe(greatGrandchildNode.position.x);
      
      // Verify vertical spacing
      expect(childNode.position.y).toBe(rootNode.position.y + defaultLayout.verticalSpacing);
      expect(grandchildNode.position.y).toBe(childNode.position.y + defaultLayout.verticalSpacing);
      expect(greatGrandchildNode.position.y).toBe(grandchildNode.position.y + defaultLayout.verticalSpacing);
    });

    it('should handle asymmetric trees', () => {
      const root = createMockNode('root');
      const child1 = createMockNode('child1', { parentId: 'root', depth: 1 });
      const child2 = createMockNode('child2', { parentId: 'root', depth: 1 });
      const grandchild1 = createMockNode('grandchild1', { parentId: 'child1', depth: 2 });
      const grandchild2 = createMockNode('grandchild2', { parentId: 'child1', depth: 2 });
      const grandchild3 = createMockNode('grandchild3', { parentId: 'child1', depth: 2 });
      // child2 has no children
      
      root.children = ['child1', 'child2'];
      child1.children = ['grandchild1', 'grandchild2', 'grandchild3'];
      
      const nodes = new Map([
        ['root', root],
        ['child1', child1],
        ['child2', child2],
        ['grandchild1', grandchild1],
        ['grandchild2', grandchild2],
        ['grandchild3', grandchild3],
      ]);
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      const child1Node = result.get('child1')!;
      const child2Node = result.get('child2')!;
      const grandchild1Node = result.get('grandchild1')!;
      const grandchild3Node = result.get('grandchild3')!;
      
      // child1 should be centered over its children
      const expectedChild1X = (grandchild1Node.position.x + grandchild3Node.position.x) / 2;
      expect(Math.abs(child1Node.position.x - expectedChild1X)).toBeLessThan(1);
      
      // child2 should be positioned relative to child1
      expect(child2Node.position.x).not.toBe(child1Node.position.x);
    });

    it('should respect custom layout configuration', () => {
      const customLayout: TreeLayout = {
        nodeWidth: 400,
        nodeHeight: 150,
        horizontalSpacing: 100,
        verticalSpacing: 250,
      };
      
      const root = createMockNode('root');
      const child = createMockNode('child', { parentId: 'root', depth: 1 });
      root.children = ['child'];
      
      const nodes = new Map([
        ['root', root],
        ['child', child],
      ]);
      
      const result = calculateTreeLayout(nodes, customLayout);
      
      const rootNode = result.get('root')!;
      const childNode = result.get('child')!;
      
      expect(childNode.position.y).toBe(rootNode.position.y + customLayout.verticalSpacing);
    });

    it('should handle wide trees with many siblings', () => {
      const root = createMockNode('root');
      const children: GraphNode[] = [];
      const childIds: string[] = [];
      
      // Create 10 children
      for (let i = 0; i < 10; i++) {
        const childId = `child${i}`;
        const child = createMockNode(childId, { parentId: 'root', depth: 1 });
        children.push(child);
        childIds.push(childId);
      }
      
      root.children = childIds;
      
      const nodes = new Map([
        ['root', root],
        ...children.map(child => [child.id, child] as [string, GraphNode]),
      ]);
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      // Verify all children are positioned at the same depth
      const child0 = result.get('child0')!;
      const child9 = result.get('child9')!;
      
      expect(child0.position.y).toBe(child9.position.y);
      
      // Verify horizontal spacing
      const totalWidth = child9.position.x - child0.position.x;
      expect(totalWidth).toBeGreaterThan(0);
      
      // Root should be centered
      const rootNode = result.get('root')!;
      const expectedRootX = (child0.position.x + child9.position.x) / 2;
      expect(Math.abs(rootNode.position.x - expectedRootX)).toBeLessThan(1);
    });

    it('should preserve node IDs and other properties', () => {
      const root = createMockNode('root', { name: 'Root Node' });
      const child = createMockNode('child', { 
        parentId: 'root', 
        depth: 1,
        name: 'Child Node',
        blocks: [{ id: 'block1', type: 'chat', content: 'Test', position: 0 }]
      });
      
      root.children = ['child'];
      
      const nodes = new Map([
        ['root', root],
        ['child', child],
      ]);
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      const resultRoot = result.get('root')!;
      const resultChild = result.get('child')!;
      
      // Verify all properties are preserved except position
      expect(resultRoot.id).toBe('root');
      expect(resultRoot.name).toBe('Root Node');
      expect(resultRoot.parentId).toBe(null);
      expect(resultRoot.children).toEqual(['child']);
      expect(resultRoot.depth).toBe(0);
      
      expect(resultChild.id).toBe('child');
      expect(resultChild.name).toBe('Child Node');
      expect(resultChild.parentId).toBe('root');
      expect(resultChild.blocks).toHaveLength(1);
      expect(resultChild.depth).toBe(1);
      
      // Only position should be different
      expect(resultRoot.position).not.toEqual(root.position);
      expect(resultChild.position).not.toEqual(child.position);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle nodes with invalid parent references gracefully', () => {
      const orphan = createMockNode('orphan', { parentId: 'non-existent', depth: 1 });
      const nodes = new Map([['orphan', orphan]]);
      
      // Should treat orphan as a root node
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      const orphanNode = result.get('orphan')!;
      expect(orphanNode.position.y).toBe(0); // Positioned as root
    });

    it('should handle circular references gracefully', () => {
      const node1 = createMockNode('node1', { parentId: 'node2', depth: 1 });
      const node2 = createMockNode('node2', { parentId: 'node1', depth: 1 });
      
      // This creates a circular reference which shouldn't happen in valid trees
      // but the layout algorithm should handle it gracefully
      node1.children = ['node2'];
      node2.children = ['node1'];
      
      const nodes = new Map([
        ['node1', node1],
        ['node2', node2],
      ]);
      
      expect(() => {
        calculateTreeLayout(nodes, defaultLayout);
      }).not.toThrow();
    });

    it('should handle extreme layout values', () => {
      const extremeLayout: TreeLayout = {
        nodeWidth: 1,
        nodeHeight: 1,
        horizontalSpacing: 0,
        verticalSpacing: 0,
      };
      
      const root = createMockNode('root');
      const child = createMockNode('child', { parentId: 'root', depth: 1 });
      root.children = ['child'];
      
      const nodes = new Map([
        ['root', root],
        ['child', child],
      ]);
      
      expect(() => {
        calculateTreeLayout(nodes, extremeLayout);
      }).not.toThrow();
    });

    it('should handle very large trees efficiently', () => {
      const startTime = Date.now();
      
      // Create a tree with 100 nodes
      const nodes = new Map<string, GraphNode>();
      const root = createMockNode('root');
      nodes.set('root', root);
      
      const childIds: string[] = [];
      for (let i = 0; i < 99; i++) {
        const childId = `child${i}`;
        const child = createMockNode(childId, { parentId: 'root', depth: 1 });
        nodes.set(childId, child);
        childIds.push(childId);
      }
      
      root.children = childIds;
      
      const result = calculateTreeLayout(nodes, defaultLayout);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      expect(result.size).toBe(100);
      expect(executionTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});