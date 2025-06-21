/**
 * ChatInterface component that manages the chat panel UI.
 * Handles user interactions, message display, and coordination with the graph editor.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Logger } from '../utils/logger.js';
import { ChatInputHandler } from '../services/chat-input-handler.js';
import { ConversationManager } from '../services/conversation-manager.js';
import { GraphSynchronizer } from '../services/graph-synchronizer.js';
import { markdownProcessor } from '../utils/markdown.js';
import { DEFAULT_CHAT_CONFIG, CHAT_CONSTANTS, ChatMessageType } from '../types/chat.types.js';
import { DEFAULT_KEYBOARD_SHORTCUTS, DEFAULT_ACCESSIBILITY_OPTIONS } from '../types/chat-ui.types.js';
import { EditSource } from '../types/branching.types.js';
/**
 * Main chat interface component that provides a panel for conversational interaction
 * with the node graph. Opens when nodes are double-clicked and allows /prompt and /md commands.
 */
export class ChatInterface {
    constructor(parentContainer, graphEditor, config) {
        this.panelElement = null;
        this.headerElement = null;
        this.messagesElement = null;
        this.inputContainerElement = null;
        this.inputElement = null;
        this.sendButtonElement = null;
        this.closeButtonElement = null;
        this.resizeHandleElement = null;
        // Component state
        this.state = {
            activeThread: null,
            isVisible: false,
            panelWidth: 40, // Default 40%
            inputMode: 'idle',
            inputContent: '',
            loadingStates: {
                sendingMessage: false,
                generatingResponse: false,
                updatingGraph: false,
                buildingThread: false
            }
        };
        // Event listeners for cleanup
        this.eventListeners = [];
        this.logger = new Logger('ChatInterface');
        this.logger.logFunctionEntry('constructor');
        this.inputHandler = new ChatInputHandler();
        this.conversationManager = new ConversationManager(graphEditor);
        this.graphSynchronizer = new GraphSynchronizer(graphEditor);
        this.parentContainer = parentContainer;
        this.graphEditor = graphEditor;
        // Connect synchronizer with this interface
        this.graphSynchronizer.setChatInterface(this);
        // Merge config with defaults
        this.config = Object.assign(Object.assign({}, DEFAULT_CHAT_CONFIG), config);
        // Initialize UI
        this.createUIElements();
        this.setupEventListeners();
        this.applyInitialStyles();
        this.logger.logFunctionExit('constructor');
    }
    /**
     * Opens the chat panel for a specific node, showing the complete conversation thread.
     *
     * @param nodeId - The ID of the node to open chat for
     */
    openChatForNode(nodeId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('openChatForNode', { nodeId });
            this.logger.logUserInteraction('chat_opened', undefined, { nodeId });
            try {
                // Validate node exists
                const node = this.graphEditor.getNode(nodeId);
                if (!node) {
                    throw new Error(`Node with ID ${nodeId} not found`);
                }
                // Set loading state
                this.updateLoadingState('buildingThread', true);
                // Build conversation thread using ConversationManager
                const thread = this.conversationManager.buildThreadFromNodeToRoot(nodeId);
                // Update state
                this.state.activeThread = thread;
                this.state.isVisible = true;
                // Show panel and adjust layout
                this.showPanel();
                this.adjustCanvasLayout(true);
                // Render thread
                this.renderThread(thread);
                // Focus input if configured
                if (this.config.autoFocusInput && this.inputElement) {
                    this.inputElement.focus();
                }
                this.updateLoadingState('buildingThread', false);
            }
            catch (error) {
                this.logger.logError(error, 'openChatForNode', { nodeId });
                this.updateLoadingState('buildingThread', false);
                // TODO: Show error message to user
                throw error;
            }
            finally {
                this.logger.logFunctionExit('openChatForNode');
            }
        });
    }
    /**
     * Closes the chat panel and resets the canvas layout.
     */
    closeChat() {
        var _a;
        this.logger.logFunctionEntry('closeChat');
        this.logger.logUserInteraction('chat_closed', undefined, {
            lastNodeId: (_a = this.state.activeThread) === null || _a === void 0 ? void 0 : _a.targetNodeId
        });
        try {
            // Update state
            this.state.activeThread = null;
            this.state.isVisible = false;
            this.state.inputContent = '';
            this.state.inputMode = 'idle';
            // Clear conversation manager state
            this.conversationManager.clearState();
            // Hide panel and reset layout
            this.hidePanel();
            this.adjustCanvasLayout(false);
            // Clear input
            if (this.inputElement) {
                this.inputElement.value = '';
            }
        }
        finally {
            this.logger.logFunctionExit('closeChat');
        }
    }
    /**
     * Returns whether the chat panel is currently visible.
     */
    isVisible() {
        return this.state.isVisible;
    }
    /**
     * Returns the currently displayed conversation thread.
     */
    getCurrentThread() {
        return this.state.activeThread;
    }
    /**
     * Creates all DOM elements for the chat interface.
     */
    createUIElements() {
        this.logger.logFunctionEntry('createUIElements');
        try {
            // Create main panel container
            this.panelElement = document.createElement('div');
            this.panelElement.className = 'chat-panel';
            this.panelElement.setAttribute('role', 'complementary');
            this.panelElement.setAttribute('aria-label', DEFAULT_ACCESSIBILITY_OPTIONS.ariaLabels.chatPanel);
            // Create header
            this.headerElement = document.createElement('div');
            this.headerElement.className = 'chat-header';
            const titleElement = document.createElement('h2');
            titleElement.className = 'chat-title';
            titleElement.textContent = 'Conversation';
            this.closeButtonElement = document.createElement('button');
            this.closeButtonElement.className = 'chat-close-button';
            this.closeButtonElement.innerHTML = '×';
            this.closeButtonElement.setAttribute('aria-label', DEFAULT_ACCESSIBILITY_OPTIONS.ariaLabels.closeButton);
            this.closeButtonElement.setAttribute('title', 'Close chat (Esc)');
            this.headerElement.appendChild(titleElement);
            this.headerElement.appendChild(this.closeButtonElement);
            // Create messages container
            this.messagesElement = document.createElement('div');
            this.messagesElement.className = 'chat-messages';
            this.messagesElement.setAttribute('role', 'log');
            this.messagesElement.setAttribute('aria-label', DEFAULT_ACCESSIBILITY_OPTIONS.ariaLabels.messageList);
            this.messagesElement.setAttribute('aria-live', 'polite');
            // Create input container
            this.inputContainerElement = document.createElement('div');
            this.inputContainerElement.className = 'chat-input-container';
            this.inputElement = document.createElement('textarea');
            this.inputElement.className = 'chat-input';
            this.inputElement.placeholder = 'Type /prompt or /md followed by your message... (Ctrl+Enter to send, Enter for new line)';
            this.inputElement.setAttribute('aria-label', DEFAULT_ACCESSIBILITY_OPTIONS.ariaLabels.inputField);
            this.inputElement.setAttribute('rows', '3');
            this.sendButtonElement = document.createElement('button');
            this.sendButtonElement.className = 'chat-send-button';
            this.sendButtonElement.textContent = 'Send';
            this.sendButtonElement.setAttribute('aria-label', DEFAULT_ACCESSIBILITY_OPTIONS.ariaLabels.sendButton);
            this.sendButtonElement.disabled = true;
            this.inputContainerElement.appendChild(this.inputElement);
            this.inputContainerElement.appendChild(this.sendButtonElement);
            // Create resize handle
            this.resizeHandleElement = document.createElement('div');
            this.resizeHandleElement.className = 'chat-resize-handle';
            this.resizeHandleElement.setAttribute('role', 'separator');
            this.resizeHandleElement.setAttribute('aria-orientation', 'vertical');
            this.resizeHandleElement.setAttribute('aria-label', 'Resize chat panel');
            // Assemble panel
            this.panelElement.appendChild(this.headerElement);
            this.panelElement.appendChild(this.messagesElement);
            this.panelElement.appendChild(this.inputContainerElement);
            this.panelElement.appendChild(this.resizeHandleElement);
            // Add to parent container
            this.parentContainer.appendChild(this.panelElement);
            this.logger.logInfo('ui_elements_created', 'createUIElements');
        }
        finally {
            this.logger.logFunctionExit('createUIElements');
        }
    }
    /**
     * Sets up event listeners for user interactions.
     */
    setupEventListeners() {
        this.logger.logFunctionEntry('setupEventListeners');
        try {
            // Close button
            if (this.closeButtonElement) {
                this.addEventListener(this.closeButtonElement, 'click', () => this.closeChat());
            }
            // Input field
            if (this.inputElement) {
                this.addEventListener(this.inputElement, 'input', (e) => this.handleInputChange(e));
                this.addEventListener(this.inputElement, 'keydown', (e) => this.handleInputKeydown(e));
            }
            // Send button
            if (this.sendButtonElement) {
                this.addEventListener(this.sendButtonElement, 'click', () => this.handleSendMessage());
            }
            // Keyboard shortcuts
            this.addEventListener(window, 'keydown', (e) => this.handleGlobalKeydown(e));
            // Resize handle (stub for now)
            if (this.resizeHandleElement) {
                this.addEventListener(this.resizeHandleElement, 'mousedown', (e) => this.startResize(e));
            }
            this.logger.logInfo('event_listeners_attached', 'setupEventListeners', {
                listenerCount: this.eventListeners.length
            });
        }
        finally {
            this.logger.logFunctionExit('setupEventListeners');
        }
    }
    /**
     * Helper method to add event listeners that can be cleaned up later.
     */
    addEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
    }
    /**
     * Applies initial CSS styles to the chat panel.
     */
    applyInitialStyles() {
        this.logger.logFunctionEntry('applyInitialStyles');
        try {
            if (!this.panelElement)
                return;
            // Set initial width
            this.panelElement.style.width = `${this.state.panelWidth}%`;
            // Initially hidden
            this.panelElement.style.display = 'none';
            this.logger.logInfo('styles_applied', 'applyInitialStyles', {
                panelWidth: this.state.panelWidth
            });
        }
        finally {
            this.logger.logFunctionExit('applyInitialStyles');
        }
    }
    /**
     * Shows the chat panel with animation.
     */
    showPanel() {
        this.logger.logFunctionEntry('showPanel');
        try {
            if (!this.panelElement)
                return;
            this.panelElement.style.display = 'flex';
            // Force reflow for animation
            void this.panelElement.offsetHeight;
            this.panelElement.classList.add('chat-panel-visible');
            this.logger.logInfo('panel_shown', 'showPanel');
        }
        finally {
            this.logger.logFunctionExit('showPanel');
        }
    }
    /**
     * Hides the chat panel with animation.
     */
    hidePanel() {
        this.logger.logFunctionEntry('hidePanel');
        try {
            if (!this.panelElement)
                return;
            this.panelElement.classList.remove('chat-panel-visible');
            // Hide after animation
            setTimeout(() => {
                if (this.panelElement) {
                    this.panelElement.style.display = 'none';
                }
            }, this.config.transitionDuration);
            this.logger.logInfo('panel_hidden', 'hidePanel');
        }
        finally {
            this.logger.logFunctionExit('hidePanel');
        }
    }
    /**
     * Adjusts the canvas layout when chat opens/closes.
     */
    adjustCanvasLayout(chatOpen) {
        this.logger.logFunctionEntry('adjustCanvasLayout', { chatOpen });
        try {
            const canvas = document.querySelector('.canvas');
            const editorContainer = document.querySelector('.editor-container');
            if (!canvas || !editorContainer)
                return;
            if (chatOpen) {
                editorContainer.classList.add('chat-active');
                canvas.style.width = `${CHAT_CONSTANTS.CANVAS_WIDTH_WITH_CHAT}%`;
                // Store the current zoom level before adjusting
                const currentZoom = this.graphEditor.getScale();
                if (!this.state.zoomBeforeChat) {
                    this.state.zoomBeforeChat = currentZoom;
                }
                // Calculate new zoom to fit more nodes
                // Reduce zoom based on configured factor
                const targetZoom = Math.max(0.1, currentZoom * CHAT_CONSTANTS.ZOOM_REDUCTION_FACTOR);
                this.graphEditor.setZoom(targetZoom);
                // Update zoom slider if it exists
                const zoomSlider = document.getElementById('zoomSlider');
                const zoomValue = document.getElementById('zoomValue');
                if (zoomSlider && zoomValue) {
                    const zoomPercent = Math.round(targetZoom * 100);
                    zoomSlider.value = zoomPercent.toString();
                    zoomValue.textContent = `${zoomPercent}%`;
                }
            }
            else {
                editorContainer.classList.remove('chat-active');
                canvas.style.width = '100%';
                // Restore previous zoom level when chat closes
                if (this.state.zoomBeforeChat) {
                    this.graphEditor.setZoom(this.state.zoomBeforeChat);
                    // Update zoom slider
                    const zoomSlider = document.getElementById('zoomSlider');
                    const zoomValue = document.getElementById('zoomValue');
                    if (zoomSlider && zoomValue) {
                        const zoomPercent = Math.round(this.state.zoomBeforeChat * 100);
                        zoomSlider.value = zoomPercent.toString();
                        zoomValue.textContent = `${zoomPercent}%`;
                    }
                    // Clear stored zoom
                    delete this.state.zoomBeforeChat;
                }
            }
            this.logger.logInfo('canvas_adjusted', 'adjustCanvasLayout', {
                chatOpen,
                zoomAdjusted: true
            });
        }
        finally {
            this.logger.logFunctionExit('adjustCanvasLayout');
        }
    }
    /**
     * Renders a conversation thread in the messages area.
     */
    renderThread(thread) {
        this.logger.logFunctionEntry('renderThread', { threadId: thread.id });
        try {
            if (!this.messagesElement)
                return;
            // Clear existing messages
            this.messagesElement.innerHTML = '';
            // Render each message in the thread
            if (thread.messages.length === 0) {
                const placeholder = document.createElement('div');
                placeholder.className = 'chat-placeholder';
                placeholder.textContent = 'No messages yet. Use /prompt to start a conversation or /md to add notes.';
                this.messagesElement.appendChild(placeholder);
            }
            else {
                thread.messages.forEach((message) => {
                    const messageEl = this.createMessageElement(message);
                    if (messageEl) {
                        this.messagesElement.appendChild(messageEl);
                    }
                });
                // Scroll to bottom
                this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
            }
            this.logger.logInfo('thread_rendered', 'renderThread', {
                messageCount: thread.messages.length
            });
        }
        finally {
            this.logger.logFunctionExit('renderThread');
        }
    }
    /**
     * Creates a DOM element for a chat message.
     */
    createMessageElement(message) {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        messageEl.setAttribute('data-message-id', message.id);
        messageEl.setAttribute('data-node-id', message.nodeId);
        messageEl.setAttribute('data-preview-mode', 'rendered');
        // Add type-specific classes
        switch (message.type) {
            case ChatMessageType.USER_PROMPT:
                messageEl.classList.add('chat-message-user');
                break;
            case ChatMessageType.ASSISTANT_RESPONSE:
                messageEl.classList.add('chat-message-assistant');
                break;
            case ChatMessageType.USER_MARKDOWN:
                messageEl.classList.add('chat-message-markdown');
                break;
        }
        // Add message content
        const contentEl = document.createElement('div');
        contentEl.className = 'chat-message-content';
        // Render markdown for assistant responses and user markdown
        if (message.type === ChatMessageType.ASSISTANT_RESPONSE ||
            message.type === ChatMessageType.USER_MARKDOWN) {
            contentEl.innerHTML = markdownProcessor.renderMarkdown(message.content, message.type);
            // Add double-click handler to toggle preview mode
            contentEl.addEventListener('dblclick', (e) => {
                e.preventDefault();
                this.toggleMessagePreviewMode(messageEl, message);
            });
        }
        else {
            contentEl.textContent = message.content;
        }
        messageEl.appendChild(contentEl);
        // Add timestamp
        const timestampEl = document.createElement('div');
        timestampEl.className = 'chat-message-timestamp';
        timestampEl.textContent = new Date(message.timestamp).toLocaleTimeString();
        messageEl.appendChild(timestampEl);
        return messageEl;
    }
    /**
     * Handles input field changes.
     */
    handleInputChange(event) {
        this.logger.logFunctionEntry('handleInputChange');
        try {
            const input = event.target.value;
            this.state.inputContent = input;
            // Get command hint
            const commandHint = this.inputHandler.getCommandHint(input);
            // Update input mode
            if (commandHint === '/prompt') {
                this.state.inputMode = 'typing_prompt';
            }
            else if (commandHint === '/md') {
                this.state.inputMode = 'typing_markdown';
            }
            else {
                this.state.inputMode = 'idle';
            }
            // Enable/disable send button based on validity
            if (this.sendButtonElement) {
                const isValid = this.inputHandler.isValidCommandFormat(input);
                this.sendButtonElement.disabled = !isValid || this.isAnyLoading();
            }
            this.logger.logUserInteraction('input_changed', undefined, {
                inputLength: input.length,
                inputMode: this.state.inputMode
            });
        }
        finally {
            this.logger.logFunctionExit('handleInputChange');
        }
    }
    /**
     * Handles keydown events in the input field.
     */
    handleInputKeydown(event) {
        this.logger.logFunctionEntry('handleInputKeydown', { key: event.key });
        try {
            // Ctrl+Enter to send
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                this.handleSendMessage();
            }
        }
        finally {
            this.logger.logFunctionExit('handleInputKeydown');
        }
    }
    /**
     * Handles global keyboard shortcuts.
     */
    handleGlobalKeydown(event) {
        // Only handle if chat is visible
        if (!this.state.isVisible)
            return;
        const shortcuts = DEFAULT_KEYBOARD_SHORTCUTS;
        // Escape to close
        if (event.key === shortcuts.togglePanel) {
            event.preventDefault();
            this.closeChat();
        }
    }
    /**
     * Handles sending a message.
     */
    handleSendMessage() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('handleSendMessage');
            try {
                if (!this.inputElement || this.isAnyLoading())
                    return;
                const input = this.inputElement.value; // Don't trim here, let parseCommand handle it
                if (!input.trim())
                    return; // Check if empty after trimming
                // Parse command
                const commandResult = this.inputHandler.parseCommand(input);
                if (!commandResult.isValid) {
                    // TODO: Show error message to user
                    this.logger.logInfo('invalid_command', 'handleSendMessage', {
                        error: commandResult.error
                    });
                    return;
                }
                this.logger.logUserInteraction('message_sent', undefined, {
                    command: commandResult.command,
                    contentLength: commandResult.content.length
                });
                // Clear input
                this.inputElement.value = '';
                this.state.inputContent = '';
                // Process the command
                if (commandResult.command === '/prompt') {
                    yield this.handlePromptCommand(commandResult.content);
                }
                else if (commandResult.command === '/md') {
                    this.logger.logInfo('Processing /md command', 'handleSendMessage', {
                        originalInput: input,
                        parsedContent: commandResult.content,
                        contentLength: commandResult.content.length
                    });
                    yield this.handleMarkdownCommand(commandResult.content);
                }
            }
            finally {
                this.logger.logFunctionExit('handleSendMessage');
            }
        });
    }
    /**
     * Handles the /prompt command by creating a new child node.
     */
    handlePromptCommand(content) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('handlePromptCommand', { contentLength: content.length });
            try {
                if (!this.state.activeThread) {
                    this.logger.logWarn('No active thread for prompt command', 'handlePromptCommand');
                    return;
                }
                // Set loading states
                this.updateLoadingState('sendingMessage', true);
                this.updateLoadingState('generatingResponse', true);
                try {
                    // First, add the prompt message to the chat immediately
                    const promptMessage = {
                        id: `msg-${Date.now()}-prompt`,
                        type: ChatMessageType.USER_PROMPT,
                        content: content,
                        timestamp: new Date(),
                        nodeId: this.state.activeThread.targetNodeId,
                        blockId: 'pending'
                    };
                    // Add the message to the current thread temporarily
                    if (this.state.activeThread) {
                        this.state.activeThread.messages.push(promptMessage);
                        // Re-render the thread to show the new prompt immediately
                        this.renderThread(this.state.activeThread);
                    }
                    // Prepare to track streaming response
                    let responseMessageId = null;
                    let targetNodeId = this.state.activeThread.targetNodeId;
                    // Submit prompt with streaming callback
                    const resultNodeId = yield this.conversationManager.submitPromptForNode(targetNodeId, content, (streamingContent) => {
                        // Handle streaming updates
                        if (!responseMessageId) {
                            // Create response message on first chunk
                            responseMessageId = `msg-${Date.now()}-response`;
                            const responseMessage = {
                                id: responseMessageId,
                                type: ChatMessageType.ASSISTANT_RESPONSE,
                                content: streamingContent,
                                timestamp: new Date(),
                                nodeId: targetNodeId, // Use the target node ID for now
                                blockId: 'streaming'
                            };
                            if (this.state.activeThread) {
                                this.state.activeThread.messages.push(responseMessage);
                                this.renderThread(this.state.activeThread);
                            }
                        }
                        else {
                            // Update existing response message
                            this.updateStreamingMessage(responseMessageId, streamingContent);
                        }
                    });
                    // Only sync if a new node was created
                    if (resultNodeId !== this.state.activeThread.targetNodeId) {
                        // Sync with graph display
                        yield this.graphSynchronizer.syncNewChildNode(this.state.activeThread.targetNodeId, resultNodeId);
                    }
                    // Refresh the chat view to show the complete updated conversation
                    yield this.openChatForNode(resultNodeId);
                    this.logger.logInfo('Prompt command processed successfully', 'handlePromptCommand', {
                        resultNodeId
                    });
                }
                catch (error) {
                    this.logger.logError(error, 'handlePromptCommand');
                    // TODO: Show error to user
                    this.showError('Failed to process prompt: ' + error.message);
                }
                finally {
                    this.updateLoadingState('sendingMessage', false);
                    this.updateLoadingState('generatingResponse', false);
                }
            }
            finally {
                this.logger.logFunctionExit('handlePromptCommand');
            }
        });
    }
    /**
     * Handles the /md command by adding markdown to the previous prompt node.
     */
    handleMarkdownCommand(content) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('handleMarkdownCommand', {
                contentLength: content.length,
                contentPreview: content.substring(0, 100),
                content: content // Log full content for debugging
            });
            try {
                if (!this.state.activeThread) {
                    this.logger.logWarn('No active thread for markdown command', 'handleMarkdownCommand');
                    return;
                }
                // Set loading state
                this.updateLoadingState('sendingMessage', true);
                try {
                    // Add markdown to previous prompt node
                    yield this.conversationManager.associateMarkdownWithPreviousPrompt(content, this.state.activeThread);
                    // Refresh the thread display
                    yield this.openChatForNode(this.state.activeThread.targetNodeId);
                    this.logger.logInfo('Markdown command processed successfully', 'handleMarkdownCommand');
                }
                catch (error) {
                    this.logger.logError(error, 'handleMarkdownCommand');
                    // TODO: Show error to user
                    this.showError('Failed to add markdown: ' + error.message);
                }
                finally {
                    this.updateLoadingState('sendingMessage', false);
                }
            }
            finally {
                this.logger.logFunctionExit('handleMarkdownCommand');
            }
        });
    }
    /**
     * Updates a streaming message in the chat display
     */
    updateStreamingMessage(messageId, content) {
        this.logger.logFunctionEntry('updateStreamingMessage', {
            messageId,
            contentLength: content.length
        });
        try {
            const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageEl) {
                const contentEl = messageEl.querySelector('.chat-message-content');
                if (contentEl) {
                    // Update with rendered markdown
                    contentEl.innerHTML = markdownProcessor.renderMarkdown(content, ChatMessageType.ASSISTANT_RESPONSE);
                    // Scroll to bottom to show new content
                    if (this.messagesElement) {
                        this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
                    }
                }
            }
            // Also update the message in the thread data
            if (this.state.activeThread) {
                const message = this.state.activeThread.messages.find(m => m.id === messageId);
                if (message) {
                    message.content = content;
                }
            }
        }
        catch (error) {
            this.logger.logError(error, 'updateStreamingMessage', { messageId });
        }
        finally {
            this.logger.logFunctionExit('updateStreamingMessage');
        }
    }
    /**
     * Shows an error message to the user.
     */
    showError(message) {
        // TODO: Implement proper error display
        // For now, just log it
        this.logger.logWarn(message, 'showError');
        // Simple temporary solution - show in messages area
        if (this.messagesElement) {
            const errorEl = document.createElement('div');
            errorEl.className = 'chat-error-message';
            errorEl.textContent = message;
            errorEl.style.color = '#ff6b6b';
            errorEl.style.padding = '10px';
            errorEl.style.margin = '10px 0';
            errorEl.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
            errorEl.style.borderRadius = '4px';
            this.messagesElement.appendChild(errorEl);
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (errorEl.parentNode) {
                    errorEl.parentNode.removeChild(errorEl);
                }
            }, 5000);
        }
    }
    /**
     * Starts panel resizing.
     */
    startResize(_event) {
        this.logger.logFunctionEntry('startResize');
        // TODO: Implement panel resizing
        this.logger.logFunctionExit('startResize');
    }
    /**
     * Updates a specific loading state.
     */
    updateLoadingState(key, value) {
        this.state.loadingStates[key] = value;
        // Update UI to reflect loading state
        if (this.sendButtonElement) {
            this.sendButtonElement.disabled = this.isAnyLoading();
        }
    }
    /**
     * Checks if any loading operation is in progress.
     */
    isAnyLoading() {
        return Object.values(this.state.loadingStates).some(loading => loading);
    }
    /**
     * Toggles between preview and raw mode for a message
     */
    toggleMessagePreviewMode(messageEl, message) {
        this.logger.logFunctionEntry('toggleMessagePreviewMode', { messageId: message.id });
        try {
            const currentMode = messageEl.getAttribute('data-preview-mode');
            const contentEl = messageEl.querySelector('.chat-message-content');
            if (!contentEl)
                return;
            if (currentMode === 'rendered') {
                // Switch to raw mode (editable)
                messageEl.setAttribute('data-preview-mode', 'raw');
                // Create textarea for editing
                const textarea = document.createElement('textarea');
                textarea.className = 'chat-message-edit';
                textarea.value = message.content;
                textarea.style.width = '100%';
                textarea.style.minHeight = '100px';
                textarea.style.resize = 'vertical';
                // Create save/cancel buttons
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'chat-edit-buttons';
                buttonContainer.style.marginTop = '8px';
                buttonContainer.style.display = 'flex';
                buttonContainer.style.gap = '8px';
                const saveBtn = document.createElement('button');
                saveBtn.textContent = 'Save';
                saveBtn.className = 'chat-save-btn';
                saveBtn.style.padding = '4px 12px';
                saveBtn.style.borderRadius = '4px';
                saveBtn.style.background = '#4a9eff';
                saveBtn.style.color = 'white';
                saveBtn.style.border = 'none';
                saveBtn.style.cursor = 'pointer';
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = 'Cancel';
                cancelBtn.className = 'chat-cancel-btn';
                cancelBtn.style.padding = '4px 12px';
                cancelBtn.style.borderRadius = '4px';
                cancelBtn.style.background = '#666';
                cancelBtn.style.color = 'white';
                cancelBtn.style.border = 'none';
                cancelBtn.style.cursor = 'pointer';
                buttonContainer.appendChild(saveBtn);
                buttonContainer.appendChild(cancelBtn);
                // Clear content and add editor
                contentEl.innerHTML = '';
                contentEl.appendChild(textarea);
                contentEl.appendChild(buttonContainer);
                // Focus textarea
                textarea.focus();
                textarea.select();
                // Handle save
                saveBtn.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
                    const newContent = textarea.value.trim();
                    if (newContent && newContent !== message.content) {
                        // Create a new branch with edited content
                        yield this.createBranchFromEdit(message.nodeId, message.type, newContent);
                    }
                    // Revert to preview mode
                    this.toggleMessagePreviewMode(messageEl, Object.assign(Object.assign({}, message), { content: newContent }));
                }));
                // Handle cancel
                cancelBtn.addEventListener('click', () => {
                    // Revert to preview mode without saving
                    this.toggleMessagePreviewMode(messageEl, message);
                });
                // Handle Escape key
                textarea.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        cancelBtn.click();
                    }
                });
            }
            else {
                // Switch back to rendered mode
                messageEl.setAttribute('data-preview-mode', 'rendered');
                // Re-render the content
                if (message.type === ChatMessageType.ASSISTANT_RESPONSE ||
                    message.type === ChatMessageType.USER_MARKDOWN) {
                    contentEl.innerHTML = markdownProcessor.renderMarkdown(message.content, message.type);
                }
                else {
                    contentEl.textContent = message.content;
                }
                // Re-add double-click handler
                contentEl.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    this.toggleMessagePreviewMode(messageEl, message);
                });
            }
        }
        catch (error) {
            this.logger.logError(error, 'toggleMessagePreviewMode');
        }
        finally {
            this.logger.logFunctionExit('toggleMessagePreviewMode');
        }
    }
    /**
     * Creates a new branch from an edited message
     */
    createBranchFromEdit(nodeId, messageType, newContent) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('createBranchFromEdit', { nodeId, messageType, contentLength: newContent.length });
            try {
                const branchingService = this.graphEditor.getBranchingService();
                const versionHistoryManager = this.graphEditor.getVersionHistoryManager();
                // Handle different message types
                if (messageType === ChatMessageType.USER_PROMPT) {
                    // For prompts, find the prompt block and create a branch
                    const node = this.graphEditor.getNode(nodeId);
                    if (node) {
                        const promptBlock = node.blocks.find(b => b.type === 'prompt');
                        if (promptBlock) {
                            const branchResult = yield branchingService.createBranchFromEdit(nodeId, promptBlock.id, newContent, EditSource.CHAT_INTERFACE);
                            if (branchResult.success) {
                                // Get the new node from the branching service
                                const newNode = branchingService.getNode(branchResult.newNodeId);
                                if (newNode) {
                                    // Add the node to the graph editor
                                    this.graphEditor.addNodeToGraph(newNode);
                                }
                                versionHistoryManager.recordBranch(branchResult.branchMetadata);
                                yield this.openChatForNode(branchResult.newNodeId);
                                this.logger.logInfo('Prompt branch created', 'createBranchFromEdit', {
                                    originalNodeId: nodeId,
                                    newNodeId: branchResult.newNodeId
                                });
                            }
                        }
                    }
                }
                else if (messageType === ChatMessageType.ASSISTANT_RESPONSE) {
                    // For responses, find the response block and create a branch
                    this.logger.logInfo('Creating branch for response edit', 'createBranchFromEdit', {
                        nodeId,
                        messageType,
                        contentPreview: newContent.substring(0, 50)
                    });
                    const node = this.graphEditor.getNode(nodeId);
                    if (node) {
                        const responseBlock = node.blocks.find(b => b.type === 'response');
                        if (responseBlock) {
                            this.logger.logInfo('Found response block, creating branch', 'createBranchFromEdit', {
                                blockId: responseBlock.id,
                                blockType: responseBlock.type
                            });
                            const branchResult = yield branchingService.createBranchFromEdit(nodeId, responseBlock.id, newContent, EditSource.CHAT_INTERFACE);
                            if (branchResult.success) {
                                // Get the new node from the branching service
                                const newNode = branchingService.getNode(branchResult.newNodeId);
                                if (newNode) {
                                    // Add the node to the graph editor
                                    this.graphEditor.addNodeToGraph(newNode);
                                }
                                versionHistoryManager.recordBranch(branchResult.branchMetadata);
                                yield this.openChatForNode(branchResult.newNodeId);
                                this.logger.logInfo('Response branch created successfully', 'createBranchFromEdit', {
                                    originalNodeId: nodeId,
                                    newNodeId: branchResult.newNodeId
                                });
                            }
                            else {
                                this.logger.logWarn('Branch creation failed', 'createBranchFromEdit', {
                                    nodeId,
                                    blockId: responseBlock.id
                                });
                            }
                        }
                        else {
                            this.logger.logWarn('No response block found in node', 'createBranchFromEdit', {
                                nodeId,
                                blockTypes: node.blocks.map(b => b.type)
                            });
                        }
                    }
                    else {
                        this.logger.logWarn('Node not found for response edit', 'createBranchFromEdit', {
                            nodeId
                        });
                    }
                }
                else if (messageType === ChatMessageType.USER_MARKDOWN) {
                    // For markdown, update in place (no branching)
                    const node = this.graphEditor.getNode(nodeId);
                    if (node) {
                        const mdBlock = node.blocks.find(b => b.type === 'markdown');
                        if (mdBlock) {
                            yield this.graphEditor.updateBlockContent(nodeId, mdBlock.id, newContent);
                            this.logger.logInfo('Markdown updated in place', 'createBranchFromEdit', { nodeId });
                        }
                    }
                }
            }
            catch (error) {
                this.logger.logError(error, 'createBranchFromEdit');
                this.showError('Failed to create branch from edit: ' + error.message);
            }
            finally {
                this.logger.logFunctionExit('createBranchFromEdit');
            }
        });
    }
    /**
     * Cleans up the component and removes event listeners.
     */
    destroy() {
        this.logger.logFunctionEntry('destroy');
        try {
            // Remove event listeners
            for (const { element, event, handler } of this.eventListeners) {
                element.removeEventListener(event, handler);
            }
            this.eventListeners = [];
            // Remove DOM elements
            if (this.panelElement && this.panelElement.parentNode) {
                this.panelElement.parentNode.removeChild(this.panelElement);
            }
            // Clear references
            this.panelElement = null;
            this.headerElement = null;
            this.messagesElement = null;
            this.inputContainerElement = null;
            this.inputElement = null;
            this.sendButtonElement = null;
            this.closeButtonElement = null;
            this.resizeHandleElement = null;
            this.logger.logInfo('component_destroyed', 'destroy');
        }
        finally {
            this.logger.logFunctionExit('destroy');
        }
    }
}
