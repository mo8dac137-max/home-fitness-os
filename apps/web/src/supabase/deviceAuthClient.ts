import type { FetchLike } from './syncTransport.js';
import type { SupabaseEnvConfig } from './env.js';
import {
  generateDeviceKeyPair,
  isValidPublicDeviceJwk,
  signNonce,
  type PublicDeviceJwk,
} from './deviceKeys.js';
import type { DeviceKeyStore, StoredDeviceRecord } from './deviceKeyStore.js';

/**
 * Device authorization client (Phase 4C).
 *
 * Talks to the deployed `device-auth` Edge Function (M0-15 contract):
 * enroll → challenge → verify (12 h device session) → revoke / recover.
 * Plain fetch with injected I/O — same decision as `syncTransport` (no
 * supabase-js, fully testable, minimal bundle).
 *
 * Every function returns a discriminated result instead of throwing. Server
 * error bodies (`{ "error": "..." }`) pass through honestly as `code`;
 * client-side failures use the synthesized codes documented below.
 */

export const DEVICE_AUTH_FUNCTION = 'device-auth';

/** Error codes synthesized on the client (server codes pass through verbatim). */
export type ClientDeviceAuthErrorCode =
  | 'missing_token'
  | 'bad_response'
  | 'network_error'
  | 'timeout'
  | 'not_enrolled'
  | 'bad_device_id'
  | 'signing_failed';

export interface DeviceAuthOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export type DeviceAuthResult<T> =
  | { ok: true; data: T; http_status: number }
  | {
      ok: false;
      /** Server `error` string verbatim, or a ClientDeviceAuthErrorCode. */
      code: string;
      http_status: number | null;
      message: string;
    };

// ── low-level transport ────────────────────────────────────────────────────

function functionUrl(config: SupabaseEnvConfig): string {
  return `${config.url.replace(/\/+$/, '')}/functions/v1/${DEVICE_AUTH_FUNCTION}`;
}

async function request(
  url: string,
  init: RequestInit,
  options: DeviceAuthOptions,
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

function failure<T>(
  code: string,
  httpStatus: number | null,
  message: string,
): DeviceAuthResult<T> {
  return { ok: false, code, http_status: httpStatus, message };
}

/** POSTs one `{ action, ... }` call to the device-auth function. */
export async function callDeviceAuth<T>(
  config: SupabaseEnvConfig,
  accessToken: string,
  body: Record<string, unknown>,
  options: DeviceAuthOptions = {},
): Promise<DeviceAuthResult<T>> {
  if (accessToken.trim() === '') {
    return failure<T>('missing_token', null, 'access token is required');
  }

  let res: Response;
  try {
    res = await request(
      functionUrl(config),
      {
        method: 'POST',
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      options,
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return failure<T>('timeout', null, 'device-auth request timed out');
    }
    return failure<T>(
      'network_error',
      null,
      `device-auth request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = await res.text().catch(() => '');
  let parsed: unknown = null;
  try {
    parsed = text === '' ? null : (JSON.parse(text) as unknown);
  } catch {
    parsed = null;
  }

  const bodyObj = typeof parsed === 'object' && parsed !== null
    ? (parsed as Record<string, unknown>)
    : null;
  const serverError = typeof bodyObj?.['error'] === 'string' ? bodyObj['error'] : null;

  if (!res.ok) {
    return failure<T>(
      serverError ?? `http_${res.status}`,
      res.status,
      serverError
        ? `device-auth failed: ${serverError}`
        : `device-auth failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`,
    );
  }

  if (bodyObj === null || serverError !== null) {
    return failure<T>('bad_response', res.status, 'device-auth returned an unexpected body');
  }

  return { ok: true, data: parsed as T, http_status: res.status };
}

// ── action contracts (server responses) ────────────────────────────────────

export interface DeviceStatus {
  active_devices: number;
  session_verified: boolean;
  /**
   * Phase 4D5 contract extension: per-device rows for the account card.
   * null = the deployed function predates the extension (or sent garbage);
   * the UI then falls back to the bare active_devices count.
   */
  devices: DeviceStatusRow[] | null;
  /**
   * Phase 4D9 contract extension: most recent revoked devices (audit trail,
   * server caps at 10). null = the deployed function predates the extension
   * (or sent garbage); the UI then shows no history section at all.
   */
  revoked_devices: RevokedDeviceRow[] | null;
}

export interface RevokedDeviceRow {
  device_id: string;
  label: string;
  created_at: string | null;
  revoked_at: string | null;
}

export interface DeviceStatusRow {
  device_id: string;
  label: string;
  created_at: string | null;
  last_seen_at: string | null;
}

export interface EnrollOutcome {
  /** `created` = newly enrolled; `already` = this browser already has a device. */
  status: 'created' | 'already';
  device_id: string;
  /** One-time codes — only present right after creation; must be shown once. */
  recovery_codes: string[] | null;
}

export interface VerifyOutcome {
  device_id: string;
  /** 12 h device-session expiry from the server (ISO), when provided. */
  expires_at: string | null;
}

// ── high-level flows ───────────────────────────────────────────────────────

export async function fetchDeviceStatus(
  config: SupabaseEnvConfig,
  accessToken: string,
  options: DeviceAuthOptions = {},
): Promise<DeviceAuthResult<DeviceStatus>> {
  const res = await callDeviceAuth<unknown>(config, accessToken, { action: 'status' }, options);
  if (!res.ok) return res;

  const d = res.data as Record<string, unknown>;
  const active = d['active_devices'];
  const verified = d['session_verified'];
  if (typeof active !== 'number' || !Number.isFinite(active) || typeof verified !== 'boolean') {
    return failure<DeviceStatus>('bad_response', res.http_status, 'malformed status payload');
  }
  return {
    ok: true,
    data: {
      active_devices: active,
      session_verified: verified,
      devices: parseDeviceRows(d['devices']),
      revoked_devices: parseRevokedRows(d['revoked_devices']),
    },
    http_status: res.http_status,
  };
}

/**
 * Phase 4D5: defensive parse of the optional `devices` array. Absent or
 * malformed -> null (UI degrades to the bare count); malformed entries are
 * dropped individually so one bad row never hides the rest.
 */
export function parseDeviceRows(raw: unknown): DeviceStatusRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: DeviceStatusRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id = e['id'];
    const label = e['label'];
    if (typeof id !== 'string' || id === '' || typeof label !== 'string') continue;
    const createdAt = e['created_at'];
    const lastSeen = e['last_seen_at'];
    rows.push({
      device_id: id,
      label,
      created_at: typeof createdAt === 'string' ? createdAt : null,
      last_seen_at: typeof lastSeen === 'string' ? lastSeen : null,
    });
  }
  return rows.length > 0 ? rows : null;
}

/**
 * Phase 4D9: defensive parse of the optional `revoked_devices` array —
 * mirrors `parseDeviceRows` exactly. Absent or malformed -> null (the UI
 * shows no history section); malformed entries are dropped individually so
 * one bad row never hides the rest.
 */
export function parseRevokedRows(raw: unknown): RevokedDeviceRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: RevokedDeviceRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id = e['id'];
    const label = e['label'];
    if (typeof id !== 'string' || id === '' || typeof label !== 'string') continue;
    const createdAt = e['created_at'];
    const revokedAt = e['revoked_at'];
    rows.push({
      device_id: id,
      label,
      created_at: typeof createdAt === 'string' ? createdAt : null,
      revoked_at: typeof revokedAt === 'string' ? revokedAt : null,
    });
  }
  return rows.length > 0 ? rows : null;
}

/**
 * Enrolls this browser as an authorized device.
 * Reuses an orphaned key pair from a failed earlier attempt; generates a new
 * pair on first use. Recovery codes are returned exactly once.
 */
export async function enrollCurrentDevice(
  config: SupabaseEnvConfig,
  accessToken: string,
  store: DeviceKeyStore,
  label: string,
  options: DeviceAuthOptions = {},
): Promise<DeviceAuthResult<EnrollOutcome>> {
  const existing = await store.load();
  if (existing?.device_id != null) {
    return {
      ok: true,
      data: { status: 'already', device_id: existing.device_id, recovery_codes: null },
      http_status: 200,
    };
  }

  const pair = existing
    ? { privateKey: existing.private_key, publicJwk: existing.public_jwk }
    : await generateDeviceKeyPair();

  const res = await callDeviceAuth<{ device_id?: unknown; recovery_codes?: unknown }>(
    config,
    accessToken,
    { action: 'enroll', public_key_jwk: pair.publicJwk, label },
    options,
  );
  if (!res.ok) return res;

  const deviceId = typeof res.data['device_id'] === 'string' ? res.data['device_id'] : null;
  if (deviceId === null) {
    return failure<EnrollOutcome>('bad_response', res.http_status, 'enroll response missing device_id');
  }
  const codes = Array.isArray(res.data['recovery_codes'])
    ? (res.data['recovery_codes'] as unknown[]).filter((c): c is string => typeof c === 'string')
    : null;

  await store.save({
    device_id: deviceId,
    label,
    public_jwk: pair.publicJwk,
    private_key: pair.privateKey,
    created_at: existing?.created_at ?? new Date().toISOString(),
  });

  return { ok: true, data: { status: 'created', device_id: deviceId, recovery_codes: codes }, http_status: res.http_status };
}

/**
 * Proves device possession: challenge → sign nonce → verify. On success the
 * server binds the Supabase Auth `session_id` of the presented JWT to a 12 h
 * device session, which unlocks the RLS-gated tables (e.g. `session_events`).
 */
export async function verifyCurrentDevice(
  config: SupabaseEnvConfig,
  accessToken: string,
  store: DeviceKeyStore,
  options: DeviceAuthOptions = {},
): Promise<DeviceAuthResult<VerifyOutcome>> {
  const record = await store.load();
  if (!record || record.device_id === null) {
    return failure<VerifyOutcome>('not_enrolled', null, 'this browser has no enrolled device');
  }
  const deviceId: string = record.device_id;

  const ch = await callDeviceAuth<{ challenge_id?: unknown; nonce?: unknown }>(
    config,
    accessToken,
    { action: 'challenge', device_id: deviceId },
    options,
  );
  if (!ch.ok) return ch;
  const challengeId = typeof ch.data['challenge_id'] === 'string' ? ch.data['challenge_id'] : null;
  const nonce = typeof ch.data['nonce'] === 'string' && ch.data['nonce'].length > 0
    ? ch.data['nonce']
    : null;
  if (challengeId === null || nonce === null) {
    return failure<VerifyOutcome>('bad_response', ch.http_status, 'malformed challenge payload');
  }

  let signature: string;
  try {
    signature = await signNonce(record.private_key, nonce);
  } catch (err) {
    return failure<VerifyOutcome>(
      'signing_failed',
      null,
      `nonce signing failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const vf = await callDeviceAuth<{ ok?: unknown; expires_at?: unknown }>(
    config,
    accessToken,
    { action: 'verify', device_id: deviceId, challenge_id: challengeId, signature },
    options,
  );
  if (!vf.ok) return vf;

  const expiresAt = typeof vf.data['expires_at'] === 'string' ? vf.data['expires_at'] : null;
  return { ok: true, data: { device_id: deviceId, expires_at: expiresAt }, http_status: vf.http_status };
}

/** Revokes the given device (server requires an already-verified session). */
export async function revokeCurrentDevice(
  config: SupabaseEnvConfig,
  accessToken: string,
  store: DeviceKeyStore,
  options: DeviceAuthOptions = {},
): Promise<DeviceAuthResult<{ ok: boolean }>> {
  const record = await store.load();
  if (!record || record.device_id === null) {
    return failure<{ ok: boolean }>('not_enrolled', null, 'this browser has no enrolled device');
  }

  const res = await callDeviceAuth<{ ok?: unknown }>(
    config,
    accessToken,
    { action: 'revoke', device_id: record.device_id },
    options,
  );
  if (!res.ok) return res;

  await store.clear(); // this browser's device is no longer authorized
  return { ok: true, data: { ok: true }, http_status: res.http_status };
}

/**
 * Phase 4D6: revokes ANY of the user's devices by id — the per-device revoke
 * buttons in the account card. Unlike `revokeCurrentDevice` it never touches
 * the local key store: revoking another device is purely server-side, and
 * this browser stays verified. Requires a verified device session (server
 * answers 403 `device_session_required` otherwise). A hardened server (4D6)
 * answers 404 `unknown_or_revoked_device` for an id that is unknown or
 * already revoked; an older function answers a bare ok for the same input —
 * the caller handles both honestly through the discriminated result.
 */
export async function revokeDeviceById(
  config: SupabaseEnvConfig,
  accessToken: string,
  deviceId: string,
  options: DeviceAuthOptions = {},
): Promise<DeviceAuthResult<{ ok: boolean }>> {
  if (deviceId.trim() === '') {
    return failure<{ ok: boolean }>('bad_device_id', null, 'a device id is required');
  }
  return callDeviceAuth<{ ok: boolean }>(
    config,
    accessToken,
    { action: 'revoke', device_id: deviceId },
    options,
  );
}

/**
 * Lost-device recovery: consumes a one-time recovery code, revokes all old
 * devices/sessions server-side, and enrolls this browser with a fresh key pair.
 */
export async function recoverDevice(
  config: SupabaseEnvConfig,
  accessToken: string,
  store: DeviceKeyStore,
  recoveryCode: string,
  label: string,
  options: DeviceAuthOptions = {},
): Promise<DeviceAuthResult<EnrollOutcome>> {
  const fresh = await generateDeviceKeyPair();

  const res = await callDeviceAuth<{ device_id?: unknown; recovery_codes?: unknown }>(
    config,
    accessToken,
    {
      action: 'recover',
      public_key_jwk: fresh.publicJwk,
      recovery_code: recoveryCode.trim().toLowerCase(),
      label,
    },
    options,
  );
  if (!res.ok) return res;

  const deviceId = typeof res.data['device_id'] === 'string' ? res.data['device_id'] : null;
  if (deviceId === null) {
    return failure<EnrollOutcome>('bad_response', res.http_status, 'recover response missing device_id');
  }
  const codes = Array.isArray(res.data['recovery_codes'])
    ? (res.data['recovery_codes'] as unknown[]).filter((c): c is string => typeof c === 'string')
    : null;

  await store.save({
    device_id: deviceId,
    label,
    public_jwk: fresh.publicJwk,
    private_key: fresh.privateKey,
    created_at: new Date().toISOString(),
  });

  return { ok: true, data: { status: 'created', device_id: deviceId, recovery_codes: codes }, http_status: res.http_status };
}

/** Local view helpers for the UI layer (Phase 4D2). */

export function isDeviceEnrolled(store: DeviceKeyStore): Promise<boolean> {
  return store.load().then((r) => r !== null && r.device_id !== null);
}

export async function loadEnrolledDeviceId(store: DeviceKeyStore): Promise<string | null> {
  const r: StoredDeviceRecord | null = await store.load();
  return r?.device_id ?? null;
}

/** Type guard re-exported so the UI can validate server JWKs defensively. */
export function isValidServerPublicJwk(value: unknown): value is PublicDeviceJwk {
  return isValidPublicDeviceJwk(value);
}
