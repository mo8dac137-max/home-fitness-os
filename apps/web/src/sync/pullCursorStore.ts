import { KeyValueStore } from '../storage/KeyValueStore.js';
import type { PullCursorPort } from './syncService.js';

/**
 * Phase 4D10: IndexedDB-backed pull cursor persistence, namespaced per user.
 *
 * The cursor is the newest server-assigned `synced_at` this device has
 * already merged (server clock — see syncService). Like the device key
 * record, it is intentionally NOT cleared on sign-out: signing back in
 * resumes incremental pulls instead of paying one full pull, and the
 * per-user key namespace means an account switch can never inherit another
 * account's cursor. A stale key costs a few bytes.
 */

export const PULL_CURSOR_PREFIX = 'hfos.pull_cursor.';

export interface PullCursorStore extends PullCursorPort {
  /** Removes the stored cursor for the user (tidy-up only, never required). */
  clear(userId: string): Promise<void>;
}

export class KeyValuePullCursorStore implements PullCursorStore {
  private readonly kv: KeyValueStore;

  constructor(kv: KeyValueStore) {
    this.kv = kv;
  }

  async load(userId: string): Promise<string | null> {
    const raw = await this.kv.get<unknown>(PULL_CURSOR_PREFIX + userId);
    // defensive: a corrupted value must degrade to a full pull, never crash
    return typeof raw === 'string' && Number.isFinite(Date.parse(raw)) ? raw : null;
  }

  async save(userId: string, iso: string): Promise<void> {
    await this.kv.set(PULL_CURSOR_PREFIX + userId, iso);
  }

  async clear(userId: string): Promise<void> {
    await this.kv.delete(PULL_CURSOR_PREFIX + userId);
  }
}
