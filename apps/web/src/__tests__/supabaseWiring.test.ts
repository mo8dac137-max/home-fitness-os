import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Architectural guard (Phase 4A): the cloud sync card must probe the real
 * configured project endpoint, render every user-facing string through i18n,
 * and the repository must never carry real credentials (only .env.example
 * placeholders; .env stays gitignored).
 */
describe('Cloud Sync Wiring Guard', () => {
  const read = (rel: string): string =>
    fs.readFileSync(path.resolve(__dirname, rel), 'utf-8');

  it('MoreScreen renders CloudSyncCard in the About diagnostics view', () => {
    const screen = read('../screens/MoreScreen.tsx');
    expect(screen).toContain("import { CloudSyncCard } from '../components/CloudSyncCard.js';");
    expect(screen).toContain('<CloudSyncCard />');
  });

  it('card probes the real endpoint and renders status via i18n only', () => {
    const card = read('../components/CloudSyncCard.tsx');
    expect(card).toContain('readSupabaseEnv()');
    expect(card).toContain('probeCloudConnection(');
    expect(card).toContain("t('sync.title')");
    expect(card).toContain("t('sync.subtitle')");
    // Status labels resolve through the typed STATUS_LABEL_KEY record
    expect(card).toContain("'sync.status_online'");
    expect(card).toContain('STATUS_LABEL_KEY');
    expect(card).toContain("t('sync.latency_ms')");
    // No hard-coded user-facing strings (all copy comes from the dictionaries)
    expect(card).not.toMatch(/Connected|Unreachable|Not configured|Checking…/);
  });

  it('.env.example documents both vars and .env stays gitignored', () => {
    const example = read('../../../../.env.example');
    expect(example).toContain('VITE_SUPABASE_URL=');
    expect(example).toContain('VITE_SUPABASE_PUBLISHABLE_KEY=');
    const gitignore = read('../../../../.gitignore');
    expect(gitignore).toContain('.env*');
    expect(gitignore).toContain('!.env.example');
  });
});
