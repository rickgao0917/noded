/**
 * Type definitions for Quill editor
 */

export interface QuillOptions {
  theme?: string;
  placeholder?: string;
  readOnly?: boolean;
  modules?: {
    toolbar?: Array<
      | string
      | Array<string | { [key: string]: string | number | boolean | Array<number | boolean> }>
      | { [key: string]: string | number | boolean | Array<number | boolean> }
    >;
    [key: string]: unknown;
  };
}

export interface QuillDelta {
  ops: QuillOperation[];
}

export interface QuillOperation {
  insert?: string | { [key: string]: unknown };
  delete?: number;
  retain?: number;
  attributes?: QuillAttributes;
}

export interface QuillAttributes {
  header?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  blockquote?: boolean;
  'code-block'?: boolean;
  list?: 'ordered' | 'bullet';
  link?: string;
  code?: boolean;
  [key: string]: unknown;
}

export interface QuillInstance {
  root: HTMLElement;
  container: HTMLElement;
  getText(): string;
  setContents(delta: QuillDelta): void;
  updateContents(delta: QuillDelta): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  enable(enabled: boolean): void;
  disable(): void;
  getContents(): QuillDelta;
  getLength(): number;
  deleteText(index: number, length: number): void;
  insertText(index: number, text: string, attributes?: QuillAttributes): void;
  formatText(index: number, length: number, attributes: QuillAttributes): void;
}

export interface QuillConstructor {
  new (container: HTMLElement | string, options?: QuillOptions): QuillInstance;
}

// Extend Window interface to include Quill
declare global {
  interface Window {
    Quill?: QuillConstructor;
  }
}

export {};