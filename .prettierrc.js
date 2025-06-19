/**
 * Prettier configuration for TypeScript codebase
 * 
 * Ensures consistent code formatting across the entire project
 * in compliance with ts_readme.xml standards.
 */

module.exports = {
  // Core formatting options
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  
  // TypeScript-specific options
  parser: 'typescript',
  
  // HTML/CSS formatting for templates
  htmlWhitespaceSensitivity: 'css',
  
  // File-specific overrides
  overrides: [
    {
      files: '*.{ts,tsx}',
      options: {
        parser: 'typescript',
        semi: true,
        singleQuote: true,
        trailingComma: 'es5',
      },
    },
    {
      files: '*.{js,jsx}',
      options: {
        parser: 'babel',
        semi: true,
        singleQuote: true,
        trailingComma: 'es5',
      },
    },
    {
      files: '*.json',
      options: {
        parser: 'json',
        tabWidth: 2,
      },
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown',
        printWidth: 80,
        proseWrap: 'preserve',
      },
    },
    {
      files: '*.html',
      options: {
        parser: 'html',
        printWidth: 100,
        htmlWhitespaceSensitivity: 'css',
      },
    },
    {
      files: '*.css',
      options: {
        parser: 'css',
        singleQuote: false,
      },
    },
  ],
  
  // Ignore patterns
  ignorePath: '.prettierignore',
};