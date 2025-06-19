var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Logger } from './logger.js';
/**
 * BlockNote editor manager for handling rich text editing
 * Manages BlockNote instances for each block in the graph editor
 */
export class BlockNoteManager {
    constructor() {
        this.editors = new Map();
        this.isInitialized = false;
        this.logger = new Logger('BlockNoteManager');
    }
    /**
     * Initialize BlockNote libraries dynamically
     * @returns Promise that resolves when libraries are loaded
     */
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            this.logger.logFunctionEntry('initialize');
            try {
                if (this.isInitialized) {
                    this.logger.logInfo('BlockNote already initialized', 'initialize');
                    return;
                }
                // Wait a bit for importmaps to load
                yield new Promise(resolve => setTimeout(resolve, 100));
                // Check if BlockNote is available globally
                const globalWindow = window;
                if (globalWindow.BlockNoteCore && globalWindow.BlockNoteReact) {
                    this.blocknoteCore = globalWindow.BlockNoteCore;
                    this.blocknoteReact = globalWindow.BlockNoteReact;
                    this.isInitialized = true;
                    this.logger.logInfo('BlockNote libraries found globally', 'initialize');
                }
                else {
                    // Try to load via importmap
                    try {
                        // Use eval to bypass TypeScript module resolution
                        const loadModule = (moduleName) => {
                            return eval(`import('${moduleName}')`);
                        };
                        const [core, react] = yield Promise.all([
                            loadModule('@blocknote/core'),
                            loadModule('@blocknote/react')
                        ]);
                        this.blocknoteCore = core;
                        this.blocknoteReact = react;
                        this.isInitialized = true;
                        this.logger.logInfo('BlockNote libraries loaded via importmap', 'initialize');
                    }
                    catch (importError) {
                        this.logger.logWarn('Failed to load BlockNote via importmap', 'initialize', {
                            error: String(importError)
                        });
                        throw new Error('BlockNote libraries not available');
                    }
                }
                const executionTime = performance.now() - startTime;
                this.logger.logPerformance('initialize', 'library_load', executionTime);
                this.logger.logFunctionExit('initialize', { success: true }, executionTime);
            }
            catch (error) {
                this.logger.logError(error, 'initialize');
                throw new Error('Failed to initialize BlockNote libraries');
            }
        });
    }
    /**
     * Create a BlockNote editor instance for a specific block
     *
     * @param blockId - The ID of the block
     * @param initialContent - Initial markdown content
     * @param container - DOM element to render the editor in
     * @param onChange - Callback when content changes
     * @returns The editor instance
     */
    createEditor(blockId, initialContent, container, onChange) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = performance.now();
            this.logger.logFunctionEntry('createEditor', {
                blockId,
                contentLength: initialContent.length
            });
            try {
                // Ensure BlockNote is initialized
                if (!this.isInitialized) {
                    yield this.initialize();
                }
                // Clean up any existing editor
                if (this.editors.has(blockId)) {
                    this.destroyEditor(blockId);
                }
                // Create BlockNote editor schema and instance
                const editor = this.blocknoteCore.BlockNoteEditor.create({
                    initialContent: yield this.parseMarkdownToBlocks(initialContent),
                    domAttributes: {
                        editor: {
                            class: 'bn-editor',
                            'data-block-id': blockId
                        }
                    }
                });
                // Set up change handler
                if (onChange) {
                    editor.onChange(() => __awaiter(this, void 0, void 0, function* () {
                        const blocks = editor.document;
                        const markdown = yield this.blocksToMarkdown(blocks);
                        onChange(markdown);
                    }));
                }
                // Mount editor to container
                const editorContainer = document.createElement('div');
                editorContainer.className = 'blocknote-container';
                container.appendChild(editorContainer);
                // Use vanilla JS mounting since we're not in a React app
                editor.mount(editorContainer);
                // Store editor reference
                this.editors.set(blockId, editor);
                this.logger.logInfo('BlockNote editor created', 'createEditor', { blockId });
                const executionTime = performance.now() - startTime;
                this.logger.logPerformance('createEditor', 'editor_creation', executionTime);
                this.logger.logFunctionExit('createEditor', { blockId }, executionTime);
                return editor;
            }
            catch (error) {
                this.logger.logError(error, 'createEditor', { blockId });
                throw new Error(`Failed to create BlockNote editor for block ${blockId}`);
            }
        });
    }
    /**
     * Parse markdown content to BlockNote blocks
     *
     * @param markdown - Markdown string to parse
     * @returns BlockNote blocks array
     */
    parseMarkdownToBlocks(markdown) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('parseMarkdownToBlocks', {
                markdownLength: markdown.length
            });
            try {
                if (!markdown || !markdown.trim()) {
                    return [{
                            type: 'paragraph',
                            content: []
                        }];
                }
                // Use BlockNote's markdown parser if available
                if (this.blocknoteCore.parseMarkdown) {
                    return yield this.blocknoteCore.parseMarkdown(markdown);
                }
                // Fallback: Simple parsing for basic content
                const lines = markdown.split('\n');
                const blocks = [];
                for (const line of lines) {
                    if (line.startsWith('# ')) {
                        blocks.push({
                            type: 'heading',
                            props: { level: 1 },
                            content: [{ type: 'text', text: line.slice(2) }]
                        });
                    }
                    else if (line.startsWith('## ')) {
                        blocks.push({
                            type: 'heading',
                            props: { level: 2 },
                            content: [{ type: 'text', text: line.slice(3) }]
                        });
                    }
                    else if (line.startsWith('### ')) {
                        blocks.push({
                            type: 'heading',
                            props: { level: 3 },
                            content: [{ type: 'text', text: line.slice(4) }]
                        });
                    }
                    else if (line.startsWith('```')) {
                        // Code block handling
                        const codeLines = [];
                        let i = lines.indexOf(line) + 1;
                        while (i < lines.length && !lines[i].startsWith('```')) {
                            codeLines.push(lines[i]);
                            i++;
                        }
                        blocks.push({
                            type: 'codeBlock',
                            props: { language: line.slice(3) || 'text' },
                            content: [{ type: 'text', text: codeLines.join('\n') }]
                        });
                    }
                    else if (line.trim()) {
                        blocks.push({
                            type: 'paragraph',
                            content: [{ type: 'text', text: line }]
                        });
                    }
                }
                return blocks.length > 0 ? blocks : [{
                        type: 'paragraph',
                        content: []
                    }];
            }
            catch (error) {
                this.logger.logError(error, 'parseMarkdownToBlocks');
                return [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: markdown }]
                    }];
            }
        });
    }
    /**
     * Convert BlockNote blocks to markdown
     *
     * @param blocks - BlockNote blocks array
     * @returns Markdown string
     */
    blocksToMarkdown(blocks) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            this.logger.logFunctionEntry('blocksToMarkdown', {
                blockCount: blocks.length
            });
            try {
                // Use BlockNote's markdown serializer if available
                if (this.blocknoteCore.blocksToMarkdown) {
                    return yield this.blocknoteCore.blocksToMarkdown(blocks);
                }
                // Fallback: Simple conversion
                const lines = [];
                for (const block of blocks) {
                    switch (block.type) {
                        case 'heading':
                            const level = ((_a = block.props) === null || _a === void 0 ? void 0 : _a.level) || 1;
                            const prefix = '#'.repeat(level);
                            const text = this.extractText(block.content);
                            lines.push(`${prefix} ${text}`);
                            break;
                        case 'paragraph':
                            lines.push(this.extractText(block.content));
                            break;
                        case 'bulletListItem':
                            lines.push(`- ${this.extractText(block.content)}`);
                            break;
                        case 'numberedListItem':
                            lines.push(`1. ${this.extractText(block.content)}`);
                            break;
                        case 'codeBlock':
                            const lang = ((_b = block.props) === null || _b === void 0 ? void 0 : _b.language) || '';
                            lines.push(`\`\`\`${lang}`);
                            lines.push(this.extractText(block.content));
                            lines.push('```');
                            break;
                        case 'quote':
                            lines.push(`> ${this.extractText(block.content)}`);
                            break;
                        default:
                            lines.push(this.extractText(block.content));
                    }
                    // Add spacing between blocks
                    if (blocks.indexOf(block) < blocks.length - 1) {
                        lines.push('');
                    }
                }
                return lines.join('\n');
            }
            catch (error) {
                this.logger.logError(error, 'blocksToMarkdown');
                return '';
            }
        });
    }
    /**
     * Extract text content from inline content array
     *
     * @param content - Inline content array
     * @returns Plain text string
     */
    extractText(content) {
        if (!content || !Array.isArray(content)) {
            return '';
        }
        return content
            .map(item => {
            if (typeof item === 'string') {
                return item;
            }
            if (item.type === 'text' && item.text) {
                return item.text;
            }
            if (item.type === 'link' && item.content) {
                return this.extractText(item.content);
            }
            return '';
        })
            .join('');
    }
    /**
     * Update editor content
     *
     * @param blockId - The ID of the block
     * @param content - New markdown content
     */
    updateContent(blockId, content) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('updateContent', {
                blockId,
                contentLength: content.length
            });
            try {
                const editor = this.editors.get(blockId);
                if (!editor) {
                    this.logger.logWarn('Editor not found', 'updateContent', { blockId });
                    return;
                }
                const blocks = yield this.parseMarkdownToBlocks(content);
                editor.replaceBlocks(editor.document, blocks);
                this.logger.logInfo('Editor content updated', 'updateContent', { blockId });
            }
            catch (error) {
                this.logger.logError(error, 'updateContent', { blockId });
            }
        });
    }
    /**
     * Get current content from editor
     *
     * @param blockId - The ID of the block
     * @returns Current markdown content
     */
    getContent(blockId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('getContent', { blockId });
            try {
                const editor = this.editors.get(blockId);
                if (!editor) {
                    this.logger.logWarn('Editor not found', 'getContent', { blockId });
                    return '';
                }
                const markdown = yield this.blocksToMarkdown(editor.document);
                this.logger.logInfo('Retrieved editor content', 'getContent', {
                    blockId,
                    contentLength: markdown.length
                });
                return markdown;
            }
            catch (error) {
                this.logger.logError(error, 'getContent', { blockId });
                return '';
            }
        });
    }
    /**
     * Destroy a specific editor instance
     *
     * @param blockId - The ID of the block
     */
    destroyEditor(blockId) {
        this.logger.logFunctionEntry('destroyEditor', { blockId });
        try {
            const editor = this.editors.get(blockId);
            if (editor) {
                editor.destroy();
                this.editors.delete(blockId);
                this.logger.logInfo('Editor destroyed', 'destroyEditor', { blockId });
            }
        }
        catch (error) {
            this.logger.logError(error, 'destroyEditor', { blockId });
        }
    }
    /**
     * Destroy all editor instances
     */
    destroyAll() {
        this.logger.logFunctionEntry('destroyAll', {
            editorCount: this.editors.size
        });
        try {
            for (const [blockId, editor] of this.editors) {
                try {
                    editor.destroy();
                }
                catch (error) {
                    this.logger.logError(error, 'destroyAll', { blockId });
                }
            }
            this.editors.clear();
            this.logger.logInfo('All editors destroyed', 'destroyAll');
        }
        catch (error) {
            this.logger.logError(error, 'destroyAll');
        }
    }
}
// Export singleton instance
export const blockNoteManager = new BlockNoteManager();
