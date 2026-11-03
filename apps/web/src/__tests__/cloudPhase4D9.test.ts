import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fetchDeviceStatus, parseRevokedRows } from '../supabase/deviceAuthClient.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';
import { enDict, arDict } from '../i18n/index.js';

/**
 * Phase 4D9: revoked-device history (the audit trail the account card has
 * been missing since 4D6 made revocation one-tap).
 *
 * - The server rows arrive through the `status` contract extension, so the
 *   real logic under test is the client's defensive parsing.
 * - The function/hook/card wiring follows the house style: source guards.
 */

const read = (...segments: string[]): string =>
  fs.readFileSync(path.resolve(__dirname, ...segments), 'utf8');

const CONFIG: SupabaseEnvConfig = { url: 'https://example.supabase.co', publishableKey: 'pb_test_key' };

function fetchReturning(body: string, status = 200): typeof fetch {
  return (async (url: unknown, init: unknown) => {
    void url;
    void init;
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

describe('phase 4D9: parseRevokedRows', () => {
  it('keeps well-formed rows and coerces missing timestamps to null', () => {
    const rows = parseRevokedRows([
      {
        id: 'dev-1',
        label: 'old phone',
        created_at: '2026-10-09T10:00:00Z',
        revoked_at: '2026-11-01T09:30:00Z',
      },
      { id: 'dev-2', label: 'tablet' }, // timestamps absent -> null, row survives
    ]);
    expect(rows).toEqual([
      {
        device_id: 'dev-1',
        label: 'old phone',
        created_at: '2026-10-09T10:00:00Z',
        revoked_at: '2026-11-01T09:30:00Z',
      },
      { device_id: 'dev-2', label: 'tablet', created_at: null, revoked_at: null },
    ]);
  });

  it('drops malformed entries individually so one bad row never hides the rest', () => {
    const rows = parseRevokedRows([
      null,
      'garbage',
      { label: 'no id' },
      { id: '', label: 'empty id' },
      { id: 'ok-1', label: 42 },
      { id: 'ok-2', label: 'fine', created_at: 7, revoked_at: true },
    ]);
    expect(rows).toEqual([{ device_id: 'ok-2', label: 'fine', created_at: null, revoked_at: null }]);
  });

  it('answers null for absent, non-array, and empty inputs (honest degrade)', () => {
    expect(parseRevokedRows(undefined)).toBeNull();
    expect(parseRevokedRows(null)).toBeNull();
    expect(parseRevokedRows('nope')).toBeNull();
    expect(parseRevokedRows([])).toBeNull();
  });
});

describe('phase 4D9: fetchDeviceStatus contract', () => {
  it('parses revoked_devices out of a v3 status payload', async () => {
    const payload = {
      active_devices: 1,
      session_verified: true,
      devices: [{ id: 'live-1', label: 'this browser', created_at: null, last_seen_at: null }],
      revoked_devices: [
        { id: 'gone-1', label: 'lost phone', created_at: '2026-10-09T10:00:00Z', revoked_at: '2026-11-01T09:30:00Z' },
      ],
    };
    const res = await fetchDeviceStatus(CONFIG, 'token-1', { fetchImpl: fetchReturning(JSON.stringify(payload)) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.revoked_devices).toEqual([
      {
        device_id: 'gone-1',
        label: 'lost phone',
        created_at: '2026-10-09T10:00:00Z',
        revoked_at: '2026-11-01T09:30:00Z',
      },
    ]);
  });

  it('an older function (no revoked_devices field) degrades to null without touching devices', async () => {
    const payload = {
      active_devices: 2,
      session_verified: false,
      devices: [{ id: 'live-1', label: 'still here', created_at: null, last_seen_at: null }],
    };
    const res = await fetchDeviceStatus(CONFIG, 'token-1', { fetchImpl: fetchReturning(JSON.stringify(payload)) });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.revoked_devices).toBeNull();
    expect(res.data.devices).toHaveLength(1);
  });
});

describe('phase 4D9: function + hook + card wiring guards', () => {
  it('the edge function extends status additively with the same degrade pattern', () => {
    const fn = read('..', '..', '..', '..', 'supabase', 'functions', 'device-auth', 'index.ts');
    expect(fn).toContain('async function revokedDeviceRows()');
    expect(fn).toContain(".not('revoked_at', 'is', null)");
    expect(fn).toContain(".order('revoked_at', { ascending: false })");
    expect(fn).toContain('.limit(10)');
    expect(fn).toContain('...(revoked !== null ? { revoked_devices: revoked } : {})');
    // the 4D5 status shape survives untouched
    expect(fn).toContain('...(devices !== null ? { devices } : {})');
  });

  it('the hook carries revokedRows through every state path the rows already have', () => {
    const hook = read('../cloud/useCloudSession.ts');
    expect(hook).toContain('revokedRows: RevokedDeviceRow[] | null');
    // INITIAL + SIGNED_OUT_RESET + signOut + epoch cleanup + status mapping
    expect(hook.match(/revokedRows: null/g)?.length).toBeGreaterThanOrEqual(4);
    expect(hook).toContain('revokedRows: status.data.revoked_devices');
  });

  it('the card renders a collapsed, read-only history section', () => {
    const card = read('../components/CloudAccountCard.tsx');
    expect(card).toContain('const [showRevoked, setShowRevoked] = useState(false);');
    expect(card).toContain('cloud.revokedRows !== null && cloud.revokedRows.length > 0');
    expect(card).toContain("t('account.revoked_devices_title').replace('{count}'");
    expect(card).toContain("t('account.device_revoked_when').replace('{date}'");
    expect(card).toContain('aria-expanded={showRevoked}');
    // read-only: no revoke affordance inside the history list
    const section = card.slice(card.indexOf('Phase 4D9: revoked-device history'), card.indexOf('{cloud.lastSyncAt !== null'));
    expect(section).not.toContain('revokeDevice(');
    expect(section).not.toContain('account.device_revoke_confirm');
  });
});

describe('phase 4D9: i18n ships both languages', () => {
  const NEW_KEYS = ['account.revoked_devices_title', 'account.device_revoked_when'] as const;

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
    expect(placeholders(enDict['account.revoked_devices_title'] as string)).toEqual(['count']);
    expect(placeholders(enDict['account.device_revoked_when'] as string)).toEqual(['date']);
  });
});
