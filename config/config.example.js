// Example configuration file for the Node Editor
// Copy this file to config.js and add your API key

window.NODE_EDITOR_CONFIG = {
  // Get your API key from https://aistudio.google.com/apikey
  GEMINI_API_KEY: 'YOUR_API_KEY_HERE',
  
  // Feature flags for experimental features
  FEATURE_FLAGS: {
    enabled: {
      userDiscovery: true  // Enable user discovery feature (search for other users and their workspaces)
    }
  },
  
  // Debug configuration - control what gets logged to console
  DEBUG: {
    // Global enable/disable
    enabled: true,
    
    // Log levels to display (comment out to disable)
    levels: {
      TRACE: false,  // Function entry/exit, most verbose
      DEBUG: false,  // Variable assignments, branches, loops
      INFO: true,    // User interactions, business logic
      WARN: true,    // Performance warnings, recoverable issues
      ERROR: true,   // Errors with full context
      FATAL: true    // Critical system failures
    },
    
    // Log types to display (fine-grained control)
    types: {
      function_entry: false,      // Function entry with parameters
      function_exit: false,       // Function exit with return values
      branch_execution: false,    // Conditional branches (if/else)
      loop_execution: false,      // Loop iterations
      variable_assignment: false, // Variable value changes
      user_interaction: true,     // User clicks, inputs, etc.
      performance_metric: true,   // Execution time measurements
      business_logic: true,       // Application flow milestones
      error: true,               // Error details
      warning: true,             // Warning messages
      trace: false,              // Detailed execution trace
      debug: false               // Debug information
    },
    
    // Service-specific filtering (only log from these services)
    services: {
      GraphEditor: true,
      Logger: false,
      ErrorFactory: true,
      GeminiService: true,
      Application: true,
      GlobalErrorHandler: true,
      ErrorHandler: true,
      Bootstrap: true
    },
    
    // Function-specific filtering (regex patterns)
    functions: {
      include: [
        // Examples:
        // 'submitToLLM',           // Only log submitToLLM function
        // 'create.*',              // Log all create* functions
        // '.*Error.*',             // Log functions with Error in name
        '.*'                        // Log all functions (default)
      ],
      exclude: [
        // Examples:
        // 'updateConnections',     // Don't log updateConnections
        // 'render.*',              // Don't log render* functions
        // '.*Transform.*'          // Don't log *Transform* functions
      ]
    },
    
    // Performance thresholds (ms)
    performance: {
      warnThreshold: 10,   // Log warning if execution > 10ms
      errorThreshold: 100  // Log error if execution > 100ms
    },
    
    // Output formatting
    format: {
      pretty: true,         // Pretty print JSON (false for single line)
      includeTimestamp: true,
      includeMetadata: true,
      includeStackTrace: true,
      maxDepth: 3          // Max object nesting depth to log
    }
  }
};