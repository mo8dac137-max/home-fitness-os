import { describe, it, expect } from 'vitest';
import {
  toSyncRow,
  envelopeFromSyncRow,
  pushEvents,
  pullEvents,
  type FetchLike,
  type SessionEventRow,
} from '../supabase/syncTransport.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';
import type { EventEnvelope } from '@hfos/events';

const CONFIG: SupabaseEnvConfig = {
  url: 'https://tbyqtmgxomznpemkkaee.supabase.co',
  publishableKey: 'sb_publishable_test',
};
const USER = '11111111-1111-4111-8111-111111111111';

const ENVELOPE: EventEnvelope = {
  event_id: '018f0000-0000-7000-8000-000000000001',
  type: 'session.set_logged',
  occurred_at: '2026-11-03T10:00:00.000Z',
  device_id: 'local-device-1',
  idempotency_key: 'idem-0001',
  schema_version: 1,
  payload: { exercise_id: 'ex-pushup', reps: 12, target_reps: 10, rpe: 7 },
};

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('session event sync mapping', () => {
  it('maps an envelope to a row and back (round-trip, incl. supersedes)', () => {
    const withSupersedes: EventEnvelope = {
      ...ENVELOPE,
      supersedes_event_id: '018f0000-0000-7000-8000-000000000000',
    };
    const row = toSyncRow(withSupersedes, USER);
    expect(row.idempotency_key).toBe('idem-0001');
    expect(row.user_id).toBe(USER);
    expect(row.payload).toEqual(ENVELOPE.payload);
    expect(row.supersedes_event_id).toBe('018f0000-0000-7000-8000-000000000000');

    const back = envelopeFromSyncRow(row);
    expect(back).toEqual(withSupersedes);
  });

  it('defaults a missing payload to an empty object and drops bad rows', () => {
    // Simulate runtime-malformed data (e.g. an old IndexedDB row): the static
    // type guarantees payload, but the transport must still survive its absence.
    const malformed = JSON.parse(JSON.stringify(ENVELOPE)) as EventEnvelope;
    (malformed as { payload?: unknown }).payload = undefined;
    const row = toSyncRow(malformed, USER);
    expect(row.payload).toEqual({});

    expect(envelopeFromSyncRow(null)).toBeNull();
    expect(envelopeFromSyncRow('nope')).toBeNull();
    expect(envelopeFromSyncRow({ ...toSyncRow(ENVELOPE, USER), event_id: '' })).toBeNull();
    expect(
      envelopeFromSyncRow({ ...toSyncRow(ENVELOPE, USER), schema_version: 'x' })
    ).toBeNull();
  });
});

describe('pushEvents', () => {
  it('posts the batch with auth headers and dedupe Prefer, counting pushed vs duplicates', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ url: input, init: init ?? {} });
      const body = JSON.parse(String(init?.body ?? '[]')) as SessionEventRow[];
      return jsonRes(201, body.map((r) => ({ idempotency_key: r.idempotency_key })));
    };

    const res = await pushEvents(CONFIG, 'jwt-token', USER, [ENVELOPE, ENVELOPE], {
      fetchImpl,
      batchSize: 10,
    });

    expect(res.ok).toBe(true);
    expect(res.pushed).toBe(2);
    expect(res.duplicates).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      'https://tbyqtmgxomznpemkkaee.supabase.co/rest/v1/session_events?on_conflict=idempotency_key&select=idempotency_key'
    );
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['apikey']).toBe('sb_publishable_test');
    expect(headers['Authorization']).toBe('Bearer jwt-token');
    expect(headers['Prefer']).toBe('resolution=ignore-duplicates,return=representation');
  });

  it('chunks large batches and counts server-side duplicates honestly', async () => {
    const fetchImpl: FetchLike = async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '[]')) as SessionEventRow[];
      // Server returns only 1 accepted row per chunk (rest are duplicates)
      return jsonRes(201, body.slice(0, 1).map((r) => ({ idempotency_key: r.idempotency_key })));
    };

    const many: EventEnvelope[] = Array.from({ length: 25 }, (_, i) => ({
      ...ENVELOPE,
      idempotency_key: `idem-${String(i).padStart(4, '0')}`,
    }));
    const res = await pushEvents(CONFIG, 'jwt-token', USER, many, { fetchImpl, batchSize: 10 });

    expect(res.ok).toBe(true);
    // 3 chunks (10+10+5), 1 accepted each → 3 pushed, 22 duplicates
    expect(res.pushed).toBe(3);
    expect(res.duplicates).toBe(22);
  });

  it('stops and reports the HTTP failure without throwing', async () => {
    const fetchImpl: FetchLike = async () => jsonRes(403, { message: 'permission denied' });
    const res = await pushEvents(CONFIG, 'jwt-token', USER, [ENVELOPE], { fetchImpl });

    expect(res.ok).toBe(false);
    expect(res.http_status).toBe(403);
    expect(res.error).toContain('403');
    expect(res.pushed).toBe(0);
  });
});

describe('pullEvents', () => {
  it('maps rows back to envelopes and paginates until a short page', async () => {
    const page1: SessionEventRow[] = Array.from({ length: 3 }, (_, i) => ({
      ...toSyncRow(ENVELOPE, USER),
      idempotency_key: `idem-${i}`,
      synced_at: '2026-11-03T11:00:00.000Z',
    }));
    const page2: SessionEventRow[] = [
      { ...toSyncRow(ENVELOPE, USER), idempotency_key: 'idem-3' },
    ];
    const pages = [page1, page2];
    const seenUrls: string[] = [];
    const fetchImpl: FetchLike = async (input) => {
      seenUrls.push(input);
      return jsonRes(200, pages[seenUrls.length - 1] ?? []);
    };

    const res = await pullEvents(CONFIG, 'jwt-token', USER, {
      fetchImpl,
      pageSize: 3,
      sinceIso: '2026-11-01T00:00:00.000Z',
    });

    expect(res.ok).toBe(true);
    expect(res.envelopes).toHaveLength(4);
    expect(res.envelopes[0]?.idempotency_key).toBe('idem-0');
    // Cursor + ordering applied
    expect(seenUrls[0]).toContain('occurred_at=gt.2026-11-01T00%3A00%3A00.000Z');
    expect(seenUrls[0]).toContain('user_id=eq.');
    expect(seenUrls[0]).toContain('order=occurred_at.asc');
    expect(seenUrls).toHaveLength(2); // second page (1 row < pageSize) is final
  });

  it('reports failures and tolerates malformed rows by skipping them', async () => {
    const bad = await pullEvents(CONFIG, 'jwt-token', USER, {
      fetchImpl: async () => jsonRes(401, { message: 'permission denied' }),
    });
    expect(bad.ok).toBe(false);
    expect(bad.http_status).toBe(401);
    expect(bad.envelopes).toHaveLength(0);

    const mixed = await pullEvents(CONFIG, 'jwt-token', USER, {
      fetchImpl: async () => jsonRes(200, [toSyncRow(ENVELOPE, USER), { broken: true }]),
    });
    expect(mixed.ok).toBe(true);
    expect(mixed.envelopes).toHaveLength(1);
  });
});
