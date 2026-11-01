import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import type { Clock, IdGenerator } from '@hfos/ports';
import type { PrescriptionSnapshot } from '@hfos/contracts';
import { getEffectiveConfig } from '@hfos/config';
import { deriveTrainingState } from '@hfos/engine-core';
import { KeyValueStore } from '../storage/index.js';
import {
  createInitialRunnerState,
  sessionReducer,
  generateSessionEvents,
  saveSessionRunner,
  loadSessionRunner,
  clearSessionRunner,
  computeRestDuration,
  type SessionRunnerDeps,
} from '../engine/sessionRunner.js';

class FakeClock implements Clock {
  private currentMs: number;

  constructor(initialIso: string = '2026-11-01T10:00:00.000Z') {
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
    return `018f6c38-89c0-7b56-8a5b-9d48b1bfb9${String(this.count).padStart(2, '0')}`;
  }
}

const mockSnapshot: PrescriptionSnapshot = {
  schema_version: 1,
  id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb901',
  session_id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb902',
  engine_version: '1.0.0',
  config_version: '1.0.0',
  created_at: '2026-11-01T09:00:00.000Z',
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

describe('Session Runner Core Logic (Phase 2A)', () => {
  const config = getEffectiveConfig();

  const createDeps = (clock: FakeClock): SessionRunnerDeps => ({
    clock,
    idGenerator: new SequentialIdGenerator(),
    config,
    deviceId: 'test-device-redmi12',
  });

  it('1. happy path: warmup -> exercise sets -> rest auto-advance -> cooldown -> done', () => {
    const clock = new FakeClock('2026-11-01T10:00:00.000Z');
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    expect(state.phase).toBe('warmup');
    expect(state.total_warmup_sets).toBe(1);

    // Start session
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    expect(state.session_started_at).toBe('2026-11-01T10:00:00.000Z');

    // Complete warmup set
    clock.advanceSeconds(45);
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 12 }, deps);
    expect(state.phase).toBe('rest');
    expect(state.set_records).toHaveLength(1);
    expect(state.set_records[0]!.is_warmup).toBe(true);
    expect(state.set_records[0]!.done_reps).toBe(12);
    expect(state.rest_deadline).toBeDefined();

    // Auto-advance rest to first working exercise
    clock.advanceSeconds(60);
    state = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);
    expect(state.phase).toBe('exercise');
    expect(state.current_exercise_index).toBe(0);
    expect(state.current_set_index).toBe(0);

    // Working Exercise 0, Set 0: partial reps (done_reps 8 < target 10)
    clock.advanceSeconds(40);
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 8, rpe: 8.5 }, deps);
    expect(state.phase).toBe('rest');
    expect(state.current_set_index).toBe(1);
    expect(state.set_records).toHaveLength(2);
    expect(state.set_records[1]!.done_reps).toBe(8);
    expect(state.set_records[1]!.target_reps).toBe(10);
    expect(state.set_records[1]!.rpe).toBe(8.5);

    // Extend rest by +20s
    const oldDeadline = state.rest_deadline!;
    state = sessionReducer(state, { type: 'EXTEND_REST', seconds: 20 }, deps);
    expect(Date.parse(state.rest_deadline!)).toBe(Date.parse(oldDeadline) + 20000);

    // Auto-advance rest to Set 1
    clock.advanceSeconds(100);
    state = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);
    expect(state.phase).toBe('exercise');
    expect(state.current_set_index).toBe(1);

    // Working Exercise 0, Set 1: flag pain=true
    clock.advanceSeconds(40);
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 10, pain: true }, deps);
    expect(state.phase).toBe('rest');
    expect(state.current_exercise_index).toBe(1); // advanced to next exercise
    expect(state.current_set_index).toBe(0);
    expect(state.set_records[2]!.pain).toBe(true);

    // Skip rest between exercises
    state = sessionReducer(state, { type: 'SKIP_REST' }, deps);
    expect(state.phase).toBe('exercise');
    expect(state.current_exercise_index).toBe(1);

    // Working Exercise 1, Set 0 (last set of the session)
    clock.advanceSeconds(40);
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 8, rpe: 8.0 }, deps);

    // Because cooldown_duration_minutes is 5, transitions to 'cooldown'
    expect(state.phase).toBe('cooldown');
    expect(state.rest_deadline).toBeDefined();

    // Advance 5 minutes for cooldown completion
    clock.advanceMinutes(5);
    state = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);
    expect(state.phase).toBe('done');
    expect(state.completed_at).toBe(clock.nowIso());

    // Generate emitted events and verify structure
    const events = generateSessionEvents(state, deps);
    expect(events.length).toBeGreaterThanOrEqual(4); // started + 1 warmup + 2 working + 1 completed

    const startedEv = events.find((e) => e.type === 'session.started');
    expect(startedEv).toBeDefined();
    expect((startedEv!.payload as { training_unit: string }).training_unit).toBe('A');

    const completedEv = events.find((e) => e.type === 'session.completed');
    expect(completedEv).toBeDefined();
    expect((completedEv!.payload as { sets_count: number }).sets_count).toBe(3); // 3 working sets

    // Check deriveTrainingState integration
    const trainingState = deriveTrainingState(events, clock.nowIso(), config);
    expect(trainingState.last_session_unit).toBe('A');
    expect(trainingState.last_stimulus_at_by_pattern?.horizontal_push).toBeDefined();
    expect(trainingState.weekly_sets_by_muscle?.chest).toBeGreaterThanOrEqual(1);
    expect(trainingState.pain_flags).toContain('horizontal_push');
  });

  it('2. rest auto-advance and skip-rest behavior', () => {
    const clock = new FakeClock('2026-11-01T10:00:00.000Z');
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);

    // Complete warmup
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps);
    expect(state.phase).toBe('rest');

    // Before deadline, auto-advance does nothing
    clock.advanceSeconds(10);
    const beforeAdvance = sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps);
    expect(beforeAdvance.phase).toBe('rest');

    // Skip rest immediately advances
    const skipped = sessionReducer(state, { type: 'SKIP_REST' }, deps);
    expect(skipped.phase).toBe('exercise');
    expect(skipped.rest_deadline).toBeNull();
  });

  it('3. pause and resume across simulated reload', () => {
    const clock = new FakeClock('2026-11-01T10:00:00.000Z');
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'A', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'SKIP_SET' }, deps); // skip warmup -> exercise
    state = sessionReducer(state, { type: 'COMPLETE_SET' }, deps); // into rest (e.g. 60s)

    expect(state.phase).toBe('rest');
    const initialDeadlineMs = Date.parse(state.rest_deadline!);

    // Advance 20s, then pause
    clock.advanceSeconds(20);
    state = sessionReducer(state, { type: 'PAUSE' }, deps);
    expect(state.is_paused).toBe(true);
    expect(state.paused_remaining_ms).toBe(initialDeadlineMs - clock.nowTimestamp());

    // Simulate reload: serialize and deserialize JSON
    const serialized = JSON.stringify(state);
    let reloadedState = JSON.parse(serialized) as typeof state;

    // While paused, clock advances 5 minutes (user puts phone down)
    clock.advanceMinutes(5);

    // Resume
    reloadedState = sessionReducer(reloadedState, { type: 'RESUME' }, deps);
    expect(reloadedState.is_paused).toBe(false);
    expect(reloadedState.rest_deadline).toBeDefined();

    // The remaining duration should be precisely preserved from when paused
    const newDeadlineMs = Date.parse(reloadedState.rest_deadline!);
    expect(newDeadlineMs - clock.nowTimestamp()).toBe(state.paused_remaining_ms);
  });

  it('4. abandon records honest event with reason and completed count', () => {
    const clock = new FakeClock('2026-11-01T10:00:00.000Z');
    const deps = createDeps(clock);

    let state = createInitialRunnerState(mockSnapshot, 'B', deps);
    state = sessionReducer(state, { type: 'START_SESSION' }, deps);
    state = sessionReducer(state, { type: 'SKIP_SET' }, deps); // skip warmup
    state = sessionReducer(state, { type: 'COMPLETE_SET', done_reps: 10 }, deps); // 1 set

    // Abandon session
    clock.advanceSeconds(30);
    state = sessionReducer(
      state,
      { type: 'ABANDON', reason: 'knee discomfort during warmup' },
      deps
    );

    expect(state.phase).toBe('done');
    expect(state.is_abandoned).toBe(true);
    expect(state.abandon_reason).toBe('knee discomfort during warmup');

    const events = generateSessionEvents(state, deps);
    const abandonedEv = events.find((e) => e.type === 'session.abandoned');
    expect(abandonedEv).toBeDefined();
    expect((abandonedEv!.payload as { reason: string }).reason).toBe(
      'knee discomfort during warmup'
    );
    expect((abandonedEv!.payload as { sets_completed: number }).sets_completed).toBe(1);
  });

  it('5. persistence in KeyValueStore survives reload and clears on finish', async () => {
    const kvStore = new KeyValueStore();
    const clock = new FakeClock('2026-11-01T10:00:00.000Z');
    const deps = createDeps(clock);

    const state = createInitialRunnerState(mockSnapshot, 'A', deps);
    await saveSessionRunner(kvStore, state);

    const loaded = await loadSessionRunner(kvStore);
    expect(loaded).toBeDefined();
    expect(loaded?.session_id).toBe(state.session_id);
    expect(loaded?.phase).toBe('warmup');

    await clearSessionRunner(kvStore);
    const afterClear = await loadSessionRunner(kvStore);
    expect(afterClear).toBeNull();
  });

  it('6. computeRestDuration respects bounds and rest_dynamic config', () => {
    const defaultRest = computeRestDuration(45, false, config);
    expect(defaultRest).toBe(45);

    // Below floor (30s) clamps to floor
    const belowFloor = computeRestDuration(10, false, config);
    expect(belowFloor).toBe(30);

    // Above ceiling (180s) clamps to ceiling
    const aboveCeiling = computeRestDuration(250, false, config);
    expect(aboveCeiling).toBe(180);

    // Exercise transition uses max(transition_seconds, rest_floor)
    const transitionRest = computeRestDuration(undefined, true, config);
    expect(transitionRest).toBe(30); // max(15, 30) = 30
  });
});
