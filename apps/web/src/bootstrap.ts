import { MOCK_USER, type MockUserProfile } from '@hfos/sim';
import { KeyValueStore, IndexedDbEventLog } from './storage/index.js';
import {
  loadAppearance,
  applyAppearanceToDOM,
  type AppearanceSettings,
} from './appearance.js';

export const KV_KEY_PROFILE = 'mock_athlete_profile';
export const KV_KEY_ENV = 'mock_athlete_environment';
export const KV_KEY_HAS_LAUNCHED = 'hfos_has_launched';
export const KV_KEY_LANGUAGE = 'hfos_language';

export interface MockEnvironmentState {
  schema_version: number;
  items: Record<
    string,
    {
      item_id: string;
      status: 'unknown' | 'declared' | 'validated' | 'retired';
      updated_at: string;
    }
  >;
}

export const INITIAL_MOCK_ENV: MockEnvironmentState = {
  schema_version: 1,
  items: {
    floor: { item_id: 'floor', status: 'validated', updated_at: '2026-10-09T00:00:00.000Z' },
    wall: { item_id: 'wall', status: 'declared', updated_at: '2026-10-09T00:00:00.000Z' },
    door: { item_id: 'door', status: 'declared', updated_at: '2026-10-09T00:00:00.000Z' },
    chair: { item_id: 'chair', status: 'validated', updated_at: '2026-10-09T00:00:00.000Z' },
    loaded_backpack: { item_id: 'loaded_backpack', status: 'validated', updated_at: '2026-10-09T00:00:00.000Z' },
  },
};

/**
 * Ensures the MockUser and environment items are initialized in IndexedDB kv store.
 * Applies saved appearance settings before first paint to eliminate visual flash.
 */
export async function bootstrapMockUser(): Promise<{
  profile: MockUserProfile;
  env: MockEnvironmentState;
  isFirstEverLaunch: boolean;
  appearance: AppearanceSettings;
}> {
  const kv = new KeyValueStore();

  // Load and apply appearance settings to documentElement immediately
  const appearance = await loadAppearance();
  applyAppearanceToDOM(appearance);

  const hasLaunched = await kv.get<boolean>(KV_KEY_HAS_LAUNCHED);
  const isFirstEverLaunch = !hasLaunched;

  let profile = await kv.get<MockUserProfile>(KV_KEY_PROFILE);
  if (!profile) {
    profile = { ...MOCK_USER };
    await kv.set(KV_KEY_PROFILE, profile);
  }

  let env = await kv.get<MockEnvironmentState>(KV_KEY_ENV);
  if (!env) {
    env = { ...INITIAL_MOCK_ENV };
    await kv.set(KV_KEY_ENV, env);
  }

  if (isFirstEverLaunch) {
    await kv.set(KV_KEY_HAS_LAUNCHED, true);
  }

  return { profile, env, isFirstEverLaunch, appearance };
}

/**
 * Purges events and re-seeds mock data in IndexedDB.
 */
export async function resetMockData(): Promise<void> {
  const kv = new KeyValueStore();
  const eventLog = new IndexedDbEventLog();

  await eventLog.clear();
  await kv.set(KV_KEY_PROFILE, { ...MOCK_USER });
  await kv.set(KV_KEY_ENV, { ...INITIAL_MOCK_ENV });
}
