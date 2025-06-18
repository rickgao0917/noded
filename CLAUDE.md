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

**Docker Development:**
```bash
# Build and run with Docker Compose
docker-compose up -d      # Start container in background
docker-compose down       # Stop and remove container
docker-compose logs -f    # View container logs

# Manual Docker commands
docker build -t noded .   # Build image
docker run -p 6001:8000 noded  # Run container
```

**Port Configuration:**
- Local development: Port 8000 (Python HTTP server)
- Docker container: Port 6001 (mapped to internal 8000)
- Access via: `http://localhost:6001` when using Docker

**Port Conflict Resolution:**
If port 8000 is in use locally:
- Use `lsof -ti:8000 | xargs kill -9` to kill processes on port 8000
- Or use `python3 -m http.server 8001` to run on a different port
- Or directly open `standalone.html` in your browser (no server needed)
- Or use Docker which runs on port 6001

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
- GraphNode interface includes custom `name` field for user-defined labels
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

This project strictly adheres to the comprehensive TypeScript coding standards defined in `ts_readme.xml`. Key requirements include:

**Project Structure (per ts_readme.xml):**
- Kebab-case file naming: `graph-editor.ts`, `type-guards.ts`, `tree-layout.ts`
- Type files use `.types.ts` suffix: `graph.types.ts`, `errors.ts`
- Directory structure follows: `/src/types`, `/src/utils`, `/src/components`
- Import organization: external libraries → internal absolute → relative imports

**Type Safety Requirements (mandatory per ts_readme.xml):**
- All function parameters must have explicit types
- Function return types are mandatory
- Runtime type guards required for all external data
- Discriminated unions for state management
- Branded types for domain-specific values (node IDs, etc.)
- `readonly` modifiers for immutable data structures

**Naming Conventions (enforced from ts_readme.xml):**
- Variables/functions: `camelCase` (e.g., `nodeCounter`, `addChild`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `NODE_WIDTH`, `NODE_HEIGHT`)
- Interfaces/types: `PascalCase` (e.g., `GraphNode`, `NodeBlock`)
- Boolean variables prefix: `is`, `has`, `can`, `should`
- Functions prefix with verbs: `validateGraphNode`, `calculateTreeLayout`

**TypeScript Compiler Settings (strict mode required):**
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "exactOptionalPropertyTypes": true,
  "noUncheckedIndexedAccess": true
}
```

**Logging Standards (custom extension of ts_readme.xml):**
- 100% function coverage with entry/exit logging
- Branch coverage for all conditional statements  
- Performance metrics with automatic warnings (>10ms)
- Structured JSON output with correlation IDs
- User interaction tracking with detailed context

**Error Handling Patterns:**
- Custom error hierarchy with structured context
- User-friendly messages separated from technical details
- Domain-specific error types for different failure modes
- Full error context including function name and parameters

**Code Documentation:**
- JSDoc required for all public APIs
- Complex generics must include usage examples
- Runtime validation logic must be documented
- Type guards must specify validation rules

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

### Recent Improvements (2025-06-18)

**Performance Optimizations:**
- **Enhanced Dragging Speed**: Added damping factor (1.2x) for canvas panning and acceleration factor (1.1x) for node dragging
- **Smooth Transitions**: Removed position transitions from nodes, kept only for visual feedback (borders, shadows)
- **CSS Performance**: Added `will-change: transform` for better rendering performance

**Initial Features:**
- **Zoom Functionality**: 
  - Mouse wheel zoom (0.1x to 5x range) centered on cursor position
  - Zoom In/Out buttons with fixed step increments (0.2)
  - Zoom controls integrated with existing pan and drag functionality
  - Reset View also resets zoom to default (1x)

**Auto-Layout System:**
- **Intelligent Tree Layout**: Auto Layout button that reorganizes the entire graph with optimal spacing
- **Dynamic Spacing**: Prevents node overlapping with configurable horizontal (200px) and vertical (300px) spacing
- **Multiple Root Support**: Handles graphs with multiple root nodes, spacing them horizontally
- **Animated Transitions**: Smooth 0.5s animations when nodes move to new positions
- **View Centering**: Automatically centers the view on the graph after layout
- **Adaptive Heights**: Layout algorithm considers actual node heights including collapsed/expanded states

**Enhanced Node Functionality:**
- **Node Collapsing**: 
  - Collapse/expand entire nodes to show only headers
  - Visual indicators (▼/▶) for collapse state
  - Collapsed nodes use minimal vertical space (60px)
  - Auto-layout respects collapsed node dimensions
- **Node Renaming**:
  - Editable node names with inline text input
  - Custom names preserved throughout operations
  - Original node ID shown in small text
  - Enter key or blur to save changes
- **Node Resizing**:
  - Drag handle (⋮⋮) at bottom-right corner
  - Resize nodes between 300-600px width
  - Flexible height adjustment with no upper limit
  - Real-time connection line updates during resize

**Block Improvements:**
- **Block Minimizing**: 
  - Individual blocks can be minimized to show only headers
  - Dynamic titles showing content preview or type
  - Smooth expand/collapse animations
- **Block Resizing**:
  - Drag handles for textarea height adjustment (60-400px)
  - Independent sizing for each block
- **Simplified Headers**:
  - Prompt blocks: "Prompt"
  - Response blocks: "Response"
  - Markdown blocks: "MD #1", "MD #2", etc.
- **Centralized Controls**:
  - "+ MD" button moved to node header
  - No duplicate buttons in individual blocks

**Connection Line Enhancements:**
- **Dynamic Sizing**: Lines adjust based on actual node dimensions
- **Collapsed Node Support**: Proper connections for nodes of any size
- **Real-time Updates**: Connections update during node resize operations
- **Clean Paths**: Smooth curved lines from parent bottom to child top

**User Interface Updates:**
- Added Auto Layout button to control panel
- Node names are editable with hover/focus states
- Resize handles appear on hover for clean interface
- Updated help text to include new controls
- Consistent styling for all interactive elements

**Bug Fixes:**
- Fixed SVG connection rendering issues where lines were sometimes half-rendered
- Added `overflow: visible` to SVG elements for proper line display
- Improved SVG element initialization with proper width/height attributes
- Fixed overlapping issues in auto-layout with proper dimension calculations

### Docker Configuration

**Container Architecture:**
- Multi-stage build process for optimized production image
- Build stage: Node.js 18 Alpine for TypeScript compilation
- Runtime stage: Python 3.11 Alpine for minimal HTTP server
- Final image size optimized by copying only built artifacts

**Docker Files:**
- `Dockerfile`: Multi-stage build configuration
- `docker-compose.yml`: Service orchestration with volume mounts
- Port mapping: External 6001 → Internal 8000
- Automatic restart policy: `unless-stopped`

**Volume Mounts (read-only):**
```yaml
- ./dist:/app/dist:ro        # Compiled JavaScript
- ./index.html:/app/index.html:ro     # Main application
- ./standalone.html:/app/standalone.html:ro  # Standalone version
```

**Docker Commands:**
```bash
# Development with hot reload (requires local build)
docker-compose up -d
docker-compose logs -f

# Production build
docker build -t noded:latest .
docker run -d -p 6001:8000 --name noded-app noded:latest

# Maintenance
docker-compose down          # Stop and remove
docker-compose restart       # Restart service
docker exec -it noded-app sh # Access container shell
```

### Development Notes

**Deployment Options:**
- `index.html` - Modular version using ES6 imports (requires HTTP server)
- `standalone.html` - Self-contained version with inlined code (direct browser access, no server needed)
- Docker container - Production-ready deployment with automated builds

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
- **Strictly follow `ts_readme.xml` standards for all code modifications:**
  - Check naming conventions before creating new files/variables
  - Ensure all functions have explicit return types
  - Add runtime type guards for external data
  - Use `readonly` modifiers for immutable structures
  - Maintain import organization order
  - Document complex types with JSDoc and examples
- Run `npm run typecheck` to verify strict TypeScript compliance
- Use `npm run lint` to ensure code style consistency (when ESLint is configured)