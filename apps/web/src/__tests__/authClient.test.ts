import { describe, it, expect } from 'vitest';
import {
  signInWithPassword,
  getValidSession,
  refreshSession,
  signOut,
  authSessionFromTokenResponse,
  authSessionFromUnknown,
  InMemoryAuthSessionStore,
  KeyValueAuthSessionStore,
  AUTH_TOKEN_TTL_MARGIN_SECONDS,
  type AuthSession,
} from '../supabase/authClient.js';
import { storedDeviceRecordFromUnknown } from '../supabase/deviceKeyStore.js';
import type { FetchLike } from '../supabase/syncTransport.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';

const CONFIG: SupabaseEnvConfig = {
  url: 'https://tbyqtmgxomznpemkkaee.supabase.co',
  publishableKey: 'sb_publishable_test',
};

const TOKEN_RESPONSE = {
  access_token: 'jwt-access-token',
  refresh_token: 'refresh-token-1',
  expires_in: 3600,
  expires_at: 1_000_000_500,
  token_type: 'bearer',
  user: { id: 'user-1', email: 'athlete@example.com' },
};

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function freshSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    access_token: 'jwt-access-token',
    refresh_token: 'refresh-token-1',
    expires_at: 1_000_000_500,
    user_id: 'user-1',
    email: 'athlete@example.com',
    ...overrides,
  };
}

describe('signInWithPassword', () => {
  it('posts the password grant and persists the session', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      calls.push({ url: input, init: init ?? {} });
      return jsonRes(200, TOKEN_RESPONSE);
    };
    const store = new InMemoryAuthSessionStore();

    const res = await signInWithPassword(CONFIG, store, ' athlete@example.com ', 'secret', {
      fetchImpl,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.refreshed).toBe(false);
    expect(res.data.session.email).toBe('athlete@example.com');
    expect(res.data.session.expires_at).toBe(1_000_000_500);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://tbyqtmgxomznpemkkaee.supabase.co/auth/v1/token?grant_type=password');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['apikey']).toBe('sb_publishable_test');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      email: 'athlete@example.com', // trimmed
      password: 'secret',
    });

    const stored = await store.load();
    expect(stored?.access_token).toBe('jwt-access-token');
  });

  it('normalizes legacy and current invalid-credential error shapes', async () => {
    const legacy: FetchLike = async () =>
      jsonRes(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
    const r1 = await signInWithPassword(CONFIG, new InMemoryAuthSessionStore(), 'a@b.c', 'x', {
      fetchImpl: legacy,
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe('invalid_credentials');

    const modern: FetchLike = async () =>
      jsonRes(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    const r2 = await signInWithPassword(CONFIG, new InMemoryAuthSessionStore(), 'a@b.c', 'x', {
      fetchImpl: modern,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('invalid_credentials');

    const stored = await new InMemoryAuthSessionStore().load();
    expect(stored).toBeNull();
  });

  it('maps network and timeout failures to typed codes', async () => {
    const network: FetchLike = async () => {
      throw new Error('offline');
    };
    const r1 = await signInWithPassword(CONFIG, new InMemoryAuthSessionStore(), 'a@b.c', 'x', {
      fetchImpl: network,
    });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe('network_error');

    const hanging: FetchLike = (_input, init) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const r2 = await signInWithPassword(CONFIG, new InMemoryAuthSessionStore(), 'a@b.c', 'x', {
      fetchImpl: hanging,
      timeoutMs: 5,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('timeout');
  });
});

describe('getValidSession', () => {
  it('reports signed_out when nothing is stored', async () => {
    const res = await getValidSession(CONFIG, new InMemoryAuthSessionStore());
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('signed_out');
      expect(res.http_status).toBeNull();
    }
  });

  it('returns a fresh stored session without any network call', async () => {
    let called = 0;
    const fetchImpl: FetchLike = async () => {
      called++;
      return jsonRes(200, TOKEN_RESPONSE);
    };
    const store = new InMemoryAuthSessionStore();
    await store.save(freshSession({ expires_at: Math.floor(Date.now() / 1000) + 3600 }));

    const res = await getValidSession(CONFIG, store, { fetchImpl });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.refreshed).toBe(false);
    expect(called).toBe(0);
  });

  it('refreshes a near-expiry session and persists the new tokens', async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (input) => {
      calls.push(input);
      return jsonRes(200, { ...TOKEN_RESPONSE, access_token: 'jwt-new', refresh_token: 'refresh-2' });
    };
    const store = new InMemoryAuthSessionStore();
    await store.save(
      freshSession({ expires_at: Math.floor(Date.now() / 1000) + AUTH_TOKEN_TTL_MARGIN_SECONDS - 10 }),
    );

    const res = await getValidSession(CONFIG, store, { fetchImpl });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.refreshed).toBe(true);
    expect(res.data.session.access_token).toBe('jwt-new');
    expect(calls[0]).toContain('grant_type=refresh_token');
    expect((await store.load())?.refresh_token).toBe('refresh-2');
  });

  it('clears the stored session when the refresh is rejected', async () => {
    const fetchImpl: FetchLike = async () =>
      jsonRes(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Already Used' });
    const store = new InMemoryAuthSessionStore();
    await store.save(freshSession({ expires_at: Math.floor(Date.now() / 1000) - 10 }));

    const res = await getValidSession(CONFIG, store, { fetchImpl });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('invalid_credentials');
    expect(await store.load()).toBeNull();
  });

  it('does not clear the store when refresh fails with a network error', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('offline');
    };
    const store = new InMemoryAuthSessionStore();
    await store.save(freshSession({ expires_at: Math.floor(Date.now() / 1000) - 10 }));

    const res = await getValidSession(CONFIG, store, { fetchImpl });
    // Deliberate: transient network failure must not log the user out.
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('network_error');
    expect(await store.load()).not.toBeNull();
  });
});

describe('refreshSession', () => {
  it('sends the refresh grant and saves the rotated tokens', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const fetchImpl: FetchLike = async (_input, init) => {
      calls.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return jsonRes(200, { ...TOKEN_RESPONSE, refresh_token: 'refresh-rotated' });
    };
    const store = new InMemoryAuthSessionStore();

    const res = await refreshSession(CONFIG, store, 'refresh-token-1', { fetchImpl });

    expect(res.ok).toBe(true);
    expect(calls[0]).toEqual({ refresh_token: 'refresh-token-1' });
    expect((await store.load())?.refresh_token).toBe('refresh-rotated');
  });
});

describe('signOut', () => {
  it('calls the global logout and always clears the local session', async () => {
    const calls: Array<{ url: string; auth: string | undefined; status: number }> = [];
    const store = new InMemoryAuthSessionStore();
    await store.save(freshSession());

    const failing: FetchLike = async (input, init) => {
      calls.push({
        url: input,
        auth: (init?.headers as Record<string, string>)['Authorization'],
        status: 500,
      });
      return jsonRes(500, { msg: 'boom' });
    };

    const res = await signOut(CONFIG, store, { fetchImpl: failing });

    expect(res.ok).toBe(true); // local sign-out never blocked by server errors
    expect(calls[0]?.url).toContain('/auth/v1/logout?scope=global');
    expect(calls[0]?.auth).toBe('Bearer jwt-access-token');
    expect(await store.load()).toBeNull();
  });

  it('signs out cleanly when nothing is stored (no network call)', async () => {
    let called = 0;
    const fetchImpl: FetchLike = async () => {
      called++;
      return jsonRes(204, {});
    };
    const res = await signOut(CONFIG, new InMemoryAuthSessionStore(), { fetchImpl });
    expect(res.ok).toBe(true);
    expect(called).toBe(0);
  });
});

describe('defensive parsing', () => {
  it('token response parsing: falls back to expires_in and rejects incomplete bodies', () => {
    const fromExpiresIn = authSessionFromTokenResponse({
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
      user: { id: 'u1' },
    });
    expect(fromExpiresIn?.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(fromExpiresIn?.email).toBe('');

    expect(authSessionFromTokenResponse({ access_token: 'a' })).toBeNull();
    expect(authSessionFromTokenResponse(null)).toBeNull();
    expect(
      authSessionFromTokenResponse({ access_token: 'a', refresh_token: 'r', user: {} }),
    ).toBeNull();
  });

  it('stored session rehydration drops corrupt records', () => {
    expect(authSessionFromUnknown(null)).toBeNull();
    expect(authSessionFromUnknown('session')).toBeNull();
    expect(
      authSessionFromUnknown({ access_token: 'a', refresh_token: 'r', user_id: 'u', email: 'e' }),
    ).toBeNull(); // missing expires_at
    expect(authSessionFromUnknown(freshSession())).not.toBeNull();

    // the device-store guard stays separate and strict
    expect(storedDeviceRecordFromUnknown({ device_id: 5 })).toBeNull();
  });
});

describe('KeyValueAuthSessionStore', () => {
  it('round-trips through a kv-shaped backend and degrades on corruption', async () => {
    const backing = new Map<string, unknown>();
    const kv = {
      get: async <T,>(key: string): Promise<T | null> => (backing.get(key) as T) ?? null,
      set: async <T,>(key: string, value: T): Promise<void> => {
        backing.set(key, value);
      },
      delete: async (key: string): Promise<void> => {
        backing.delete(key);
      },
    };
    const store = new KeyValueAuthSessionStore(kv);

    expect(await store.load()).toBeNull();
    await store.save(freshSession());
    expect((await store.load())?.user_id).toBe('user-1');

    backing.set('hfos.auth.session', 'corrupt');
    expect(await store.load()).toBeNull();
    await store.clear();
    expect(await store.load()).toBeNull();
  });
});
