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
import { revokeCurrentDevice } from '../supabase/deviceAuthClient.js';
import { KeyValueDeviceKeyStore } from '../supabase/deviceKeyStore.js';
import { syncNow, type SyncSummary } from '../sync/syncService.js';

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
      patch({ syncBusy: false, lastSync: first });
      return;
    }
    // Permission errors usually mean the 12 h device session lapsed: one
    // re-verify round, then a single retry. Anything else surfaces honestly.
    const flow = await runDeviceFlow(env.config, valid.data.session.access_token, deviceStore);
    if (flow.kind !== 'verified' && flow.kind !== 'enrolled') {
      patch({ syncBusy: false, lastSync: first });
      return;
    }
    const second = await syncNow(
      env.config,
      valid.data.session.access_token,
      valid.data.session.user_id,
      eventLog,
    );
    patch({ syncBusy: false, lastSync: second });
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
    void sync();
  }, [state.stage, sync]);

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
