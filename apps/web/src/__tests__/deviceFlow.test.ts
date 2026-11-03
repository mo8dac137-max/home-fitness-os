import { describe, it, expect } from 'vitest';
import { runDeviceFlow, submitDeviceRecovery } from '../supabase/deviceFlow.js';
import {
  generateDeviceKeyPair,
  isValidPublicDeviceJwk,
  verifyNonceSignature,
} from '../supabase/deviceKeys.js';
import { InMemoryDeviceKeyStore, type StoredDeviceRecord } from '../supabase/deviceKeyStore.js';
import type { FetchLike } from '../supabase/syncTransport.js';
import type { SupabaseEnvConfig } from '../supabase/env.js';

const CONFIG: SupabaseEnvConfig = {
  url: 'https://tbyqtmgxomznpemkkaee.supabase.co',
  publishableKey: 'sb_publishable_test',
};
const TOKEN = 'user-access-token';

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type ActionHandler = (body: Record<string, unknown>) => Response | Promise<Response>;

function mockFunction(handlers: Record<string, ActionHandler>) {
  const calls: Array<{ action: string; body: Record<string, unknown> }> = [];
  const fetchImpl: FetchLike = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    calls.push({ action: String(body['action'] ?? ''), body });
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

async function seedEnrolled(store: InMemoryDeviceKeyStore, deviceId = 'dev-1'): Promise<StoredDeviceRecord> {
  const pair = await generateDeviceKeyPair();
  const record: StoredDeviceRecord = {
    device_id: deviceId,
    label: 'test',
    public_jwk: pair.publicJwk,
    private_key: pair.privateKey,
    created_at: '2026-11-03T00:00:00.000Z',
  };
  await store.save(record);
  return record;
}

describe('runDeviceFlow', () => {
  it('short-circuits to verified when the device session is already live', async () => {
    const store = new InMemoryDeviceKeyStore();
    await seedEnrolled(store, 'dev-1');
    const { calls, fetchImpl } = mockFunction({
      status: () => jsonRes(200, { active_devices: 1, session_verified: true }),
    });

    const result = await runDeviceFlow(CONFIG, TOKEN, store, { fetchImpl });

    expect(result).toEqual({ kind: 'verified', device_id: 'dev-1' });
    expect(calls.map((c) => c.action)).toEqual(['status']);
  });

  it('requires recovery when the server is verified but this browser lost its record', async () => {
    const store = new InMemoryDeviceKeyStore();
    const { calls, fetchImpl } = mockFunction({
      status: () => jsonRes(200, { active_devices: 1, session_verified: true }),
    });

    const result = await runDeviceFlow(CONFIG, TOKEN, store, { fetchImpl });

    expect(result).toEqual({ kind: 'recovery_required', reason: 'local_record_missing' });
    expect(calls.map((c) => c.action)).toEqual(['status']);
  });

  it('enrolls and verifies on a fresh browser, returning one-time codes', async () => {
    const store = new InMemoryDeviceKeyStore();
    const nonce = hexNonce(32);
    let enrolledJwk: unknown = null;

    const { calls, fetchImpl } = mockFunction({
      status: () => jsonRes(200, { active_devices: 0, session_verified: false }),
      enroll: (body) => {
        enrolledJwk = body['public_key_jwk'];
        return jsonRes(200, { device_id: 'dev-new', recovery_codes: ['aaaa-bbbb-cccc'] });
      },
      challenge: () => jsonRes(200, { challenge_id: 'ch-1', nonce }),
      verify: (body) =>
        verifyNonceSignature(enrolledJwk as never, nonce, String(body['signature'] ?? '')).then(
          (ok) =>
            ok
              ? jsonRes(200, { ok: true, expires_at: '2026-11-04T00:00:00.000Z' })
              : jsonRes(401, { error: 'bad_signature' }),
        ),
    });

    const result = await runDeviceFlow(CONFIG, TOKEN, store, { fetchImpl, label: 'pixel-8' });

    expect(result.kind).toBe('enrolled');
    if (result.kind !== 'enrolled') return;
    expect(result.outcome).toEqual({
      status: 'created',
      device_id: 'dev-new',
      recovery_codes: ['aaaa-bbbb-cccc'],
    });
    expect(isValidPublicDeviceJwk(enrolledJwk)).toBe(true);
    expect(calls.map((c) => c.action)).toEqual(['status', 'enroll', 'challenge', 'verify']);

    const saved = await store.load();
    expect(saved?.device_id).toBe('dev-new');
    expect(saved?.label).toBe('pixel-8');
  });

  it('requires recovery when a device exists that this browser does not control', async () => {
    const store = new InMemoryDeviceKeyStore();
    const { calls, fetchImpl } = mockFunction({
      status: () => jsonRes(200, { active_devices: 1, session_verified: false }),
    });

    const result = await runDeviceFlow(CONFIG, TOKEN, store, { fetchImpl });

    expect(result).toEqual({ kind: 'recovery_required', reason: 'device_exists' });
    expect(calls.map((c) => c.action)).toEqual(['status']);
  });

  it('verifies the existing local key pair when a device session is not yet live', async () => {
    const store = new InMemoryDeviceKeyStore();
    const record = await seedEnrolled(store, 'dev-1');
    const nonce = hexNonce(32);

    const { calls, fetchImpl } = mockFunction({
      status: () => jsonRes(200, { active_devices: 1, session_verified: false }),
      challenge: () => jsonRes(200, { challenge_id: 'ch-1', nonce }),
      verify: (body) =>
        verifyNonceSignature(record.public_jwk, nonce, String(body['signature'] ?? '')).then((ok) =>
          ok ? jsonRes(200, { ok: true, expires_at: '2026-11-04T00:00:00.000Z' }) : jsonRes(401, { error: 'bad_signature' }),
        ),
    });

    const result = await runDeviceFlow(CONFIG, TOKEN, store, { fetchImpl });

    expect(result).toEqual({ kind: 'verified', device_id: 'dev-1' });
    expect(calls.map((c) => c.action)).toEqual(['status', 'challenge', 'verify']);
  });

  it('falls back to recovery when the local key no longer proves possession', async () => {
    const store = new InMemoryDeviceKeyStore();
    await seedEnrolled(store, 'dev-1');
    const { fetchImpl } = mockFunction({
      status: () => jsonRes(200, { active_devices: 1, session_verified: false }),
      challenge: () => jsonRes(403, { error: 'unknown_or_revoked_device' }),
    });

    const result = await runDeviceFlow(CONFIG, TOKEN, store, { fetchImpl });

    expect(result).toEqual({
      kind: 'recovery_required',
      reason: 'unknown_or_revoked_device',
    });
  });

  it('passes transport errors through as data', async () => {
    const store = new InMemoryDeviceKeyStore();
    const fetchImpl: FetchLike = async () => {
      throw new Error('offline');
    };

    const result = await runDeviceFlow(CONFIG, TOKEN, store, { fetchImpl });

    expect(result).toEqual({ kind: 'error', code: 'network_error', message: expect.any(String) });
  });
});

describe('submitDeviceRecovery', () => {
  it('recovers with a fresh key pair, verifies, and returns the new codes', async () => {
    const store = new InMemoryDeviceKeyStore();
    const oldRecord = await seedEnrolled(store, 'dev-old');
    const nonce = hexNonce(32);
    let recoveredJwk: unknown = null;

    const { calls, fetchImpl } = mockFunction({
      recover: (body) => {
        recoveredJwk = body['public_key_jwk'];
        return jsonRes(200, { device_id: 'dev-new', recovery_codes: ['dddd-eeee-ffff'] });
      },
      challenge: () => jsonRes(200, { challenge_id: 'ch-2', nonce }),
      verify: (body) =>
        verifyNonceSignature(recoveredJwk as never, nonce, String(body['signature'] ?? '')).then(
          (ok) =>
            ok
              ? jsonRes(200, { ok: true, expires_at: '2026-11-04T00:00:00.000Z' })
              : jsonRes(401, { error: 'bad_signature' }),
        ),
    });

    const result = await submitDeviceRecovery(CONFIG, TOKEN, store, ' aabb-ccdd-eeff ', {
      fetchImpl,
    });

    expect(result.kind).toBe('enrolled');
    if (result.kind !== 'enrolled') return;
    expect(result.outcome.recovery_codes).toEqual(['dddd-eeee-ffff']);

    const saved = await store.load();
    expect(saved?.device_id).toBe('dev-new');
    expect(saved?.public_jwk).not.toEqual(oldRecord.public_jwk); // fresh key pair
    expect(calls.map((c) => c.action)).toEqual(['recover', 'challenge', 'verify']);
  });

  it('surfaces a consumed or wrong recovery code without touching the store', async () => {
    const store = new InMemoryDeviceKeyStore();
    await seedEnrolled(store, 'dev-old');
    const { fetchImpl } = mockFunction({
      recover: () => jsonRes(403, { error: 'bad_recovery_code' }),
    });

    const result = await submitDeviceRecovery(CONFIG, TOKEN, store, 'nope', { fetchImpl });

    expect(result).toEqual({ kind: 'error', code: 'bad_recovery_code', message: expect.any(String) });
    expect((await store.load())?.device_id).toBe('dev-old');
  });
});
