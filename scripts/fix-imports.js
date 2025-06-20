#!/usr/bin/env node

/**
 * Post-build script to add .js extensions to imports in compiled files
 * This is needed for ES modules to work correctly in the browser
 */

const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else if (filePath.endsWith('.js')) {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

// Get all .js files in dist directory
const files = getAllFiles('dist');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let modified = false;
  
  // Fix relative imports that don't have .js extension
  // Match: from './something' or from '../something' but not from './something.js'
  const newContent = content.replace(
    /from\s+['"](\.[^'"]+?)['"];/g,
    (match, importPath) => {
      // Don't add .js if it's already there or if it's importing a directory
      if (importPath.endsWith('.js') || importPath.endsWith('/')) {
        return match;
      }
      modified = true;
      return `from '${importPath}.js';`;
    }
  );
  
  if (modified) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Fixed imports in: ${file}`);
  }
});

console.log(`Processed ${files.length} files`);