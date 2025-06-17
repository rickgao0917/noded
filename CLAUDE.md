# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a graph-based node editor built with TypeScript that renders an interactive tree of conversation nodes. Each node contains multiple blocks (prompt, response, markdown) and represents a conversation state, with child nodes representing edits or variations creating a guaranteed tree structure with DOM-based rendering.

## Development Commands

**Build and Development:**
```bash
npm run build           # Compile TypeScript to dist/
npm run build:strict    # Full build with strict checking and linting
npm run dev             # Watch mode compilation  
npm run serve           # Start Python HTTP server on port 8000
npm run start           # Build and start server
npm run typecheck       # Type checking without compilation
npm run lint            # ESLint with zero warnings tolerance
```

**Local Development Workflow:**
1. `npm run build` - Compile TypeScript
2. `npm run serve` - Start Python server on port 8000 (or use alternative port if 8000 is busy)
3. Open `http://localhost:8000` for the modular version or open `standalone.html` directly in browser

**Port Issues:**
If port 8000 is in use, you can:
- Use `lsof -ti:8000 | xargs kill -9` to kill processes on port 8000
- Or use `python3 -m http.server 8001` to run on a different port
- Or directly open `standalone.html` in your browser (no server needed)

## Architecture

### Core Design Principles

**Comprehensive Logging Architecture:**
- Every function has entry/exit logging with performance metrics
- Branch coverage logging for all conditional statements
- Structured JSON logging with correlation IDs and sanitization
- 100% function coverage requirement following ts_readme.xml standards

**Error Handling System:**
- Custom error hierarchy: BaseError → NodeEditorError, DOMError, ValidationError, TreeStructureError
- User-friendly error messages with technical details separated
- Full error context including function name, parameters, and correlation IDs
- Global error handlers for unhandled exceptions and promise rejections

**Runtime Validation:**
- Type guards for all data structures (GraphNode, NodeBlock, Position)
- Comprehensive validation with detailed error reporting
- Tree integrity validation preventing cycles and orphaned references

### Key Components

**GraphEditor Class** (`src/components/graph-editor.ts`):
- Main application class with ~1500 lines of comprehensive logging
- Manages DOM manipulation, event coordination, and node lifecycle
- Tree layout calculation and SVG connection rendering
- Coordinates between DOM elements: canvas, canvasContent, connectionsEl
- Every method has full logging coverage (entry/exit/branches/performance)

**Tree Data Structure:**
- Nodes stored in `Map<string, GraphNode>` for O(1) lookup
- Each node maintains `children: string[]` array for tree relationships
- Tree layout algorithm (`utils/tree-layout.ts`) calculates positions based on subtree width
- Guaranteed tree structure with cycle detection and integrity validation

**Logging System** (`src/utils/logger.ts`):
- Six log levels: TRACE, DEBUG, INFO, WARN, ERROR, FATAL
- Structured JSON output with correlation IDs, session tracking
- Parameter sanitization for sensitive data
- Performance metric tracking with automatic warnings for slow operations
- Browser console logging with comprehensive context

**Validation System** (`src/utils/type-guards.ts`):
- Runtime type guards for all interfaces
- Validator class with assertion-style methods
- Tree integrity validation with detailed error reporting
- DOM element validation with proper error context

### File Organization

```
src/
├── types/
│   ├── graph.types.ts       # Core interfaces (GraphNode, NodeBlock, Position)
│   └── errors.ts            # Custom error hierarchy with context
├── components/
│   └── graph-editor.ts      # Main GraphEditor class with comprehensive logging
├── utils/
│   ├── logger.ts            # Structured logging system
│   ├── type-guards.ts       # Runtime validation and type guards
│   └── tree-layout.ts       # Tree positioning algorithm
└── index.ts                 # DOM setup, event delegation, global error handling
```

### TypeScript Standards Compliance

This project strictly follows the comprehensive standards defined in `ts_readme.xml`:

**Logging Requirements:**
- 100% function coverage with entry/exit logging
- Branch coverage for all conditional statements  
- Performance metrics for all operations
- Structured JSON output with correlation tracking

**Error Handling:**
- Custom error classes with user-friendly messages
- Full error context with function names and parameters
- Domain-specific errors (NodeEditorError, DOMError, ValidationError, TreeStructureError)

**Code Quality:**
- Kebab-case file naming (graph-editor.ts, type-guards.ts)
- JSDoc documentation for all public APIs
- Runtime validation for all inputs
- Strict TypeScript configuration with all safety checks enabled

### Implementation Details

**Tree Layout Algorithm** (`utils/tree-layout.ts`):
- Calculates subtree widths recursively to determine node spacing
- Positions nodes at fixed vertical levels based on depth
- Handles multiple root nodes with horizontal offset
- Comprehensive JSDoc documentation with examples

**DOM Architecture:**
- Canvas element for panning/background interactions
- CanvasContent element for transform operations (scale/pan)
- SVG element for connection lines between parent/child nodes
- Individual node elements positioned absolutely with CSS transforms

**Event Handling Pattern:**
- Global event delegation in `index.ts` with comprehensive error boundaries
- Canvas panning via mousedown/mousemove with proper state management
- Node dragging with collision detection and position validation
- All user interactions logged with context and performance metrics

**Error Recovery:**
- Global error handlers for uncaught exceptions and promise rejections
- User-friendly error display with technical details logged separately
- Graceful degradation for DOM manipulation failures
- Comprehensive validation preventing invalid tree states

### Development Notes

**Deployment Options:**
- `index.html` - Modular version using ES6 imports (requires HTTP server)
- `standalone.html` - Self-contained version with inlined code (direct browser access, no server needed)

**Logging Philosophy:**
- Every function call produces structured JSON logs in browser console
- Performance metrics automatically track execution times with warnings for slow operations (>10ms)
- Branch coverage ensures all code paths are observable
- Correlation IDs enable request tracing across function calls
- User interactions logged with detailed context (mouse events, keyboard input, node operations)

**Validation Strategy:**
- Runtime type checking for all external inputs using comprehensive type guards
- Tree structure integrity validation on every modification to prevent cycles
- DOM element validation with proper error context and user-friendly messages
- Comprehensive error messages for debugging and user feedback
- Textarea elements have proper accessibility attributes (id, name, autocomplete)

**Development Best Practices:**
- Always run `npm run build` before testing changes
- Use browser developer tools to view structured logging output
- Maintain the comprehensive logging, error handling, and validation patterns established throughout the system
- Follow ts_readme.xml standards for all code modifications