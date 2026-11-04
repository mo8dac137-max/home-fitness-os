import type { EventLog } from '@hfos/events';
import { pushEvents, pullEvents, type SyncTransportOptions } from '../supabase/syncTransport.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';

/**
 * Sync orchestration (Phase 4D2).
 *
 * One idempotent round-trip over the append-only `session_events` mirror:
 * 1. PUSH every local envelope — safe to repeat because `idempotency_key` is
 *    the server's primary key and pushes use `ignore-duplicates`.
 * 2. PULL the user's remote rows and append them locally — the local
 *    `EventLog` silently drops duplicate `idempotency_key`s, so re-pulling is
 *    equally safe. `merged` counts only rows that were genuinely new.
 *
 * Conflict model: events are append-only facts; nothing is ever rewritten.
 * The same `session_id` cannot be written from two devices (M0-15 allows one
 * active device), so duplicates carry identical payloads by construction.
 */

export interface SyncSummary {
  ok: boolean;
  /** Envelopes accepted as new server rows in this round. */
  pushed: number;
  /** Local envelopes the server already had (safe no-ops). */
  duplicates: number;
  /** Remote rows received in this round. */
  pulled: number;
  /** Remote rows that were genuinely new to the local log. */
  merged: number;
  http_status: number | null;
  error: string | null;
}

/**
 * Phase 4D10: persistence for the pull cursor, keyed by user. The cursor is
 * the newest server-assigned `synced_at` this device has already merged —
 * server-clock based, so skewed device clocks can never skip rows.
 */
export interface PullCursorPort {
  load(userId: string): Promise<string | null>;
  save(userId: string, iso: string): Promise<void>;
}

/**
 * Replay window subtracted from a stored cursor: rows inserted concurrently
 * with the previous pull's last page (server `now()` within the same
 * instant, committed just after our read) would otherwise slip past the
 * strict `gt` filter forever. The replayed rows are free — the merge below
 * is idempotent and counts only genuinely new keys.
 */
export const PULL_OVERLAP_MS = 10 * 60 * 1000;

/**
 * The pull's `sinceSyncedIso` for a stored cursor: null = no usable cursor
 * (first round or garbage value) → honest full pull; otherwise the cursor
 * minus the replay window.
 */
export function cursorSinceIso(storedCursor: string | null): string | null {
  if (storedCursor === null) return null;
  const t = Date.parse(storedCursor);
  if (!Number.isFinite(t)) return null; // self-healing: garbage falls back to full pull
  return new Date(t - PULL_OVERLAP_MS).toISOString();
}

export interface SyncServiceOptions extends SyncTransportOptions {
  /** Phase 4D10: when provided, pulls are cursor-based; absent = full pull. */
  pullCursor?: PullCursorPort;
}

export async function syncNow(
  config: SupabaseEnvConfig,
  accessToken: string,
  userId: string,
  eventLog: EventLog,
  options: SyncServiceOptions = {},
): Promise<SyncSummary> {
  const localAll = await eventLog.getAll();
  const localKeys = new Set(localAll.map((e) => e.idempotency_key));

  // ── push ────────────────────────────────────────────────────────────────
  const push = await pushEvents(config, accessToken, userId, localAll, options);
  if (!push.ok) {
    return {
      ok: false,
      pushed: push.pushed,
      duplicates: push.duplicates,
      pulled: 0,
      merged: 0,
      http_status: push.http_status,
      error: push.error,
    };
  }

  // ── pull ────────────────────────────────────────────────────────────────
  // Phase 4D10: cursor-based pull. The stored cursor is the newest server
  // synced_at already merged here; the pull replays a 10-minute overlap so
  // a concurrent insert can never slip past the strict gt filter, and the
  // idempotent merge makes the replay free. No usable cursor (first round,
  // garbage value) honestly falls back to the full pull. The cursor only
  // advances on a successful pull, so bookkeeping cannot drift the log —
  // the exact safety the deliberate full pull used to guarantee.
  const storedCursor = options.pullCursor !== undefined
    ? await options.pullCursor.load(userId)
    : null;
  const sinceSyncedIso = cursorSinceIso(storedCursor);
  const pull = await pullEvents(config, accessToken, userId, {
    ...options,
    sinceIso: undefined,
    ...(sinceSyncedIso !== null ? { sinceSyncedIso } : {}),
  });
  if (!pull.ok) {
    return {
      ok: false,
      pushed: push.pushed,
      duplicates: push.duplicates,
      pulled: pull.envelopes.length,
      merged: 0,
      http_status: pull.http_status,
      error: pull.error,
    };
  }

  // ── merge ───────────────────────────────────────────────────────────────
  let merged = 0;
  for (const envelope of pull.envelopes) {
    if (!localKeys.has(envelope.idempotency_key)) {
      merged++;
      localKeys.add(envelope.idempotency_key);
    }
    await eventLog.append(envelope); // idempotent append
  }

  // Phase 4D10: advance the cursor only forward (a pure overlap replay can
  // report rows older than the stored cursor — saving those would move it
  // backward and widen the next replay). A non-finite stored value (garbage)
  // counts as "nothing stored" so the self-healing full pull replaces it.
  if (options.pullCursor !== undefined && pull.max_synced_at !== null) {
    const candidate = Date.parse(pull.max_synced_at);
    const currentMs = storedCursor !== null ? Date.parse(storedCursor) : Number.NaN;
    const current = Number.isFinite(currentMs) ? currentMs : Number.NEGATIVE_INFINITY;
    if (Number.isFinite(candidate) && candidate > current) {
      await options.pullCursor.save(userId, pull.max_synced_at);
    }
  }

  return {
    ok: true,
    pushed: push.pushed,
    duplicates: push.duplicates,
    pulled: pull.envelopes.length,
    merged,
    http_status: pull.http_status,
    error: null,
  };
}
