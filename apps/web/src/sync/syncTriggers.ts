/**
 * Auto-sync trigger policy (Phase 4D4).
 *
 * Phase 4D3 already syncs once per cold start. This policy adds the two
 * opportunistic moments a phone-first workout app actually comes back to
 * life: the app/tab becoming visible again (mobile backgrounding, tab
 * switch) and connectivity returning after an offline stretch (`online`).
 *
 * The decision lives in a tiny injectable state machine so the React layer
 * stays a thin adapter (house style: the logic is under test, the hook is
 * source-guarded):
 * - never fires while the cloud is not `ready` or a round is in flight;
 * - rate-limits itself to one round per MIN_AUTO_SYNC_INTERVAL_MS so rapid
 *   tab flips or flaky connections cannot hammer the edge functions.
 *
 * The policy is deliberately trigger-agnostic: `visible` and `online` share
 * the same gate today; if one ever needs its own cadence, the hook passes a
 * trigger tag here and the map lives in this one file.
 */

/** Minimum wall-clock gap between two opportunistic auto-sync rounds. */
export const MIN_AUTO_SYNC_INTERVAL_MS = 30_000;

export interface AutoSyncPolicyOptions {
  /** Test seam: overrides the default minimum interval (ms). */
  minIntervalMs?: number;
  /** Test seam: clock source (defaults to Date.now). */
  now?: () => number;
}

export interface AutoSyncDeps {
  /** The cloud session is signed in AND device-verified (stage `ready`). */
  ready: boolean;
  /** A sync round (manual or automatic) is currently in flight. */
  busy: boolean;
}

export interface AutoSyncPolicy {
  /** Whether an opportunistic trigger may start a sync round right now. */
  shouldSync: (deps: AutoSyncDeps) => boolean;
  /** Records that a round started at the current clock reading. */
  markStarted: () => void;
}

export function createAutoSyncPolicy(options: AutoSyncPolicyOptions = {}): AutoSyncPolicy {
  const minIntervalMs = options.minIntervalMs ?? MIN_AUTO_SYNC_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());
  let lastStartedAt: number | null = null;

  return {
    shouldSync(deps) {
      if (!deps.ready || deps.busy) return false;
      if (lastStartedAt !== null && now() - lastStartedAt < minIntervalMs) return false;
      return true;
    },
    markStarted() {
      lastStartedAt = now();
    },
  };
}
