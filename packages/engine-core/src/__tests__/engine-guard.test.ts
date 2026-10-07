import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('engine-core guard', () => {
  const FORBIDDEN_TOKENS = [
    'fs',
    'path',
    'node:',
    'window',
    'document',
    'fetch',
    'localStorage',
    'indexedDB',
  ];

  function getSourceFiles(dir: string): string[] {
    const results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (item === '__tests__') continue; // only check non-test source code
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...getSourceFiles(fullPath));
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it('scans packages/engine-core/src and fails on fs, path, node:, window, document, fetch, localStorage, indexedDB', () => {
    const engineSrcDir = path.resolve(__dirname, '..');
    const sourceFiles = getSourceFiles(engineSrcDir);

    expect(sourceFiles.length).toBeGreaterThan(0);

    const violations: Array<{ file: string; token: string; line: number; lineContent: string }> = [];

    // Regex to match forbidden tokens as word boundaries or module specifiers
    // We check for import/calls/references
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Strip single line comments or check code tokens
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

        for (const token of FORBIDDEN_TOKENS) {
          // Check for forbidden module imports or global references
          const isModuleImport =
            token === 'node:'
              ? line.includes('node:')
              : new RegExp(`(?:from|import|require)\\s*['"](?:node:)?${token}['"]`).test(line);

          // Word boundary check for globals (window, document, fetch, localStorage, indexedDB, fs, path)
          const isGlobalOrIdentifier = new RegExp(`\\b${token}\\b`).test(line);

          if (isModuleImport || isGlobalOrIdentifier) {
            violations.push({
              file: path.basename(file),
              token,
              line: index + 1,
              lineContent: line.trim(),
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const errorMsg = violations
        .map(
          (v) =>
            `Forbidden token "${v.token}" detected in ${v.file}:${v.line} -> "${v.lineContent}"`
        )
        .join('\n');
      expect.fail(`Engine-core purity violation:\n${errorMsg}`);
    }
  });
});
