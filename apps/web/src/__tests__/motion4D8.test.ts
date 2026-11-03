/**
 * Phase 4D8 — motion personality hint in the lab's style picker.
 *
 * Contract under test:
 * - Every `MOTION_PERSONALITIES` entry carries a `labelKey` that resolves to
 *   a non-empty string in BOTH dictionaries (and Arabic script in arDict,
 *   matching the Phase 3 coverage invariant).
 * - The nine character labels are distinct within each dictionary — two
 *   skins must never advertise the same motion character.
 * - The hint template carries the `{character}` placeholder in both dicts
 *   (the global placeholder-parity guard re-checks it too).
 * - AppearanceLab renders the caption per variant through the shared `t()`
 *   (no hard-coded English in JSX — the compliance guard's invariant).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MOTION_PERSONALITIES, STYLE_VARIANTS } from '../appearance.js';
import { arDict, enDict, type I18nKey } from '../i18n/index.js';

const read = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('phase 4D8: motion personality hint in the lab picker', () => {
  it('every personality carries a labelKey resolving in both dicts', () => {
    expect(Object.keys(MOTION_PERSONALITIES).sort()).toEqual([...STYLE_VARIANTS].sort());
    for (const variant of STYLE_VARIANTS) {
      const key = MOTION_PERSONALITIES[variant].labelKey as I18nKey;
      expect(enDict[key], `enDict missing ${key}`).toBeTruthy();
      expect(arDict[key], `arDict missing ${key}`).toBeTruthy();
      // Arabic values carry Arabic script — no silent English leftovers.
      expect(arDict[key]).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it('the nine character labels are distinct within each dict', () => {
    for (const [name, dict] of [
      ['en', enDict],
      ['ar', arDict],
    ] as const) {
      const labels = STYLE_VARIANTS.map((v) => dict[MOTION_PERSONALITIES[v].labelKey as I18nKey]);
      expect(new Set(labels).size, `${name} labels must all differ`).toBe(STYLE_VARIANTS.length);
    }
  });

  it('the hint template exists in both dicts with the {character} placeholder', () => {
    expect(enDict['appearance.motion_hint']).toBe('Motion: {character}');
    expect(arDict['appearance.motion_hint']).toBe('الحركة: {character}');
  });

  it('the lab picker renders the hint per variant (wiring guard)', () => {
    const lab = read('../screens/AppearanceLab.tsx');
    expect(lab).toContain('MOTION_PERSONALITIES');
    expect(lab).toContain("t('appearance.motion_hint').replace(");
    expect(lab).toContain('MOTION_PERSONALITIES[variant].labelKey as I18nKey');
  });

  it('labelKey churn guard (documented key per skin)', () => {
    const keys = Object.fromEntries(
      Object.entries(MOTION_PERSONALITIES).map(([variant, p]) => [variant, p.labelKey])
    );
    expect(keys).toEqual({
      clay: 'appearance.motion_clay',
      glass: 'appearance.motion_glass',
      neu: 'appearance.motion_neu',
      mono: 'appearance.motion_mono',
      neon: 'appearance.motion_neon',
      aurora: 'appearance.motion_aurora',
      brutal: 'appearance.motion_brutal',
      paper: 'appearance.motion_paper',
      oled: 'appearance.motion_oled',
    });
  });
});
