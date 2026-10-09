import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  IndexedDbEventLog,
  KeyValueStore,
  closeDatabase,
  DB_NAME,
} from '../index.js';
import type { EventEnvelope } from '@hfos/events';

describe('IndexedDB Storage Layer', () => {
  beforeEach(async () => {
    closeDatabase();
    indexedDB.deleteDatabase(DB_NAME);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('IndexedDbEventLog appends events and returns them sorted by occurred_at then event_id', async () => {
    const log = new IndexedDbEventLog();

    const e1: EventEnvelope = {
      event_id: '018f6c38-89c0-7b56-8a5b-000000000002',
      type: 'session.started',
      occurred_at: '2026-10-09T10:00:00.000Z',
      device_id: 'device_1',
      idempotency_key: 'key_2',
      schema_version: 1,
      payload: {},
    };

    const e2: EventEnvelope = {
      event_id: '018f6c38-89c0-7b56-8a5b-000000000001',
      type: 'readiness.recorded',
      occurred_at: '2026-10-09T08:00:00.000Z',
      device_id: 'device_1',
      idempotency_key: 'key_1',
      schema_version: 1,
      payload: {},
    };

    const e3: EventEnvelope = {
      event_id: '018f6c38-89c0-7b56-8a5b-000000000003',
      type: 'session.completed',
      occurred_at: '2026-10-09T10:00:00.000Z',
      device_id: 'device_1',
      idempotency_key: 'key_3',
      schema_version: 1,
      payload: {},
    };

    await log.append(e1);
    await log.append(e2);
    await log.append(e3);

    const all = await log.getAll();
    expect(all).toHaveLength(3);

    // e2 happened earliest (08:00)
    expect(all[0]?.event_id).toBe(e2.event_id);
    // e1 and e3 happened at the same time (10:00), e1 has lower event_id ending in 0002 vs 0003
    expect(all[1]?.event_id).toBe(e1.event_id);
    expect(all[2]?.event_id).toBe(e3.event_id);
  });

  it('IndexedDbEventLog ignores duplicate idempotency_key', async () => {
    const log = new IndexedDbEventLog();

    const e1: EventEnvelope = {
      event_id: '018f6c38-89c0-7b56-8a5b-000000000010',
      type: 'session.started',
      occurred_at: '2026-10-09T10:00:00.000Z',
      device_id: 'device_1',
      idempotency_key: 'dup_key',
      schema_version: 1,
      payload: { attempt: 1 },
    };

    const e2: EventEnvelope = {
      event_id: '018f6c38-89c0-7b56-8a5b-000000000011',
      type: 'session.started',
      occurred_at: '2026-10-09T10:05:00.000Z',
      device_id: 'device_1',
      idempotency_key: 'dup_key', // Same idempotency key!
      schema_version: 1,
      payload: { attempt: 2 },
    };

    await log.append(e1);
    await log.append(e2); // Should be silently ignored

    const count = await log.count();
    expect(count).toBe(1);

    const events = await log.getAll();
    expect(events).toHaveLength(1);
    expect(events[0]?.event_id).toBe(e1.event_id);
  });

  it('persists data across closing and re-opening the database', async () => {
    const log1 = new IndexedDbEventLog();
    const kv1 = new KeyValueStore();

    const e: EventEnvelope = {
      event_id: '018f6c38-89c0-7b56-8a5b-000000000099',
      type: 'plan.generated',
      occurred_at: '2026-10-09T11:00:00.000Z',
      device_id: 'device_1',
      idempotency_key: 'persistent_key',
      schema_version: 1,
      payload: {},
    };

    await log1.append(e);
    await kv1.set('test_setting', { active: true, count: 42 });

    // Close database connection
    closeDatabase();

    // Re-open with new instances
    const log2 = new IndexedDbEventLog();
    const kv2 = new KeyValueStore();

    const allEvents = await log2.getAll();
    expect(allEvents).toHaveLength(1);
    expect(allEvents[0]?.event_id).toBe(e.event_id);

    const val = await kv2.get<{ active: boolean; count: number }>('test_setting');
    expect(val).toEqual({ active: true, count: 42 });
  });

  it('KeyValueStore handles get, set, delete, and getAllKeys', async () => {
    const kv = new KeyValueStore();

    expect(await kv.get('missing')).toBeNull();

    await kv.set('user_name', 'MockAthlete');
    expect(await kv.get<string>('user_name')).toBe('MockAthlete');

    await kv.set('profile', { level: 3 });
    expect(await kv.get<{ level: number }>('profile')).toEqual({ level: 3 });

    const keys = await kv.getAllKeys();
    expect(keys).toContain('user_name');
    expect(keys).toContain('profile');

    await kv.delete('user_name');
    expect(await kv.get('user_name')).toBeNull();
  });
});
