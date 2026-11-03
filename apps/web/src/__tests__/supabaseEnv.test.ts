import { describe, it, expect } from 'vitest';
import { readSupabaseEnv } from '../supabase/env.js';

/**
 * Phase 4A: Supabase env plumbing must validate configuration honestly and
 * never throw at import/call time — missing or invalid config degrades to a
 * typed result the UI can render as a truthful status.
 */
describe('readSupabaseEnv', () => {
  it('returns ok with an origin-normalized url for a valid https config', () => {
    const res = readSupabaseEnv({
      VITE_SUPABASE_URL: 'https://tbyqtmgxomznpemkkaee.supabase.co/',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config.url).toBe('https://tbyqtmgxomznpemkkaee.supabase.co');
      expect(res.config.publishableKey).toBe('sb_publishable_test');
    }
  });

  it('accepts plain http only for loopback dev stacks', () => {
    const local = readSupabaseEnv({
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'k',
    });
    const remote = readSupabaseEnv({
      VITE_SUPABASE_URL: 'http://insecure.example.com',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'k',
    });
    expect(local.ok).toBe(true);
    expect(remote).toEqual({ ok: false, reason: 'invalid_url' });
  });

  it('reports missing when the url or the key are absent or blank', () => {
    expect(readSupabaseEnv({})).toEqual({ ok: false, reason: 'missing' });
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })
    ).toEqual({ ok: false, reason: 'missing' });
    expect(readSupabaseEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toEqual({
      ok: false,
      reason: 'missing',
    });
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })
    ).toEqual({ ok: false, reason: 'missing' });
  });

  it('reports invalid_url for unparseable urls', () => {
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: 'not-a-url', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })
    ).toEqual({ ok: false, reason: 'invalid_url' });
  });
});
