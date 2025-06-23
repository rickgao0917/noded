#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to clear the SQLite database
 * This will delete all users, sessions, and workspaces
 */

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'noded.db');

console.log('🗑️  Database Cleanup Script');
console.log('==========================');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.log('✅ No database found at:', dbPath);
  console.log('✅ Database is already clean!');
  process.exit(0);
}

// Get database file stats
const stats = fs.statSync(dbPath);
const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

console.log(`📊 Current database: ${dbPath}`);
console.log(`📏 Database size: ${sizeInMB} MB`);
console.log(`📅 Last modified: ${stats.mtime.toLocaleString()}`);
console.log('');

// Confirm deletion
console.log('⚠️  WARNING: This will permanently delete:');
console.log('   • All user accounts');
console.log('   • All login sessions');
console.log('   • All workspaces and their content');
console.log('');

// In a real interactive environment, you would use readline
// For now, we'll just delete it since the user requested it
try {
  fs.unlinkSync(dbPath);
  console.log('✅ Database deleted successfully!');
  console.log('');
  console.log('🔄 Next steps:');
  console.log('1. Restart the server: npm run server');
  console.log('2. Refresh your browser');
  console.log('3. Register a new account');
  console.log('');
  console.log('The database will be automatically recreated when you restart the server.');
} catch (error) {
  console.error('❌ Failed to delete database:', error.message);
  console.log('');
  console.log('💡 You may need to:');
  console.log('1. Stop the server first (Ctrl+C)');
  console.log('2. Run this script again');
  process.exit(1);
}