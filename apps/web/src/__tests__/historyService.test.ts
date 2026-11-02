import { describe, it, expect } from 'vitest';
import type { EventEnvelope } from '@hfos/events';
import { InMemoryEventLog } from '@hfos/events';
import type { Plan } from '@hfos/contracts';
import {
  buildHistorySummary,
  loadHistorySummary,
} from '../engine/historyService.js';

/**
 * Phase "history wiring" behavioral tests: pure computation over injected
 * envelopes with an injected nowMs — no DOM, no wall clock, no IndexedDB.
 */

const NOW_MS = Date.parse('2026-11-02T10:00:00.000Z');
const DAY_MS = 86_400_000;

let seq = 0;
function ev(
  type: string,
  ageMs: number,
  payload: Record<string, unknown>,
  idempotencyKey?: string
): EventEnvelope {
  seq++;
  return {
    event_id: `018f6c38-0000-7b56-8a5b-${String(seq).padStart(12, '0')}`,
    type,
    occurred_at: new Date(NOW_MS - ageMs).toISOString(),
    device_id: 'test-device-redmi12',
    idempotency_key: idempotencyKey ?? `idem-${seq}`,
    schema_version: 1,
    payload,
  };
}

function makePlan(mainDays: number, totalDays: number): Plan {
  const days = Array.from({ length: totalDays }, (_, i) => ({
    schema_version: 1,
    day_index: i,
    status: (i === 0 ? 'locked' : i === 1 ? 'protected' : 'adaptive') as
      | 'locked'
      | 'protected'
      | 'adaptive',
    kind: (i < mainDays ? 'main' : 'rest') as 'main' | 'rest',
    unit: 'A',
    date: new Date(NOW_MS + i * DAY_MS).toISOString(),
    session_snapshot: null,
  }));
  return {
    schema_version: 1,
    id: '018f6c38-89c0-7b56-8a5b-9d48b1bfc901',
    created_at: new Date(NOW_MS).toISOString(),
    days,
    horizon_days: totalDays,
    current_unit: 'A',
  } as Plan;
}

describe('History Service (wiring session events into Home/Progress)', () => {
  it('empty log yields honest zeros and nulls with no session data', () => {
    const summary = buildHistorySummary([], null, NOW_MS);
    expect(summary.has_session_data).toBe(false);
    expect(summary.total_completed_sessions).toBe(0);
    expect(summary.completed_sessions_in_window).toBe(0);
    expect(summary.sets_total).toBe(0);
    expect(summary.rep_target_hit_rate).toBeNull();
    expect(summary.avg_rpe).toBeNull();
    expect(summary.pattern_exposure).toEqual({});
    expect(summary.muscle_exposure).toEqual({});
    expect(summary.window_days).toBe(7);
    expect(summary.exposure_window_days).toBe(14);
  });

  it('counts completed sessions inside the 7-day window only', () => {
    const events = [
      ev('session.completed', 2 * DAY_MS, {}),
      ev('session.completed', 5 * DAY_MS, {}),
      ev('session.completed', 10 * DAY_MS, {}), // outside the 7d window
      ev('session.completed', 3 * DAY_MS, {}),
    ];
    const summary = buildHistorySummary(events, null, NOW_MS);
    expect(summary.total_completed_sessions).toBe(4);
    expect(summary.completed_sessions_in_window).toBe(3);
    expect(summary.has_session_data).toBe(true);
  });

  it('derives rep-target hits and average RPE from logged sets', () => {
    const events = [
      // Hit: 10/10 with RPE 8
      ev('session.set_logged', 1 * DAY_MS, {
        exercise_id: 'pushup_standard',
        set_number: 1,
        reps: 10,
        target_reps: 10,
        rpe: 8,
        pattern: 'horizontal_push',
      }),
      // Partial: 6/10 with RPE 9
      ev('session.set_logged', 2 * DAY_MS, {
        exercise_id: 'pushup_standard',
        set_number: 2,
        reps: 6,
        target_reps: 10,
        rpe: 9,
        pattern: 'horizontal_push',
      }),
      // No RPE provided: counted as a set, excluded from the RPE average
      ev('session.set_logged', 3 * DAY_MS, {
        exercise_id: 'pushup_standard',
        set_number: 3,
        reps: 10,
        target_reps: 10,
        pattern: 'horizontal_push',
      }),
    ];
    const summary = buildHistorySummary(events, null, NOW_MS);
    expect(summary.sets_total).toBe(3);
    expect(summary.sets_hit).toBe(2);
    expect(summary.rep_target_hit_rate).toBeCloseTo(2 / 3, 10);
    expect(summary.avg_rpe).toBeCloseTo(8.5, 10);
  });

  it('builds pattern exposure over the 14-day window and muscle exposure over the 7-day window', () => {
    const events = [
      // In both windows
      ev('session.set_logged', 1 * DAY_MS, {
        exercise_id: 'pushup_standard',
        set_number: 1,
        reps: 10,
        target_reps: 10,
        rpe: 7.5,
        pattern: 'horizontal_push',
      }),
      // In both windows ( Pike push-up -> vertical_push / shoulders )
      ev('session.set_logged', 2 * DAY_MS, {
        exercise_id: 'pike_pushup',
        set_number: 1,
        reps: 8,
        target_reps: 8,
        rpe: 8,
        pattern: 'vertical_push',
      }),
      // 10 days old: inside the 14d exposure window, outside the 7d muscle window
      ev('session.set_logged', 10 * DAY_MS, {
        exercise_id: 'pike_pushup',
        set_number: 1,
        reps: 8,
        target_reps: 8,
        rpe: 8,
        pattern: 'vertical_push',
      }),
      // 20 days old: outside every window
      ev('session.set_logged', 20 * DAY_MS, {
        exercise_id: 'pushup_standard',
        set_number: 1,
        reps: 10,
        target_reps: 10,
        rpe: 7,
        pattern: 'horizontal_push',
      }),
    ];
    const summary = buildHistorySummary(events, null, NOW_MS);
    expect(summary.pattern_exposure).toEqual({
      horizontal_push: 1,
      vertical_push: 2,
    });
    expect(summary.muscle_exposure).toEqual({
      chest: 1,
      shoulders: 2,
    });
    expect(summary.sets_total).toBe(3);
  });

  it('falls back to the library pattern when a set event omits it', () => {
    const events = [
      ev('session.set_logged', 1 * DAY_MS, {
        exercise_id: 'pike_pushup',
        set_number: 1,
        reps: 8,
        target_reps: 8,
        rpe: 8,
      }),
    ];
    const summary = buildHistorySummary(events, null, NOW_MS);
    expect(summary.pattern_exposure).toEqual({ vertical_push: 1 });
  });

  it('counts planned main sessions from the plan and stays at 0 without one', () => {
    const plan = makePlan(3, 7);
    expect(buildHistorySummary([], plan, NOW_MS).planned_main_sessions).toBe(3);
    expect(buildHistorySummary([], null, NOW_MS).planned_main_sessions).toBe(0);
  });

  it('never double-counts duplicated idempotency keys', () => {
    const events = [
      ev('session.completed', 1 * DAY_MS, {}, 'dup-key'),
      ev('session.completed', 1 * DAY_MS, {}, 'dup-key'),
      ev('session.set_logged', 1 * DAY_MS, {
        exercise_id: 'pushup_standard',
        set_number: 1,
        reps: 10,
        target_reps: 10,
        rpe: 8,
        pattern: 'horizontal_push',
      }, 'dup-set'),
      ev('session.set_logged', 1 * DAY_MS, {
        exercise_id: 'pushup_standard',
        set_number: 1,
        reps: 10,
        target_reps: 10,
        rpe: 8,
        pattern: 'horizontal_push',
      }, 'dup-set'),
    ];
    const summary = buildHistorySummary(events, null, NOW_MS);
    expect(summary.total_completed_sessions).toBe(1);
    expect(summary.sets_total).toBe(1);
  });

  it('abandoned sessions mark data existence without counting as completions', () => {
    const events = [
      ev('session.abandoned', 1 * DAY_MS, { reason: 'joint discomfort', sets_completed: 1 }),
    ];
    const summary = buildHistorySummary(events, null, NOW_MS);
    expect(summary.has_session_data).toBe(true);
    expect(summary.total_completed_sessions).toBe(0);
    expect(summary.completed_sessions_in_window).toBe(0);
  });

  it('loadHistorySummary reads through an EventLog implementation', async () => {
    const log = new InMemoryEventLog();
    await log.append(ev('session.completed', 1 * DAY_MS, {}));
    await log.append(ev('session.set_logged', 1 * DAY_MS, {
      exercise_id: 'pushup_standard',
      set_number: 1,
      reps: 10,
      target_reps: 10,
      rpe: 7.5,
      pattern: 'horizontal_push',
    }));

    const plan = makePlan(4, 7);
    const summary = await loadHistorySummary(log, plan, NOW_MS);
    expect(summary.total_completed_sessions).toBe(1);
    expect(summary.sets_total).toBe(1);
    expect(summary.planned_main_sessions).toBe(4);
  });
});
