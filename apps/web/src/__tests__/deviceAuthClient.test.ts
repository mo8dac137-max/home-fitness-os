import { describe, it, expect } from 'vitest';
import {
  callDeviceAuth,
  fetchDeviceStatus,
  enrollCurrentDevice,
  verifyCurrentDevice,
  revokeCurrentDevice,
  recoverDevice,
  isDeviceEnrolled,
  loadEnrolledDeviceId,
} from '../supabase/deviceAuthClient.js';
import {
  generateDeviceKeyPair,
  isValidPublicDeviceJwk,
  verifyNonceSignature,
} from '../supabase/deviceKeys.js';
import {
  InMemoryDeviceKeyStore,
  storedDeviceRecordFromUnknown,
  type StoredDeviceRecord,
} from '../supabase/deviceKeyStore.js';
import type { FetchLike } from '../supabase/syncTransport.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';

const CONFIG: SupabaseEnvConfig = {
  url: 'https://tbyqtmgxomznpemkkaee.supabase.co',
  publishableKey: 'sb_publishable_test',
};
const TOKEN = 'user-access-token';
const FUNCTION_URL = 'https://tbyqtmgxomznpemkkaee.supabase.co/functions/v1/device-auth';

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Mock of the device-auth contract. Handlers keyed by `action`. */
type ActionHandler = (body: Record<string, unknown>) => Response | Promise<Response>;

function mockFunction(handlers: Record<string, ActionHandler>) {
  const calls: Array<{ url: string; init: RequestInit; body: Record<string, unknown> }> = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    calls.push({ url: input, init: init ?? {}, body });
    const handler = handlers[String(body['action'] ?? '')];
    if (!handler) return jsonRes(400, { error: 'unknown_action' });
    return handler(body);
  };
  return { calls, fetchImpl };
}

const hexNonce = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');

async function seedEnrolled(
  store: InMemoryDeviceKeyStore,
  deviceId = 'dev-1',
): Promise<StoredDeviceRecord> {
  const pair = await generateDeviceKeyPair();
  const record: StoredDeviceRecord = {
    device_id: deviceId,
    label: 'test-device',
    public_jwk: pair.publicJwk,
    private_key: pair.privateKey,
    created_at: '2026-11-03T00:00:00.000Z',
  };
  await store.save(record);
  return record;
}

describe('callDeviceAuth transport', () => {
  it('posts the action JSON with apikey + Bearer headers to the function URL', async () => {
    const { calls, fetchImpl } = mockFunction({
      status: () => jsonRes(200, { active_devices: 0, session_verified: false }),
    });

    const res = await callDeviceAuth<{ active_devices: number }>(
      CONFIG, TOKEN, { action: 'status' }, { fetchImpl },
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data['active_devices']).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(FUNCTION_URL);
    expect(calls[0]?.init.method).toBe('POST');
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['apikey']).toBe('sb_publishable_test');
    expect(headers['Authorization']).toBe(`Bearer ${TOKEN}`);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('surfaces server error codes verbatim with the HTTP status', async () => {
    const { fetchImpl } = mockFunction({ enroll: () => jsonRes(409, { error: 'device_exists_use_recover' }) });
    const res = await callDeviceAuth(CONFIG, TOKEN, { action: 'enroll' }, { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('device_exists_use_recover');
      expect(res.http_status).toBe(409);
    }
  });

  it('rejects an empty token without touching the network', async () => {
    let called = 0;
    const fetchImpl: FetchLike = async () => {
      called++;
      return jsonRes(200, {});
    };
    const res = await callDeviceAuth(CONFIG, '   ', { action: 'status' }, { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('missing_token');
    expect(called).toBe(0);
  });

  it('maps network failures and timeouts to typed codes', async () => {
    const network: FetchLike = async () => {
      throw new Error('DNS blew up');
    };
    const net = await callDeviceAuth(CONFIG, TOKEN, { action: 'status' }, { fetchImpl: network });
    expect(net.ok).toBe(false);
    if (!net.ok) {
      expect(net.code).toBe('network_error');
      expect(net.http_status).toBeNull();
    }

    const hanging: FetchLike = (_input, init) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const timed = await callDeviceAuth(CONFIG, TOKEN, { action: 'status' }, {
      fetchImpl: hanging,
      timeoutMs: 5,
    });
    expect(timed.ok).toBe(false);
    if (!timed.ok) expect(timed.code).toBe('timeout');
  });

  it('reports non-JSON and error-typed success bodies as bad_response', async () => {
    const html: FetchLike = async () =>
      new Response('<html>502</html>', { status: 502 });
    const gw = await callDeviceAuth(CONFIG, TOKEN, { action: 'status' }, { fetchImpl: html });
    expect(gw.ok).toBe(false);
    if (!gw.ok) expect(gw.code).toBe('http_502');

    const weird: FetchLike = async () => jsonRes(500, { error: 'server_error' });
    const se = await callDeviceAuth(CONFIG, TOKEN, { action: 'status' }, { fetchImpl: weird });
    if (!se.ok) expect(se.code).toBe('server_error');

    const notJson: FetchLike = async () => new Response('not json', { status: 200 });
    const nj = await callDeviceAuth(CONFIG, TOKEN, { action: 'status' }, { fetchImpl: notJson });
    expect(nj.ok).toBe(false);
    if (!nj.ok) {
      expect(nj.code).toBe('bad_response');
      expect(nj.http_status).toBe(200);
    }
  });
});

describe('enrollCurrentDevice', () => {
  it('generates a key pair, enrolls it, and persists the device record', async () => {
    const store = new InMemoryDeviceKeyStore();
    const { calls, fetchImpl } = mockFunction({
      enroll: () => jsonRes(200, { device_id: 'dev-1', recovery_codes: ['aaaa-bbbb-cccc'] }),
    });

    const res = await enrollCurrentDevice(CONFIG, TOKEN, store, 'pixel-8', { fetchImpl });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe('created');
    expect(res.data.device_id).toBe('dev-1');
    expect(res.data.recovery_codes).toEqual(['aaaa-bbbb-cccc']);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.body['action']).toBe('enroll');
    expect(calls[0]?.body['label']).toBe('pixel-8');
    const jwk = calls[0]?.body['public_key_jwk'];
    expect(isValidPublicDeviceJwk(jwk)).toBe(true);

    const saved = await store.load();
    expect(saved?.device_id).toBe('dev-1');
    expect(saved?.label).toBe('pixel-8');
    expect(saved?.private_key.type).toBe('private');
    expect(saved?.private_key.extractable).toBe(false);
    expect(saved?.public_jwk).toEqual(jwk);
  });

  it('short-circuits without a network call when this browser is enrolled', async () => {
    const store = new InMemoryDeviceKeyStore();
    await seedEnrolled(store, 'dev-1');
    const { calls, fetchImpl } = mockFunction({ enroll: () => jsonRes(200, {}) });

    const res = await enrollCurrentDevice(CONFIG, TOKEN, store, 'x', { fetchImpl });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({ status: 'already', device_id: 'dev-1', recovery_codes: null });
    expect(calls).toHaveLength(0);
  });

  it('reuses an orphaned key pair from a failed earlier attempt', async () => {
    const store = new InMemoryDeviceKeyStore();
    const pair = await generateDeviceKeyPair();
    await store.save({
      device_id: null,
      label: 'pixel-8',
      public_jwk: pair.publicJwk,
      private_key: pair.privateKey,
      created_at: '2026-11-03T00:00:00.000Z',
    });
    const { calls, fetchImpl } = mockFunction({
      enroll: () => jsonRes(200, { device_id: 'dev-2', recovery_codes: [] }),
    });

    const res = await enrollCurrentDevice(CONFIG, TOKEN, store, 'pixel-8', { fetchImpl });
    expect(res.ok).toBe(true);
    expect(calls[0]?.body['public_key_jwk']).toEqual(pair.publicJwk);

    const saved = await store.load();
    expect(saved?.device_id).toBe('dev-2');
    expect(saved?.public_jwk).toEqual(pair.publicJwk);
  });

  it('does not persist anything when the server refuses (409 already enrolled)', async () => {
    const store = new InMemoryDeviceKeyStore();
    const { fetchImpl } = mockFunction({
      enroll: () => jsonRes(409, { error: 'device_exists_use_recover' }),
    });

    const res = await enrollCurrentDevice(CONFIG, TOKEN, store, 'x', { fetchImpl });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('device_exists_use_recover');
    expect(await store.load()).toBeNull();
  });

  it('rejects a success body without device_id as bad_response', async () => {
    const store = new InMemoryDeviceKeyStore();
    const { fetchImpl } = mockFunction({ enroll: () => jsonRes(200, { nope: true }) });
    const res = await enrollCurrentDevice(CONFIG, TOKEN, store, 'x', { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('bad_response');
    expect(await store.load()).toBeNull();
  });
});

describe('verifyCurrentDevice', () => {
  it('runs challenge → sign → verify and satisfies the server-side verification', async () => {
    const store = new InMemoryDeviceKeyStore();
    const record = await seedEnrolled(store, 'dev-1');
    const nonce = hexNonce(32);
    let verifyBody: Record<string, unknown> | null = null;

    const { calls, fetchImpl } = mockFunction({
      challenge: () => jsonRes(200, { challenge_id: 'ch-1', nonce }),
      verify: (body) => {
        verifyBody = body;
        // exact server algorithm against the enrolled public key
        return verifyNonceSignature(record.public_jwk, nonce, String(body['signature'] ?? ''))
          .then((ok) =>
            ok
              ? jsonRes(200, { ok: true, expires_at: '2026-11-03T23:00:00.000Z' })
              : jsonRes(401, { error: 'bad_signature' }),
          );
      },
    });

    const res = await verifyCurrentDevice(CONFIG, TOKEN, store, { fetchImpl });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.device_id).toBe('dev-1');
    expect(res.data.expires_at).toBe('2026-11-03T23:00:00.000Z');
    expect(verifyBody).not.toBeNull();
    expect(verifyBody?.['device_id']).toBe('dev-1');
    expect(verifyBody?.['challenge_id']).toBe('ch-1');
    expect(typeof verifyBody?.['signature']).toBe('string');
    expect(calls).toHaveLength(2);
  });

  it('refuses to run without an enrolled device and never touches the network', async () => {
    const store = new InMemoryDeviceKeyStore();
    const { calls, fetchImpl } = mockFunction({ challenge: () => jsonRes(200, {}) });

    const res = await verifyCurrentDevice(CONFIG, TOKEN, store, { fetchImpl });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('not_enrolled');
      expect(res.http_status).toBeNull();
    }
    expect(calls).toHaveLength(0);
  });

  it('surfaces challenge and verify failures with their codes', async () => {
    const store = new InMemoryDeviceKeyStore();
    await seedEnrolled(store);

    const revoked = mockFunction({
      challenge: () => jsonRes(403, { error: 'unknown_or_revoked_device' }),
    });
    const r1 = await verifyCurrentDevice(CONFIG, TOKEN, store, { fetchImpl: revoked.fetchImpl });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe('unknown_or_revoked_device');

    const used = mockFunction({
      challenge: () => jsonRes(200, { challenge_id: 'ch-1', nonce: hexNonce(32) }),
      verify: () => jsonRes(401, { error: 'bad_or_used_challenge' }),
    });
    const r2 = await verifyCurrentDevice(CONFIG, TOKEN, store, { fetchImpl: used.fetchImpl });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('bad_or_used_challenge');
  });

  it('rejects a malformed challenge payload as bad_response', async () => {
    const store = new InMemoryDeviceKeyStore();
    await seedEnrolled(store);
    const { fetchImpl } = mockFunction({ challenge: () => jsonRes(200, { challenge_id: 'ch-1' }) });
    const res = await verifyCurrentDevice(CONFIG, TOKEN, store, { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('bad_response');
  });
});

describe('revokeCurrentDevice', () => {
  it('revokes and clears the local record', async () => {
    const store = new InMemoryDeviceKeyStore();
    await seedEnrolled(store, 'dev-1');
    const { calls, fetchImpl } = mockFunction({ revoke: () => jsonRes(200, { ok: true }) });

    const res = await revokeCurrentDevice(CONFIG, TOKEN, store, { fetchImpl });

    expect(res.ok).toBe(true);
    expect(calls[0]?.body).toEqual({ action: 'revoke', device_id: 'dev-1' });
    expect(await store.load()).toBeNull();
    expect(await isDeviceEnrolled(store)).toBe(false);
  });

  it('keeps the local record when the server refuses', async () => {
    const store = new InMemoryDeviceKeyStore();
    await seedEnrolled(store, 'dev-1');
    const { fetchImpl } = mockFunction({
      revoke: () => jsonRes(403, { error: 'device_session_required' }),
    });

    const res = await revokeCurrentDevice(CONFIG, TOKEN, store, { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('device_session_required');
    expect((await store.load())?.device_id).toBe('dev-1');
  });

  it('reports not_enrolled without a network call', async () => {
    const store = new InMemoryDeviceKeyStore();
    const { calls, fetchImpl } = mockFunction({ revoke: () => jsonRes(200, {}) });
    const res = await revokeCurrentDevice(CONFIG, TOKEN, store, { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('not_enrolled');
    expect(calls).toHaveLength(0);
  });
});

describe('recoverDevice', () => {
  it('enrolls a fresh key pair, replaces the old record, and returns new codes', async () => {
    const store = new InMemoryDeviceKeyStore();
    const oldRecord = await seedEnrolled(store, 'dev-old');

    const { calls, fetchImpl } = mockFunction({
      recover: () => jsonRes(200, { device_id: 'dev-new', recovery_codes: ['dddd-eeee-ffff'] }),
    });

    const res = await recoverDevice(CONFIG, TOKEN, store, '  AABB-CCDD-EEFF  ', 'new-phone', { fetchImpl });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe('created');
    expect(res.data.device_id).toBe('dev-new');
    expect(res.data.recovery_codes).toEqual(['dddd-eeee-ffff']);

    // code normalized exactly like the server hashes it
    expect(calls[0]?.body['recovery_code']).toBe('aabb-ccdd-eeff');
    const jwk = calls[0]?.body['public_key_jwk'];
    expect(isValidPublicDeviceJwk(jwk)).toBe(true);

    const saved = await store.load();
    expect(saved?.device_id).toBe('dev-new');
    expect(saved?.public_jwk).not.toEqual(oldRecord.public_jwk); // fresh key pair
  });

  it('surfaces bad_recovery_code and leaves the store untouched', async () => {
    const store = new InMemoryDeviceKeyStore();
    await seedEnrolled(store, 'dev-old');
    const { fetchImpl } = mockFunction({
      recover: () => jsonRes(403, { error: 'bad_recovery_code' }),
    });

    const res = await recoverDevice(CONFIG, TOKEN, store, 'nope', 'x', { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('bad_recovery_code');
    expect((await store.load())?.device_id).toBe('dev-old');
  });
});

describe('fetchDeviceStatus', () => {
  it('passes a well-formed status payload through', async () => {
    const { fetchImpl } = mockFunction({
      status: () => jsonRes(200, { active_devices: 1, session_verified: true }),
    });
    const res = await fetchDeviceStatus(CONFIG, TOKEN, { fetchImpl });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ active_devices: 1, session_verified: true });
    }
  });

  it('rejects malformed status payloads as bad_response', async () => {
    const { fetchImpl } = mockFunction({
      status: () => jsonRes(200, { active_devices: 'one', session_verified: 'yes' }),
    });
    const res = await fetchDeviceStatus(CONFIG, TOKEN, { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('bad_response');
  });
});

describe('local record rehydration', () => {
  it('drops corrupt stored records defensively', () => {
    expect(storedDeviceRecordFromUnknown(null)).toBeNull();
    expect(storedDeviceRecordFromUnknown('record')).toBeNull();
    expect(storedDeviceRecordFromUnknown({ label: 'x', created_at: 't' })).toBeNull(); // no jwk/key
    expect(
      storedDeviceRecordFromUnknown({
        device_id: 'dev-1',
        label: 'x',
        created_at: '2026-11-03T00:00:00.000Z',
        public_jwk: { kty: 'EC', crv: 'P-256', x: 'a', y: 'b', d: 'leak' },
        private_key: { type: 'private', algorithm: { name: 'ECDSA' }, usages: ['sign'] },
      }),
    ).toBeNull(); // private material inside public_jwk → reject
  });

  it('exposes enrollment helpers over the store', async () => {
    const store = new InMemoryDeviceKeyStore();
    expect(await isDeviceEnrolled(store)).toBe(false);
    expect(await loadEnrolledDeviceId(store)).toBeNull();

    await seedEnrolled(store, 'dev-9');
    expect(await isDeviceEnrolled(store)).toBe(true);
    expect(await loadEnrolledDeviceId(store)).toBe('dev-9');
  });
});

describe('contract guards', () => {
  it('client source stays injectable: no hard-coded project URL or secret', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.resolve(__dirname, '../supabase');
    for (const name of ['deviceAuthClient.ts', 'deviceKeyStore.ts', 'deviceKeys.ts']) {
      const src = fs.readFileSync(path.join(dir, name), 'utf8');
      expect(src, `${name} must not hard-code a project URL`).not.toMatch(
        /https:\/\/[a-z0-9]{20}\.supabase\.co/,
      );
      expect(src, `${name} must not embed a secret key`).not.toMatch(/service_role|secret_key|sb_secret_/);
    }
  });

  it('signing contract is pinned: SHA-256 over the raw nonce, P-256 curve', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../supabase/deviceKeys.ts'),
      'utf8',
    );
    expect(src).toContain("hash: 'SHA-256'");
    expect(src).toContain("namedCurve: 'P-256'");
  });
});
