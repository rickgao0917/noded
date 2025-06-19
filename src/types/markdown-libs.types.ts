/**
 * Type definitions for markdown and syntax highlighting libraries
 */

export interface MarkedOptions {
  highlight?: (code: string, lang: string) => string;
  breaks?: boolean;
  gfm?: boolean;
  headerIds?: boolean;
  langPrefix?: string;
  mangle?: boolean;
  pedantic?: boolean;
  sanitize?: boolean;
  silent?: boolean;
  smartLists?: boolean;
  smartypants?: boolean;
  xhtml?: boolean;
}

export interface MarkedStatic {
  parse(markdown: string): string;
  setOptions(options: MarkedOptions): void;
  use(extension: unknown): void;
}

export interface HljsResult {
  value: string;
  language?: string;
  relevance?: number;
  top?: unknown;
}

export interface HljsStatic {
  highlight(code: string, options: { language: string }): HljsResult;
  highlightAuto(code: string): HljsResult;
  highlightElement(element: Element): void;
  configure(options: unknown): void;
  listLanguages(): string[];
}

// Extend Window interface to include these libraries
declare global {
  interface Window {
    marked?: MarkedStatic;
    hljs?: HljsStatic;
  }
}

export {};