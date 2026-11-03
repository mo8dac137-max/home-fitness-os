import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import 'fake-indexeddb/auto';
import {
  DEFAULT_APPEARANCE,
  STYLE_VARIANTS,
  STYLE_PRESETS,
  accentValueForStyle,
  sanitizeAppearance,
  loadAppearance,
  saveAppearance,
  applyAppearanceToDOM,
  KV_KEY_APPEARANCE,
  type AppearanceSettings,
  type StyleVariant,
} from '../appearance.js';
import { enDict } from '../i18n/index.js';
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
      style: 'clay',
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
      style: 'hologram',
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
      style: 'glass',
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

  it('accepts every registered style variant through sanitize', () => {
    for (const style of STYLE_VARIANTS) {
      const sanitized = sanitizeAppearance({ style });
      expect(sanitized.style).toBe(style);
      // Non-style fields fall back to defaults when absent.
      expect(sanitized.accent).toBe(DEFAULT_APPEARANCE.accent);
    }
  });

  it('rejects a bogus style and falls back to clay', () => {
    expect(sanitizeAppearance({ style: 'woodgrain' }).style).toBe('clay');
    expect(sanitizeAppearance({ style: 42 }).style).toBe('clay');
    expect(sanitizeAppearance({ style: null }).style).toBe('clay');
  });

  it('persists and loads settings from IndexedDB kv store', async () => {
    const custom: AppearanceSettings = {
      style: 'neon',
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

  it('returns the raw accent hex for dark skins', () => {
    const darkStyles: StyleVariant[] = ['clay', 'glass', 'mono', 'neon', 'aurora', 'oled'];
    for (const style of darkStyles) {
      expect(accentValueForStyle(style, '#c6f432')).toBe('#c6f432');
    }
  });

  it('darkens the accent via color-mix for light skins (ink safety)', () => {
    expect(accentValueForStyle('neu', '#c6f432')).toBe(
      'color-mix(in srgb, #c6f432 70%, #2a3050)'
    );
    expect(accentValueForStyle('paper', '#c6f432')).toBe(
      'color-mix(in srgb, #c6f432 70%, #3d3229)'
    );
    expect(accentValueForStyle('brutal', '#c6f432')).toBe(
      'color-mix(in srgb, #c6f432 70%, #26251c)'
    );
  });

  it('exposes style metadata with swatches and i18n keys for every variant', () => {
    expect(Object.keys(STYLE_PRESETS).sort()).toEqual([...STYLE_VARIANTS].sort());
    for (const variant of STYLE_VARIANTS) {
      const preset = STYLE_PRESETS[variant];
      expect(typeof preset.bg).toBe('string');
      expect(preset.bg.length).toBeGreaterThan(0);
      expect(typeof preset.surface).toBe('string');
      expect(preset.surface.length).toBeGreaterThan(0);
      // The label key must resolve to a real English dictionary entry.
      const label = (enDict as unknown as Record<string, string>)[preset.labelKey];
      expect(typeof label === 'string' && label.length > 0).toBe(true);
    }
  });

  it('shell and light skins stay token-driven (bg/ink regression guard)', () => {
    // The app shell must paint from tokens, never the clay palette — a
    // hardcoded bg-[#0a0a10] shell makes every light skin float on black.
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    expect(app).not.toMatch(/bg-\[#0a0a10\]/);
    expect(app).toContain('bg-[var(--bg)]');
    expect(app).toContain('text-[var(--text)]');
    // Light skins must define the white accent ink next to the white remap.
    for (const skin of ['neu', 'brutal', 'paper'] as const) {
      const css = readFileSync(
        new URL(`../styles/skins/${skin}.css`, import.meta.url),
        'utf8'
      );
      expect(css).toContain('--accent-ink: #ffffff');
      expect(css).toContain('--color-white:');
    }
  });

  it('applies appearance CSS variables and data-style to the document element', () => {
    const attributes: Record<string, string> = {};
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
      setAttribute(name: string, value: string) {
        attributes[name] = value;
      },
      getAttribute(name: string) {
        return attributes[name];
      },
    };

    // Temporarily mock global document
    const origDoc = globalThis.document;
    // @ts-expect-error Mocking document for unit test
    globalThis.document = { documentElement: fakeRoot };

    try {
      const settings: AppearanceSettings = {
        style: 'neu',
        accent: 'violet',
        depth: 'strong',
        radius: 'extra_round',
        density: 'compact',
        motion: 'reduced',
        haptics: 'off',
      };

      applyAppearanceToDOM(settings);

      expect(attributes['data-style']).toBe('neu');
      // neu is a light skin: the violet accent must arrive ink-mixed.
      expect(fakeRoot.style.getPropertyValue('--accent')).toBe(
        'color-mix(in srgb, #8b7cff 70%, #2a3050)'
      );
      expect(fakeRoot.style.getPropertyValue('--depth')).toBe('1.4');
      expect(fakeRoot.style.getPropertyValue('--r-lg')).toBe('36px');
      expect(fakeRoot.style.getPropertyValue('--density')).toBe('0.85');
      expect(fakeRoot.style.getPropertyValue('--motion-duration')).toBe('0ms');
    } finally {
      globalThis.document = origDoc;
    }
  });

  it('switching to a dark skin keeps the raw accent and updates data-style', () => {
    const attributes: Record<string, string> = {};
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
      setAttribute(name: string, value: string) {
        attributes[name] = value;
      },
    };

    const origDoc = globalThis.document;
    // @ts-expect-error Mocking document for unit test
    globalThis.document = { documentElement: fakeRoot };

    try {
      applyAppearanceToDOM({ ...DEFAULT_APPEARANCE, style: 'oled', accent: 'lime' });
      expect(attributes['data-style']).toBe('oled');
      expect(fakeRoot.style.getPropertyValue('--accent')).toBe('#c6f432');
    } finally {
      globalThis.document = origDoc;
    }
  });
});
