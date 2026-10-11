import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { PlanService, KV_KEY_PLAN_CURRENT } from '../engine/planService.js';
import { closeDatabase, DB_NAME, KeyValueStore, IndexedDbEventLog } from '../storage/index.js';
import { MockClock, MockIdGenerator } from '@hfos/sim';
import { LocalScheduleProvider } from '@hfos/ports';
import { DEFAULT_WEEKLY_WINDOWS } from '../engine/engineContext.js';

describe('PlanService & Engine Horizon Wiring (M1-B1)', () => {
  beforeEach(async () => {
    closeDatabase();
    indexedDB.deleteDatabase(DB_NAME);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('same inputs produce same deterministic plan structure', async () => {
    const clock = new MockClock('2026-10-12T18:00:00Z');
    const idGen1 = new MockIdGenerator();
    const idGen2 = new MockIdGenerator();
    const sched = new LocalScheduleProvider(DEFAULT_WEEKLY_WINDOWS);

    const service1 = new PlanService({
      clock,
      idGenerator: idGen1,
      scheduleProvider: sched,
    });
    const result1 = await service1.getOrCreatePlan(clock.now());

    // Clear KV to re-generate from scratch with same inputs
    const kv = new KeyValueStore();
    await kv.delete(KV_KEY_PLAN_CURRENT);

    const service2 = new PlanService({
      clock,
      idGenerator: idGen2,
      scheduleProvider: sched,
    });
    const result2 = await service2.getOrCreatePlan(clock.now());

    expect(result1.plan.horizon_days).toBe(7);
    expect(result2.plan.horizon_days).toBe(7);

    // Days structure and kinds match exactly
    expect(result1.plan.days.map((d) => ({ index: d.day_index, kind: d.kind, status: d.status }))).toEqual(
      result2.plan.days.map((d) => ({ index: d.day_index, kind: d.kind, status: d.status }))
    );
  });

  it('reload restores the persisted plan from kv store without generating a new one', async () => {
    const clock = new MockClock('2026-10-12T18:00:00Z');
    const idGen = new MockIdGenerator();
    const eventLog = new IndexedDbEventLog();
    const kv = new KeyValueStore();

    const service = new PlanService({ clock, idGenerator: idGen, eventLog, kvStore: kv });
    const initial = await service.getOrCreatePlan(clock.now());

    const planEventsBefore = await eventLog.getByType('plan.generated');
    expect(planEventsBefore.length).toBe(1);

    // Call again with same clock time
    const reloaded = await service.getOrCreatePlan(clock.now());
    expect(reloaded.plan.id).toBe(initial.plan.id);

    // No duplicate plan.generated event
    const planEventsAfter = await eventLog.getByType('plan.generated');
    expect(planEventsAfter.length).toBe(1);
  });

  it('sliding clock by one day drops Day 0 and appends a new Day 6', async () => {
    const clock = new MockClock('2026-10-12T18:00:00Z'); // Monday
    const idGen = new MockIdGenerator();
    const eventLog = new IndexedDbEventLog();
    const kv = new KeyValueStore();

    const service = new PlanService({ clock, idGenerator: idGen, eventLog, kvStore: kv });
    const day1Result = await service.getOrCreatePlan(clock.now());

    const initialDay0Date = day1Result.plan.days[0]!.date;
    const initialDay1Date = day1Result.plan.days[1]!.date;

    // Advance clock by 1 full day
    clock.advanceDays(1); // Tuesday

    const day2Result = await service.getOrCreatePlan(clock.now());

    expect(day2Result.plan.days.length).toBe(7);

    // New Day 0 has the date of old Day 1, and initial Day 0 date is dropped
    expect(initialDay0Date).toBeDefined();
    expect(day2Result.plan.days[0]!.date).toBe(initialDay1Date);
    expect(day2Result.plan.days.map((d) => d.date)).not.toContain(initialDay0Date);
    expect(day2Result.plan.days[0]!.status).toBe('locked');
    expect(day2Result.plan.days[1]!.status).toBe('protected');

    // Emitted plan.revised event
    const revisedEvents = await eventLog.getByType('plan.revised');
    expect(revisedEvents.length).toBe(1);
  });

  it('adaptive days do not flap when inputs are unchanged', async () => {
    const clock = new MockClock('2026-10-12T18:00:00Z');
    const idGen = new MockIdGenerator();
    const service = new PlanService({ clock, idGenerator: idGen });

    const first = await service.getOrCreatePlan(clock.now());
    const second = await service.getOrCreatePlan(clock.now());

    // Days 2 to 6 are identical
    for (let i = 2; i < 7; i++) {
      expect(first.plan.days[i]!.kind).toBe(second.plan.days[i]!.kind);
      expect(first.plan.days[i]!.status).toBe(second.plan.days[i]!.status);
      expect(first.plan.days[i]!.date).toBe(second.plan.days[i]!.date);
    }
  });

  it('event log contains plan.generated then plan.revised only when needed', async () => {
    const clock = new MockClock('2026-10-12T18:00:00Z');
    const idGen = new MockIdGenerator();
    const eventLog = new IndexedDbEventLog();
    const service = new PlanService({ clock, idGenerator: idGen, eventLog });

    await service.getOrCreatePlan(clock.now());
    let allEvents = await eventLog.getAll();
    expect(allEvents.map((e) => e.type)).toEqual(['plan.generated']);

    // Same time: no events added
    await service.getOrCreatePlan(clock.now());
    allEvents = await eventLog.getAll();
    expect(allEvents.length).toBe(1);

    // Slide day
    clock.advanceDays(1);
    await service.getOrCreatePlan(clock.now());
    allEvents = await eventLog.getAll();
    expect(allEvents.map((e) => e.type)).toEqual(['plan.generated', 'plan.revised']);
  });

  it('plan generation benchmark executes well under 50ms', async () => {
    const clock = new MockClock('2026-10-12T18:00:00Z');
    const idGen = new MockIdGenerator();
    const service = new PlanService({ clock, idGenerator: idGen });

    // Warm-up call
    await service.getOrCreatePlan(clock.now());

    // Fresh generation benchmark
    const kv = new KeyValueStore();
    await kv.delete(KV_KEY_PLAN_CURRENT);

    const start = performance.now();
    const result = await service.getOrCreatePlan(clock.now());
    const duration = performance.now() - start;

    expect(result.plan.days.length).toBe(7);
    expect(duration).toBeLessThan(50);
  });
});

