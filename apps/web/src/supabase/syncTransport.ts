import type { EventEnvelope } from '@hfos/events';
import type { SupabaseEnvConfig } from './env.js';

/**
 * Session-event sync transport (Phase 4D1).
 *
 * Moves local `EventEnvelope`s to and from the append-only
 * `public.session_events` table through plain PostgREST — no supabase-js yet
 * (same decision as Phase 4A: injected fetch, fully testable, minimal bundle).
 *
 * Idempotency contract: `idempotency_key` is the table's primary key and
 * pushes use `resolution=ignore-duplicates`, so re-pushing an already-synced
 * event is always a safe no-op.
 */

export interface SessionEventRow {
  idempotency_key: string;
  user_id: string;
  event_id: string;
  type: string;
  occurred_at: string;
  device_id: string;
  schema_version: number;
  payload: Record<string, unknown>;
  supersedes_event_id: string | null;
  synced_at?: string;
}

export const SYNC_TABLE = 'session_events';
export const DEFAULT_PUSH_BATCH = 100;
export const DEFAULT_PULL_PAGE = 500;

export interface SyncTransportOptions {
  fetchImpl?: FetchLike;
  nowFn?: () => number;
  timeoutMs?: number;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PushResult {
  ok: boolean;
  /** Envelopes accepted as new rows (from the returned representation). */
  pushed: number;
  /** Envelopes whose idempotency_key already existed (safe no-op). */
  duplicates: number;
  http_status: number | null;
  error: string | null;
}

export interface PullResult {
  ok: boolean;
  envelopes: EventEnvelope[];
  http_status: number | null;
  error: string | null;
}

// ── Mapping ────────────────────────────────────────────────────────────────

export function toSyncRow(envelope: EventEnvelope, userId: string): SessionEventRow {
  return {
    idempotency_key: envelope.idempotency_key,
    user_id: userId,
    event_id: envelope.event_id,
    type: envelope.type,
    occurred_at: envelope.occurred_at,
    device_id: envelope.device_id,
    schema_version: envelope.schema_version,
    payload: (envelope.payload ?? {}) as Record<string, unknown>,
    supersedes_event_id: envelope.supersedes_event_id ?? null,
  };
}

/** Defensive rehydration of a network row into a trusted EventEnvelope. */
export function envelopeFromSyncRow(row: unknown): EventEnvelope | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;

  const idempotencyKey = str(r['idempotency_key']);
  const eventId = str(r['event_id']);
  const type = str(r['type']);
  const occurredAt = str(r['occurred_at']);
  const deviceId = str(r['device_id']);
  const schemaVersion = num(r['schema_version']);

  if (
    idempotencyKey === null ||
    eventId === null ||
    type === null ||
    occurredAt === null ||
    deviceId === null ||
    schemaVersion === null
  ) {
    return null;
  }

  const payload = r['payload'];
  const envelope: EventEnvelope = {
    event_id: eventId,
    type,
    occurred_at: occurredAt,
    device_id: deviceId,
    idempotency_key: idempotencyKey,
    schema_version: schemaVersion,
    payload:
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {},
  };

  const supersedes = str(r['supersedes_event_id']);
  if (supersedes !== null) envelope.supersedes_event_id = supersedes;

  return envelope;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// ── Transport helpers ──────────────────────────────────────────────────────

function restUrl(config: SupabaseEnvConfig, search: string): string {
  return `${config.url.replace(/\/+$/, '')}/rest/v1/${SYNC_TABLE}${search}`;
}

function headersFor(config: SupabaseEnvConfig, accessToken: string): Record<string, string> {
  return {
    apikey: config.publishableKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function request(
  url: string,
  init: RequestInit,
  options: SyncTransportOptions
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Push ───────────────────────────────────────────────────────────────────

export async function pushEvents(
  config: SupabaseEnvConfig,
  accessToken: string,
  userId: string,
  envelopes: EventEnvelope[],
  options: SyncTransportOptions & { batchSize?: number } = {}
): Promise<PushResult> {
  const batchSize = options.batchSize ?? DEFAULT_PUSH_BATCH;
  const rows = envelopes.map((e) => toSyncRow(e, userId));

  let pushed = 0;
  let duplicates = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    try {
      const res = await request(
        restUrl(config, '?on_conflict=idempotency_key&select=idempotency_key'),
        {
          method: 'POST',
          headers: {
            ...headersFor(config, accessToken),
            Prefer: 'resolution=ignore-duplicates,return=representation',
          },
          body: JSON.stringify(chunk),
        },
        options
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return {
          ok: false,
          pushed,
          duplicates,
          http_status: res.status,
          error: `push failed: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`,
        };
      }

      const inserted = (await res.json().catch(() => [])) as Array<{ idempotency_key?: string }>;
      const accepted = Array.isArray(inserted) ? inserted.length : 0;
      pushed += accepted;
      duplicates += chunk.length - accepted;
    } catch (err) {
      return {
        ok: false,
        pushed,
        duplicates,
        http_status: null,
        error: `push failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { ok: true, pushed, duplicates, http_status: 201, error: null };
}

// ── Pull ───────────────────────────────────────────────────────────────────

export async function pullEvents(
  config: SupabaseEnvConfig,
  accessToken: string,
  userId: string,
  options: SyncTransportOptions & { sinceIso?: string; pageSize?: number } = {}
): Promise<PullResult> {
  const pageSize = options.pageSize ?? DEFAULT_PULL_PAGE;
  const envelopes: EventEnvelope[] = [];

  try {
    for (;;) {
      const params = new URLSearchParams({
        select: '*',
        user_id: `eq.${userId}`,
        order: 'occurred_at.asc,idempotency_key.asc',
        limit: String(pageSize),
      });
      if (options.sinceIso !== undefined) {
        params.set('occurred_at', `gt.${options.sinceIso}`);
      }

      const res = await request(
        restUrl(config, `?${params.toString()}`),
        { method: 'GET', headers: headersFor(config, accessToken) },
        options
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return {
          ok: false,
          envelopes,
          http_status: res.status,
          error: `pull failed: HTTP ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`,
        };
      }

      const rows = (await res.json().catch(() => [])) as unknown[];
      if (!Array.isArray(rows)) {
        return {
          ok: false,
          envelopes,
          http_status: res.status,
          error: 'pull failed: unexpected response body',
        };
      }

      for (const row of rows) {
        const envelope = envelopeFromSyncRow(row);
        if (envelope !== null) envelopes.push(envelope);
      }

      if (rows.length < pageSize) break; // final page reached
    }
  } catch (err) {
    return {
      ok: false,
      envelopes,
      http_status: null,
      error: `pull failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { ok: true, envelopes, http_status: 200, error: null };
}
