import { describe, it, expect } from 'vitest';
import { indicatorOffset, indicatorCssVarTransform } from '../components/indicatorOffset.js';
import fs from 'fs';
import path from 'path';

describe('RTL & Logical Properties Support (M1-A4)', () => {
  it('indicatorOffset calculates correct transform without drift for LTR and RTL', () => {
    // In LTR (isRtl = false): dir = 1
    expect(indicatorOffset(0, false)).toBe('translateX(calc(0%))');
    expect(indicatorOffset(1, false)).toBe('translateX(calc(100%))');
    expect(indicatorOffset(2, false)).toBe('translateX(calc(200%))');
    expect(indicatorOffset(3, false)).toBe('translateX(calc(300%))');

    // In RTL (isRtl = true): dir = -1
    expect(indicatorOffset(0, true)).toBe('translateX(calc(0%))');
    expect(indicatorOffset(1, true)).toBe('translateX(calc(-100%))');
    expect(indicatorOffset(2, true)).toBe('translateX(calc(-200%))');
    expect(indicatorOffset(3, true)).toBe('translateX(calc(-300%))');
  });

  it('indicatorCssVarTransform generates valid CSS variable expression', () => {
    expect(indicatorCssVarTransform(0)).toBe('translateX(calc(var(--dir) * 0 * 100%))');
    expect(indicatorCssVarTransform(1)).toBe('translateX(calc(var(--dir) * 1 * 100%))');
    expect(indicatorCssVarTransform(2)).toBe('translateX(calc(var(--dir) * 2 * 100%))');
    expect(indicatorCssVarTransform(3)).toBe('translateX(calc(var(--dir) * 3 * 100%))');
  });

  it('verifies numbers, units, sets, durations, and levels use .ltr-num class across screens and components', () => {
    const screensDir = path.resolve(__dirname, '../screens');
    const componentsDir = path.resolve(__dirname, '../components');

    const files = [
      ...fs.readdirSync(screensDir).map((f) => path.join(screensDir, f)),
      ...fs.readdirSync(componentsDir).map((f) => path.join(componentsDir, f)),
    ].filter((f) => f.endsWith('.tsx'));

    expect(files.length).toBeGreaterThan(0);

    let ltrNumOccurrences = 0;
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.match(/ltr-num/g);
      if (matches) {
        ltrNumOccurrences += matches.length;
      }
    }

    // Verify .ltr-num is actively used on screens
    expect(ltrNumOccurrences).toBeGreaterThanOrEqual(8);
  });

  it('verifies tokens.css defines --dir variable for LTR and RTL', () => {
    const tokensPath = path.resolve(__dirname, '../styles/tokens.css');
    const content = fs.readFileSync(tokensPath, 'utf-8');

    expect(content).toContain('--dir: 1');
    expect(content).toContain('[dir="rtl"]');
    expect(content).toContain('--dir: -1');
  });

  it('verifies index.css defines .ltr-num and .icon-directional mirroring for RTL', () => {
    const indexPath = path.resolve(__dirname, '../index.css');
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain('.ltr-num');
    expect(content).toContain('unicode-bidi: isolate');
    expect(content).toContain('[dir="rtl"] .icon-directional');
    expect(content).toContain('transform: scaleX(-1)');
    expect(content).toContain('.content-scroll-area');
  });

  it('fails if BottomNav indicator style lacks insetBlock and insetInlineStart', () => {
    const bottomNavPath = path.resolve(__dirname, '../components/BottomNav.tsx');
    const content = fs.readFileSync(bottomNavPath, 'utf-8');

    expect(content).toContain('insetBlock: 0');
    expect(content).toContain('insetInlineStart: 0');
  });

  it('RTL audit: no physical direction classes or CSS properties (Phase 3)', () => {
    const screensDir = path.resolve(__dirname, '../screens');
    const componentsDir = path.resolve(__dirname, '../components');

    const tsxFiles = [
      ...fs.readdirSync(screensDir).map((f) => path.join(screensDir, f)),
      ...fs.readdirSync(componentsDir).map((f) => path.join(componentsDir, f)),
    ].filter((f) => f.endsWith('.tsx'));
    expect(tsxFiles.length).toBeGreaterThan(0);

    // Physical (direction-dependent) utilities must never be reintroduced;
    // logical equivalents (ms-/me-/ps-/pe-/text-start/text-end/start-/end-)
    // mirror automatically under [dir="rtl"].
    const classPatterns: Array<[RegExp, string]> = [
      [/(?:^|[\s"'])-?[mp][lr]-\d/, 'physical margin/padding (use ms-/me-/ps-/pe-)'],
      [/(?:^|[\s"'])text-(?:left|right)(?:[\s"']|$)/, 'physical text alignment (use text-start/text-end)'],
      [/(?:^|[\s"'])rounded-[lr](?:[tb])?(?=[\s"']|-)/, 'physical corner radius (use rounded-s-/rounded-e-)'],
      [/(?:^|[\s"'])border-[lr](?:-|[\s"'])/, 'physical border side (use border-s-/border-e-)'],
      [/(?:^|[\s"'])(?:left|right)-\d/, 'physical inset (use start-/end-)'],
    ];

    const violations: string[] = [];
    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const [pattern, hint] of classPatterns) {
        if (pattern.test(content)) {
          violations.push(`${path.basename(file)}: ${hint}`);
        }
      }
    }

    // CSS files: physical box properties are direction-dependent; .ltr-num's
    // intentional `direction: ltr` is not a box property and stays allowed.
    const cssFiles = [
      path.resolve(__dirname, '../index.css'),
      path.resolve(__dirname, '../styles/tokens.css'),
      path.resolve(__dirname, '../styles/clay.css'),
    ];
    const cssPattern = /(?:padding|margin)-(?:left|right)\s*:|text-align\s*:\s*(?:left|right)/;
    for (const cssPath of cssFiles) {
      const content = fs.readFileSync(cssPath, 'utf-8');
      const found = content.match(cssPattern);
      if (found) {
        violations.push(`${path.basename(cssPath)}: physical CSS property (${found.join(', ')})`);
      }
    }

    expect(violations).toEqual([]);
  });
});
