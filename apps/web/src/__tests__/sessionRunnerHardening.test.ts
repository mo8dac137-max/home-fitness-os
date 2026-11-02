import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import type { Clock, IdGenerator } from '@hfos/ports';
import type { PrescriptionSnapshot } from '@hfos/contracts';
import { getEffectiveConfig } from '@hfos/config';
import { KeyValueStore } from '../storage/index.js';
import {
  createInitialRunnerState,
  sessionReducer,
  generateSessionEvents,
  saveSessionRunner,
  loadSessionRunner,
  clearSessionRunner,
  type SessionRunnerDeps,
  type SessionRunnerState,
} from '../engine/sessionRunner.js';

class FakeClock implements Clock {
  private currentMs: number;

  constructor(initialIso: string = '2026-11-02T10:00:00.000Z') {
    this.currentMs = Date.parse(initialIso);
  }

  public now(): Date {
    return new Date(this.currentMs);
  }

  public nowIso(): string {
    return new Date(this.currentMs).toISOString();
  }

  public nowTimestamp(): number {
    return this.currentMs;
  }

  public advanceSeconds(sec: number): void {
    this.currentMs += sec * 1000;
  }

  public advanceMinutes(min: number): void {
    this.currentMs += min * 60 * 1000;
  }
}

class SequentialIdGenerator implements IdGenerator {
  private count = 0;
  public generateId(): string {
    this.count++;
    return `018f6c38-89c0-7b56-8a5b-9d48b1bfc9${String(this.count).padStart(2, '0')}`;
  }
}

const mockSnapshot: PrescriptionSnapshot = {
  schema_version: 1,
  id: '018f6c38-89c0-7b56-8a5b-9d48b1bfc901',
  session_id: '018f6c38-89c0-7b56-8a5b-9d48b1bfc902',
  engine_version: '1.0.0',
  config_version: '1.0.0',
  created_at: '2026-11-02T09:00:00.000Z',
  rules: [],
  exercises: [
    {
      exercise_id: 'pushup_standard',
      sets: [
        {
          schema_version: 1,
          set_number: 1,
          target_reps: 10,
          target_rpe: 7.5,
          rest_seconds: 60,
        },
        {
          schema_version: 1,
          set_number: 2,
          target_reps: 10,
          target_rpe: 8.0,
          rest_seconds: 60,
        },
      ],
      rest_seconds: 90,
    },
    {
      exercise_id: 'pike_pushup',
      sets: [
        {
          schema_version: 1,
          set_number: 1,
          target_reps: 8,
          target_rpe: 8.0,
          rest_seconds: 60,
        },
      ],
      rest_seconds: 60,
    },
  ],
};

/**
 * Phase 2C hardening battery: pure reducer-level behavioral tests.
 * The reducer has no wall clock; all time is injected through FakeClock,
 * and stale-deadline behaviour is exercised through AUTO_ADVANCE (the
 * reducer's single idempotent "advance if deadline elapsed" transition).
 */
describe('Session Runner Hardening (Phase 2C)', () => {
  const config = getEffectiveConfig();

  const createDeps = (clock: FakeClock): SessionRunnerDeps => ({
    clock,
    idGenerator: new SequentialIdGenerator(),
    config,
    deviceId: 'test-device-redmi12',
  });

  it('1. stale AUTO_ADVANCE past rest deadline advances exactly like an expiry tick', () => {
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // warmup done -> rest 30s
    expect(state.phase).toBe('rest');
    expect(state.rest_deadline).toBeDefined();

    // Before the deadline: no-op
    clock.advanceSeconds(10);
    const fresh = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);
    expect(fresh.phase).toBe('rest');
    expect(fresh).toBe(state);

    // Past the deadline: advances exactly one phase
    clock.advanceSeconds(25); // now 35s > 30s deadline
    const advanced = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);
    expect(advanced.phase).toBe('exercise');
    expect(advanced.current_exercise_index).toBe(0);
    expect(advanced.current_set_index).toBe(0);
    expect(advanced.rest_deadline).toBeNull();
  });

  it('2. device slept through rest: one stale advance only, second is a no-op', () => {
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // rest 30s
    const setIndexBefore = state.current_set_index;

    // Sleep for an hour
    clock.advanceMinutes(60);
    state = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);

    expect(state.phase).toBe('exercise');
    expect(state.current_set_index).toBe(setIndexBefore);
    expect(state.rest_deadline).toBeNull();

    // A second stale advance must not double-advance
    const second = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);
    expect(second).toBe(state);
  });

  it('3. reload mid-rest with already-expired deadline advances on first tick', async () => {
    const kvStore = new KeyValueStore();
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // rest 30s
    await saveSessionRunner(kvStore, state);

    // Device away; deadline passes while persisted
    clock.advanceSeconds(60);
    const loaded: SessionRunnerState | null = await loadSessionRunner(kvStore);
    expect(loaded).not.toBeNull();
    expect(loaded!.phase).toBe('rest');
    expect(Date.parse(loaded!.rest_deadline!)).toBeLessThan(clock.nowTimestamp());

    const advanced = sessionReducer(loaded!, { type: 'AUTO_ADVANCE' }, deps);
    expect(advanced.phase).toBe('exercise');
    expect(advanced.rest_deadline).toBeNull();

    await clearSessionRunner(kvStore);
  });

  it('4. EXTEND_REST clamps total rest to rest_ceiling_seconds', () => {
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'SKIP_SET' }, deps); // skip warmup -> exercise
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // rest 60s
    expect(state.rest_duration_seconds).toBe(60);

    // +20s is inside headroom (180 - 60): applied exactly
    const deadlineAfterFirst = state.rest_deadline!;
    state = sessionReducer(state, { type: 'EXTEND_REST', seconds: 20 }, deps);
    expect(state.rest_duration_seconds).toBe(80);
    expect(Date.parse(state.rest_deadline!)).toBe(Date.parse(deadlineAfterFirst) + 20000);

    // +200s exceeds headroom (180 - 80 = 100): clamped to exactly the ceiling
    state = sessionReducer(state, { type: 'EXTEND_REST', seconds: 200 }, deps);
    expect(state.rest_duration_seconds).toBe(180);
    expect(state.rest_duration_seconds).toBeLessThanOrEqual(180);

    // Ceiling reached: further extension is a no-op returning the same reference
    const atCeiling = state;
    const refused = sessionReducer(state, { type: 'EXTEND_REST', seconds: 20 }, deps);
    expect(refused).toBe(atCeiling);
    expect(refused.rest_duration_seconds).toBe(180);
    expect(Date.parse(refused.rest_deadline!)).toBe(Date.parse(atCeiling.rest_deadline!));
  });

  it('5. EXTEND_REST never moves the deadline backwards', () => {
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'SKIP_SET' }, deps);
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // rest 60s
    const deadlineBefore = state.rest_deadline!;

    const rejected = sessionReducer(state, { type: 'EXTEND_REST', seconds: -15 }, deps);
    expect(rejected).toBe(state);
    expect(rejected.rest_deadline).toBe(deadlineBefore);
    expect(rejected.rest_duration_seconds).toBe(60);
  });

  it('6. partial-reps set event carries both done reps and target reps', () => {
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'SKIP_SET' }, deps); // -> exercise
    clock.advanceSeconds(40);
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 8, rpe: 8.5 }, deps);

    const events = generateSessionEvents(state, deps);
    const setEvent = events.find(
      (e) => e.type === 'session.set_logged' && (e.payload as { set_number: number }).set_number === 1
    );
    expect(setEvent).toBeDefined();
    const payload = setEvent!.payload as { reps: number; target_reps: number };
    expect(payload.reps).toBe(8);
    expect(payload.target_reps).toBe(10);
  });

  it('7. pain flag is recorded exactly once per set with unique idempotency keys', () => {
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'SKIP_SET' }, deps);
    clock.advanceSeconds(40);
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 10, pain: true }, deps);
    state = sessionReducer(state, { type: 'SKIP_REST' }, deps);
    clock.advanceSeconds(40);
    // Pain toggled on, off, on before completion: final value is what is recorded
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 10, pain: true }, deps);
    state = sessionReducer(state, { type: 'SKIP_REST' }, deps);
    clock.advanceSeconds(40);
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 8 }, deps);

    const events = generateSessionEvents(state, deps);
    const setEvents = events.filter((e) => e.type === 'session.set_logged');
    expect(setEvents).toHaveLength(3);

    const painTrue = setEvents.filter((e) => (e.payload as { pain: boolean }).pain === true);
    expect(painTrue).toHaveLength(2);

    const keys = setEvents.map((e) => e.idempotency_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('8. abandon mid-warmup and mid-rest records honest reason and freezes state', () => {
    const clock = new FakeClock();
    const deps = createDeps(clock);

    // (a) mid-warmup
    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'ABANDON', reason: 'felt dizzy' }, deps);
    expect(state.phase).toBe('done');
    expect(state.is_abandoned).toBe(true);
    expect(state.abandon_reason).toBe('felt dizzy');

    const frozen = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 10 }, deps);
    expect(frozen).toBe(state);

    // (b) mid-rest
    let state2 = createInitialRunnerState(mockSnapshot, 'B', deps);
    state2 = sessionReducer(state2, { type: 'START_SESSION' }, deps);
    state2 = sessionReducer(state2, { type: 'SKIP_SET' }, deps);
    state2 = sessionReducer(state2, { type: 'COMPLETE_SET', done_reps: 10 }, deps); // rest
    expect(state2.rest_deadline).not.toBeNull();

    state2 = sessionReducer(state2, { type: 'ABANDON', reason: 'joint discomfort' }, deps);
    expect(state2.is_abandoned).toBe(true);
    expect(state2.rest_deadline).toBeNull();

    const events = generateSessionEvents(state2, deps);
    const abandonedEv = events.find((e) => e.type === 'session.abandoned');
    expect(abandonedEv).toBeDefined();
    expect((abandonedEv!.payload as { reason: string; sets_completed: number })).toMatchObject({
      reason: 'joint discomfort',
      sets_completed: 1,
    });
  });

  it('9. double-finish is idempotent and generates no duplicate events', () => {
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'SKIP_SET' }, deps);
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 10 }, deps);

    state = sessionReducer(state, { type: 'FINISH' }, deps);
    expect(state.phase).toBe('done');

    const again = sessionReducer(state, { type: 'FINISH' }, deps);
    expect(again).toBe(state);

    const first = generateSessionEvents(state, deps);
    const second = generateSessionEvents(state, deps);
    expect(first).toHaveLength(second.length);
    expect(first.map((e) => e.idempotency_key)).toEqual(second.map((e) => e.idempotency_key));
  });

  it('10. cooldown auto-advance reaches done and persistence clears the snapshot', async () => {
    const kvStore = new KeyValueStore();
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'SKIP_SET' }, deps); // -> exercise
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // ex0 set0 -> rest
    state = sessionReducer(state, { type: 'SKIP_REST' }, deps);
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // ex0 set1 -> transition rest
    state = sessionReducer(state, { type: 'SKIP_REST' }, deps);
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // ex1 last set -> cooldown
    expect(state.phase).toBe('cooldown');
    await saveSessionRunner(kvStore, state);

    clock.advanceMinutes(5);
    state = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);
    expect(state.phase).toBe('done');
    expect(state.completed_at).toBe(clock.nowIso());
    expect(state.rest_deadline).toBeNull();

    // Persistence path: snapshot is removed once the session is terminal
    await clearSessionRunner(kvStore);
    const afterClear = await loadSessionRunner(kvStore);
    expect(afterClear).toBeNull();
  });

  it('11. every envelope of a full session satisfies the EventEnvelope contract', () => {
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // warmup
    clock.advanceSeconds(30);
    state = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);
    clock.advanceSeconds(40);
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 9 }, deps); // partial
    state = sessionReducer(state, { type: 'SKIP_REST' }, deps);
    clock.advanceSeconds(40);
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps);
    state = sessionReducer(state, { type: 'SKIP_REST' }, deps);
    clock.advanceSeconds(40);
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // -> cooldown
    clock.advanceMinutes(5);
    state = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);
    expect(state.phase).toBe('done');

    const events = generateSessionEvents(state, deps);
    // 1 started + 4 set_logged (1 warmup + 3 working) + 1 completed
    expect(events).toHaveLength(6);

    const allowedTypes = new Set([
      'session.started',
      'session.set_logged',
      'session.completed',
      'session.abandoned',
    ]);
    const eventIds = events.map((e) => e.event_id);
    const idempotencyKeys = events.map((e) => e.idempotency_key);

    for (const ev of events) {
      expect(ev.event_id).toBeTruthy();
      expect(ev.schema_version).toBe(1);
      expect(allowedTypes.has(ev.type)).toBe(true);
      expect(Number.isNaN(Date.parse(ev.occurred_at))).toBe(false);
      expect(ev.device_id).toBe('test-device-redmi12');
      expect(ev.idempotency_key).toBeTruthy();
      expect(ev.payload).toBeDefined();
    }
    expect(new Set(eventIds).size).toBe(eventIds.length);
    expect(new Set(idempotencyKeys).size).toBe(idempotencyKeys.length);
  });

  it('12. pause freezes absolute deadline math and resume preserves remaining rest', () => {
    const clock = new FakeClock();
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'SKIP_SET' }, deps);
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // rest 60s

    clock.advanceSeconds(20); // 40s remaining
    state = sessionReducer(state, { type: 'PAUSE' }, deps);
    expect(state.is_paused).toBe(true);
    expect(state.paused_remaining_ms).toBe(40000);

    // Phone away for 10 minutes while paused
    clock.advanceMinutes(10);

    state = sessionReducer(state, { type: 'RESUME' }, deps);
    expect(state.is_paused).toBe(false);
    expect(state.paused_remaining_ms).toBeUndefined();
    expect(state.rest_deadline).not.toBeNull();
    expect(Date.parse(state.rest_deadline!) - clock.nowTimestamp()).toBe(40000);
  });
});
