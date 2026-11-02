import { describe, it, expect } from 'vitest';
import {
  enDict,
  arDict,
  t,
  setLanguage,
  getLanguage,
  type I18nKey,
} from '../i18n/index.js';

/**
 * Phase 3: Arabic dictionary must cover 100% of the English dictionary.
 * The compile-time Record<keyof typeof enDict, string> annotation on arDict
 * already enforces key parity during typecheck; these runtime tests guard the
 * same contract against future refactors (e.g. someone reverting to Partial)
 * and additionally protect translation quality invariants.
 */
describe('Arabic Dictionary 100% Coverage (Phase 3)', () => {
  it('arDict covers every enDict key exactly — no missing, no extras', () => {
    const enKeys = Object.keys(enDict).sort();
    const arKeys = Object.keys(arDict).sort();
    expect(arKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(200);
  });

  it('every Arabic value contains Arabic script (no silent English leftovers)', () => {
    const arabicScript = /[\u0600-\u06FF]/;
    const violations: string[] = [];
    for (const [key, value] of Object.entries(arDict)) {
      if (!arabicScript.test(value)) {
        violations.push(key);
      }
    }
    expect(violations).toEqual([]);
  });

  it('placeholder tokens match between English and Arabic values', () => {
    const placeholder = /\{(\w+)\}/g;
    const arMap = new Map(Object.entries(arDict));
    const mismatches: string[] = [];
    for (const [key, enValue] of Object.entries(enDict)) {
      const arValue = arMap.get(key);
      if (arValue === undefined) continue; // covered by the parity test above
      const enTokens = [...enValue.matchAll(placeholder)].map((m) => m[1]).sort();
      const arTokens = [...arValue.matchAll(placeholder)].map((m) => m[1]).sort();
      if (JSON.stringify(enTokens) !== JSON.stringify(arTokens)) {
        mismatches.push(key);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('in Arabic mode t() resolves every key from arDict and never falls back to English', () => {
    expect(getLanguage()).toBe('en');
    setLanguage('ar');
    try {
      for (const key of Object.keys(enDict) as I18nKey[]) {
        expect(t(key)).toBe(arDict[key]);
      }
    } finally {
      setLanguage('en');
    }
    expect(getLanguage()).toBe('en');
  });
});
