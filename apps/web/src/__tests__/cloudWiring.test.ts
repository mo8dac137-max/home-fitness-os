import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { enDict } from '../i18n/index.js';

/**
 * Source guards for the Phase 4D2 cloud wiring: App drives the cloud session,
 * MoreScreen surfaces the account card, and every account.* key used by the
 * component actually exists in the dictionaries (both languages ship together).
 */

const read = (...segments: string[]): string =>
  fs.readFileSync(path.resolve(__dirname, ...segments), 'utf8');

describe('cloud wiring guards', () => {
  it('App owns the single cloud session and syncs after workout completion', () => {
    const app = read('../App.tsx');
    expect(app).toContain('useCloudSession()');
    expect(app).toContain('void cloud.sync()');
    expect(app).toMatch(/onSessionComplete=\{\(\) => \{[\s\S]*?void cloud\.sync\(\);[\s\S]*?\}\}/);
    expect(app).toMatch(/cloud=\{cloud\}/);
  });

  it('MoreScreen accepts the optional cloud handle and renders the account card', () => {
    const more = read('../screens/MoreScreen.tsx');
    expect(more).toContain('cloud?: CloudSessionHandle | null');
    expect(more).toContain('{cloud && <CloudAccountCard cloud={cloud} />}');
  });

  it('CloudAccountCard keeps copy in i18n and reports failures with real codes', () => {
    const card = read('../components/CloudAccountCard.tsx');
    // no hard-coded copy in the card (i18n-only rule)
    expect(card).not.toMatch(/>(?!\{)[A-Z][a-z]+ [a-z]/); // no raw English text nodes
    // failure surfaces carry the real server code for honest diagnostics
    expect(card).toContain("'{code}'");
    expect(card).toContain('account.error_invalid_credentials');
    expect(card).toContain('account.device_error');
    expect(card).toContain('account.sync_failed');
  });

  it('every account.* key used in source exists in the dictionaries', () => {
    const card = read('../components/CloudAccountCard.tsx');
    const used = [...card.matchAll(/t\('(account\.[a-z_]+)'\)/g)].map((m) => m[1] ?? '');
    expect(used.length).toBeGreaterThanOrEqual(20);
    for (const key of used) {
      expect(enDict, `missing en key: ${key}`).toHaveProperty(key);
    }
  });

  it('cloud modules stay injectable: no hard-coded project URL or secrets', () => {
    for (const rel of [
      '../supabase/authClient.ts',
      '../supabase/deviceFlow.ts',
      '../sync/syncService.ts',
      '../cloud/useCloudSession.ts',
    ]) {
      const src = read(rel);
      expect(src, `${rel} must not hard-code a project URL`).not.toMatch(
        /https:\/\/[a-z0-9]{20}\.supabase\.co/,
      );
      expect(src, `${rel} must not embed secrets`).not.toMatch(/service_role|secret_key|sb_secret_/);
    }
  });
});
