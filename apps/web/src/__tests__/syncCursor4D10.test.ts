import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { syncNow, cursorSinceIso, PULL_OVERLAP_MS } from '../sync/syncService.js';
import { pullEvents, toSyncRow, type SessionEventRow } from '../supabase/syncTransport.js';
import { KeyValuePullCursorStore, PULL_CURSOR_PREFIX } from '../sync/pullCursorStore.js';
import { KeyValueStore } from '../storage/KeyValueStore.js';
import { closeDatabase, DB_NAME } from '../storage/idb.js';
import { InMemoryEventLog, type EventEnvelope, type EventLog } from '@hfos/events';
import type { FetchLike } from '../supabase/syncTransport.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';

/**
 * Phase 4D10: cursor-based pull.
 *
 * The cursor is the newest server-assigned `synced_at` already merged here —
 * server-clock based, so skewed device clocks cannot skip rows. A 10-minute
 * replay window plus the idempotent merge keeps the old full-pull safety
 * ("no cursor bookkeeping can drift") while the round cost drops from the
 * whole log to the genuinely new rows.
 */

const CONFIG: SupabaseEnvConfig = {
  url: 'https://tbyqtmgxomznpemkkaee.supabase.co',
  publishableKey: 'sb_publishable_test',
};
const USER = '11111111-1111-4111-8111-111111111111';
const USER2 = '22222222-2222-4222-8222-222222222222';

function envelope(idem: string, occurredAt = '2026-11-03T10:00:00.000Z'): EventEnvelope {
  return {
    event_id: `018f0000-0000-7000-8000-${idem.padStart(12, '0')}`,
    type: 'session.set_logged',
    occurred_at: occurredAt,
    device_id: 'local-device-1',
    idempotency_key: idem,
    schema_version: 1,
    payload: { reps: 12 },
  };
}

/** A raw server row (what PostgREST actually returns, synced_at included). */
function row(idem: string, syncedAt: string | null): Record<string, unknown> {
  const base = toSyncRow(envelope(idem), USER) as unknown as Record<string, unknown>;
  return syncedAt === null ? base : { ...base, synced_at: syncedAt };
}

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** In-memory PullCursorPort with a peek helper for assertions. */
function memoryCursorStore() {
  const map = new Map<string, string>();
  return {
    load: async (userId: string): Promise<string | null> => map.get(userId) ?? null,
    save: async (userId: string, iso: string): Promise<void> => {
      map.set(userId, iso);
    },
    peek: (userId: string): string | null => map.get(userId) ?? null,
  };
}

describe('phase 4D10: cursorSinceIso', () => {
  it('subtracts the replay window from a usable cursor', () => {
    expect(cursorSinceIso('2026-11-05T12:00:00.000Z')).toBe('2026-11-05T11:50:00.000Z');
    expect(PULL_OVERLAP_MS).toBe(10 * 60 * 1000);
  });

  it('answers null for a missing or garbage cursor (honest full pull)', () => {
    expect(cursorSinceIso(null)).toBeNull();
    expect(cursorSinceIso('not-a-date')).toBeNull();
  });
});

describe('phase 4D10: syncNow with a pull cursor', () => {
  it('the first round pulls fully (no synced_at filter) and stores the cursor', async () => {
    const log: EventLog = new InMemoryEventLog();
    const cursors = memoryCursorStore();
    const pullCalls: string[] = [];
    const fetchImpl: FetchLike = async (input, init) => {
      if (init?.method === 'POST') return jsonRes(201, []);
      pullCalls.push(String(input));
      return jsonRes(200, [row('remote-c', '2026-11-05T12:00:00.000Z')]);
    };

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl, pullCursor: cursors });

    expect(res.ok).toBe(true);
    expect(res.merged).toBe(1);
    const url = new URL(pullCalls[0] ?? '');
    expect(url.searchParams.get('synced_at')).toBeNull();
    expect(url.searchParams.get('order')).toBe('occurred_at.asc,idempotency_key.asc');
    expect(cursors.peek(USER)).toBe('2026-11-05T12:00:00.000Z');
  });

  it('the next round pulls incrementally from the cursor minus the overlap', async () => {
    const log: EventLog = new InMemoryEventLog();
    const cursors = memoryCursorStore();
    cursors.save(USER, '2026-11-05T12:00:00.000Z');
    const pullCalls: string[] = [];
    const fetchImpl: FetchLike = async (input, init) => {
      if (init?.method === 'POST') return jsonRes(201, []);
      pullCalls.push(String(input));
      return jsonRes(200, []);
    };

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl, pullCursor: cursors });

    expect(res.ok).toBe(true);
    expect(res.pulled).toBe(0);
    const url = new URL(pullCalls[0] ?? '');
    expect(url.searchParams.get('synced_at')).toBe('gt.2026-11-05T11:50:00.000Z');
    expect(url.searchParams.get('order')).toBe('synced_at.asc,idempotency_key.asc');
    // an empty round keeps the stored cursor exactly where it was
    expect(cursors.peek(USER)).toBe('2026-11-05T12:00:00.000Z');
  });

  it('replayed overlap rows merge for free and never move the cursor backward', async () => {
    const log: EventLog = new InMemoryEventLog();
    await log.append(envelope('already-have', '2026-11-05T11:55:00.000Z'));
    const cursors = memoryCursorStore();
    cursors.save(USER, '2026-11-05T12:00:00.000Z');
    // the pull replays an older row (overlap) plus a genuinely new one
    const fetchImpl: FetchLike = async (input, init) => {
      if (init?.method === 'POST') return jsonRes(201, []);
      return jsonRes(200, [
        row('already-have', '2026-11-05T11:55:00.000Z'),
        row('brand-new', '2026-11-05T12:01:00.000Z'),
      ]);
    };

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl, pullCursor: cursors });

    expect(res.ok).toBe(true);
    expect(res.pulled).toBe(2);
    expect(res.merged).toBe(1); // only brand-new
    expect(cursors.peek(USER)).toBe('2026-11-05T12:01:00.000Z'); // forward only
  });

  it('a pull failure leaves the stored cursor untouched', async () => {
    const log: EventLog = new InMemoryEventLog();
    await log.append(envelope('local-a'));
    const cursors = memoryCursorStore();
    cursors.save(USER, '2026-11-05T12:00:00.000Z');
    const fetchImpl: FetchLike = async (input, init) => {
      if (init?.method === 'POST') return jsonRes(201, []);
      return jsonRes(401, { message: 'permission denied' });
    };

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl, pullCursor: cursors });

    expect(res.ok).toBe(false);
    expect(cursors.peek(USER)).toBe('2026-11-05T12:00:00.000Z');
  });

  it('a garbage stored cursor self-heals into a full pull and gets replaced', async () => {
    const log: EventLog = new InMemoryEventLog();
    const cursors = memoryCursorStore();
    cursors.save(USER, 'garbage');
    const pullCalls: string[] = [];
    const fetchImpl: FetchLike = async (input, init) => {
      if (init?.method === 'POST') return jsonRes(201, []);
      pullCalls.push(String(input));
      return jsonRes(200, [row('remote-c', '2026-11-05T12:00:00.000Z')]);
    };

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl, pullCursor: cursors });

    expect(res.ok).toBe(true);
    expect(new URL(pullCalls[0] ?? '').searchParams.get('synced_at')).toBeNull();
    expect(cursors.peek(USER)).toBe('2026-11-05T12:00:00.000Z');
  });

  it('without a pullCursor option the pull stays a full pull (old callers intact)', async () => {
    const log: EventLog = new InMemoryEventLog();
    const pullCalls: string[] = [];
    const fetchImpl: FetchLike = async (input, init) => {
      if (init?.method === 'POST') return jsonRes(201, []);
      pullCalls.push(String(input));
      return jsonRes(200, []);
    };

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl });

    expect(res.ok).toBe(true);
    expect(new URL(pullCalls[0] ?? '').searchParams.get('synced_at')).toBeNull();
  });
});

describe('phase 4D10: pullEvents cursor plumbing', () => {
  it('sets the synced_at filter, switches the ordering, and reports max_synced_at', async () => {
    const seenUrls: string[] = [];
    const fetchImpl: FetchLike = async (input) => {
      seenUrls.push(String(input));
      return jsonRes(200, [row('r1', '2026-11-05T12:00:00.000Z'), row('r2', '2026-11-05T12:05:00.000Z')]);
    };

    const res = await pullEvents(CONFIG, 'jwt', USER, {
      fetchImpl,
      sinceSyncedIso: '2026-11-05T11:50:00.000Z',
    });

    expect(res.ok).toBe(true);
    const url = new URL(seenUrls[0] ?? '');
    expect(url.searchParams.get('synced_at')).toBe('gt.2026-11-05T11:50:00.000Z');
    expect(url.searchParams.get('order')).toBe('synced_at.asc,idempotency_key.asc');
    expect(res.max_synced_at).toBe('2026-11-05T12:05:00.000Z');
    expect(res.envelopes).toHaveLength(2);
  });

  it('max_synced_at stays null when no row carries a usable synced_at', async () => {
    const rows: SessionEventRow[] = [toSyncRow(envelope('r1'), USER)];
    const res = await pullEvents(CONFIG, 'jwt', USER, {
      fetchImpl: async () => jsonRes(200, rows),
    });
    expect(res.ok).toBe(true);
    expect(res.max_synced_at).toBeNull();
  });
});

describe('phase 4D10: KeyValuePullCursorStore', () => {
  beforeEach(async () => {
    closeDatabase();
    indexedDB.deleteDatabase(DB_NAME);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('saves, loads, and clears a cursor under a per-user key', async () => {
    const store = new KeyValuePullCursorStore(new KeyValueStore());

    expect(await store.load(USER)).toBeNull();
    await store.save(USER, '2026-11-05T12:00:00.000Z');
    expect(await store.load(USER)).toBe('2026-11-05T12:00:00.000Z');

    // namespaced per user: another account never inherits the cursor
    expect(await store.load(USER2)).toBeNull();

    await store.clear(USER);
    expect(await store.load(USER)).toBeNull();
  });

  it('a corrupted stored value degrades to null (full pull), never crashes', async () => {
    const kv = new KeyValueStore();
    const store = new KeyValuePullCursorStore(kv);
    await kv.set(PULL_CURSOR_PREFIX + USER, { broken: true });
    expect(await store.load(USER)).toBeNull();
    await kv.set(PULL_CURSOR_PREFIX + USER, 'not-a-date');
    expect(await store.load(USER)).toBeNull();
  });

  it('persists through a fresh store instance (real IndexedDB round-trip)', async () => {
    await new KeyValuePullCursorStore(new KeyValueStore()).save(USER, '2026-11-05T12:00:00.000Z');
    expect(await new KeyValuePullCursorStore(new KeyValueStore()).load(USER)).toBe(
      '2026-11-05T12:00:00.000Z',
    );
  });
});
