/**
 * Jest test setup file
 * 
 * Global test configuration and mocks for the node editor test suite.
 * Ensures consistent test environment across all test files.
 */

// Mock DOM APIs that aren't available in jsdom
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock performance API for logging tests
Object.defineProperty(global, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  },
  writable: true,
});

// Mock fetch for API tests
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock console methods for logging tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock URL.createObjectURL for export tests
global.URL.createObjectURL = jest.fn(() => 'mocked-url');
global.URL.revokeObjectURL = jest.fn();

// Mock HTMLElement methods
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  value: 400,
});

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  value: 250,
});

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: jest.fn(() => ({
    x: 0,
    y: 0,
    width: 400,
    height: 250,
    top: 0,
    left: 0,
    bottom: 250,
    right: 400,
    toJSON: jest.fn(),
  })),
});

// Mock SVG namespace for connection rendering tests
document.createElementNS = jest.fn((namespace: string, tagName: string) => {
  const element = document.createElement(tagName) as any;
  element.setAttribute = jest.fn();
  
  // Add SVG-specific properties for type compatibility
  if (namespace === 'http://www.w3.org/2000/svg') {
    element.ownerSVGElement = null;
    element.viewportElement = null;
  }
  
  return element;
}) as any;

// Setup cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset DOM
  document.body.innerHTML = '';
  
  // Reset any global state that might affect tests
  if (global.fetch) {
    (global.fetch as jest.Mock).mockReset();
  }
});

// Global test utilities
export const createMockNode = (id: string, overrides: any = {}) => ({
  id,
  name: `Node ${id}`,
  parentId: null,
  children: [],
  blocks: [],
  position: { x: 0, y: 0 },
  depth: 0,
  ...overrides,
});

export const createMockBlock = (id: string, type: 'chat' | 'response' | 'markdown' = 'chat', content?: string, overrides: any = {}) => ({
  id,
  type,
  content: content !== undefined ? content : `Test ${type} content`,
  position: 0,
  ...overrides,
});

export const createMockDOMElement = (tagName: string = 'div', id?: string) => {
  const element = document.createElement(tagName);
  if (id) {
    element.id = id;
  }
  
  // Add common DOM methods that tests might need
  element.querySelector = jest.fn();
  element.querySelectorAll = jest.fn();
  element.appendChild = jest.fn();
  element.removeChild = jest.fn();
  element.addEventListener = jest.fn();
  element.removeEventListener = jest.fn();
  
  return element;
};

// Export for use in tests
export { originalConsole };

export const mockPerformance = global.performance;