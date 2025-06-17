export class NodeEditor {
    constructor(canvas, canvasContent, connectionsEl) {
        this.nodes = new Map();
        this.selectedNode = null;
        this.nodeCounter = 0;
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.isDragging = false;
        this.lastPanX = 0;
        this.lastPanY = 0;
        this.canvas = canvas;
        this.canvasContent = canvasContent;
        this.connectionsEl = connectionsEl;
        this.setupEventListeners();
        this.createSampleData();
    }
    setupEventListeners() {
        // Canvas panning
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.target === this.canvas || e.target === this.canvasContent) {
                this.isPanning = true;
                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;
            }
        });
        document.addEventListener('mousemove', (e) => {
            if (this.isPanning && !this.isDragging) {
                const deltaX = e.clientX - this.lastPanX;
                const deltaY = e.clientY - this.lastPanY;
                this.panX += deltaX;
                this.panY += deltaY;
                this.updateCanvasTransform();
                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;
            }
        });
        document.addEventListener('mouseup', () => {
            this.isPanning = false;
            this.isDragging = false;
        });
    }
    updateCanvasTransform() {
        this.canvasContent.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
    createSampleData() {
        // Create root node with prompt, response, and markdown blocks
        const root = this.createNode(null, [
            { id: 'root_prompt', type: 'prompt', content: 'What is the capital of France?', position: 0 },
            { id: 'root_response', type: 'response', content: 'The capital of France is Paris, a major European city and global center for art, fashion, gastronomy, and culture.', position: 1 },
            { id: 'root_markdown', type: 'markdown', content: '# Additional Information\\n\\nParis is located in northern France, on the banks of the Seine River.', position: 2 }
        ]);
        this.positionNode(root, 400, 100);
        // Create child nodes representing edits/variations
        const child1 = this.createNode(root.id, [
            { id: 'child1_prompt', type: 'prompt', content: 'Tell me more about the history of Paris.', position: 0 },
            { id: 'child1_response', type: 'response', content: 'Paris has a rich history dating back over 2,000 years. Originally a Celtic settlement called Lutetia, it became the capital of France in the 12th century.', position: 1 }
        ]);
        const child2 = this.createNode(root.id, [
            { id: 'child2_prompt', type: 'prompt', content: 'What are the main attractions in Paris?', position: 0 },
            { id: 'child2_response', type: 'response', content: 'Major attractions include the Eiffel Tower, Louvre Museum, Notre-Dame Cathedral, Arc de Triomphe, and Champs-Élysées.', position: 1 }
        ]);
        // Create grandchild nodes
        const grandchild1 = this.createNode(child1.id, [
            { id: 'gc1_prompt', type: 'prompt', content: 'What role did Paris play in the French Revolution?', position: 0 },
            { id: 'gc1_response', type: 'response', content: 'Paris was the epicenter of the French Revolution (1789-1799). Key events like the storming of the Bastille took place here.', position: 1 },
            { id: 'gc1_markdown', type: 'markdown', content: '## Key Revolutionary Sites\\n\\n- **Bastille**: Prison stormed on July 14, 1789\\n- **Place de la Révolution**: Site of many executions\\n- **Tuileries Palace**: Royal residence during the revolution', position: 2 }
        ]);
        const grandchild2 = this.createNode(child1.id, [
            { id: 'gc2_prompt', type: 'prompt', content: 'How did Paris develop during the Medieval period?', position: 0 },
            { id: 'gc2_response', type: 'response', content: 'During the Medieval period, Paris grew from a small island settlement to become the largest city in Europe by 1300, with impressive Gothic architecture.', position: 1 }
        ]);
        this.layoutTree();
    }
    createNode(parentId = null, blocks = []) {
        var _a, _b;
        const nodeId = `node_${++this.nodeCounter}`;
        const node = {
            id: nodeId,
            parentId,
            children: [],
            position: { x: 0, y: 0 },
            depth: parentId ? ((_b = (_a = this.nodes.get(parentId)) === null || _a === void 0 ? void 0 : _a.depth) !== null && _b !== void 0 ? _b : 0) + 1 : 0,
            blocks: blocks.length > 0 ? blocks : [
                { id: `${nodeId}_prompt`, type: 'prompt', content: 'Enter your prompt here...', position: 0 },
                { id: `${nodeId}_response`, type: 'response', content: 'Response will appear here...', position: 1 }
            ]
        };
        this.nodes.set(nodeId, node);
        if (parentId) {
            const parent = this.nodes.get(parentId);
            if (parent) {
                parent.children.push(nodeId);
            }
        }
        this.renderNode(node);
        return node;
    }
    renderNode(node) {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'node';
        nodeEl.id = node.id;
        nodeEl.style.left = node.position.x + 'px';
        nodeEl.style.top = node.position.y + 'px';
        nodeEl.innerHTML = `
      <div class="node-header">
        <span class="node-id">${node.id} (depth: ${node.depth})</span>
        <div class="node-actions">
          <button class="btn add" data-action="addChild" data-node-id="${node.id}">Add Child</button>
          <button class="btn delete" data-action="deleteNode" data-node-id="${node.id}">Delete</button>
        </div>
      </div>
      <div class="node-blocks">
        ${node.blocks.map((block, index) => this.renderBlock(block, node.id, index)).join('')}
      </div>
    `;
        // Add event listeners
        nodeEl.addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('btn')) {
                const action = target.getAttribute('data-action');
                const nodeId = target.getAttribute('data-node-id');
                if (action === 'addChild' && nodeId) {
                    this.addChild(nodeId);
                }
                else if (action === 'deleteNode' && nodeId) {
                    this.deleteNode(nodeId);
                }
            }
        });
        this.setupNodeDragging(nodeEl, node);
        this.canvasContent.appendChild(nodeEl);
    }
    renderBlock(block, nodeId, blockIndex) {
        return `
      <div class="block ${block.type}-block">
        <div class="block-header">
          ${block.type}
          <button class="btn" data-action="addMarkdown" data-node-id="${nodeId}">+ MD</button>
        </div>
        <div class="block-content">
          <textarea 
            placeholder="Enter ${block.type} content..."
            data-node-id="${nodeId}"
            data-block-index="${blockIndex}"
          >${block.content}</textarea>
        </div>
      </div>
    `;
    }
    setupNodeDragging(nodeEl, node) {
        let isDragging = false;
        let startX, startY, startNodeX, startNodeY;
        nodeEl.addEventListener('mousedown', (e) => {
            const target = e.target;
            if (target.closest('.btn') || target.closest('textarea'))
                return;
            isDragging = true;
            this.isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startNodeX = node.position.x;
            startNodeY = node.position.y;
            this.selectNode(node);
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging)
                return;
            const deltaX = (e.clientX - startX) / this.scale;
            const deltaY = (e.clientY - startY) / this.scale;
            node.position.x = startNodeX + deltaX;
            node.position.y = startNodeY + deltaY;
            this.positionNode(node, node.position.x, node.position.y);
            this.updateConnections();
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            this.isDragging = false;
        });
    }
    positionNode(node, x, y) {
        node.position.x = x;
        node.position.y = y;
        const nodeEl = document.getElementById(node.id);
        if (nodeEl) {
            nodeEl.style.left = x + 'px';
            nodeEl.style.top = y + 'px';
        }
    }
    selectNode(node) {
        // Remove previous selection
        if (this.selectedNode) {
            const prevEl = document.getElementById(this.selectedNode.id);
            if (prevEl)
                prevEl.classList.remove('selected');
        }
        this.selectedNode = node;
        const nodeEl = document.getElementById(node.id);
        if (nodeEl)
            nodeEl.classList.add('selected');
    }
    addChild(parentId) {
        const parent = this.nodes.get(parentId);
        if (!parent)
            return;
        const child = this.createNode(parentId, [
            { id: `${parentId}_child_prompt_${Date.now()}`, type: 'prompt', content: 'New prompt - edit this content...', position: 0 },
            { id: `${parentId}_child_response_${Date.now()}`, type: 'response', content: 'New response - this represents an edit or variation of the parent node...', position: 1 }
        ]);
        this.layoutTree();
        this.updateConnections();
    }
    addMarkdownBlock(nodeId) {
        const node = this.nodes.get(nodeId);
        if (node) {
            const newBlock = {
                id: `${nodeId}_markdown_${Date.now()}`,
                type: 'markdown',
                content: '# New markdown block\\n\\nAdd your content here...',
                position: node.blocks.length
            };
            node.blocks.push(newBlock);
            this.rerenderNode(node);
        }
    }
    updateBlockContent(nodeId, blockIndex, content) {
        const node = this.nodes.get(nodeId);
        if (node && node.blocks[blockIndex]) {
            node.blocks[blockIndex].content = content;
        }
    }
    deleteNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node)
            return;
        // Don't delete if it has children
        if (node.children.length > 0) {
            alert('Cannot delete node with children. Delete children first.');
            return;
        }
        // Remove from parent's children list
        if (node.parentId) {
            const parent = this.nodes.get(node.parentId);
            if (parent) {
                parent.children = parent.children.filter(id => id !== nodeId);
            }
        }
        // Remove from DOM and nodes map
        const nodeEl = document.getElementById(nodeId);
        if (nodeEl)
            nodeEl.remove();
        this.nodes.delete(nodeId);
        this.updateConnections();
    }
    rerenderNode(node) {
        const nodeEl = document.getElementById(node.id);
        if (nodeEl) {
            nodeEl.remove();
            this.renderNode(node);
            this.updateConnections();
        }
    }
    layoutTree() {
        // Get all root nodes
        const rootNodes = Array.from(this.nodes.values()).filter(n => !n.parentId);
        let rootOffset = 100;
        rootNodes.forEach((root) => {
            const subtreeWidth = this.calculateSubtreeWidth(root);
            this.layoutSubtree(root, rootOffset + subtreeWidth / 2, 100);
            rootOffset += subtreeWidth + 150;
        });
        this.updateConnections();
    }
    calculateSubtreeWidth(node) {
        const nodeWidth = 350;
        const horizontalSpacing = 100;
        if (node.children.length === 0) {
            return nodeWidth;
        }
        const childrenWidth = node.children.reduce((total, childId) => {
            const child = this.nodes.get(childId);
            return total + (child ? this.calculateSubtreeWidth(child) : 0);
        }, 0);
        const spacingWidth = (node.children.length - 1) * horizontalSpacing;
        return Math.max(nodeWidth, childrenWidth + spacingWidth);
    }
    layoutSubtree(node, centerX, y) {
        const verticalSpacing = 250;
        const horizontalSpacing = 100;
        // Position current node
        this.positionNode(node, centerX - 175, y); // 175 is half of node width
        if (node.children.length === 0)
            return;
        // Calculate positions for children
        const childWidths = node.children.map(childId => {
            const child = this.nodes.get(childId);
            return child ? this.calculateSubtreeWidth(child) : 0;
        });
        const totalChildWidth = childWidths.reduce((sum, width) => sum + width, 0);
        const totalSpacing = (node.children.length - 1) * horizontalSpacing;
        const totalWidth = totalChildWidth + totalSpacing;
        let currentX = centerX - totalWidth / 2;
        node.children.forEach((childId, index) => {
            const child = this.nodes.get(childId);
            if (child) {
                const childWidth = childWidths[index];
                const childCenterX = currentX + childWidth / 2;
                this.layoutSubtree(child, childCenterX, y + verticalSpacing);
                currentX += childWidth + horizontalSpacing;
            }
        });
    }
    updateConnections() {
        this.connectionsEl.innerHTML = '';
        this.nodes.forEach(node => {
            if (node.parentId) {
                const parent = this.nodes.get(node.parentId);
                if (parent) {
                    this.drawConnection(parent, node);
                }
            }
        });
    }
    drawConnection(parent, child) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const parentCenterX = parent.position.x + 200; // Approximate node width / 2
        const parentCenterY = parent.position.y + 100; // Approximate node height / 2
        const childCenterX = child.position.x + 200;
        const childCenterY = child.position.y + 50; // Connect to top of child
        // Create a curved path
        const midY = (parentCenterY + childCenterY) / 2;
        const pathData = `M ${parentCenterX} ${parentCenterY + 50} C ${parentCenterX} ${midY} ${childCenterX} ${midY} ${childCenterX} ${childCenterY}`;
        line.setAttribute('d', pathData);
        line.setAttribute('class', 'connection-line');
        this.connectionsEl.appendChild(line);
    }
    addRootNode() {
        const root = this.createNode(null, [
            { id: `root_${Date.now()}_prompt`, type: 'prompt', content: 'New root prompt...', position: 0 },
            { id: `root_${Date.now()}_response`, type: 'response', content: 'New root response...', position: 1 }
        ]);
        this.layoutTree();
    }
    resetView() {
        this.panX = 0;
        this.panY = 0;
        this.scale = 1;
        this.updateCanvasTransform();
    }
    exportData() {
        return {
            nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
                id,
                parentId: node.parentId,
                children: node.children,
                position: node.position,
                depth: node.depth,
                blocks: node.blocks
            }))
        };
    }
}
