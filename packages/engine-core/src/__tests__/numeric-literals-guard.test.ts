import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

function isIndex(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // e.g. arr[2]
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) {
    return true;
  }

  // e.g. arr[arr.length - 2]
  if (ts.isBinaryExpression(parent)) {
    if (
      parent.parent &&
      ts.isElementAccessExpression(parent.parent) &&
      parent.parent.argumentExpression === parent
    ) {
      return true;
    }
  }

  // e.g. .slice(2), .splice(1), .at(-1)
  if (
    ts.isCallExpression(parent) &&
    ts.isPropertyAccessExpression(parent.expression) &&
    ['slice', 'splice', 'at'].includes(parent.expression.name.text)
  ) {
    return true;
  }

  // Comparisons with an index or count variable (e.g. dayIndex, length, streak, count)
  if (ts.isBinaryExpression(parent)) {
    const other = parent.left === node ? parent.right : parent.left;
    const otherText = other.getText(sourceFile);
    if (/index|day_index|dayIndex|length|streak|count|rir|sets/i.test(otherText)) {
      return true;
    }
  }

  return false;
}

describe('Numeric Literals Guard (Rule 10 tightened)', () => {
  it('strictly fails on arithmetic between numeric literals and on numeric literals other than 0 and 1 outside indices and PRNG constants', () => {
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
        // 1. Fail on arithmetic between two numeric literals (e.g. 1 / 2)
        if (ts.isBinaryExpression(node)) {
          if (ts.isNumericLiteral(node.left) && ts.isNumericLiteral(node.right)) {
            const pos = node.getStart(sourceFile);
            if (!isInsidePrng(pos)) {
              const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
              violations.push(
                `${file}:${line + 1}:${character + 1} - Found forbidden arithmetic between numeric literals "${node.getText(sourceFile)}" (all tunable numbers must come from @hfos/config)`
              );
            }
          }
        }

        // 2. Fail on numeric literals other than 0 and 1 (indices and PRNG constants excepted)
        if (ts.isNumericLiteral(node)) {
          const pos = node.getStart(sourceFile);
          if (!isInsidePrng(pos)) {
            const numVal = Number(node.text);
            if (numVal !== 0 && numVal !== 1) {
              if (!isIndex(node, sourceFile)) {
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
                violations.push(
                  `${file}:${line + 1}:${character + 1} - Found forbidden numeric literal "${node.text}" (only 0 and 1, indices, and PRNG constants allowed; all others must come from @hfos/config)`
                );
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    if (violations.length > 0) {
      expect.fail(
        `Rule 10 Violation: Numeric literals or literal arithmetic found in engine-core/src:\n${violations.join('\n')}`
      );
    }

    expect(violations).toEqual([]);
  });
});
