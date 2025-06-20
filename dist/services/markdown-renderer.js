/**
 * Enhanced markdown rendering service with comprehensive feature support
 *
 * Builds on the existing MarkdownProcessor to add advanced features like
 * math rendering, diagrams, caching, and performance monitoring.
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
import { MarkdownProcessor } from '../utils/markdown.js';
import { DEFAULT_RENDER_OPTIONS } from '../types/markdown.types.js';
/**
 * LRU Cache implementation for rendered content
 */
class LRUCache {
    constructor(maxSize) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }
    set(key, value) {
        // Remove oldest if at capacity
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        // Delete and re-add to move to end
        this.cache.delete(key);
        this.cache.set(key, value);
    }
    clear() {
        this.cache.clear();
    }
    get size() {
        return this.cache.size;
    }
}
/**
 * Enhanced markdown renderer with advanced features
 */
export class MarkdownRenderer {
    constructor() {
        this.performanceThreshold = 100; // ms
        this.logger = new Logger('MarkdownRenderer');
        this.markdownProcessor = new MarkdownProcessor();
        this.renderCache = new LRUCache(50);
    }
    /**
     * Renders markdown content to HTML with all features
     */
    renderMarkdown(content_1) {
        return __awaiter(this, arguments, void 0, function* (content, options = DEFAULT_RENDER_OPTIONS, correlationId) {
            var _a, _b, _c, _d;
            const startTime = performance.now();
            this.logger.logFunctionEntry('renderMarkdown', {
                contentLength: content.length,
                options,
                correlationId
            });
            try {
                // Check cache first
                const cacheKey = this.generateCacheKey(content, options);
                const cached = this.renderCache.get(cacheKey);
                if (cached) {
                    this.logger.logDebug('Cache hit for markdown content', 'renderMarkdown', {
                        cacheKey,
                        correlationId
                    });
                    const metrics = {
                        parseTime: 0,
                        sanitizeTime: 0,
                        highlightTime: 0,
                        mathTime: 0,
                        diagramTime: 0,
                        totalTime: performance.now() - startTime,
                        cacheHit: true
                    };
                    this.logPerformanceMetrics(metrics, correlationId);
                    this.logger.logFunctionExit('renderMarkdown', { cached: true });
                    return cached;
                }
                // Track individual stage times
                const stageStartTime = performance.now();
                // Basic markdown rendering with syntax highlighting
                let html = yield this.markdownProcessor.renderMarkdown(content);
                const parseTime = performance.now() - stageStartTime;
                // Process math if enabled
                const mathStartTime = performance.now();
                if (options.enableMath && this.hasMathContent(content)) {
                    html = yield this.renderMathBlocks(html, correlationId);
                }
                const mathTime = performance.now() - mathStartTime;
                // Process diagrams if enabled
                const diagramStartTime = performance.now();
                if (options.enableDiagrams && this.hasDiagramContent(content)) {
                    html = yield this.renderMermaidDiagrams(html, correlationId);
                }
                const diagramTime = performance.now() - diagramStartTime;
                // Sanitize if enabled
                const sanitizeStartTime = performance.now();
                if (options.sanitize) {
                    html = this.sanitizeHtml(html, correlationId);
                }
                const sanitizeTime = performance.now() - sanitizeStartTime;
                // Apply theme-specific classes
                if (options.theme && options.theme !== 'default') {
                    html = `<div class="markdown-theme-${options.theme}">${html}</div>`;
                }
                const totalTime = performance.now() - startTime;
                // Create result
                const result = {
                    html,
                    renderTime: totalTime,
                    usedFeatures: {
                        syntaxHighlighting: (_a = options.enableSyntaxHighlighting) !== null && _a !== void 0 ? _a : true,
                        mathRendering: ((_b = options.enableMath) !== null && _b !== void 0 ? _b : true) && this.hasMathContent(content),
                        diagramSupport: ((_c = options.enableDiagrams) !== null && _c !== void 0 ? _c : true) && this.hasDiagramContent(content),
                        emojiSupport: (_d = options.enableEmoji) !== null && _d !== void 0 ? _d : true
                    },
                    warnings: this.collectWarnings(content, html)
                };
                // Cache the result
                this.renderCache.set(cacheKey, result);
                // Log performance metrics
                const metrics = {
                    parseTime,
                    sanitizeTime,
                    highlightTime: 0, // Included in parseTime
                    mathTime,
                    diagramTime,
                    totalTime,
                    cacheHit: false
                };
                this.logPerformanceMetrics(metrics, correlationId);
                this.logger.logFunctionExit('renderMarkdown', {
                    htmlLength: html.length,
                    renderTime: totalTime
                });
                return result;
            }
            catch (error) {
                this.logger.logError(error, 'renderMarkdown', {
                    contentLength: content.length,
                    options,
                    correlationId
                });
                throw error;
            }
        });
    }
    /**
     * Renders math expressions using KaTeX
     */
    renderMathBlocks(html, correlationId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('renderMathBlocks', { correlationId });
            try {
                if (typeof window !== 'undefined' && 'katex' in window) {
                    const katex = window.katex;
                    // renderMathInElement is available but not used in this implementation
                    // Create a temporary container
                    const container = document.createElement('div');
                    container.innerHTML = html;
                    // Process inline math ($...$)
                    const inlineRegex = /\$([^\$]+)\$/g;
                    container.innerHTML = container.innerHTML.replace(inlineRegex, (match, math) => {
                        try {
                            return katex.renderToString(math, {
                                displayMode: false,
                                throwOnError: false
                            });
                        }
                        catch (e) {
                            this.logger.logWarn(`Failed to render inline math: ${math}`, 'renderMathBlocks', {
                                error: e,
                                correlationId
                            });
                            return `<code class="math-error">${match}</code>`;
                        }
                    });
                    // Process display math ($$...$$)
                    const displayRegex = /\$\$([^\$]+)\$\$/g;
                    container.innerHTML = container.innerHTML.replace(displayRegex, (match, math) => {
                        try {
                            return katex.renderToString(math, {
                                displayMode: true,
                                throwOnError: false
                            });
                        }
                        catch (e) {
                            this.logger.logWarn(`Failed to render display math: ${math}`, 'renderMathBlocks', {
                                error: e,
                                correlationId
                            });
                            return `<pre class="math-error">${match}</pre>`;
                        }
                    });
                    html = container.innerHTML;
                }
                this.logger.logFunctionExit('renderMathBlocks');
                return html;
            }
            catch (error) {
                this.logger.logError(error, 'renderMathBlocks', { correlationId });
                return html; // Return original HTML on error
            }
        });
    }
    /**
     * Renders Mermaid diagrams
     */
    renderMermaidDiagrams(html, correlationId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.logFunctionEntry('renderMermaidDiagrams', { correlationId });
            try {
                if (typeof window !== 'undefined' && 'mermaid' in window) {
                    const mermaid = window.mermaid;
                    // Find all mermaid code blocks
                    const mermaidRegex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;
                    let match;
                    let diagramId = 0;
                    while ((match = mermaidRegex.exec(html)) !== null) {
                        const diagramCode = match[1] || '';
                        const elementId = `mermaid-diagram-${Date.now()}-${diagramId++}`;
                        try {
                            // Create a temporary container
                            const container = document.createElement('div');
                            container.id = elementId;
                            container.textContent = this.unescapeHtml(diagramCode);
                            // Render the diagram
                            const diagramText = container.textContent || '';
                            const { svg } = yield mermaid.render(elementId, diagramText);
                            // Replace the code block with the rendered diagram
                            html = html.replace(match[0], `<div class="mermaid-diagram">${svg}</div>`);
                        }
                        catch (e) {
                            this.logger.logWarn('Failed to render Mermaid diagram', 'renderMermaidDiagrams', {
                                error: e,
                                diagramCode,
                                correlationId
                            });
                            // Keep the original code block with error styling
                            html = html.replace(match[0], `<pre class="diagram-error"><code>${match[1]}</code></pre>`);
                        }
                    }
                }
                this.logger.logFunctionExit('renderMermaidDiagrams');
                return html;
            }
            catch (error) {
                this.logger.logError(error, 'renderMermaidDiagrams', { correlationId });
                return html; // Return original HTML on error
            }
        });
    }
    /**
     * Sanitizes HTML output using DOMPurify
     */
    sanitizeHtml(html, correlationId) {
        this.logger.logFunctionEntry('sanitizeHtml', { correlationId });
        try {
            if (typeof window !== 'undefined' && 'DOMPurify' in window) {
                const DOMPurify = window.DOMPurify;
                const config = {
                    ALLOWED_TAGS: [
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                        'p', 'br', 'hr', 'strong', 'em', 'u', 's', 'code', 'pre',
                        'blockquote', 'ul', 'ol', 'li', 'a', 'img',
                        'table', 'thead', 'tbody', 'tr', 'th', 'td',
                        'div', 'span', 'svg', 'g', 'path', 'rect', 'circle', 'text', 'line',
                        'math', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'msqrt',
                        'input' // For task lists
                    ],
                    ALLOWED_ATTR: [
                        'href', 'src', 'alt', 'title', 'class', 'id',
                        'type', 'checked', 'disabled', // For task lists
                        'viewBox', 'width', 'height', 'd', 'fill', 'stroke', // For SVG
                        'x', 'y', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2'
                    ],
                    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
                    KEEP_CONTENT: true,
                    IN_PLACE: true
                };
                html = DOMPurify.sanitize(html, config);
            }
            this.logger.logFunctionExit('sanitizeHtml');
            return html;
        }
        catch (error) {
            this.logger.logError(error, 'sanitizeHtml', { correlationId });
            return html; // Return original HTML on error
        }
    }
    /**
     * Checks if content contains math expressions
     */
    hasMathContent(content) {
        return /\$[^\$]+\$|\$\$[^\$]+\$\$/.test(content);
    }
    /**
     * Checks if content contains diagram code
     */
    hasDiagramContent(content) {
        return /```mermaid[\s\S]*?```/.test(content);
    }
    /**
     * Generates a cache key for rendered content
     */
    generateCacheKey(content, options) {
        const optionsStr = JSON.stringify(options);
        return `${content.length}-${this.hashString(content)}-${this.hashString(optionsStr)}`;
    }
    /**
     * Simple string hash function
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
    /**
     * Unescapes HTML entities
     */
    unescapeHtml(html) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = html;
        return textarea.value;
    }
    /**
     * Collects warnings from the rendering process
     */
    collectWarnings(content, _html) {
        const warnings = [];
        // Check for unclosed math expressions
        const mathOpens = (content.match(/\$/g) || []).length;
        if (mathOpens % 2 !== 0) {
            warnings.push('Unclosed math expression detected');
        }
        // Check for potential XSS attempts
        if (/<script|javascript:|on\w+=/i.test(content)) {
            warnings.push('Potentially unsafe content was sanitized');
        }
        // Check for broken links
        const brokenLinkRegex = /\[([^\]]+)\]\(\s*\)/g;
        if (brokenLinkRegex.test(content)) {
            warnings.push('Empty link URL detected');
        }
        return warnings;
    }
    /**
     * Logs performance metrics with warnings for slow operations
     */
    logPerformanceMetrics(metrics, correlationId) {
        const context = {
            metrics,
            correlationId,
            performanceThreshold: this.performanceThreshold
        };
        if (metrics.totalTime > this.performanceThreshold) {
            this.logger.logWarn(`Markdown rendering took ${metrics.totalTime.toFixed(2)}ms (threshold: ${this.performanceThreshold}ms)`, 'logPerformanceMetrics', context);
        }
        else {
            this.logger.logDebug(`Markdown rendering completed in ${metrics.totalTime.toFixed(2)}ms`, 'logPerformanceMetrics', context);
        }
    }
    /**
     * Clears the render cache
     */
    clearCache() {
        this.logger.logInfo('Clearing render cache', 'clearCache', {
            cacheSize: this.renderCache.size
        });
        this.renderCache.clear();
    }
}
