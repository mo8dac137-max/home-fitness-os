import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

describe('Numeric Literals Guard (Rule 10)', () => {
  it('strictly scans engine-core/src for numeric literals other than 0, 1, 2 outside comments and PRNG constants', () => {
    const srcDir = path.resolve(__dirname, '..');
    const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));

    const violations: string[] = [];

    for (const file of files) {
      const filePath = path.join(srcDir, file);
      const code = fs.readFileSync(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        file,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      );

      // Find PRNG exempt ranges if any
      const prngRanges: Array<{ start: number; end: number }> = [];
      const prngRegex = /\/\*\s*PRNG\s*\*\/[\s\S]*?\/\*\s*END PRNG\s*\*\//g;
      let match: RegExpExecArray | null;
      while ((match = prngRegex.exec(code)) !== null) {
        prngRanges.push({ start: match.index, end: match.index + match[0].length });
      }

      const isInsidePrng = (pos: number) => {
        return prngRanges.some((r) => pos >= r.start && pos <= r.end);
      };

      const visit = (node: ts.Node) => {
        if (ts.isNumericLiteral(node)) {
          const pos = node.getStart(sourceFile);
          if (!isInsidePrng(pos)) {
            const numVal = Number(node.text);
            if (numVal !== 0 && numVal !== 1 && numVal !== 2) {
              const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
              violations.push(
                `${file}:${line + 1}:${character + 1} - Found forbidden numeric literal "${node.text}" (allowed: 0, 1, 2; all others must come from @hfos/config)`
              );
            }
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    if (violations.length > 0) {
      expect.fail(
        `Rule 10 Violation: Numeric literals other than 0, 1, 2 found in engine-core/src:\n${violations.join('\n')}`
      );
    }

    expect(violations).toEqual([]);
  });
});
