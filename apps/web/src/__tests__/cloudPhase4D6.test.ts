import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { revokeDeviceById } from '../supabase/deviceAuthClient.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';
import { enDict, arDict } from '../i18n/index.js';

/**
 * Phase 4D6: per-device revoke + "added when" facts + honest server contract.
 *
 * - `revokeDeviceById` is pure client logic under real unit tests (injected
 *   fetch, verbatim server-code passthrough, no-store guarantee).
 * - The React/browser wiring follows the house style: source guards.
 */

const read = (...segments: string[]): string =>
  fs.readFileSync(path.resolve(__dirname, ...segments), 'utf8');

const CONFIG: SupabaseEnvConfig = { url: 'https://example.supabase.co', publishableKey: 'pb_test_key' };

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function captureFetch(body: string, status = 200): { fetchImpl: typeof fetch; calls: CapturedCall[] } {
  const calls: CapturedCall[] = [];
  const fetchImpl = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: init as RequestInit });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('phase 4D6: revokeDeviceById', () => {
  it('sends revoke with the explicit device id and correct transport headers', async () => {
    const { fetchImpl, calls } = captureFetch(JSON.stringify({ ok: true }));
    const res = await revokeDeviceById(CONFIG, 'token-1', 'dev-9', { fetchImpl });
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ action: 'revoke', device_id: 'dev-9' });
    expect(calls[0]?.init.headers).toMatchObject({
      Authorization: 'Bearer token-1',
      apikey: 'pb_test_key',
    });
    expect(String(calls[0]?.url)).toContain('/functions/v1/device-auth');
  });

  it('short-circuits an empty id without any network call (bad_device_id)', async () => {
    const { fetchImpl, calls } = captureFetch('{}');
    const res = await revokeDeviceById(CONFIG, 'token-1', '   ', { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('bad_device_id');
    expect(calls).toHaveLength(0);
  });

  it('refuses an empty access token before any network call (missing_token)', async () => {
    const { fetchImpl, calls } = captureFetch('{}');
    const res = await revokeDeviceById(CONFIG, '   ', 'dev-9', { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('missing_token');
    expect(calls).toHaveLength(0);
  });

  it('passes a hardened-server 404 through verbatim', async () => {
    const { fetchImpl } = captureFetch(JSON.stringify({ error: 'unknown_or_revoked_device' }), 404);
    const res = await revokeDeviceById(CONFIG, 'token-1', 'gone-device', { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('unknown_or_revoked_device');
      expect(res.http_status).toBe(404);
    }
  });
});

describe('phase 4D6: card + hook wiring guards', () => {
  it('every device row carries a revoke affordance with a two-step confirm', () => {
    const card = read('../components/CloudAccountCard.tsx');
    expect(card).toContain('confirmRevokeId');
    expect(card).toContain('cloud.revokeDevice(row.device_id)');
    expect(card).toContain("t('account.device_revoke')");
    expect(card).toContain("t('account.device_revoke_hint')");
    expect(card).toContain("t('account.device_revoke_confirm')");
    expect(card).toContain("t('account.device_revoke_failed')");
    // the current device routes through the existing full deauthorize flow
    expect(card).toContain('if (isCurrent) {');
    expect(card).toContain('setConfirmDeauth(true)');
  });

  it('rows surface when each device was added, next to its last-seen fact', () => {
    const card = read('../components/CloudAccountCard.tsx');
    expect(card).toContain('function formatDate(');
    expect(card).toContain("t('account.device_added')");
    expect(card).toContain('row.created_at !== null');
  });

  it('the hook exposes revokeDevice and a dedicated revokeError surface', () => {
    const hook = read('../cloud/useCloudSession.ts');
    expect(hook).toContain('revokeDevice: (deviceId: string) => Promise<void>');
    expect(hook).toContain('revokeDeviceById(');
    expect(hook).toMatch(/revokeError: revoked\.code/);
    expect(hook).toMatch(/revokeError: null,\s*\n\s*\}\);/);
  });

  it('revokeDevice never signs out — revoking another device keeps this browser verified', () => {
    const hook = read('../cloud/useCloudSession.ts');
    const revokeBlock = hook.slice(
      hook.indexOf('const revokeDevice = useCallback'),
      hook.indexOf('// ── opportunistic auto-sync'),
    );
    expect(revokeBlock).not.toContain('authSignOut');
    expect(revokeBlock).toContain('await refreshDeviceInfo();');
  });

  it('the edge function makes revoke honest (404 instead of a fake ok)', () => {
    const fn = read('..', '..', '..', '..', 'supabase', 'functions', 'device-auth', 'index.ts');
    expect(fn).toContain("return json(req, 404, { error: 'unknown_or_revoked_device' });");
    expect(fn).toContain(".eq('id', deviceId).eq('user_id', userId).is('revoked_at', null).maybeSingle()");
  });

  it('the edge function serves CORS from an optional allow-list (M0-15b)', () => {
    const fn = read('..', '..', '..', '..', 'supabase', 'functions', 'device-auth', 'index.ts');
    expect(fn).toContain("Deno.env.get('DEVICE_AUTH_ALLOWED_ORIGINS')");
    expect(fn).toContain('function corsHeaders(req: Request)');
    expect(fn).toContain("headers['Vary'] = 'Origin'");
    // the spike-wide wildcard stays the documented fallback when unset
    expect(fn).toContain("? '*'");
  });

  it('the 4D5 edge-function behavior survives untouched', () => {
    const fn = read('..', '..', '..', '..', 'supabase', 'functions', 'device-auth', 'index.ts');
    expect(fn).toMatch(/update\(\{ last_seen_at: new Date\(\)\.toISOString\(\) \}\)/);
    expect(fn).toContain('/* pre-migration database: last-seen stays untouched */');
    expect(fn).toContain(".select('id, label, created_at, last_seen_at')");
    expect(fn).toContain('...(devices !== null ? { devices } : {})');
    expect(fn).toContain('return null; // pre-migration database: fall back to the bare count');
  });
});

describe('phase 4D6: i18n ships both languages', () => {
  const NEW_KEYS = [
    'account.device_added',
    'account.device_revoke',
    'account.device_revoke_hint',
    'account.device_revoke_confirm',
    'account.device_revoke_failed',
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
    expect(placeholders(enDict['account.device_added'] as string)).toEqual(['date']);
    expect(placeholders(enDict['account.device_revoke_failed'] as string)).toEqual(['code']);
  });
});
