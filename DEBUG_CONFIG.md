# Debug Configuration Guide

The Node Editor includes a powerful, granular debug logging system that can be configured through the `config.js` file or controlled at runtime through the browser console.

## Configuration File Setup

1. Copy `config.example.js` to `config.js`
2. Modify the `DEBUG` section to control logging output

## Configuration Options

### Global Enable/Disable
```javascript
DEBUG: {
  enabled: true,  // Master switch for all logging
}
```

### Log Levels
Control which severity levels are displayed:
```javascript
levels: {
  TRACE: false,  // Function entry/exit (most verbose)
  DEBUG: false,  // Variable assignments, branches, loops
  INFO: true,    // User interactions, business logic
  WARN: true,    // Performance warnings, recoverable issues
  ERROR: true,   // Errors with full context
  FATAL: true    // Critical system failures
}
```

### Log Types
Fine-grained control over specific log types:
```javascript
types: {
  function_entry: false,      // Function called with parameters
  function_exit: false,       // Function returns with value
  branch_execution: false,    // If/else branches taken
  loop_execution: false,      // Loop iterations completed
  variable_assignment: false, // Critical variable changes
  user_interaction: true,     // User clicks, inputs, etc.
  performance_metric: true,   // Execution time measurements
  business_logic: true,       // Application flow milestones
  error: true,               // Error details
  warning: true,             // Warning messages
  trace: false,              // Detailed execution trace
  debug: false               // Debug information
}
```

### Service Filtering
Only show logs from specific services:
```javascript
services: {
  GraphEditor: true,
  Logger: false,
  ErrorFactory: true,
  GeminiService: true,
  Application: true,
  GlobalErrorHandler: true,
  ErrorHandler: true,
  Bootstrap: true
}
```

### Function Filtering
Include/exclude functions by regex pattern:
```javascript
functions: {
  include: [
    'submitToLLM',      // Only this function
    'create.*',         // All create* functions
    '.*Error.*',        // Functions with Error in name
    '.*'                // All functions (default)
  ],
  exclude: [
    'updateConnections', // Skip this function
    'render.*',          // Skip all render* functions
    '.*Transform.*'      // Skip *Transform* functions
  ]
}
```

### Performance Thresholds
```javascript
performance: {
  warnThreshold: 10,   // Warn if execution > 10ms
  errorThreshold: 100  // Error if execution > 100ms
}
```

### Output Formatting
```javascript
format: {
  pretty: true,          // Pretty print JSON
  includeTimestamp: true,
  includeMetadata: true,
  includeStackTrace: true,
  maxDepth: 3           // Max object nesting depth
}
```

## Runtime Control (Browser Console)

The debug system can be controlled at runtime using the global `debug` object:

### Basic Commands
```javascript
debug.enable()          // Enable all logging
debug.disable()         // Disable all logging
debug.verbose()         // Enable verbose mode (all logs)
debug.minimal()         // Minimal mode (INFO+ only)
debug.help()           // Show all available commands
```

### Function Filtering
```javascript
debug.showOnly('submitToLLM')              // Only show this function
debug.showOnly('create*', 'delete*')       // Multiple patterns
debug.hideFunction('updateConnections')    // Hide specific function
```

### Level Control
```javascript
debug.setLevel('DEBUG', true)   // Enable DEBUG level
debug.setLevel('TRACE', false)  // Disable TRACE level
```

### Type Control
```javascript
debug.setType('function_entry', true)    // Enable function entry logs
debug.setType('branch_execution', false) // Disable branch logs
```

### Service Filtering
```javascript
debug.showService('GeminiService')              // Only GeminiService
debug.showService('GraphEditor', 'Application') // Multiple services
```

### Specialized Views
```javascript
debug.performanceOnly()  // Show only performance metrics
debug.showConfig()       // Display current configuration
```

## Common Debug Scenarios

### 1. Debug LLM Integration
```javascript
debug.showOnly('submitToLLM', 'createResponseBlock', 'updateStreamingResponse')
debug.showService('GeminiService')
```

### 2. Track User Interactions
```javascript
debug.setType('user_interaction', true)
debug.setType('function_entry', false)
debug.setType('function_exit', false)
```

### 3. Performance Analysis
```javascript
debug.performanceOnly()
// Or with custom thresholds:
debug.updateAllLoggers({
  performance: { warnThreshold: 5, errorThreshold: 50 }
})
```

### 4. Debug Specific Node Operations
```javascript
debug.showOnly('createNode', 'deleteNode', 'moveNode', 'addChild')
```

### 5. Trace Error Flow
```javascript
debug.setLevel('ERROR', true)
debug.setType('error', true)
debug.setType('function_entry', true)
debug.setType('function_exit', true)
```

## Tips

1. **Start with minimal logging** and enable more as needed
2. **Use function patterns** to focus on specific areas
3. **Combine filters** for precise control
4. **Save configurations** for different debugging scenarios
5. **Use runtime control** for quick debugging without page reload

## Default Recommended Settings

For development:
```javascript
DEBUG: {
  enabled: true,
  levels: {
    INFO: true,
    WARN: true,
    ERROR: true,
    FATAL: true
  },
  types: {
    user_interaction: true,
    performance_metric: true,
    business_logic: true,
    error: true,
    warning: true
  }
}
```

For debugging specific issues:
```javascript
DEBUG: {
  enabled: true,
  levels: {
    TRACE: true,
    DEBUG: true,
    INFO: true,
    WARN: true,
    ERROR: true,
    FATAL: true
  },
  functions: {
    include: ['functionToDebug'],
    exclude: []
  }
}
```