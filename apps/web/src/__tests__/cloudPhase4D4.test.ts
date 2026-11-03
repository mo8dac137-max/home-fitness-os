import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  createAutoSyncPolicy,
  MIN_AUTO_SYNC_INTERVAL_MS,
} from '../sync/syncTriggers.js';
import { enDict, arDict } from '../i18n/index.js';

/**
 * Phase 4D4: opportunistic auto-sync + honest device facts.
 *
 * - The trigger policy (visible-again / back-online) is pure logic under
 *   real unit tests: readiness gate, busy gate, and the 30 s rate limiter
 *   that keeps rapid tab flips from hammering the edge functions.
 * - The React hook and the account card follow the house style: source
 *   guards that pin the wiring (both event listeners, epoch-scoped device
 *   info refresh, lastSyncAt stamping, null-guarded UI facts).
 * - The three new i18n keys must ship in both dictionaries with matching
 *   placeholders.
 */

const read = (...segments: string[]): string =>
  fs.readFileSync(path.resolve(__dirname, ...segments), 'utf8');

describe('phase 4D4: auto-sync trigger policy', () => {
  it('defaults to a 30 s minimum interval', () => {
    expect(MIN_AUTO_SYNC_INTERVAL_MS).toBe(30_000);
  });

  it('never fires while the cloud is not ready', () => {
    const policy = createAutoSyncPolicy({ minIntervalMs: 1000, now: () => 0 });
    expect(policy.shouldSync({ ready: false, busy: false })).toBe(false);
  });

  it('never fires while a sync round is in flight', () => {
    const policy = createAutoSyncPolicy({ minIntervalMs: 1000, now: () => 0 });
    expect(policy.shouldSync({ ready: true, busy: true })).toBe(false);
  });

  it('fires when ready and idle, then rate-limits inside the interval', () => {
    let clock = 0;
    const policy = createAutoSyncPolicy({ minIntervalMs: 1000, now: () => clock });
    expect(policy.shouldSync({ ready: true, busy: false })).toBe(true);
    policy.markStarted();
    clock = 500;
    expect(policy.shouldSync({ ready: true, busy: false })).toBe(false);
  });

  it('allows a new round once the interval has elapsed', () => {
    let clock = 0;
    const policy = createAutoSyncPolicy({ minIntervalMs: 1000, now: () => clock });
    policy.markStarted();
    clock = 999;
    expect(policy.shouldSync({ ready: true, busy: false })).toBe(false);
    clock = 1000;
    expect(policy.shouldSync({ ready: true, busy: false })).toBe(true);
  });

  it('the busy gate holds even outside the rate-limit window', () => {
    let clock = 0;
    const policy = createAutoSyncPolicy({ minIntervalMs: 1000, now: () => clock });
    policy.markStarted();
    clock = 5000; // far past the interval
    expect(policy.shouldSync({ ready: true, busy: true })).toBe(false);
  });
});

describe('phase 4D4: hook wiring guards', () => {
  const hook = read('../cloud/useCloudSession.ts');

  it('listens to both comeback moments and cleans them up', () => {
    expect(hook).toContain("window.addEventListener('online', tryOpportunisticSync)");
    expect(hook).toContain("document.addEventListener('visibilitychange', onVisibility)");
    expect(hook).toContain("window.removeEventListener('online', tryOpportunisticSync)");
    expect(hook).toContain("document.removeEventListener('visibilitychange', onVisibility)");
    // only actually syncs when the app is visible again
    expect(hook).toContain("document.visibilityState === 'visible'");
  });

  it('routes opportunistic triggers through the policy (gate + rate limit)', () => {
    expect(hook).toContain('createAutoSyncPolicy()');
    expect(hook).toContain(
      'policy.shouldSync({ ready: snap.stage === \'ready\', busy: snap.syncBusy })',
    );
    // markStarted before every automatic round: the cold-start path and the
    // opportunistic path both feed the same rate limiter
    const marks = [...hook.matchAll(/markStarted\(\)/g)].length;
    expect(marks).toBe(2);
  });

  it('refreshes device info once per readiness epoch, not per render', () => {
    expect(hook).toContain('deviceInfoEpochRef');
    expect(hook).toContain('loadEnrolledDeviceId(deviceStore)');
    expect(hook).toContain('fetchDeviceStatus(env.config, token)');
    expect(hook).toMatch(/state\.stage !== 'ready' \|\| deviceInfoEpochRef\.current\) return;/);
  });

  it('a failed status probe only leaves the count unknown (informational)', () => {
    expect(hook).toContain('if (status.ok) patch({ activeDevices: status.data.active_devices });');
    expect(hook).not.toContain("deviceError: status.code");
  });

  it('stamps the wall-clock time of every completed sync round', () => {
    const stamps = [...hook.matchAll(/lastSyncAt: Date\.now\(\)/g)].length;
    expect(stamps).toBe(3); // first ok, honest failure keep, post-re-verify round
  });

  it('signed-out resets clear the new device facts too', () => {
    expect(hook).toMatch(/activeDevices: null,\s*\n\s*deviceId: null,\s*\n\s*lastSyncAt: null,/);
  });
});

describe('phase 4D4: account card guards', () => {
  const card = read('../components/CloudAccountCard.tsx');

  it('surfaces the three facts, each null-guarded (no invented values)', () => {
    expect(card).toContain('cloud.activeDevices !== null');
    expect(card).toContain('cloud.deviceId !== null');
    expect(card).toContain('cloud.lastSyncAt !== null');
    expect(card).toContain("t('account.active_devices')");
    expect(card).toContain("t('account.this_device')");
    expect(card).toContain("t('account.last_sync')");
  });

  it('shows the short device id with the full id kept as the title', () => {
    expect(card).toContain('cloud.deviceId.slice(0, 8)');
    expect(card).toContain('title={cloud.deviceId}');
  });
});

describe('phase 4D4: i18n ships both languages', () => {
  const NEW_KEYS = [
    'account.active_devices',
    'account.this_device',
    'account.last_sync',
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
    expect(placeholders(enDict['account.active_devices'] as string)).toEqual(['count']);
    expect(placeholders(enDict['account.this_device'] as string)).toEqual(['id']);
    expect(placeholders(enDict['account.last_sync'] as string)).toEqual(['time']);
  });
});
