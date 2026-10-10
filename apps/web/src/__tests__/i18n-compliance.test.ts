import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Scan all .tsx files in apps/web/src/screens and apps/web/src/components
 * to ensure that user-visible English text is routed through t() keys,
 * rather than hard-coded English sentences.
 */
describe('JSX i18n Hard-coded English String Guard', () => {
  const TARGET_DIRS = [
    path.resolve(__dirname, '../screens'),
    path.resolve(__dirname, '../components'),
  ];

  // Allowlist of short abbreviations, single symbols, or system technical tokens
  const ALLOWLIST = new Set([
    'HF',
    'min',
    's',
    'ms',
    'kg',
    'reps',
    'RPE',
    'est.',
    '--',
    '✕',
    '›',
    '←',
    '•',
    '🔍',
    '⚙️',
    '💾',
    'ℹ️',
    '📥',
    '⚠️',
  ]);

  function getTsxFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...getTsxFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it('verifies no hard-coded English sentences in JSX text nodes', () => {
    const files = TARGET_DIRS.flatMap(getTsxFiles);
    expect(files.length).toBeGreaterThan(0);

    const violations: Array<{ file: string; line: number; text: string }> = [];

    // Regex to match actual JSX text nodes between tags: >Some English Text<
    // Only in the JSX return body: lines inside return (...)
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      let inReturn = false;

      lines.forEach((line, lineIndex) => {
        const trimmed = line.trim();

        if (trimmed.includes('return (') || trimmed.startsWith('return <')) {
          inReturn = true;
        }

        if (!inReturn) return;

        // Skip comment lines and code lines
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('import ') ||
          trimmed.startsWith('const ') ||
          trimmed.startsWith('let ') ||
          trimmed.startsWith('type ') ||
          trimmed.startsWith('interface ')
        ) {
          return;
        }

        // Match JSX text strictly between > and <
        // e.g. <span ...>Some Text</span> or <div>Some Text</div>
        const jsxTextMatch = />([^<>{}\n]+)</g;
        let match: RegExpExecArray | null;
        while ((match = jsxTextMatch.exec(line)) !== null) {
          const rawText = match[1]?.trim() ?? '';
          // If contains alphabetical characters and is not in allowlist
          if (rawText && /[a-zA-Z]{3,}/.test(rawText) && !ALLOWLIST.has(rawText)) {
            // Check if it's not a generic symbol
            violations.push({
              file: path.relative(process.cwd(), filePath),
              line: lineIndex + 1,
              text: rawText,
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const msg = violations
        .map((v) => `${v.file}:${v.line} -> "${v.text}"`)
        .join('\n');
      expect.fail(
        `Found hard-coded English text in JSX that should use t():\n${msg}`
      );
    }
  });
});
