# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a sophisticated graph-based node editor built with TypeScript that renders an interactive tree of conversation nodes with comprehensive features. Each node contains multiple blocks (chat, prompt, response, markdown) representing conversation states, with child nodes creating branches or variations. The system features comprehensive logging, error handling, AI integration (Gemini 2.0 Flash), rich text editing capabilities, and a guaranteed tree structure with DOM-based rendering.

## Development Commands

**Build and Development:**
```bash
npm run build           # Compile TypeScript to dist/
npm run build:strict    # Full build with strict checking and linting
npm run dev             # Watch mode compilation  
npm run serve           # Start Python HTTP server on port 8000
npm run server          # Start Node.js server with Gemini API integration
npm run start           # Build and start Python server
npm run typecheck       # Type checking without compilation
npm run lint            # ESLint with zero warnings tolerance
```

**Testing Commands:**
```bash
npm run test            # Run Jest test suite
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage reports (80% minimum required)
npm run test:ci         # CI-optimized test run with coverage
```

**Code Quality:**
```bash
npm run format          # Format code with Prettier
npm run format:check    # Check code formatting
```

**Local Development Workflow:**
1. `npm run build` - Compile TypeScript
2. `npm run serve` - Start Python server on port 8000 (or use alternative port if 8000 is busy)
3. Open `http://localhost:8000` for the modular version or open `standalone.html` directly in browser
4. Alternative: `npm run server` - Start Node.js server with full API integration

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
- Node.js server: Port 8000 (with API endpoints)
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
│   ├── graph.types.ts           # Core interfaces (GraphNode, NodeBlock, Position)
│   ├── chat-interface.types.ts  # Enhanced chat interface types
│   └── errors.ts                # Custom error hierarchy with context
├── components/
│   └── graph-editor.ts          # Main GraphEditor class with comprehensive logging
├── services/
│   └── gemini-service.ts        # Gemini 2.0 Flash API integration service
├── utils/
│   ├── logger.ts                # Structured logging system
│   ├── type-guards.ts           # Runtime validation and type guards
│   ├── tree-layout.ts           # Tree positioning algorithm
│   ├── markdown.ts              # Markdown processing and syntax highlighting
│   └── quill-manager.ts         # Rich text editor management
└── index.ts                     # DOM setup, event delegation, global error handling
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

## AI Integration and Services

**Gemini 2.0 Flash Integration** (`src/services/gemini-service.ts`):
- Full streaming API support with real-time response chunks
- Comprehensive error handling and retry logic
- Terminal logging for development visibility
- Configurable generation parameters (temperature, topK, topP, maxOutputTokens)
- User-friendly error messages with technical details separated
- Performance tracking and response time monitoring

**Enhanced Chat Interface** (`src/types/chat-interface.types.ts`):
- State management for chat continuation interfaces
- Loading indicator states for API calls
- Multiple input modes: compact, expanded, loading, error
- Branded types for type safety (ChatBlockId, LoadingStateId)
- Comprehensive submission result tracking

**Server Integration** (`server.js`):
- Node.js HTTP server with full API endpoint support
- `/api/submit` endpoint for graph data submission to Gemini API
- CORS handling for cross-origin requests
- Static file serving with proper MIME types
- Comprehensive request/response logging
- Error handling with detailed error reporting

## Rich Text Editing and Content Processing

**Quill Editor Integration** (`src/utils/quill-manager.ts`):
- Rich text editing with toolbar support (headers, bold, italic, links, code blocks)
- Markdown to Quill Delta conversion for seamless content handling
- Dynamic editor creation and destruction for memory management
- HTML and plain text content extraction
- Event-driven content change notifications
- Editor state management (enable/disable, content updates)

**Markdown Processing** (`src/utils/markdown.ts`):
- Full markdown parsing with syntax highlighting via Highlight.js
- Automatic code block highlighting for multiple languages
- Markdown syntax detection for intelligent content rendering
- Fallback rendering for environments without markdown libraries
- Safe HTML escaping for security
- Performance-optimized parsing with caching

**Block Types and Content Management:**
- **Chat blocks**: User input with rich text capabilities
- **Prompt blocks**: Structured prompts for AI interactions
- **Response blocks**: AI-generated responses with syntax highlighting
- **Markdown blocks**: Documentation and formatted content
- Dynamic content rendering based on block type
- Inline editing with real-time validation

## Testing Infrastructure

**Jest Configuration** (`jest.config.js`):
- TypeScript support with ts-jest
- JSDOM environment for DOM testing
- Coverage requirements: 80% minimum globally, 100% for utilities
- Module resolution with path mapping
- Test file organization in dedicated `/tests` directory
- Comprehensive coverage reporting (text, lcov, HTML, JSON)

**Test Structure:**
```
tests/
├── components/
│   └── graph-editor.test.ts     # GraphEditor component tests
├── integration/
│   └── api-endpoints.test.ts    # API integration tests
├── utils/
│   ├── logger.test.ts           # Logging system tests
│   ├── tree-layout.test.ts      # Layout algorithm tests
│   └── type-guards.test.ts      # Validation system tests
└── setup.ts                     # Test environment setup
```

**Coverage Requirements:**
- Global minimum: 80% (branches, functions, lines, statements)
- Utility functions: 100% coverage requirement per `ts_readme.xml`
- Integration tests for API endpoints and service interactions
- Component tests for UI behavior and user interactions

## Enhanced Features and Improvements

### Advanced UI Features

**Enhanced Node Management:**
- **Node Collapsing**: Toggle entire nodes to show only headers with visual indicators (▼/▶)
- **Node Renaming**: Editable node names with inline text input and focus/blur handling
- **Node Resizing**: Drag handles for width (300-600px) and flexible height adjustment
- **Real-time Updates**: Connection lines update during node operations

**Improved Block Functionality:**
- **Block Minimizing**: Individual blocks can be collapsed with content preview
- **Block Resizing**: Textarea height adjustment (60-400px) with drag handles
- **Dynamic Headers**: Content-aware headers showing block type and preview
- **Centralized Controls**: Unified button placement for consistent UX

**Advanced Canvas Features:**
- **Zoom Controls**: Mouse wheel zoom (0.1x-5x) with slider and button controls
- **Auto-Layout System**: Intelligent tree reorganization with collision detection
- **Canvas Panning**: Enhanced dragging with damping factors for smooth movement
- **View Management**: Reset view functionality with zoom and position restoration

### Performance Optimizations

**Rendering Performance:**
- `will-change: transform` for GPU acceleration
- Reduced DOM reflows with optimized CSS transitions
- Efficient SVG connection line rendering with proper viewport management
- Memory-optimized event handling with proper cleanup

**User Interaction Enhancements:**
- Enhanced dragging speed with acceleration factors
- Smooth animations for layout changes (0.5s transitions)
- Responsive hover states for all interactive elements
- Collision detection and prevention in auto-layout

### Recent Improvements (Current Implementation)

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

## Deployment and Build Options

**Multiple Deployment Targets:**
1. **Modular Version** (`index.html`): ES6 imports, requires HTTP server, full feature set
2. **Standalone Version** (`standalone.html`): Self-contained, direct browser access, embedded JavaScript
3. **Docker Container**: Production deployment with multi-stage builds and optimized runtime
4. **Node.js Server**: Full-stack development with API integration

**Build Optimization:**
- Multi-stage Docker builds for minimal production images
- TypeScript compilation with strict mode enforcement
- Asset optimization and proper MIME type handling
- Read-only volume mounts for security

## API Endpoints and Integration

**Available Endpoints:**
- `POST /api/submit` - Submit graph data to Gemini API for processing
- Static file serving for all application assets
- CORS-enabled for cross-origin development
- Comprehensive request/response logging

**Integration Examples:**
```javascript
// Submit graph data to Gemini API
fetch('/api/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(graphData)
})
.then(response => response.json())
.then(data => console.log(data.geminiResponse));
```

## Development Best Practices

**Code Quality Standards:**
- Always run `npm run build` before testing changes
- Use `npm run test` to ensure 80% minimum coverage
- Run `npm run typecheck` to verify strict TypeScript compliance
- Use `npm run format` to maintain consistent code style
- Monitor browser developer tools for structured logging output

**Architecture Guidelines:**
- Maintain comprehensive logging, error handling, and validation patterns
- **Strictly follow `ts_readme.xml` standards for all code modifications:**
  - Check naming conventions before creating new files/variables
  - Ensure all functions have explicit return types
  - Add runtime type guards for external data
  - Use `readonly` modifiers for immutable structures
  - Maintain import organization order
  - Document complex types with JSDoc and examples

**Performance Monitoring:**
- Monitor function execution times (warnings for >10ms operations)
- Track memory usage during node operations
- Validate tree integrity on every modification
- Use correlation IDs for request tracing across components

**AI Integration Guidelines:**
- Configure Gemini API keys securely (never commit keys to repository)
- Implement proper error handling for API timeouts and failures
- Monitor streaming response performance and chunk processing
- Validate API responses before processing

**Rich Text Editing:**
- Initialize Quill editors only when needed for memory efficiency
- Clean up editor instances when nodes are deleted
- Handle markdown-to-delta conversion for seamless content flow
- Validate content changes before applying to data model