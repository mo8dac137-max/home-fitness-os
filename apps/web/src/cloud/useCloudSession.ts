import { useCallback, useEffect, useRef, useState } from 'react';
import { IndexedDbEventLog } from '../storage/IndexedDbEventLog.js';
import { KeyValueStore } from '../storage/KeyValueStore.js';
import { readSupabaseEnv } from '../supabase/env.js';
import {
  getValidSession,
  signInWithPassword,
  signOut as authSignOut,
  KeyValueAuthSessionStore,
  type AuthSession,
} from '../supabase/authClient.js';
import { runDeviceFlow, submitDeviceRecovery } from '../supabase/deviceFlow.js';
import {
  fetchDeviceStatus,
  loadEnrolledDeviceId,
  revokeCurrentDevice,
} from '../supabase/deviceAuthClient.js';
import { KeyValueDeviceKeyStore } from '../supabase/deviceKeyStore.js';
import { syncNow, type SyncSummary } from '../sync/syncService.js';
import { createAutoSyncPolicy, type AutoSyncPolicy } from '../sync/syncTriggers.js';

/**
 * Cloud session hook (Phase 4D2).
 *
 * Thin React glue over the tested cloud modules: auth client, device flow,
 * sync service. The app stays fully usable signed out — this hook never
 * blocks rendering; it only powers the Account card and background sync.
 */

export type CloudStage =
  | 'checking' // restoring a stored session on mount
  | 'signed_out'
  | 'device_flow' // signed in; enroll/verify in progress (or failed, retryable)
  | 'recovery' // recovery code input required
  | 'ready'; // signed in + device verified

export interface CloudSessionState {
  configured: boolean;
  stage: CloudStage;
  email: string | null;
  busy: boolean;
  /** One-time codes from a fresh enroll/recovery — shown exactly once. */
  recoveryCodes: string[] | null;
  authError: string | null;
  deviceError: string | null;
  lastSync: SyncSummary | null;
  syncBusy: boolean;
  /** Server-reported active device count (null = unknown/not fetched). */
  activeDevices: number | null;
  /** This browser's enrolled device id (informational, from the key store). */
  deviceId: string | null;
  /** Wall-clock ms of the last completed sync round (null = never). */
  lastSyncAt: number | null;
}

export interface CloudSessionActions {
  signIn: (email: string, password: string) => Promise<void>;
  submitRecoveryCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Revokes this device's key server-side, clears it locally, signs out. */
  deauthorize: () => Promise<void>;
  sync: () => Promise<void>;
  retryDeviceFlow: () => Promise<void>;
  dismissRecoveryCodes: () => void;
}

export type CloudSessionHandle = CloudSessionState & CloudSessionActions;

const INITIAL: CloudSessionState = {
  configured: false,
  stage: 'checking',
  email: null,
  busy: false,
  recoveryCodes: null,
  authError: null,
  deviceError: null,
  lastSync: null,
  syncBusy: false,
  activeDevices: null,
  deviceId: null,
  lastSyncAt: null,
};

/** Full reset applied after sign-out / deauthorize (Phase 4D3). */
const SIGNED_OUT_RESET: Partial<CloudSessionState> = {
  stage: 'signed_out',
  email: null,
  recoveryCodes: null,
  authError: null,
  deviceError: null,
  lastSync: null,
  busy: false,
  activeDevices: null,
  deviceId: null,
  lastSyncAt: null,
};

interface CloudStores {
  sessionStore: KeyValueAuthSessionStore;
  deviceStore: KeyValueDeviceKeyStore;
}

function openStores(): CloudStores {
  return {
    sessionStore: new KeyValueAuthSessionStore(new KeyValueStore()),
    deviceStore: new KeyValueDeviceKeyStore(new KeyValueStore()),
  };
}

type FlowResult = Awaited<ReturnType<typeof runDeviceFlow>>;

function applyFlowResult(
  flow: FlowResult,
  patch: (p: Partial<CloudSessionState>) => void,
  signedInEmail: string | null,
): void {
  switch (flow.kind) {
    case 'verified':
      patch({ stage: 'ready', busy: false, deviceError: null, email: signedInEmail });
      break;
    case 'enrolled':
      patch({
        stage: 'ready',
        busy: false,
        deviceError: null,
        email: signedInEmail,
        recoveryCodes: flow.outcome.recovery_codes,
      });
      break;
    case 'recovery_required':
      patch({ stage: 'recovery', busy: false, deviceError: null });
      break;
    case 'error':
      patch({
        stage:
          flow.code === 'unauthenticated' || flow.code === 'missing_token'
            ? 'signed_out'
            : 'device_flow',
        busy: false,
        deviceError: flow.code,
      });
      break;
  }
}

export function useCloudSession(): CloudSessionHandle {
  const [state, setState] = useState<CloudSessionState>(INITIAL);
  const sessionRef = useRef<AuthSession | null>(null);

  // Opportunistic auto-sync policy (Phase 4D4): per-hook instance, lazily built
  const autoSyncPolicyRef = useRef<AutoSyncPolicy | null>(null);
  if (autoSyncPolicyRef.current === null) autoSyncPolicyRef.current = createAutoSyncPolicy();

  const patch = useCallback((p: Partial<CloudSessionState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  // ── mount: restore session, then converge the device flow ───────────────
  useEffect(() => {
    let cancelled = false;

    const boot = async (): Promise<void> => {
      const env = readSupabaseEnv();
      if (!env.ok) {
        if (!cancelled) patch({ stage: 'signed_out' }); // honest: cloud off, app unaffected
        return;
      }
      if (!cancelled) patch({ configured: true });

      const { sessionStore, deviceStore } = openStores();
      const restored = await getValidSession(env.config, sessionStore);
      if (cancelled) return;

      if (!restored.ok) {
        patch({
          stage: 'signed_out',
          authError: restored.code === 'signed_out' ? null : restored.code,
        });
        return;
      }

      sessionRef.current = restored.data.session;
      patch({ stage: 'device_flow', email: restored.data.session.email, busy: true });

      const flow = await runDeviceFlow(env.config, restored.data.session.access_token, deviceStore);
      if (cancelled) return;
      applyFlowResult(flow, patch, restored.data.session.email);
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      const env = readSupabaseEnv();
      if (!env.ok) return;
      patch({ busy: true, authError: null, deviceError: null });
      const { sessionStore, deviceStore } = openStores();
      const signedIn = await signInWithPassword(env.config, sessionStore, email, password);
      if (!signedIn.ok) {
        sessionRef.current = null;
        patch({ busy: false, authError: signedIn.code });
        return;
      }
      sessionRef.current = signedIn.data.session;
      patch({ stage: 'device_flow', email: signedIn.data.session.email });
      const flow = await runDeviceFlow(env.config, signedIn.data.session.access_token, deviceStore);
      applyFlowResult(flow, patch, signedIn.data.session.email);
    },
    [patch],
  );

  const retryDeviceFlow = useCallback(async (): Promise<void> => {
    const env = readSupabaseEnv();
    if (!env.ok) return;
    patch({ busy: true, deviceError: null });
    const { sessionStore, deviceStore } = openStores();
    const valid = await getValidSession(env.config, sessionStore);
    if (!valid.ok) {
      sessionRef.current = null;
      patch({ stage: 'signed_out', busy: false, authError: valid.code });
      return;
    }
    sessionRef.current = valid.data.session;
    patch({ stage: 'device_flow', email: valid.data.session.email });
    const flow = await runDeviceFlow(env.config, valid.data.session.access_token, deviceStore);
    applyFlowResult(flow, patch, valid.data.session.email);
  }, [patch]);

  const submitRecoveryCode = useCallback(
    async (code: string): Promise<void> => {
      const env = readSupabaseEnv();
      if (!env.ok) return;
      patch({ busy: true, deviceError: null });
      const { deviceStore } = openStores();
      const flow = await submitDeviceRecovery(
        env.config,
        sessionRef.current?.access_token ?? '',
        deviceStore,
        code,
      );
      applyFlowResult(flow, patch, sessionRef.current?.email ?? null);
    },
    [patch],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const env = readSupabaseEnv();
    if (!env.ok) return;
    const { sessionStore } = openStores();
    await authSignOut(env.config, sessionStore);
    // The device record is intentionally kept: signing back in re-verifies
    // the same key pair without a new enroll/recovery round.
    sessionRef.current = null;
    patch({
      stage: 'signed_out',
      email: null,
      recoveryCodes: null,
      authError: null,
      deviceError: null,
      lastSync: null,
      activeDevices: null,
      deviceId: null,
      lastSyncAt: null,
    });
  }, [patch]);

  const sync = useCallback(async (): Promise<void> => {
    const env = readSupabaseEnv();
    if (!env.ok || sessionRef.current === null) return;
    patch({ syncBusy: true });
    const { sessionStore, deviceStore } = openStores();
    const valid = await getValidSession(env.config, sessionStore);
    if (!valid.ok) {
      sessionRef.current = null;
      patch({ syncBusy: false, stage: 'signed_out', email: null });
      return;
    }
    sessionRef.current = valid.data.session;

    const eventLog = new IndexedDbEventLog();
    const first = await syncNow(
      env.config,
      valid.data.session.access_token,
      valid.data.session.user_id,
      eventLog,
    );
    if (first.ok) {
      patch({ syncBusy: false, lastSync: first, lastSyncAt: Date.now() });
      return;
    }
    // Permission errors usually mean the 12 h device session lapsed: one
    // re-verify round, then a single retry. Anything else surfaces honestly.
    const flow = await runDeviceFlow(env.config, valid.data.session.access_token, deviceStore);
    if (flow.kind !== 'verified' && flow.kind !== 'enrolled') {
      patch({ syncBusy: false, lastSync: first, lastSyncAt: Date.now() });
      return;
    }
    const second = await syncNow(
      env.config,
      valid.data.session.access_token,
      valid.data.session.user_id,
      eventLog,
    );
    patch({ syncBusy: false, lastSync: second, lastSyncAt: Date.now() });
  }, [patch]);

  const dismissRecoveryCodes = useCallback((): void => {
    patch({ recoveryCodes: null });
  }, [patch]);

  // ── deauthorize (Phase 4D3): revoke + clean local break ─────────────────
  const deauthorize = useCallback(async (): Promise<void> => {
    const env = readSupabaseEnv();
    if (!env.ok) return;
    patch({ busy: true, deviceError: null });
    const { sessionStore, deviceStore } = openStores();
    const valid = await getValidSession(env.config, sessionStore);
    if (!valid.ok) {
      // No live session: nothing server-side to revoke — a plain local break.
      sessionRef.current = null;
      await authSignOut(env.config, sessionStore);
      patch(SIGNED_OUT_RESET);
      return;
    }
    sessionRef.current = valid.data.session;
    const revoked = await revokeCurrentDevice(
      env.config,
      valid.data.session.access_token,
      deviceStore,
    );
    // 'not_enrolled' just means this browser has no key pair to revoke —
    // the local sign-out below is still exactly what the user asked for.
    if (!revoked.ok && revoked.code !== 'not_enrolled') {
      // Honest failure: the device is still authorized server-side, so the
      // user must know. Stay signed in + verified and surface the real code.
      patch({ busy: false, deviceError: revoked.code });
      return;
    }
    await authSignOut(env.config, sessionStore);
    sessionRef.current = null;
    patch(SIGNED_OUT_RESET);
  }, [patch]);

  // ── auto-sync (Phase 4D3): once per cold start, when the cloud is ready ──
  const autoSyncRef = useRef(false);
  useEffect(() => {
    if (state.stage === 'signed_out') {
      autoSyncRef.current = false; // a fresh sign-in may auto-sync again
      return;
    }
    if (state.stage !== 'ready' || autoSyncRef.current) return;
    autoSyncRef.current = true;
    // the cold-start round also feeds the opportunistic rate limiter, so a
    // quick background/foreground right after launch cannot double-fire
    autoSyncPolicyRef.current?.markStarted();
    void sync();
  }, [state.stage, sync]);

  // ── device/self info (Phase 4D4): refresh once per readiness epoch ──────
  const deviceInfoEpochRef = useRef(false);
  const refreshDeviceInfo = useCallback(async (): Promise<void> => {
    const env = readSupabaseEnv();
    const token = sessionRef.current?.access_token;
    if (!env.ok || token === undefined) return;
    const { deviceStore } = openStores();
    const deviceId = await loadEnrolledDeviceId(deviceStore);
    patch({ deviceId });
    // informational only: a failed status probe just leaves the count unknown
    const status = await fetchDeviceStatus(env.config, token);
    if (status.ok) patch({ activeDevices: status.data.active_devices });
  }, [patch]);

  useEffect(() => {
    if (state.stage === 'signed_out') {
      if (deviceInfoEpochRef.current) {
        deviceInfoEpochRef.current = false;
        patch({ activeDevices: null, deviceId: null, lastSyncAt: null });
      }
      return;
    }
    if (state.stage !== 'ready' || deviceInfoEpochRef.current) return;
    deviceInfoEpochRef.current = true;
    void refreshDeviceInfo();
  }, [state.stage, refreshDeviceInfo, patch]);

  // ── opportunistic auto-sync (Phase 4D4): visible again / back online ────
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  useEffect(() => {
    const tryOpportunisticSync = (): void => {
      const policy = autoSyncPolicyRef.current;
      const snap = stateRef.current;
      if (policy === null) return;
      if (!policy.shouldSync({ ready: snap.stage === 'ready', busy: snap.syncBusy })) return;
      policy.markStarted();
      void syncRef.current();
    };
    const onVisibility = (): void => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        tryOpportunisticSync();
      }
    };
    window.addEventListener('online', tryOpportunisticSync);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', tryOpportunisticSync);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return {
    ...state,
    signIn,
    submitRecoveryCode,
    signOut,
    deauthorize,
    sync,
    retryDeviceFlow,
    dismissRecoveryCodes,
  };
}
