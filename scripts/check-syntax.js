'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const ignoredDirs = new Set(['node_modules', '.git']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
}

walk(root);

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
