import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { enDict, arDict } from '../i18n/index.js';

/**
 * Source guards for the Phase 4D3 cloud additions: one auto-sync per cold
 * start once the device flow converges, an honest deauthorize action
 * (server revoke surfaced in the UI, local break only on success), and a
 * cleanup migration that only removes rows the engine already ignores.
 */

const read = (...segments: string[]): string =>
  fs.readFileSync(path.resolve(__dirname, ...segments), 'utf8');

describe('phase 4D3: auto-sync on start', () => {
  it('useCloudSession auto-syncs exactly once per readiness transition', () => {
    const hook = read('../cloud/useCloudSession.ts');
    expect(hook).toContain('autoSyncRef.current = true');
    expect(hook).toContain('void sync();');
    // the guard re-arms only after a signed-out reset, never mid-ready
    expect(hook).toMatch(/state\.stage === 'signed_out'[\s\S]*?autoSyncRef\.current = false/);
    expect(hook).toMatch(/state\.stage !== 'ready' \|\| autoSyncRef\.current\) return/);
  });

  it('the auto-sync never runs while checking or unconfigured', () => {
    const hook = read('../cloud/useCloudSession.ts');
    // stage reaches 'ready' only after a verified device flow, and sync()
    // itself early-returns when unconfigured or signed out
    expect(hook).toMatch(/stage !== 'ready'/);
    expect(hook).toMatch(/if \(!env\.ok \|\| sessionRef\.current === null\) return;/);
  });
});

describe('phase 4D3: honest deauthorize', () => {
  const hook = read('../cloud/useCloudSession.ts');

  it('deauthorize revokes server-side and then signs out locally', () => {
    expect(hook).toContain('revokeCurrentDevice(');
    expect(hook).toMatch(/await authSignOut\(env\.config, sessionStore\);\s*\n\s*sessionRef\.current = null;\s*\n\s*patch\(SIGNED_OUT_RESET\);/);
  });

  it('a failed revoke never pretends success — the user stays verified', () => {
    // the failure branch must surface the real code and return BEFORE any
    // local sign-out; only 'not_enrolled' may fall through to it
    expect(hook).toContain("revoked.code !== 'not_enrolled'");
    expect(hook).toMatch(
      /if \(!revoked\.ok && revoked\.code !== 'not_enrolled'\) \{[\s\S]*?patch\(\{ busy: false, deviceError: revoked\.code \}\);[\s\S]*?return;[\s\S]*?\}/,
    );
    const failureIdx = hook.indexOf('deviceError: revoked.code');
    // the LAST local sign-out is the success path — it must come only after
    // the failure branch (the first sign-out is the no-live-session branch)
    const successSignOutIdx = hook.lastIndexOf('await authSignOut(env.config, sessionStore);');
    expect(failureIdx).toBeGreaterThan(-1);
    expect(successSignOutIdx).toBeGreaterThan(failureIdx);
  });

  it('the card uses a two-step confirm and reports failures with real codes', () => {
    const card = read('../components/CloudAccountCard.tsx');
    for (const key of [
      'account.deauthorize',
      'account.deauthorize_hint',
      'account.deauthorize_confirm',
      'account.cancel',
      'account.deauthorize_failed',
    ]) {
      expect(card).toContain(key);
      expect(enDict, `missing en key: ${key}`).toHaveProperty(key);
      expect(arDict, `missing ar key: ${key}`).toHaveProperty(key);
    }
    expect(card).toContain('cloud.deauthorize()');
    expect(card).toContain('setConfirmDeauth(false)');
    // the plain sign-out stays available independently
    expect(card).toContain("t('account.sign_out')");
  });
});

describe('phase 4D3: cleanup migration', () => {
  const sql = read(
    '..',
    '..',
    '..',
    '..',
    'supabase',
    'migrations',
    '20261104000000_p4d3_cleanup_expired_device_auth.sql',
  );

  it('deletes only expired challenges and lapsed sessions', () => {
    expect(sql).toContain('delete from public.device_challenges where expires_at < now()');
    expect(sql).toContain('delete from public.device_sessions where expires_at < now()');
    expect(sql.match(/delete from/g)?.length).toBe(2);
  });

  it('never touches authoritative rows', () => {
    expect(sql).not.toMatch(/delete from public\.(authorized_devices|recovery_codes)/);
    // used recovery codes must keep failing reuse attempts
    expect(sql).toContain('recovery_codes');
  });
});
