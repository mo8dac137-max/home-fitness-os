import type { SupabaseEnvConfig } from './env.js';

export interface CloudProbeResult {
  /** true only when the auth health endpoint returned a 2xx response. */
  online: boolean;
  /** Round-trip latency in ms for successful probes, null otherwise. */
  latency_ms: number | null;
  /** HTTP status when a response was received, null on network failure. */
  http_status: number | null;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProbeOptions {
  fetchImpl?: FetchLike;
  nowFn?: () => number;
  timeoutMs?: number;
}

/**
 * Lightweight liveness probe against the project's auth health endpoint
 * (`GET /auth/v1/health` with the publishable key as `apikey`).
 *
 * Phase 4A needs connectivity truth only — plain fetch, no supabase-js yet.
 * All I/O (fetch, clock, timeout) is injected, so tests are deterministic.
 */
export async function probeCloudConnection(
  config: SupabaseEnvConfig,
  options: ProbeOptions = {}
): Promise<CloudProbeResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowFn = options.nowFn ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 8000;

  const healthUrl = `${config.url.replace(/\/+$/, '')}/auth/v1/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = nowFn();

  try {
    const res = await fetchImpl(healthUrl, {
      headers: { apikey: config.publishableKey },
      signal: controller.signal,
    });
    const latency = nowFn() - startedAt;
    return {
      online: res.ok,
      latency_ms: res.ok ? latency : null,
      http_status: res.status,
    };
  } catch {
    return { online: false, latency_ms: null, http_status: null };
  } finally {
    clearTimeout(timer);
  }
}
