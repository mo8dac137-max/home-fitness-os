// Live end-to-end rehearsal of Home Fitness OS device auth + session_events RLS.
// Runs against the REAL Supabase project configured in the repo's gitignored .env.
//
// Security posture of this script:
//   - never prints access tokens, refresh tokens, nonces or recovery codes
//   - creates a fresh disposable user per run (unique email or anonymous)
//   - exit 0 = every step passed, exit 1 = at least one step failed
//   - it is a manual operator tool, never part of `npm test` / CI
//
// User acquisition order:
//   1. E2E_EMAIL + E2E_PASSWORD env vars  -> password grant (dashboard-created test user)
//   2. anonymous sign-in                  -> works when anonymous provider is enabled
//   3. classic signup                     -> works when open signups are enabled
// With an anonymous user the "fresh sign-in" per-session-binding step is skipped.
//
// Station counts: 29 with an email+password user (one optional skip for
// anonymous users: 26). Three of them are DEPLOY DIFFERENTIALS — they stay
// red until the pending device-auth redeploy lands, then prove 4D5 (device
// rows), 4D6 (honest 404 revoke) and 4D9 (revoked_devices history) live in
// one run. See docs/REPORT_LIVE_E2E.md.
//
// Usage (from the repo root):  npm run e2e:live
//                         or:  node scripts/e2e_device_auth.mjs
// Optional: E2E_EMAIL=... E2E_PASSWORD=... node scripts/e2e_device_auth.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── Env (no values are ever printed) ───────────────────────────────────────

const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));
const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const BASE = String(process.env.VITE_SUPABASE_URL ?? env['VITE_SUPABASE_URL'] ?? '').replace(/\/+$/, '');
const ANON = String(process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? '');
if (!BASE.startsWith('https://') || ANON.length < 20) {
  console.error(`FATAL: ${ENV_PATH} is missing a usable VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY`);
  process.exit(2);
}

// ── Small helpers ──────────────────────────────────────────────────────────

const mask = (s) =>
  typeof s === 'string' && s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}<len ${s.length}>` : '<short>';

const TE = new TextEncoder();

function b64uToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToB64u(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jwtClaims(token) {
  return JSON.parse(new TextDecoder().decode(b64uToBytes(token.split('.')[1] ?? '')));
}

const F = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20_000) });

// ── WebCrypto device keys (mirrors apps/web/src/supabase/deviceKeys.ts) ────

async function generatePublicJwk() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  return { private_key: privateKey, public_jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } };
}

async function signNonce(privateKey, nonce) {
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, TE.encode(nonce));
  return bytesToB64u(new Uint8Array(sig));
}

// ── Transport (mirrors deviceAuthClient.ts + syncTransport.ts) ─────────────

async function deviceAuth(action, accessToken, body = {}) {
  const res = await F(`${BASE}/functions/v1/device-auth`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

async function passwordGrant(mail, pass) {
  const res = await F(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: mail, password: pass }),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function restInsertEvent(accessToken, row) {
  const res = await F(`${BASE}/rest/v1/session_events?on_conflict=idempotency_key&select=idempotency_key`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify([row]),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

async function restPullEvents(accessToken, userId) {
  const params = new URLSearchParams({
    select: '*',
    user_id: `eq.${userId}`,
    order: 'occurred_at.asc,idempotency_key.asc',
    limit: '500',
  });
  const res = await F(`${BASE}/rest/v1/session_events?${params}`, {
    method: 'GET',
    headers: { apikey: ANON, Authorization: `Bearer ${accessToken}` },
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data };
}

// ── Steps ledger ───────────────────────────────────────────────────────────

const steps = [];
function record(name, pass, detail) {
  steps.push({ name, pass: !!pass, detail: String(detail) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
}
const skip = (name, detail) => record(name, true, `SKIPPED — ${detail}`);
const expectEq = (name, actual, expected, extra = '') =>
  record(name, actual === expected, `expected ${expected}, got ${actual}${extra ? ` (${extra})` : ''}`);
const expectErr = (name, res, status, code) => {
  // device-auth errors arrive as {error}; PostgREST RLS errors arrive as {code}
  const got = res.data?.error ?? res.data?.code ?? '<none>';
  record(name, res.status === status && got === code, `expected ${status}/${code}, got ${res.status}/${got}`);
};

// ── 1. Obtain a disposable user session ────────────────────────────────────

console.log('== Live E2E rehearsal — device auth + sync RLS ==');
console.log(`project: ${mask(BASE)}`);

const envEmail = process.env.E2E_EMAIL ?? '';
const envPass = process.env.E2E_PASSWORD ?? '';
let email = envEmail || null;
let password = envPass || null;
let token = null;
let origin = '';
let anonError = '';
let signupError = '';

if (email && password) {
  const g = await passwordGrant(email, password);
  token = g.data?.access_token ?? null;
  origin = `provided test user via password grant (HTTP ${g.status})`;
  if (!token) origin += `, body: ${JSON.stringify(g.data)?.slice(0, 200)}`;
}

if (!token) {
  const aRes = await F(`${BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { source: 'e2e-rehearsal' } }),
  });
  const a = await aRes.json().catch(() => null);
  if (a?.access_token) {
    token = a.access_token;
    origin = `anonymous sign-in (HTTP ${aRes.status}) — no password available, the fresh-sign-in step will be skipped`;
    email = null;
    password = null;
  } else {
    anonError = `${aRes.status} ${a?.error_code ?? a?.msg ?? a?.error ?? ''}`;
  }
}

if (!token) {
  const rand = () => Math.random().toString(36).slice(2, 8);
  email = `e2e-${Date.now()}-${rand()}@example.com`;
  password = `E2e-${rand()}x!A${rand()}`;
  const sRes = await F(`${BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const s = await sRes.json().catch(() => null);
  token = s?.access_token ?? null;
  origin = `signup ${email} (HTTP ${sRes.status})`;
  if (!token) {
    signupError = `${sRes.status} ${s?.error_code ?? s?.msg ?? s?.error ?? ''}`;
    const g = await passwordGrant(email, password);
    token = g.data?.access_token ?? null;
    if (token) origin = `password grant for just-signed-up ${email}`;
  }
}

if (!token) {
  record('user session', false,
    `could not obtain any session — anonymous: [${anonError || 'not attempted'}], signup: [${signupError || 'not attempted'}]. ` +
    `Fix: create a confirmed test user in the dashboard (Authentication → Users → Add user, Auto Confirm ✔) and re-run with E2E_EMAIL/E2E_PASSWORD, or enable anonymous sign-ins`);
  reportAndExit();
}

const claims = jwtClaims(token);
const userId = String(claims['sub'] ?? '');
record('user session', userId.length > 0, `${origin}; session_id ${mask(String(claims['session_id'] ?? ''))}`);

// ── 2. status before anything ──────────────────────────────────────────────

const st0 = await deviceAuth('status', token);
expectEq('status(initial)', `${st0.status}:${st0.data?.active_devices}:${st0.data?.session_verified}`, '200:0:false');

// Deploy differential (4D5): the live function only carries the per-device
// `devices` rows when the 4D5 source is deployed AND the
// 20261105000000_p4d5_device_last_seen.sql migration is applied. Red here
// means: apply the migration, redeploy device-auth, re-run.
record('status(initial) carries device rows (4D5 live)',
  Array.isArray(st0.data?.devices),
  Array.isArray(st0.data?.devices)
    ? `devices field present, ${st0.data.devices.length} row(s)`
    : 'devices field absent — the live function predates 4D5 or the 20261105000000_p4d5_device_last_seen.sql migration is not applied; apply the migration, redeploy device-auth, re-run');

// ── 3. RLS gates BEFORE device verification ────────────────────────────────

const env0 = {
  event_id: crypto.randomUUID(),
  type: 'session.completed',
  occurred_at: new Date().toISOString(),
  device_id: 'e2e-rehearsal',
  idempotency_key: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  schema_version: 1,
  payload: { source: 'e2e-rehearsal', note: 'live rehearsal row' },
};
const insDenied = await restInsertEvent(token, { ...env0, user_id: userId });
expectErr('insert(before verify) denied', insDenied, 403, '42501');

const pull0 = await restPullEvents(token, userId);
record('pull(before verify) empty', pull0.status === 200 && Array.isArray(pull0.data) && pull0.data.length === 0,
  `expected 200/0 rows, got ${pull0.status}/${Array.isArray(pull0.data) ? pull0.data.length : typeof pull0.data}`);

// ── 4. enroll ──────────────────────────────────────────────────────────────

const keyA = await generatePublicJwk();
const enrA = await deviceAuth('enroll', token, { public_key_jwk: keyA.public_jwk, label: 'e2e-rehearsal-A' });
const codesA = Array.isArray(enrA.data?.recovery_codes) ? enrA.data.recovery_codes : [];
const deviceIdA = enrA.data?.device_id ?? '';
record('enroll(A)', enrA.status === 200 && deviceIdA.length > 0 && codesA.length === 8,
  `device ${deviceIdA || '<none>'}, recovery codes: ${codesA.length} (shape ${codesA[0] ? codesA[0].replace(/[0-9a-f]/g, '•') : '<none>'})`);

const keyB = await generatePublicJwk();
const enrB = await deviceAuth('enroll', token, { public_key_jwk: keyB.public_jwk, label: 'e2e-rehearsal-B' });
expectErr('enroll(second device) refused', enrB, 409, 'device_exists_use_recover');

// ── 5. challenge → sign → verify ───────────────────────────────────────────

async function runVerify(accessToken, deviceId, privateKey, { breakSignature = false } = {}) {
  const ch = await deviceAuth('challenge', accessToken, { device_id: deviceId });
  if (ch.status !== 200 || typeof ch.data?.nonce !== 'string') return ch;
  const nonceToSign = breakSignature ? 'wrong-nonce-not-from-server' : ch.data.nonce;
  const signature = await signNonce(privateKey, nonceToSign);
  return deviceAuth('verify', accessToken, {
    device_id: deviceId, challenge_id: ch.data.challenge_id, signature,
  });
}

const ver1 = await runVerify(token, deviceIdA, keyA.private_key);
record('verify(A)', ver1.status === 200 && ver1.data?.ok === true,
  `ok=${String(ver1.data?.ok)}, expires_at=${ver1.data?.expires_at ?? '<none>'}`);

// ── 6. contract negatives around verify ────────────────────────────────────

const ch2 = await deviceAuth('challenge', token, { device_id: deviceIdA });
const sig2 = await signNonce(keyA.private_key, ch2.data?.nonce ?? '');
const verAgain = await deviceAuth('verify', token, {
  device_id: deviceIdA, challenge_id: ch2.data?.challenge_id, signature: sig2,
});
expectEq('verify(A) again on a fresh challenge', verAgain.status, 200);
const verReplay = await deviceAuth('verify', token, {
  device_id: deviceIdA, challenge_id: ch2.data?.challenge_id, signature: sig2,
});
expectErr('verify(replayed challenge) refused', verReplay, 401, 'bad_or_used_challenge');

const verWrong = await runVerify(token, deviceIdA, keyA.private_key, { breakSignature: true });
expectErr('verify(wrong signature) refused', verWrong, 401, 'bad_signature');

// ── 7. sync works AFTER verification ───────────────────────────────────────

const insOk = await restInsertEvent(token, { ...env0, user_id: userId });
const insertedKeys = Array.isArray(insOk.data) ? insOk.data.map((r) => r?.idempotency_key) : [];
record('insert(after verify) accepted',
  insOk.status === 201 && insertedKeys.length === 1 && insertedKeys[0] === env0.idempotency_key,
  `HTTP ${insOk.status}, returned ${insertedKeys.length} row(s)`);

const pull1 = await restPullEvents(token, userId);
record('pull(after verify) shows the row',
  pull1.status === 200 && Array.isArray(pull1.data) && pull1.data.length === 1 &&
    pull1.data[0]?.idempotency_key === env0.idempotency_key,
  `got ${pull1.status}/${Array.isArray(pull1.data) ? pull1.data.length : typeof pull1.data}`);

const insDup = await restInsertEvent(token, { ...env0, user_id: userId });
const pull2 = await restPullEvents(token, userId);
record('insert(duplicate) idempotent',
  insDup.status === 201 && Array.isArray(insDup.data) && insDup.data.length === 0 &&
    Array.isArray(pull2.data) && pull2.data.length === 1,
  `duplicate returned ${Array.isArray(insDup.data) ? insDup.data.length : '?'}, table now has ${Array.isArray(pull2.data) ? pull2.data.length : '?'} row(s)`);

// ── 8. a fresh sign-in is NOT verified (device session binds to session_id) ─
// Requires email+password (an anonymous user cannot re-authenticate).

let activeToken = token;

if (email && password) {
  const grant = await passwordGrant(email, password);
  const token2 = grant.data?.access_token ?? null;
  const claims2 = token2 ? jwtClaims(token2) : {};
  record('fresh sign-in', grant.status === 200 && !!token2 &&
    String(claims2['session_id'] ?? '') !== String(claims['session_id'] ?? ''),
    `new session_id ${mask(String(claims2['session_id'] ?? ''))} differs from the first`);
  activeToken = token2 ?? token;

  const pull3 = await restPullEvents(activeToken, userId);
  record('pull(fresh session) blocked by per-session binding',
    pull3.status === 200 && Array.isArray(pull3.data) && pull3.data.length === 0,
    `got ${pull3.status}/${Array.isArray(pull3.data) ? pull3.data.length : typeof pull3.data} (row exists but this session_id has no device session)`);

  const ver3 = await runVerify(activeToken, deviceIdA, keyA.private_key);
  record('verify(A) under fresh session', ver3.status === 200 && ver3.data?.ok === true,
    `ok=${String(ver3.data?.ok)}, expires_at=${ver3.data?.expires_at ?? '<none>'}`);

  const pull4 = await restPullEvents(activeToken, userId);
  record('pull(fresh session, verified) shows the row',
    pull4.status === 200 && Array.isArray(pull4.data) && pull4.data.length === 1,
    `got ${pull4.status}/${Array.isArray(pull4.data) ? pull4.data.length : typeof pull4.data}`);
} else {
  skip('fresh sign-in / per-session binding',
    'anonymous user has no password; per-session binding is enforced by the device_sessions upsert keyed on the JWT session_id claim (covered by unit tests)');
}

// ── 9. recovery flow ───────────────────────────────────────────────────────

const badRc = await deviceAuth('recover', activeToken, {
  public_key_jwk: (await generatePublicJwk()).public_jwk, recovery_code: '0000-0000-0000', label: 'e2e-rehearsal-C',
});
expectErr('recover(bad code) refused', badRc, 403, 'bad_recovery_code');

const keyC = await generatePublicJwk();
const rec = await deviceAuth('recover', activeToken, {
  public_key_jwk: keyC.public_jwk, recovery_code: codesA[0], label: 'e2e-rehearsal-C',
});
const codesC = Array.isArray(rec.data?.recovery_codes) ? rec.data.recovery_codes : [];
const deviceIdC = rec.data?.device_id ?? '';
record('recover(code[0] + new key)', rec.status === 200 && deviceIdC.length > 0 && codesC.length === 8,
  `new device ${deviceIdC || '<none>'}, fresh codes: ${codesC.length}, old device + all device sessions revoked server-side`);

const rcReuse = await deviceAuth('recover', activeToken, {
  public_key_jwk: (await generatePublicJwk()).public_jwk, recovery_code: codesA[0], label: 'e2e-rehearsal-D',
});
expectErr('recover(same code twice) refused', rcReuse, 403, 'bad_recovery_code');

const chOld = await deviceAuth('challenge', activeToken, { device_id: deviceIdA });
expectErr('challenge(revoked old device) refused', chOld, 403, 'unknown_or_revoked_device');

const verC = await runVerify(activeToken, deviceIdC, keyC.private_key);
record('verify(C) after recovery', verC.status === 200 && verC.data?.ok === true,
  `ok=${String(verC.data?.ok)}, expires_at=${verC.data?.expires_at ?? '<none>'}`);

const pull5 = await restPullEvents(activeToken, userId);
record('pull(after recovery re-verify) shows the row',
  pull5.status === 200 && Array.isArray(pull5.data) && pull5.data.length === 1,
  `got ${pull5.status}/${Array.isArray(pull5.data) ? pull5.data.length : typeof pull5.data}`);

// ── 10. revoke → everything closes again ───────────────────────────────────

// Deploy differential (4D6): revoking an id that is not a live device of
// this user must answer an honest 404, not the pre-4D6 fake bare-ok over a
// zero-row update. The caller is still verified (device C) here, so the
// 404 path is reachable. Red here means the live function predates 4D6.
const rvk404 = await deviceAuth('revoke', activeToken, { device_id: crypto.randomUUID() });
expectErr('revoke(unknown id) answers honest 404 (4D6 live)', rvk404, 404, 'unknown_or_revoked_device');

const rvk = await deviceAuth('revoke', activeToken, { device_id: deviceIdC });
expectEq('revoke(C)', rvk.status, 200);

const st1 = await deviceAuth('status', activeToken);
expectEq('status(after revoke)', `${st1.status}:${st1.data?.active_devices}:${st1.data?.session_verified}`, '200:0:false');

// Deploy differential (4D9): the collapsed revoked-history section of the
// account card is fed by the `revoked_devices` status extension — present
// only once the 4D9 source is live (the 4D6 redeploy ships it). Red here
// means the live function predates 4D9.
const rvHist = Array.isArray(st1.data?.revoked_devices) ? st1.data.revoked_devices : null;
record('status(after revoke) carries revoked history (4D9 live)',
  rvHist !== null && rvHist.some((r) => r?.id === deviceIdC && typeof r?.revoked_at === 'string'),
  rvHist !== null
    ? `revoked_devices present, ${rvHist.length} row(s), device C ${rvHist.some((r) => r?.id === deviceIdC) ? 'included' : 'MISSING'} with a revoked_at stamp`
    : 'revoked_devices absent — the live function predates 4D9; redeploy device-auth (the same redeploy ships 4D6)');

const pull6 = await restPullEvents(activeToken, userId);
record('pull(after revoke) blocked again',
  pull6.status === 200 && Array.isArray(pull6.data) && pull6.data.length === 0,
  `got ${pull6.status}/${Array.isArray(pull6.data) ? pull6.data.length : typeof pull6.data}`);

// ── Report ─────────────────────────────────────────────────────────────────

function reportAndExit() {
  const failed = steps.filter((s) => !s.pass);
  console.log('');
  console.log(`== Summary: ${steps.length - failed.length}/${steps.length} steps passed ==`);
  if (failed.length > 0) {
    console.log('failed steps:');
    for (const s of failed) console.log(`  ✖ ${s.name} — ${s.detail}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}
reportAndExit();
