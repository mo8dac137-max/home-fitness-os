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

describe('E1b honesty: persistent device id + real decision summaries', () => {
  beforeEach(async () => {
    closeDatabase();
    indexedDB.deleteDatabase(DB_NAME);
  });

  afterEach(() => {
    closeDatabase();
  });

  const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('plan events carry a persistent UUIDv7 device id, never a hard-coded label', async () => {
    const clock = new MockClock('2026-10-12T18:00:00Z');
    const idGen = new MockIdGenerator();
    const eventLog = new IndexedDbEventLog();
    const kv = new KeyValueStore();
    const service = new PlanService({ clock, idGenerator: idGen, eventLog, kvStore: kv });

    await service.getOrCreatePlan(clock.now());

    const [generated] = await eventLog.getByType('plan.generated');
    if (!generated) throw new Error('plan.generated event missing');
    expect(generated.device_id).toMatch(UUID_V7_RE);
    expect(generated.device_id).not.toBe('redmi12_client');

    // The same id is persisted in the kv store
    await expect(kv.get<string>('hfos.device_id')).resolves.toBe(generated.device_id);

    // A second service sharing the kv store reuses the SAME device id
    const kv2 = new KeyValueStore();
    await kv2.delete(KV_KEY_PLAN_CURRENT); // force regeneration
    const service2 = new PlanService({ clock, idGenerator: idGen, eventLog, kvStore: kv2 });
    await service2.getOrCreatePlan(clock.now());
    const all = await eventLog.getByType('plan.generated');
    expect(all.length).toBe(2);
    expect(all[1]!.device_id).toBe(generated.device_id);
  });

  it('decision summaries use the engine unit and derive reasons from the DecisionRecord', async () => {
    const clock = new MockClock('2026-10-12T18:00:00Z');
    const idGen = new MockIdGenerator();
    const service = new PlanService({ clock, idGenerator: idGen });
    const { plan, decisions } = await service.getOrCreatePlan(clock.now());

    const REASON_KEYS = new Set([
      'reason.stimulus_gap', 'reason.priority_need', 'reason.progression_need',
      'reason.goal_weight', 'reason.schedule_fit', 'reason.readiness',
      'reason_day.scheduled_main', 'reason_day.no_window', 'reason_day.window_too_short',
      'reason_day.quota_reached', 'reason_day.consecutive_cap', 'reason_day.recovery_spacing',
      'reason_day.micro_window', 'reason_day.active_recovery_cap', 'reason_day.rest',
    ]);

    for (const day of plan.days) {
      const summary = decisions[day.day_index]!;
      // Unit comes from the engine (PlanDay.unit), not from day parity
      expect(summary.unit).toBe(day.unit ?? 'rest');
      // inputs_defaulted mirrors the plan-level honesty record
      expect(summary.inputs_defaulted).toEqual(plan.inputs_defaulted ?? []);

      if (day.kind === 'main' && day.decision?.selection) {
        expect(summary.top_reasons.length).toBeGreaterThan(0);
        for (const line of summary.top_reasons) {
          expect(REASON_KEYS.has(line.key)).toBe(true);
          if (line.value !== undefined) {
            expect(Number.isInteger(line.value)).toBe(true);
            expect(line.value).toBeGreaterThanOrEqual(0);
            expect(line.value).toBeLessThanOrEqual(100);
          }
        }
        // The rendered values are the day's REAL top-3 term contributions
        const selection = day.decision.selection as { exercise_id?: string } | null;
        const prefix = typeof selection?.exercise_id === 'string' ? selection.exercise_id : '';
        const knownTerms = [
          'stimulus_gap', 'priority_need', 'progression_need',
          'schedule_fit', 'readiness', 'goal_weight',
        ] as const;
        const allValues = knownTerms
          .map((term) => day.decision!.term_values[`${prefix}:${term}`])
          .filter((v): v is number => typeof v === 'number');
        const expectedTop3 = [...allValues].sort((a, b) => b - a).slice(0, 3).map((v) => Math.round(v * 100));
        expect(summary.top_reasons.map((l) => l.value)).toEqual(expectedTop3);
      } else {
        // Non-main days explain themselves via reason_day.* keys
        expect(summary.top_reasons.length).toBe(1);
        expect(summary.top_reasons[0]!.key.startsWith('reason_day.')).toBe(true);
      }
    }
  });

  it('revision_reason passes through from the day record instead of a hard-coded value', async () => {
    const clock = new MockClock('2026-10-12T18:00:00Z'); // Monday
    const idGen = new MockIdGenerator();
    const service = new PlanService({ clock, idGenerator: idGen });

    await service.getOrCreatePlan(clock.now());
    clock.advanceDays(1);
    const { plan, decisions } = await service.getOrCreatePlan(clock.now());

    for (const day of plan.days) {
      const summary = decisions[day.day_index]!;
      expect(summary.revision_reason ?? undefined).toBe(day.revision_reason ?? undefined);
    }
    // No summary may claim a revision that the day itself does not record
    const claimed = Object.values(decisions).filter((s) => s.revision_reason !== undefined);
    for (const s of claimed) {
      expect(plan.days[s.day_index]!.revision_reason).toBe(s.revision_reason);
    }
  });
});

