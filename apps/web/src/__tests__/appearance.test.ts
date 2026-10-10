import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  DEFAULT_APPEARANCE,
  sanitizeAppearance,
  loadAppearance,
  saveAppearance,
  applyAppearanceToDOM,
  KV_KEY_APPEARANCE,
  type AppearanceSettings,
} from '../appearance.js';
import { closeDatabase, DB_NAME, KeyValueStore } from '../storage/index.js';

describe('Appearance Lab Settings & Persistence', () => {
  beforeEach(async () => {
    closeDatabase();
    indexedDB.deleteDatabase(DB_NAME);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('provides sensible default settings', () => {
    expect(DEFAULT_APPEARANCE).toEqual({
      accent: 'lime',
      depth: 'medium',
      radius: 'round',
      density: 'comfortable',
      motion: 'full',
      haptics: 'on',
    });
  });

  it('clamps and sanitizes invalid saved values to defaults', () => {
    const invalidObj = {
      accent: 'invalid_color',
      depth: 999,
      radius: 'giant',
      density: 'super_compact',
      motion: 'turbo',
      haptics: 'maybe',
    };

    const sanitized = sanitizeAppearance(invalidObj);
    expect(sanitized).toEqual(DEFAULT_APPEARANCE);
  });

  it('preserves valid custom appearance settings', () => {
    const custom: AppearanceSettings = {
      accent: 'cyan',
      depth: 'strong',
      radius: 'extra_round',
      density: 'compact',
      motion: 'reduced',
      haptics: 'off',
    };

    const sanitized = sanitizeAppearance(custom);
    expect(sanitized).toEqual(custom);
  });

  it('persists and loads settings from IndexedDB kv store', async () => {
    const custom: AppearanceSettings = {
      accent: 'coral',
      depth: 'soft',
      radius: 'compact',
      density: 'compact',
      motion: 'reduced',
      haptics: 'off',
    };

    await saveAppearance(custom);

    // Verify stored in KV
    const kv = new KeyValueStore();
    const stored = await kv.get(KV_KEY_APPEARANCE);
    expect(stored).toEqual(custom);

    // Verify loaded through loadAppearance
    const loaded = await loadAppearance();
    expect(loaded).toEqual(custom);
  });

  it('applies appearance CSS variables to the document element when document exists', () => {
    const fakeRoot = {
      style: {
        properties: {} as Record<string, string>,
        setProperty(k: string, v: string) {
          this.properties[k] = v;
        },
        getPropertyValue(k: string) {
          return this.properties[k] || '';
        },
      },
    };

    // Temporarily mock global document
    const origDoc = globalThis.document;
    // @ts-expect-error Mocking document for unit test
    globalThis.document = { documentElement: fakeRoot };

    try {
      const settings: AppearanceSettings = {
        accent: 'violet',
        depth: 'strong',
        radius: 'extra_round',
        density: 'compact',
        motion: 'reduced',
        haptics: 'off',
      };

      applyAppearanceToDOM(settings);

      expect(fakeRoot.style.getPropertyValue('--accent')).toBe('#8b7cff');
      expect(fakeRoot.style.getPropertyValue('--depth')).toBe('1.4');
      expect(fakeRoot.style.getPropertyValue('--r-lg')).toBe('36px');
      expect(fakeRoot.style.getPropertyValue('--density')).toBe('0.85');
      expect(fakeRoot.style.getPropertyValue('--motion-duration')).toBe('0ms');
    } finally {
      globalThis.document = origDoc;
    }
  });
});
