#!/usr/bin/env node
/**
 * Test Runner for garmets_img test suite
 * Executes TypeScript test files in tests/ using node:test with automatic path alias resolution
 * and zero external runtime dependencies.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const projectRoot = path.resolve(__dirname, '..');

// 1. Resolve @/ alias to project root
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.join(projectRoot, request.slice(2));
  }
  return origResolve.call(this, request, parent, isMain, options);
};

// 2. Locate TypeScript compiler in local or parent node_modules
let ts;
const tsPaths = [
  path.join(projectRoot, 'node_modules', 'typescript'),
  'E:/garmets_img/node_modules/typescript',
];
for (const p of tsPaths) {
  try {
    ts = require(p);
    break;
  } catch (_e) {
    // continue searching
  }
}

if (!ts) {
  console.error('Error: TypeScript compiler not found in node_modules.');
  process.exit(1);
}

// 3. Register .ts extension transpilation hook
require.extensions['.ts'] = function(module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(transpiled, filename);
};

// 4. Discover and load all *.test.ts files
const testsDir = path.join(projectRoot, 'tests');
const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));

console.log(`\n========================================`);
console.log(`Running Suite: ${files.length} test files discovered`);
console.log(`========================================\n`);

for (const file of files) {
  const fullPath = path.join(testsDir, file);
  require(fullPath);
}
