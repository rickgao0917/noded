export class NodeEditor {
    constructor(canvas) {
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
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context from canvas');
        }
        this.context = ctx;
        this.state = {
            nodes: [],
            selectedNodeId: null,
            canvasOffset: { x: 0, y: 0 },
            zoom: 1
        };
        this.layout = {
            nodeWidth: 300,
            nodeHeight: 200,
            horizontalSpacing: 100,
            verticalSpacing: 150
        };
        this.setupEventListeners();
        this.render();
    }
    setNodes(nodes) {
        const layoutResults = calculateTreeLayout(nodes, this.layout);
        const positionMap = new Map(layoutResults.map(r => [r.nodeId, r.position]));
        const updatedNodes = nodes.map(node => (Object.assign(Object.assign({}, node), { position: positionMap.get(node.id) || node.position })));
        this.state = Object.assign(Object.assign({}, this.state), { nodes: updatedNodes });
        this.render();
    }
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mousePos = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        const clickedNode = this.getNodeAtPosition(mousePos);
        if (clickedNode) {
            this.state = Object.assign(Object.assign({}, this.state), { selectedNodeId: clickedNode.id });
        }
        else {
            this.isDragging = true;
            this.dragStart = mousePos;
            this.state = Object.assign(Object.assign({}, this.state), { selectedNodeId: null });
        }
        this.lastMousePos = mousePos;
        this.render();
    }
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mousePos = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        if (this.isDragging) {
            const deltaX = mousePos.x - this.lastMousePos.x;
            const deltaY = mousePos.y - this.lastMousePos.y;
            this.state = Object.assign(Object.assign({}, this.state), { canvasOffset: {
                    x: this.state.canvasOffset.x + deltaX,
                    y: this.state.canvasOffset.y + deltaY
                } });
            this.render();
        }
        this.lastMousePos = mousePos;
    }
    handleMouseUp() {
        this.isDragging = false;
    }
    handleWheel(event) {
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(3, this.state.zoom * zoomFactor));
        this.state = Object.assign(Object.assign({}, this.state), { zoom: newZoom });
        this.render();
    }
    handleResize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }
    getNodeAtPosition(pos) {
        for (const node of this.state.nodes) {
            const nodePos = this.transformPosition(node.position);
            if (pos.x >= nodePos.x &&
                pos.x <= nodePos.x + this.layout.nodeWidth * this.state.zoom &&
                pos.y >= nodePos.y &&
                pos.y <= nodePos.y + this.layout.nodeHeight * this.state.zoom) {
                return node;
            }
        }
        return null;
    }
    transformPosition(pos) {
        return {
            x: (pos.x + this.state.canvasOffset.x) * this.state.zoom,
            y: (pos.y + this.state.canvasOffset.y) * this.state.zoom
        };
    }
    render() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.save();
        this.renderConnections();
        this.renderNodes();
        this.context.restore();
    }
    renderConnections() {
        this.context.strokeStyle = '#666';
        this.context.lineWidth = 2;
        for (const node of this.state.nodes) {
            if (node.parentId) {
                const parent = this.state.nodes.find(n => n.id === node.parentId);
                if (parent) {
                    const parentPos = this.transformPosition(parent.position);
                    const childPos = this.transformPosition(node.position);
                    const parentCenter = {
                        x: parentPos.x + (this.layout.nodeWidth * this.state.zoom) / 2,
                        y: parentPos.y + (this.layout.nodeHeight * this.state.zoom)
                    };
                    const childCenter = {
                        x: childPos.x + (this.layout.nodeWidth * this.state.zoom) / 2,
                        y: childPos.y
                    };
                    this.context.beginPath();
                    this.context.moveTo(parentCenter.x, parentCenter.y);
                    this.context.lineTo(childCenter.x, childCenter.y);
                    this.context.stroke();
                }
            }
        }
    }
    renderNodes() {
        for (const node of this.state.nodes) {
            this.renderNode(node);
        }
    }
    renderNode(node) {
        const pos = this.transformPosition(node.position);
        const width = this.layout.nodeWidth * this.state.zoom;
        const height = this.layout.nodeHeight * this.state.zoom;
        const isSelected = node.id === this.state.selectedNodeId;
        this.context.fillStyle = isSelected ? '#e3f2fd' : '#f5f5f5';
        this.context.strokeStyle = isSelected ? '#2196f3' : '#ccc';
        this.context.lineWidth = isSelected ? 3 : 1;
        this.context.fillRect(pos.x, pos.y, width, height);
        this.context.strokeRect(pos.x, pos.y, width, height);
        this.renderNodeBlocks(node, pos, width, height);
    }
    renderNodeBlocks(node, nodePos, nodeWidth, nodeHeight) {
        const padding = 10 * this.state.zoom;
        const blockSpacing = 5 * this.state.zoom;
        const fontSize = Math.max(10, 12 * this.state.zoom);
        this.context.font = `${fontSize}px Arial`;
        let currentY = nodePos.y + padding;
        for (const block of node.blocks) {
            const blockHeight = this.renderBlock(block, nodePos.x + padding, currentY, nodeWidth - 2 * padding);
            currentY += blockHeight + blockSpacing;
            if (currentY >= nodePos.y + nodeHeight - padding) {
                break;
            }
        }
    }
    renderBlock(block, x, y, maxWidth) {
        const headerHeight = 20 * this.state.zoom;
        const contentPadding = 5 * this.state.zoom;
        const minContentHeight = 30 * this.state.zoom;
        let headerColor;
        let headerText;
        switch (block.type) {
            case 'prompt':
                headerColor = '#4caf50';
                headerText = 'Prompt';
                break;
            case 'response':
                headerColor = '#2196f3';
                headerText = 'Response';
                break;
            case 'markdown':
                headerColor = '#ff9800';
                headerText = 'Markdown';
                break;
        }
        this.context.fillStyle = headerColor;
        this.context.fillRect(x, y, maxWidth, headerHeight);
        this.context.fillStyle = 'white';
        this.context.textAlign = 'left';
        this.context.textBaseline = 'middle';
        this.context.fillText(headerText, x + contentPadding, y + headerHeight / 2);
        const contentY = y + headerHeight;
        this.context.fillStyle = 'white';
        this.context.fillRect(x, contentY, maxWidth, minContentHeight);
        this.context.strokeStyle = '#ddd';
        this.context.lineWidth = 1;
        this.context.strokeRect(x, contentY, maxWidth, minContentHeight);
        this.context.fillStyle = '#333';
        this.context.textAlign = 'left';
        this.context.textBaseline = 'top';
        const lines = this.wrapText(block.content, maxWidth - 2 * contentPadding);
        const lineHeight = 14 * this.state.zoom;
        for (let i = 0; i < Math.min(lines.length, 2); i++) {
            this.context.fillText(lines[i], x + contentPadding, contentY + contentPadding + i * lineHeight);
        }
        return headerHeight + minContentHeight;
    }
    wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        for (const word of words) {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const metrics = this.context.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            }
            else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    }
    getSelectedNode() {
        if (!this.state.selectedNodeId) {
            return null;
        }
        return this.state.nodes.find(node => node.id === this.state.selectedNodeId) || null;
    }
    addNode(parentId, blocks) {
        const newNode = {
            id: this.generateId(),
            parentId,
            blocks,
            position: { x: 0, y: 0 },
            depth: parentId ? this.getNodeDepth(parentId) + 1 : 0
        };
        this.setNodes([...this.state.nodes, newNode]);
    }
    getNodeDepth(nodeId) {
        const node = this.state.nodes.find(n => n.id === nodeId);
        return node ? node.depth : 0;
    }
    generateId() {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
