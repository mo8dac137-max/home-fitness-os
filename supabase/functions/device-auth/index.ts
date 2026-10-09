// M0-15 device authorization spike. Deployed as the Edge Function "device-auth".
// The function verifies the user's token itself (auth.getUser), so the gateway
// setting "Verify JWT with legacy secret" is turned OFF for this function.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*', // spike only: restrict to the app origin later (M0-15b)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SESSION_HOURS = 12;
const CHALLENGE_SECONDS = 120;
const RECOVERY_CODE_COUNT = 8;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

function pickKey(dictVar: string, legacyVar: string): string {
  const raw = Deno.env.get(dictVar);
  if (raw) {
    try {
      const dict = JSON.parse(raw) as Record<string, string>;
      if (dict['default']) return dict['default'];
    } catch {
      /* fall through to the legacy variable */
    }
  }
  const legacy = Deno.env.get(legacyVar);
  if (legacy) return legacy;
  throw new Error(`missing key: ${dictVar} / ${legacyVar}`);
}

function b64uToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const bytesToHex = (b: Uint8Array) =>
  Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
const randomHex = (bytes: number) => bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(d));
}
function jwtClaims(token: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64uToBytes(token.split('.')[1] ?? '')));
}
const inFuture = (ms: number) => new Date(Date.now() + ms).toISOString();

function validPublicJwk(j: unknown): j is JsonWebKey {
  const k = j as Record<string, unknown> | null;
  return !!k && k['kty'] === 'EC' && k['crv'] === 'P-256' &&
    typeof k['x'] === 'string' && typeof k['y'] === 'string' && !('d' in k);
}

async function verifySignature(jwk: JsonWebKey, nonce: string, sigB64u: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
  );
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, key, b64uToBytes(sigB64u),
    new TextEncoder().encode(nonce),
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'missing_token' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
  );
  const { data: ud, error: ue } = await admin.auth.getUser(token);
  if (ue || !ud.user) return json(401, { error: 'unauthenticated' });
  const userId = ud.user.id;
  const sessionId = String(jwtClaims(token)['session_id'] ?? '');
  if (!sessionId) return json(401, { error: 'no_session_id' });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body['action'] ?? '');

  async function activeDeviceCount(): Promise<number> {
    const { count } = await admin.from('authorized_devices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId).is('revoked_at', null);
    return count ?? 0;
  }
  async function sessionVerified(): Promise<boolean> {
    const { data } = await admin.from('device_sessions')
      .select('expires_at, revoked_at')
      .eq('session_id', sessionId).eq('user_id', userId).maybeSingle();
    return !!data && !data.revoked_at && new Date(data.expires_at) > new Date();
  }
  async function newRecoveryCodes(): Promise<string[]> {
    await admin.from('recovery_codes').delete().eq('user_id', userId);
    const codes: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const h = randomHex(6); // 48 bits, shown once (M0-15b: longer + keyed hash)
      codes.push(`${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`);
    }
    await admin.from('recovery_codes').insert(
      await Promise.all(codes.map(async (c) => ({ user_id: userId, code_hash: await sha256Hex(c) }))),
    );
    return codes;
  }
  async function insertDevice(jwk: JsonWebKey, label: unknown): Promise<string | null> {
    const { data, error } = await admin.from('authorized_devices')
      .insert({ user_id: userId, label: String(label ?? 'device').slice(0, 60), public_key_jwk: jwk })
      .select('id').single();
    return error || !data ? null : data.id as string;
  }

  try {
    if (action === 'status') {
      return json(200, { active_devices: await activeDeviceCount(), session_verified: await sessionVerified() });
    }

    if (action === 'enroll') {
      if (!validPublicJwk(body['public_key_jwk'])) return json(400, { error: 'bad_public_key' });
      if ((await activeDeviceCount()) > 0) return json(409, { error: 'device_exists_use_recover' });
      const id = await insertDevice(body['public_key_jwk'], body['label']);
      if (!id) return json(500, { error: 'enroll_failed' });
      return json(200, { device_id: id, recovery_codes: await newRecoveryCodes() });
    }

    if (action === 'challenge') {
      const deviceId = String(body['device_id'] ?? '');
      const { data: dev } = await admin.from('authorized_devices').select('id')
        .eq('id', deviceId).eq('user_id', userId).is('revoked_at', null).maybeSingle();
      if (!dev) return json(403, { error: 'unknown_or_revoked_device' });
      const nonce = randomHex(32);
      const { data, error } = await admin.from('device_challenges')
        .insert({ user_id: userId, nonce, expires_at: inFuture(CHALLENGE_SECONDS * 1000) })
        .select('id').single();
      if (error || !data) return json(500, { error: 'challenge_failed' });
      return json(200, { challenge_id: data.id, nonce });
    }

    if (action === 'verify') {
      const deviceId = String(body['device_id'] ?? '');
      const challengeId = String(body['challenge_id'] ?? '');
      const signature = String(body['signature'] ?? '');
      // atomically consume the challenge (one use only)
      const { data: ch } = await admin.from('device_challenges')
        .update({ used_at: new Date().toISOString() })
        .eq('id', challengeId).eq('user_id', userId).is('used_at', null)
        .gt('expires_at', new Date().toISOString()).select('nonce').maybeSingle();
      if (!ch) return json(401, { error: 'bad_or_used_challenge' });
      const { data: dev } = await admin.from('authorized_devices').select('id, public_key_jwk')
        .eq('id', deviceId).eq('user_id', userId).is('revoked_at', null).maybeSingle();
      if (!dev) return json(403, { error: 'unknown_or_revoked_device' });
      const ok = await verifySignature(dev.public_key_jwk as JsonWebKey, ch.nonce as string, signature);
      if (!ok) return json(401, { error: 'bad_signature' });
      const expires = inFuture(SESSION_HOURS * 3600 * 1000);
      const { error } = await admin.from('device_sessions').upsert({
        session_id: sessionId, user_id: userId, device_id: deviceId,
        expires_at: expires, revoked_at: null,
      });
      if (error) return json(500, { error: 'session_failed' });
      return json(200, { ok: true, expires_at: expires });
    }

    if (action === 'revoke') {
      if (!(await sessionVerified())) return json(403, { error: 'device_session_required' });
      const deviceId = String(body['device_id'] ?? '');
      const now = new Date().toISOString();
      await admin.from('authorized_devices').update({ revoked_at: now })
        .eq('id', deviceId).eq('user_id', userId);
      await admin.from('device_sessions').update({ revoked_at: now })
        .eq('device_id', deviceId).eq('user_id', userId);
      return json(200, { ok: true });
    }

    if (action === 'recover') {
      // lost phone: signed-in user + one-time recovery code -> revoke all, enroll new device
      if (!validPublicJwk(body['public_key_jwk'])) return json(400, { error: 'bad_public_key' });
      const hash = await sha256Hex(String(body['recovery_code'] ?? '').trim().toLowerCase());
      const { data: rc } = await admin.from('recovery_codes').update({ used_at: new Date().toISOString() })
        .eq('user_id', userId).eq('code_hash', hash).is('used_at', null).select('id').maybeSingle();
      if (!rc) return json(403, { error: 'bad_recovery_code' });
      const now = new Date().toISOString();
      await admin.from('authorized_devices').update({ revoked_at: now })
        .eq('user_id', userId).is('revoked_at', null);
      await admin.from('device_sessions').update({ revoked_at: now }).eq('user_id', userId);
      const id = await insertDevice(body['public_key_jwk'], body['label']);
      if (!id) return json(500, { error: 'enroll_failed' });
      return json(200, { device_id: id, recovery_codes: await newRecoveryCodes() });
    }

    return json(400, { error: 'unknown_action' });
  } catch (e) {
    return json(500, { error: 'server_error', detail: String(e) });
  }
});
