import { describe, it, expect } from 'vitest';
import { probeCloudConnection, type FetchLike } from '../supabase/probe.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';

const CONFIG: SupabaseEnvConfig = {
  url: 'https://tbyqtmgxomznpemkkaee.supabase.co',
  publishableKey: 'sb_publishable_test',
};

/**
 * Phase 4A: the connectivity probe must tell the truth in all four outcomes
 * (healthy, non-2xx, network failure, timeout) and must always hit the auth
 * health endpoint with the publishable key as `apikey`.
 */
describe('probeCloudConnection', () => {
  it('hits /auth/v1/health with the apikey header and reports latency on success', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({
        url: input,
        headers: (init?.headers ?? {}) as Record<string, string>,
      });
      return new Response(null, { status: 200 });
    };
    let clock = 0;
    const res = await probeCloudConnection(CONFIG, {
      fetchImpl,
      nowFn: () => {
        clock += 25;
        return clock;
      },
    });
    expect(res.online).toBe(true);
    expect(res.http_status).toBe(200);
    expect(res.latency_ms).toBe(25);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://tbyqtmgxomznpemkkaee.supabase.co/auth/v1/health');
    expect(calls[0]?.headers['apikey']).toBe('sb_publishable_test');
  });

  it('normalizes a trailing-slash url before probing', async () => {
    let seenUrl = '';
    const fetchImpl: FetchLike = async (input) => {
      seenUrl = input;
      return new Response(null, { status: 200 });
    };
    await probeCloudConnection({ ...CONFIG, url: 'https://x.supabase.co/' }, { fetchImpl });
    expect(seenUrl).toBe('https://x.supabase.co/auth/v1/health');
  });

  it('reports offline without latency for non-2xx responses (paused project 521)', async () => {
    const res = await probeCloudConnection(CONFIG, {
      fetchImpl: async () => new Response(null, { status: 521 }),
      nowFn: () => 0,
    });
    expect(res.online).toBe(false);
    expect(res.http_status).toBe(521);
    expect(res.latency_ms).toBeNull();
  });

  it('reports offline with null status on network failure', async () => {
    const res = await probeCloudConnection(CONFIG, {
      fetchImpl: async () => {
        throw new Error('connection refused');
      },
      nowFn: () => 0,
    });
    expect(res.online).toBe(false);
    expect(res.http_status).toBeNull();
    expect(res.latency_ms).toBeNull();
  });

  it('aborts a hanging probe after timeoutMs and reports offline', async () => {
    const slowFetch: FetchLike = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    const res = await probeCloudConnection(CONFIG, {
      fetchImpl: slowFetch,
      timeoutMs: 10,
      nowFn: () => 0,
    });
    expect(res.online).toBe(false);
    expect(res.http_status).toBeNull();
    expect(res.latency_ms).toBeNull();
  });
});
