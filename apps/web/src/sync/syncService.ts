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

export type SyncServiceOptions = SyncTransportOptions;

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
  // pullEvents drains all pages internally (stops at a short page); a full
  // pull every round is deliberate — the log is small and appends are
  // idempotent, so no cursor bookkeeping can drift.
  const pull = await pullEvents(config, accessToken, userId, {
    ...options,
    sinceIso: undefined,
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
