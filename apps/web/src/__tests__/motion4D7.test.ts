/**
 * Phase 4D7 — per-skin motion personality.
 *
 * Contract under test:
 * - JS (`MOTION_PERSONALITIES`) owns the duration scale applied to the six
 *   base motion tokens; clay is the byte-identical baseline (scale 1).
 * - CSS owns the character: every non-clay skin declares `--motion-timing`
 *   inside its `:root[data-style='…']` block, and glass/brutal additionally
 *   wire signature enter keyframes (`glassEnter` / `brutalStamp`).
 * - The user's motion:'reduced' setting always wins: all six tokens go 0ms
 *   unscaled, whatever the skin.
 * - index.css never hardcodes animation durations anymore — the literals
 *   survive only as `var(..., fallback)` safety nets, so the reduced setting
 *   and the skin personality actually reach screen/card/ring animations.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_APPEARANCE,
  MOTION_PERSONALITIES,
  STYLE_VARIANTS,
  applyAppearanceToDOM,
} from '../appearance.js';

const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

const MOTION_TOKENS = [
  '--motion-duration-fast',
  '--motion-duration',
  '--motion-duration-slow',
  '--motion-duration-enter',
  '--motion-duration-draw',
  '--motion-stagger',
] as const;

describe('phase 4D7: per-skin motion personality', () => {
  let origDocument: unknown;

  afterEach(() => {
    // Restore the real document if a DOM mock swapped it in.
    globalThis.document = origDocument as typeof globalThis.document;
    origDocument = undefined;
  });

  /** Mirrors the fake-documentElement pattern from appearance.test.ts. */
  function withFakeDocument(): { props: Record<string, string>; attrs: Record<string, string> } {
    const props: Record<string, string> = {};
    const attrs: Record<string, string> = {};
    const fakeRoot = {
      style: {
        setProperty(k: string, v: string) {
          props[k] = v;
        },
        getPropertyValue(k: string) {
          return props[k] || '';
        },
      },
      setAttribute(name: string, value: string) {
        attrs[name] = value;
      },
      getAttribute(name: string) {
        return attrs[name];
      },
    };
    origDocument = globalThis.document;
    // @ts-expect-error Mocking document for unit test
    globalThis.document = { documentElement: fakeRoot };
    return { props, attrs };
  }

  it('covers every skin variant with a finite, sane duration scale', () => {
    expect(Object.keys(MOTION_PERSONALITIES).sort()).toEqual([...STYLE_VARIANTS].sort());
    for (const variant of STYLE_VARIANTS) {
      const { durationScale } = MOTION_PERSONALITIES[variant];
      expect(Number.isFinite(durationScale)).toBe(true);
      expect(durationScale).toBeGreaterThanOrEqual(0.5);
      expect(durationScale).toBeLessThanOrEqual(2);
    }
  });

  it('keeps the documented personality per skin (churn guard)', () => {
    expect(MOTION_PERSONALITIES).toEqual({
      clay: { durationScale: 1 }, // baseline
      glass: { durationScale: 1.15 }, // floats
      neu: { durationScale: 1 }, // cushioned, standard
      mono: { durationScale: 0.85 }, // crisp
      neon: { durationScale: 0.8 }, // electric
      aurora: { durationScale: 1.2 }, // drifts
      brutal: { durationScale: 0.7 }, // stamps
      paper: { durationScale: 1 }, // steady press
      oled: { durationScale: 0.85 }, // black-glass sharp
    });
  });

  it('clay stays byte-identical to the pre-4D7 baseline (all six tokens)', () => {
    const { props } = withFakeDocument();
    applyAppearanceToDOM({ ...DEFAULT_APPEARANCE, style: 'clay', motion: 'full' });
    expect(props['--motion-duration-fast']).toBe('90ms');
    expect(props['--motion-duration']).toBe('200ms');
    expect(props['--motion-duration-slow']).toBe('600ms');
    expect(props['--motion-duration-enter']).toBe('220ms');
    expect(props['--motion-duration-draw']).toBe('900ms');
    expect(props['--motion-stagger']).toBe('50ms');
  });

  it('full motion scales all six tokens by the active skin personality (glass 1.15x)', () => {
    const { props } = withFakeDocument();
    applyAppearanceToDOM({ ...DEFAULT_APPEARANCE, style: 'glass', motion: 'full' });
    expect(props['--motion-duration-fast']).toBe('103ms'); // 90 * 1.15 → 103.49… → 103
    expect(props['--motion-duration']).toBe('230ms'); // 200 * 1.15
    expect(props['--motion-duration-slow']).toBe('690ms'); // 600 * 1.15
    expect(props['--motion-duration-enter']).toBe('253ms'); // 220 * 1.15
    expect(props['--motion-duration-draw']).toBe('1035ms'); // 900 * 1.15
    expect(props['--motion-stagger']).toBe('57ms'); // 50 * 1.15 → 57.49… → 57
  });

  it('reduced motion wins over the personality (aurora stays 0ms, unscaled)', () => {
    const { props } = withFakeDocument();
    applyAppearanceToDOM({ ...DEFAULT_APPEARANCE, style: 'aurora', motion: 'reduced' });
    for (const token of MOTION_TOKENS) {
      expect(props[token]).toBe('0ms');
    }
  });

  it('the scale extremes land in the DOM: brutal snaps, aurora drifts', () => {
    const { props } = withFakeDocument();
    applyAppearanceToDOM({ ...DEFAULT_APPEARANCE, style: 'brutal', motion: 'full' });
    expect(props['--motion-duration']).toBe('140ms'); // 200 * 0.7
    expect(props['--motion-duration-enter']).toBe('154ms'); // 220 * 0.7
    applyAppearanceToDOM({ ...DEFAULT_APPEARANCE, style: 'aurora', motion: 'full' });
    expect(props['--motion-duration']).toBe('240ms'); // 200 * 1.2
    expect(props['--motion-stagger']).toBe('60ms'); // 50 * 1.2
  });

  it('every non-clay skin owns a timing curve; clay inherits the tokens baseline', () => {
    for (const skin of STYLE_VARIANTS.filter((s) => s !== 'clay')) {
      const css = read(`../styles/skins/${skin}.css`);
      expect(css).toMatch(
        new RegExp(`:root\\[data-style='${skin}'\\] \\{[^}]*--motion-timing: cubic-bezier`)
      );
    }
    expect(read('../styles/tokens.css')).toContain(
      '--motion-timing: cubic-bezier(0.16, 1, 0.3, 1)'
    );
  });

  it('signature enter keyframes exist and are wired for glass and brutal only', () => {
    const glass = read('../styles/skins/glass.css');
    expect(glass).toContain('@keyframes glassEnter');
    expect(glass).toMatch(/\.animate-screen-enter,[^}]*animation-name: glassEnter/s);
    expect(glass).toMatch(/\.animate-card-stagger \{[^}]*animation-name: glassEnter/s);

    const brutal = read('../styles/skins/brutal.css');
    expect(brutal).toContain('@keyframes brutalStamp');
    expect(brutal).toMatch(/animation-name: brutalStamp/s);

    // No other skin introduces a signature enter animation. clay lives in
    // styles/clay.css (the baseline), the rest are in styles/skins/.
    const flatSkins = ['neu', 'mono', 'neon', 'aurora', 'paper', 'oled'] as const;
    for (const skin of flatSkins) {
      const css = read(`../styles/skins/${skin}.css`);
      expect(css).not.toMatch(/animation-name:/);
      expect(css).not.toMatch(/@keyframes/);
    }
    expect(read('../styles/clay.css')).not.toMatch(/animation-name:/);
  });

  it('index.css consumes the motion tokens — hardcoded ms survive only as fallbacks', () => {
    const css = read('../index.css');
    expect(css).toContain('animation: screenEnter var(--motion-duration-enter, 220ms)');
    expect(css).toContain('animation: cardStagger var(--motion-duration-enter, 220ms)');
    expect(css).toContain('animation: drawRing var(--motion-duration-draw, 900ms)');
    expect(css).toContain('animation-delay: calc(var(--i, 0) * var(--motion-stagger, 50ms))');

    // Guard against regression: every ms literal sits inside a var() fallback
    // (so the reduced setting and skin scale genuinely reach the animation).
    for (const line of css.split('\n')) {
      if (line.includes('220ms')) expect(line).toContain('var(--motion-duration-enter');
      if (line.includes('900ms')) expect(line).toContain('var(--motion-duration-draw');
      if (line.includes('50ms')) expect(line).toContain('var(--motion-stagger');
    }
  });

  it('tokens.css defines the six motion tokens with the documented clay defaults', () => {
    const tokens = read('../styles/tokens.css');
    expect(tokens).toContain('--motion-duration-fast: 90ms');
    expect(tokens).toContain('--motion-duration: 200ms');
    expect(tokens).toContain('--motion-duration-slow: 600ms');
    expect(tokens).toContain('--motion-duration-enter: 220ms');
    expect(tokens).toContain('--motion-duration-draw: 900ms');
    expect(tokens).toContain('--motion-stagger: 50ms');
    // OS-level reduced motion zeroes all six at the token layer too.
    const mediaBlock = tokens.slice(tokens.indexOf('prefers-reduced-motion'));
    for (const token of MOTION_TOKENS) {
      expect(mediaBlock).toContain(`${token}: 0ms`);
    }
  });
});
