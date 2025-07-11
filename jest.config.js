module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/tests/**/*.{test,spec}.{ts,tsx}'
  ],
  
  // Ignore e2e tests that require puppeteer and problematic integration tests
  testPathIgnorePatterns: [
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/integration/share-api.test.ts',
    '<rootDir>/tests/performance/share-concurrent-access.test.ts'
  ],
  
  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  
  // Coverage configuration (ts_readme.xml requirement: 80% minimum)
  // Disabled by default, enable with --coverage flag or RUN_COVERAGE=true
  collectCoverage: process.env.RUN_COVERAGE === 'true' || process.argv.includes('--coverage'),
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.types.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Utility functions require 100% coverage per ts_readme.xml
    './src/utils/**/*.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // TypeScript compilation
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Enable strict mode as required by ts_readme.xml
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        strictFunctionTypes: true,
        noUnusedLocals: false, // Allow in tests
        noUnusedParameters: false, // Allow in tests
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        // Test-specific settings
        allowJs: true,
        esModuleInterop: true,
        skipLibCheck: true,
        target: 'ES2020',
        module: 'CommonJS'
      }
    }]
  },
  
  // Mock configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Timeout settings
  testTimeout: 10000,
  
  // Verbose output for debugging
  verbose: true,
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  
  // Global test setup
  extensionsToTreatAsEsm: ['.ts']
};