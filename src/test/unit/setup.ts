// Register the vscode mock module before any test files load
const Module = require('module');
const path = require('path');

const originalResolveFilename = Module._resolveFilename;
const mockVscodePath = path.join(__dirname, 'mocks', 'vscode.js');

Module._resolveFilename = function (request: string, parent: unknown, ...rest: unknown[]) {
  if (request === 'vscode') {
    return mockVscodePath;
  }
  return originalResolveFilename.call(this, request, parent, ...rest);
};
