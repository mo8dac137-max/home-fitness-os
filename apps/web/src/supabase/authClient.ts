import type { FetchLike } from './syncTransport.js';
import type { SupabaseEnvConfig } from './env.js';

/**
 * Supabase Auth REST client (Phase 4D2).
 *
 * Plain fetch against `/auth/v1` — no supabase-js (same minimal-bundle
 * decision as the rest of the cloud layer: injected I/O, honest results).
 *
 * The persisted session is deliberately tiny: access token, refresh token,
 * expiry, and the user identity. Access tokens are refreshed pre-emptively
 * when they are within 60 s of expiry. The JWT's `session_id` claim is what
 * the device-auth function binds to a device session (M0-15), so keeping the
 * auth session alive keeps the device session usable.
 */

export const AUTH_TOKEN_TTL_MARGIN_SECONDS = 60;

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  /** Unix seconds (from the server's `expires_at`). */
  expires_at: number;
  user_id: string;
  email: string;
}

export interface AuthSessionStore {
  load(): Promise<AuthSession | null>;
  save(session: AuthSession): Promise<void>;
  clear(): Promise<void>;
}

export interface AuthClientOptions {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export type AuthResult<T> =
  | { ok: true; data: T; http_status: number }
  | {
      ok: false;
      /** Normalized server error code or client-synthesized code. */
      code: string;
      http_status: number | null;
      message: string;
    };

function failure<T>(code: string, httpStatus: number | null, message: string): AuthResult<T> {
  return { ok: false, code, http_status: httpStatus, message };
}

// ── session store implementations ──────────────────────────────────────────

import { KeyValueStore } from '../storage/KeyValueStore.js';

const AUTH_SESSION_KEY = 'hfos.auth.session';

export class InMemoryAuthSessionStore implements AuthSessionStore {
  private session: AuthSession | null = null;

  async load(): Promise<AuthSession | null> {
    return this.session;
  }

  async save(session: AuthSession): Promise<void> {
    this.session = session;
  }

  async clear(): Promise<void> {
    this.session = null;
  }
}

export class KeyValueAuthSessionStore implements AuthSessionStore {
  private readonly kv: Pick<KeyValueStore, 'get' | 'set' | 'delete'>;

  constructor(kv: Pick<KeyValueStore, 'get' | 'set' | 'delete'>) {
    this.kv = kv;
  }

  async load(): Promise<AuthSession | null> {
    const raw = await this.kv.get<unknown>(AUTH_SESSION_KEY);
    return authSessionFromUnknown(raw);
  }

  async save(session: AuthSession): Promise<void> {
    await this.kv.set(AUTH_SESSION_KEY, session);
  }

  async clear(): Promise<void> {
    await this.kv.delete(AUTH_SESSION_KEY);
  }
}

/** Defensive rehydration — a corrupt stored session behaves like signed-out. */
export function authSessionFromUnknown(value: unknown): AuthSession | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Record<string, unknown>;
  const accessToken = r['access_token'];
  const refreshToken = r['refresh_token'];
  const expiresAt = r['expires_at'];
  const userId = r['user_id'];
  const email = r['email'];
  if (
    typeof accessToken !== 'string' || accessToken.length === 0 ||
    typeof refreshToken !== 'string' || refreshToken.length === 0 ||
    typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) ||
    typeof userId !== 'string' || userId.length === 0 ||
    typeof email !== 'string'
  ) {
    return null;
  }
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    user_id: userId,
    email,
  };
}

// ── transport ──────────────────────────────────────────────────────────────

function authUrl(config: SupabaseEnvConfig, path: string): string {
  return `${config.url.replace(/\/+$/, '')}/auth/v1${path}`;
}

async function request(
  url: string,
  init: RequestInit,
  options: AuthClientOptions,
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

/** Normalizes GoTrue error bodies ({error, error_description} / {msg, error_code}). */
function parseErrorBody(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const b = parsed as Record<string, unknown>;
  if (typeof b['error_code'] === 'string' && b['error_code'].length > 0) return b['error_code'];
  if (typeof b['error'] === 'string' && b['error'].length > 0) return b['error'];
  return null;
}

async function callAuth(
  config: SupabaseEnvConfig,
  urlPath: string,
  init: RequestInit,
  options: AuthClientOptions,
): Promise<AuthResult<Record<string, unknown>>> {
  let res: Response;
  try {
    res = await request(authUrl(config, urlPath), init, options);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return failure('timeout', null, 'auth request timed out');
    }
    return failure(
      'network_error',
      null,
      `auth request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = await res.text().catch(() => '');
  let parsed: unknown = null;
  try {
    parsed = text === '' ? null : (JSON.parse(text) as unknown);
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const code = parseErrorBody(parsed) ?? `http_${res.status}`;
    return failure(code, res.status, `auth failed: ${code}`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return failure('bad_response', res.status, 'auth returned an unexpected body');
  }
  return { ok: true, data: parsed as Record<string, unknown>, http_status: res.status };
}

function headersFor(config: SupabaseEnvConfig): Record<string, string> {
  return {
    apikey: config.publishableKey,
    'Content-Type': 'application/json',
  };
}

// ── response parsing ───────────────────────────────────────────────────────

/** Extracts the persisted session from a GoTrue token response, defensively. */
export function authSessionFromTokenResponse(parsed: unknown): AuthSession | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const b = parsed as Record<string, unknown>;
  const user = typeof b['user'] === 'object' && b['user'] !== null
    ? (b['user'] as Record<string, unknown>)
    : null;

  const accessToken = b['access_token'];
  const refreshToken = b['refresh_token'];
  const expiresIn = b['expires_in'];
  const expiresAtRaw = b['expires_at'];
  const userId = user?.['id'];
  const email = user?.['email'];

  if (
    typeof accessToken !== 'string' || accessToken.length === 0 ||
    typeof refreshToken !== 'string' || refreshToken.length === 0 ||
    (typeof expiresAtRaw !== 'number' || !Number.isFinite(expiresAtRaw)) &&
      (typeof expiresIn !== 'number' || !Number.isFinite(expiresIn)) ||
    typeof userId !== 'string' || userId.length === 0
  ) {
    return null;
  }

  // Prefer the server's absolute expiry; fall back to expires_in from "now".
  const expiresAt =
    typeof expiresAtRaw === 'number' && Number.isFinite(expiresAtRaw)
      ? expiresAtRaw
      : Math.floor(Date.now() / 1000) + (expiresIn as number);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    user_id: userId,
    email: typeof email === 'string' ? email : '',
  };
}

// ── public API ─────────────────────────────────────────────────────────────

export interface SignInOutcome {
  session: AuthSession;
  /** True when the stored session was refreshed instead of freshly signed in. */
  refreshed: boolean;
}

/** Signs in with email + password and persists the session. */
export async function signInWithPassword(
  config: SupabaseEnvConfig,
  store: AuthSessionStore,
  email: string,
  password: string,
  options: AuthClientOptions = {},
): Promise<AuthResult<SignInOutcome>> {
  const res = await callAuth(
    config,
    '/token?grant_type=password',
    {
      method: 'POST',
      headers: headersFor(config),
      body: JSON.stringify({ email: email.trim(), password }),
    },
    options,
  );
  if (!res.ok) {
    // GoTrue has used both `invalid_grant` (legacy) and `invalid_credentials`
    // (current) for bad logins — normalize both for the UI.
    const code = res.code === 'invalid_grant' ? 'invalid_credentials' : res.code;
    return failure(code, res.http_status, res.message);
  }

  const session = authSessionFromTokenResponse(res.data);
  if (session === null) {
    return failure('bad_response', res.http_status, 'token response missing required fields');
  }
  await store.save(session);
  return { ok: true, data: { session, refreshed: false }, http_status: res.http_status };
}

/** Exchanges the refresh token for a fresh session and persists it. */
export async function refreshSession(
  config: SupabaseEnvConfig,
  store: AuthSessionStore,
  refreshToken: string,
  options: AuthClientOptions = {},
): Promise<AuthResult<SignInOutcome>> {
  const res = await callAuth(
    config,
    '/token?grant_type=refresh_token',
    {
      method: 'POST',
      headers: headersFor(config),
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
    options,
  );
  if (!res.ok) {
    // Same normalization as sign-in: legacy `invalid_grant` and current
    // `invalid_credentials` both mean a dead login/refresh token.
    const code = res.code === 'invalid_grant' ? 'invalid_credentials' : res.code;
    return failure(code, res.http_status, res.message);
  }

  const session = authSessionFromTokenResponse(res.data);
  if (session === null) {
    return failure('bad_response', res.http_status, 'token response missing required fields');
  }
  await store.save(session);
  return { ok: true, data: { session, refreshed: true }, http_status: res.http_status };
}

/**
 * Returns a usable session: restores the stored one, refreshing it when it is
 * within the TTL margin (or already expired). A failed refresh clears the
 * stored session — the caller sees `signed_out` instead of a dead token.
 */
export async function getValidSession(
  config: SupabaseEnvConfig,
  store: AuthSessionStore,
  options: AuthClientOptions & { nowFn?: () => number } = {},
): Promise<AuthResult<SignInOutcome>> {
  const stored = await store.load();
  if (stored === null) {
    return failure('signed_out', null, 'no stored session');
  }

  const now = Math.floor((options.nowFn ?? Date.now)() / 1000);
  if (stored.expires_at - now > AUTH_TOKEN_TTL_MARGIN_SECONDS) {
    return { ok: true, data: { session: stored, refreshed: false }, http_status: 200 };
  }

  const refreshed = await refreshSession(config, store, stored.refresh_token, options);
  if (!refreshed.ok) {
    // A definitive 4xx rejection means the refresh token is dead → sign out.
    // Transient failures (network error, timeout, 5xx) keep the stored session
    // so an offline user is never logged out by a flaky connection.
    if (refreshed.http_status !== null && refreshed.http_status < 500) {
      await store.clear();
    }
    return failure(refreshed.code, refreshed.http_status, refreshed.message);
  }
  return refreshed;
}

/** Signs out (best-effort server revocation) and clears the local session. */
export async function signOut(
  config: SupabaseEnvConfig,
  store: AuthSessionStore,
  options: AuthClientOptions = {},
): Promise<AuthResult<{ ok: boolean }>> {
  const stored = await store.load();
  if (stored !== null) {
    // best-effort: callAuth never throws; local sign-out must never be blocked
    await callAuth(
      config,
      '/logout?scope=global',
      {
        method: 'POST',
        headers: { ...headersFor(config), Authorization: `Bearer ${stored.access_token}` },
        body: '{}',
      },
      options,
    );
  }
  await store.clear();
  return { ok: true, data: { ok: true }, http_status: 204 };
}
