/**
 * Supabase environment plumbing (Phase 4A).
 *
 * Values never live in source: they come from `.env` (gitignored) through
 * Vite's `import.meta.env` at build time. Missing or invalid configuration
 * must degrade honestly — the app stays fully functional offline-first and
 * the CloudSyncCard reports "not configured" instead of crashing.
 */

export interface SupabaseEnvConfig {
  /** Project URL, origin-normalized (no trailing slash). */
  url: string;
  /** Publishable (public) key. Safe to embed in a client bundle; RLS-protected. */
  publishableKey: string;
}

export type SupabaseEnvResult =
  | { ok: true; config: SupabaseEnvConfig }
  | { ok: false; reason: 'missing' | 'invalid_url' };

const ENV_URL_KEY = 'VITE_SUPABASE_URL';
const ENV_KEY_NAME = 'VITE_SUPABASE_PUBLISHABLE_KEY';

function isLocalhost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

/**
 * Reads and validates Supabase configuration from an env-like record.
 * Defaults to `import.meta.env`; tests inject plain objects.
 */
export function readSupabaseEnv(
  env: Record<string, string | undefined> = import.meta.env
): SupabaseEnvResult {
  const url = (env[ENV_URL_KEY] ?? '').trim();
  const publishableKey = (env[ENV_KEY_NAME] ?? '').trim();

  if (url === '' || publishableKey === '') {
    return { ok: false, reason: 'missing' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }

  // Production endpoints must be https; local dev stacks (supabase start)
  // are allowed to use plain http on loopback hosts only.
  if (parsed.protocol !== 'https:' && !isLocalhost(parsed.hostname)) {
    return { ok: false, reason: 'invalid_url' };
  }

  return { ok: true, config: { url: parsed.origin, publishableKey } };
}
