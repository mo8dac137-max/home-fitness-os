import { describe, it, expect } from 'vitest';
import { syncNow } from '../sync/syncService.js';
import { InMemoryEventLog, type EventEnvelope, type EventLog } from '@hfos/events';
import type { FetchLike } from '../supabase/syncTransport.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';

const CONFIG: SupabaseEnvConfig = {
  url: 'https://tbyqtmgxomznpemkkaee.supabase.co',
  publishableKey: 'sb_publishable_test',
};
const USER = '11111111-1111-4111-8111-111111111111';

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

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Rest-ish mock: handles the push POST and the pull GET like PostgREST would. */
function restMock(remotes: EventEnvelope[], opts: { accepted?: number; failPush?: number; failPull?: number } = {}) {
  const pushedBatches: EventEnvelope[][] = [];
  const pullCalls: string[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url = String(input);
    if (init?.method === 'POST') {
      pushedBatches.push(JSON.parse(String(init.body)) as EventEnvelope[]);
      if (opts.failPush !== undefined) return jsonRes(opts.failPush, { message: 'denied' });
      const batch = pushedBatches[pushedBatches.length - 1] ?? [];
      const accepted = opts.accepted ?? batch.length;
      return jsonRes(201, batch.slice(0, accepted).map((e) => ({ idempotency_key: e.idempotency_key })));
    }
    pullCalls.push(url);
    if (opts.failPull !== undefined) return jsonRes(opts.failPull, { message: 'denied' });
    return jsonRes(200, remotes);
  };
  return { pushedBatches, pullCalls, fetchImpl };
}

describe('syncNow', () => {
  it('pushes all local events, pulls remote rows, and merges only the new ones', async () => {
    const log: EventLog = new InMemoryEventLog();
    await log.append(envelope('local-a', '2026-11-03T09:00:00.000Z'));
    await log.append(envelope('shared-b', '2026-11-03T09:30:00.000Z'));

    const { pushedBatches, pullCalls, fetchImpl } = restMock([
      envelope('shared-b', '2026-11-03T09:30:00.000Z'), // duplicate of local
      envelope('remote-c', '2026-11-03T11:00:00.000Z'), // genuinely new
    ]);

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl });

    expect(res.ok).toBe(true);
    expect(res.pushed).toBe(2);
    expect(res.duplicates).toBe(0);
    expect(res.pulled).toBe(2);
    expect(res.merged).toBe(1); // only remote-c
    expect(res.error).toBeNull();

    expect(pushedBatches).toHaveLength(1);
    expect(pushedBatches[0]?.map((e) => e.idempotency_key)).toEqual(['local-a', 'shared-b']);
    expect(pullCalls[0]).toContain('/rest/v1/session_events?');
    expect(pullCalls[0]).toContain('user_id=eq.');

    const all = await log.getAll();
    expect(all.map((e) => e.idempotency_key)).toEqual(['local-a', 'shared-b', 'remote-c']);
  });

  it('is idempotent: a second round pushes as duplicates and merges nothing', async () => {
    const log: EventLog = new InMemoryEventLog();
    await log.append(envelope('local-a'));

    const remote = [envelope('local-a')];
    const first = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl: restMock(remote).fetchImpl });
    expect(first.ok).toBe(true);
    expect(first.merged).toBe(0);

    // Second round: server already knows everything (push → 0 accepted rows).
    const second = await syncNow(CONFIG, 'jwt', USER, log, {
      fetchImpl: restMock(remote, { accepted: 0 }).fetchImpl,
    });
    expect(second.ok).toBe(true);
    expect(second.pushed).toBe(0);
    expect(second.duplicates).toBe(1);
    expect(second.pulled).toBe(1);
    expect(second.merged).toBe(0);
    expect(await log.count()).toBe(1);
  });

  it('reports a push failure without attempting the pull', async () => {
    const log: EventLog = new InMemoryEventLog();
    await log.append(envelope('local-a'));
    const { pullCalls, fetchImpl } = restMock([], { failPush: 403 });

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl });

    expect(res.ok).toBe(false);
    expect(res.http_status).toBe(403);
    expect(res.pulled).toBe(0);
    expect(res.merged).toBe(0);
    expect(pullCalls).toHaveLength(0);
  });

  it('reports a pull failure after a successful push, keeping push counts', async () => {
    const log: EventLog = new InMemoryEventLog();
    await log.append(envelope('local-a'));
    const { fetchImpl } = restMock([], { failPull: 401 });

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl });

    expect(res.ok).toBe(false);
    expect(res.pushed).toBe(1);
    expect(res.http_status).toBe(401);
    expect(res.error).toContain('401');
  });

  it('handles an empty world honestly: zero everything, still ok', async () => {
    const log: EventLog = new InMemoryEventLog();
    const { fetchImpl } = restMock([]);

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl });

    expect(res).toEqual({
      ok: true,
      pushed: 0,
      duplicates: 0,
      pulled: 0,
      merged: 0,
      http_status: 200,
      error: null,
    });
  });

  it('skips malformed remote rows while merging the valid ones', async () => {
    const log: EventLog = new InMemoryEventLog();
    const remote = [envelope('remote-c'), { broken: true } as unknown as EventEnvelope];
    const { fetchImpl } = restMock(remote);

    const res = await syncNow(CONFIG, 'jwt', USER, log, { fetchImpl });

    expect(res.ok).toBe(true);
    expect(res.pulled).toBe(1); // malformed row dropped by the transport
    expect(res.merged).toBe(1);
    expect(await log.count()).toBe(1);
  });
});
