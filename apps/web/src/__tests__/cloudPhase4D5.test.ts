import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_APPEARANCE,
  sanitizeAppearance,
  resolveEffectiveStyle,
  effectiveAppearance,
  isDarkStyle,
  systemPrefersDark,
  STYLE_VARIANTS,
  type AppearanceSettings,
} from '../appearance.js';
import { fetchDeviceStatus, parseDeviceRows } from '../supabase/deviceAuthClient.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';
import { enDict, arDict } from '../i18n/index.js';

/**
 * Phase 4D5: auto theme mode (manual vs prefers-color-scheme with a skin
 * per scheme) + the account card's per-device rows (contract v2).
 *
 * - The appearance logic is pure and under real unit tests: resolution,
 *   legacy-payload migration, and scheme reads outside a browser.
 * - The device-rows parser is under real unit tests plus one injected-fetch
 *   round through fetchDeviceStatus (v1 payload degrades to null rows).
 * - The React/browser wiring follows the house style: source guards.
 */

const read = (...segments: string[]): string =>
  fs.readFileSync(path.resolve(__dirname, ...segments), 'utf8');

const SETTINGS: AppearanceSettings = { ...DEFAULT_APPEARANCE };

afterEach(() => {
  // tests that fake a browser window must clean up after themselves
  delete (globalThis as Record<string, unknown>).window;
});

describe('phase 4D5: theme mode resolution', () => {
  it('manual mode paints exactly settings.style in either scheme', () => {
    const settings: AppearanceSettings = { ...SETTINGS, style: 'aurora', theme_mode: 'manual' };
    expect(resolveEffectiveStyle(settings, true)).toBe('aurora');
    expect(resolveEffectiveStyle(settings, false)).toBe('aurora');
  });

  it('system mode paints style_dark while dark and style_light while light', () => {
    const settings: AppearanceSettings = { ...SETTINGS, theme_mode: 'system', style_dark: 'oled', style_light: 'neu' };
    expect(resolveEffectiveStyle(settings, true)).toBe('oled');
    expect(resolveEffectiveStyle(settings, false)).toBe('neu');
  });

  it('classifies skins into dark and light', () => {
    const dark = STYLE_VARIANTS.filter((s) => isDarkStyle(s));
    const light = STYLE_VARIANTS.filter((s) => !isDarkStyle(s));
    expect(dark).toEqual(['clay', 'glass', 'mono', 'neon', 'aurora', 'oled']);
    expect(light).toEqual(['neu', 'brutal', 'paper']);
  });

  it('migrates a legacy payload: mode stays manual, the stored style joins its own scheme', () => {
    const wasLight = sanitizeAppearance({ style: 'paper', accent: 'violet' });
    expect(wasLight.theme_mode).toBe('manual');
    expect(wasLight.style_light).toBe('paper');
    expect(wasLight.style_dark).toBe('clay');
    const wasDark = sanitizeAppearance({ style: 'aurora' });
    expect(wasDark.theme_mode).toBe('manual');
    expect(wasDark.style_dark).toBe('aurora');
    expect(wasDark.style_light).toBe('paper');
  });

  it('honors explicit per-scheme skins and rejects bogus ones', () => {
    const explicit = sanitizeAppearance({ theme_mode: 'system', style_light: 'brutal', style_dark: 'mono' });
    expect(explicit.style_light).toBe('brutal');
    expect(explicit.style_dark).toBe('mono');
    const bogus = sanitizeAppearance({ theme_mode: 'sometimes', style_light: 7, style_dark: 'woodgrain' });
    expect(bogus.theme_mode).toBe('manual');
    expect(bogus.style_light).toBe(DEFAULT_APPEARANCE.style_light);
    expect(bogus.style_dark).toBe(DEFAULT_APPEARANCE.style_dark);
  });

  it('reads the scheme from the browser when present, dark when absent', () => {
    expect(systemPrefersDark()).toBe(true); // Node: no window/matchMedia
    (globalThis as Record<string, unknown>).window = {
      matchMedia: (query: string) => ({
        matches: query.includes('dark') ? false : true,
      }),
    };
    expect(systemPrefersDark()).toBe(false);
  });

  it('effectiveAppearance resolves style through the mode (persistence stays raw)', () => {
    const settings: AppearanceSettings = { ...SETTINGS, theme_mode: 'system', style: 'clay', style_light: 'paper', style_dark: 'oled' };
    // Node defaults to dark: effective paints oled while the raw payload keeps clay
    const eff = effectiveAppearance(settings);
    expect(eff.style).toBe('oled');
    expect(eff.style_dark).toBe('oled');
    expect(settings.style).toBe('clay');
  });
});

describe('phase 4D5: device rows (contract v2)', () => {
  const CONFIG: SupabaseEnvConfig = { url: 'https://example.supabase.co', publishableKey: 'pb_test_key' };

  it('returns null for absent, null, or non-array devices payloads', () => {
    expect(parseDeviceRows(undefined)).toBeNull();
    expect(parseDeviceRows(null)).toBeNull();
    expect(parseDeviceRows('nope')).toBeNull();
    expect(parseDeviceRows({ id: 'x' })).toBeNull();
  });

  it('parses valid rows and maps id -> device_id', () => {
    const rows = parseDeviceRows([
      { id: 'd1', label: 'Redmi 12', created_at: '2026-11-01T10:00:00Z', last_seen_at: '2026-11-04T08:30:00Z' },
      { id: 'd2', label: 'Studio PC', created_at: '2026-11-02T09:00:00Z', last_seen_at: null },
    ]);
    expect(rows).toEqual([
      { device_id: 'd1', label: 'Redmi 12', created_at: '2026-11-01T10:00:00Z', last_seen_at: '2026-11-04T08:30:00Z' },
      { device_id: 'd2', label: 'Studio PC', created_at: '2026-11-02T09:00:00Z', last_seen_at: null },
    ]);
  });

  it('drops malformed entries individually and collapses to null when none survive', () => {
    const mixed = parseDeviceRows([
      null,
      42,
      { id: '', label: 'ghost' },
      { id: 'ok1' },
      { id: 'ok2', label: 'Fine', last_seen_at: '2026-11-04T08:30:00Z' },
    ]);
    expect(mixed).toEqual([
      { device_id: 'ok2', label: 'Fine', created_at: null, last_seen_at: '2026-11-04T08:30:00Z' },
    ]);
    expect(parseDeviceRows([{ id: 'x', label: 3 }])).toBeNull();
  });

  it('fetchDeviceStatus degrades to null rows on a v1 payload', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ active_devices: 2, session_verified: true }),
    })) as unknown as typeof fetch;
    const res = await fetchDeviceStatus(CONFIG, 'token', { fetchImpl });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.active_devices).toBe(2);
      expect(res.data.devices).toBeNull();
    }
  });

  it('fetchDeviceStatus passes parsed rows through on a v2 payload', async () => {
    const payload = {
      active_devices: 1,
      session_verified: true,
      devices: [{ id: 'd1', label: 'Redmi 12', created_at: null, last_seen_at: null }],
    };
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    })) as unknown as typeof fetch;
    const res = await fetchDeviceStatus(CONFIG, 'token', { fetchImpl });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.devices).toEqual([
        { device_id: 'd1', label: 'Redmi 12', created_at: null, last_seen_at: null },
      ]);
    }
  });
});

describe('phase 4D5: appearance wiring guards', () => {
  it('persistence and pre-paint apply the theme-mode-resolved appearance', () => {
    const appearance = read('../appearance.ts');
    expect(appearance).toContain('applyAppearanceToDOM(effectiveAppearance(validated))');
    const bootstrap = read('../bootstrap.ts');
    expect(bootstrap).toContain('applyAppearanceToDOM(effectiveAppearance(appearance))');
  });

  it('App re-applies live while following the system scheme, and cleans up', () => {
    const app = read('../App.tsx');
    expect(app).toContain("appearance.theme_mode !== 'system'");
    expect(app).toContain("window.matchMedia('(prefers-color-scheme: dark)')");
    expect(app).toContain("mq.addEventListener('change', onSchemeChange)");
    expect(app).toContain("mq.removeEventListener('change', onSchemeChange)");
  });

  it('the lab picker edits the active scheme skin (WYSIWYG) and offers both modes', () => {
    const lab = read('../screens/AppearanceLab.tsx');
    expect(lab).toContain("update({ theme_mode: m })");
    expect(lab).toContain('resolveEffectiveStyle(settings, systemPrefersDark())');
    expect(lab).toContain('{ style_dark: variant }');
    expect(lab).toContain('{ style_light: variant }');
    expect(lab).toContain("t('appearance.theme_mode_hint')");
  });
});

describe('phase 4D5: device rows wiring guards', () => {
  it('the hook stores rows and patches them from the status probe', () => {
    const hook = read('../cloud/useCloudSession.ts');
    expect(hook).toContain('deviceRows: DeviceStatusRow[] | null');
    expect(hook).toContain('deviceRows: status.data.devices');
    // 4D9 slipped revokedRows between the rows and the id in every reset path
    expect(hook).toMatch(
      /deviceRows: null,\s*\n\s*revokedRows: null,\s*\n\s*deviceId: null,\s*\n\s*lastSyncAt: null,/,
    );
  });

  it('the card leads with server rows and keeps the v1 fallback intact', () => {
    const card = read('../components/CloudAccountCard.tsx');
    expect(card).toContain('cloud.deviceRows !== null && cloud.deviceRows.length > 0');
    expect(card).toContain("t('account.device_row_current')");
    expect(card).toContain("t('account.device_last_seen')");
    expect(card).toContain("t('account.device_never_seen')");
    // v1 fallback (4D4 surface) must survive untouched
    expect(card).toContain("t('account.active_devices')");
    expect(card).toContain("t('account.this_device')");
    expect(card).toContain('cloud.deviceId.slice(0, 8)');
    // the current-device chip compares against the local enrolled id
    expect(card).toContain('row.device_id === cloud.deviceId');
  });

  it('the edge function stamps last_seen on verify and serves rows with graceful degradation', () => {
    const fn = read('..', '..', '..', '..', 'supabase', 'functions', 'device-auth', 'index.ts');
    // verify stamps last-seen best-effort, never failing the verification
    expect(fn).toMatch(/update\(\{ last_seen_at: new Date\(\)\.toISOString\(\) \}\)/);
    expect(fn).toContain('/* pre-migration database: last-seen stays untouched */');
    // status serves rows only when the query survives (unknown column -> v1 payload)
    expect(fn).toContain(".select('id, label, created_at, last_seen_at')");
    expect(fn).toContain('...(devices !== null ? { devices } : {})');
    expect(fn).toContain('return null; // pre-migration database: fall back to the bare count');
  });

  it('the migration only adds the nullable last-seen column', () => {
    const sql = read(
      '..',
      '..',
      '..',
      '..',
      'supabase',
      'migrations',
      '20261105000000_p4d5_device_last_seen.sql',
    );
    expect(sql).toContain('add column if not exists last_seen_at timestamptz');
    expect(sql).not.toMatch(/delete from|drop table|drop column/i);
  });
});

describe('phase 4D5: i18n ships both languages', () => {
  const NEW_KEYS = [
    'appearance.theme_mode_manual',
    'appearance.theme_mode_system',
    'appearance.theme_mode_hint',
    'account.device_row_current',
    'account.device_last_seen',
    'account.device_never_seen',
  ] as const;

  it('every new key exists in en and ar with a non-empty string', () => {
    for (const key of NEW_KEYS) {
      expect(enDict, `missing en key: ${key}`).toHaveProperty(key);
      expect(arDict, `missing ar key: ${key}`).toHaveProperty(key);
      expect((enDict[key] as string).length).toBeGreaterThan(0);
      expect((arDict[key] as string).length).toBeGreaterThan(0);
    }
  });

  it('en and ar carry the same placeholders per key', () => {
    const placeholders = (value: string): string[] =>
      [...value.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1] ?? '');
    for (const key of NEW_KEYS) {
      expect(placeholders(enDict[key] as string)).toEqual(placeholders(arDict[key] as string));
    }
    expect(placeholders(enDict['account.device_last_seen'] as string)).toEqual(['time']);
  });
});
