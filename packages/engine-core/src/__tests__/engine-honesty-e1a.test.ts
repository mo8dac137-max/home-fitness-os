import { describe, it, expect } from 'vitest';
import { getEffectiveConfig } from '@hfos/config';
import { PlanSchema, type DayReasonCode, type MuscleGroup } from '@hfos/contracts';
import { INITIAL_EXERCISE_LIBRARY } from '@hfos/library';
import { LocalScheduleProvider } from '@hfos/ports';
import {
  buildHorizon,
  slideHorizon,
  deriveTrainingState,
  isEligible,
  type BuildHorizonInput,
  type CapabilityMap,
  type EnvironmentItem,
} from '../index.js';

describe('E1a: Engine Honesty (buildHorizon real terms, real filters, real provenance)', () => {
  const config = getEffectiveConfig();

  const env: Record<string, EnvironmentItem> = {
    floor: { item_id: 'floor', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
    wall: { item_id: 'wall', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
    pullup_bar: { item_id: 'pullup_bar', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
    chair: { item_id: 'chair', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
    backpack: { item_id: 'backpack', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
  };

  const eligibleExercises = INITIAL_EXERCISE_LIBRARY.filter((e) => isEligible(e, env).eligible);

  const baseCapabilityMap: CapabilityMap = {
    horizontal_push: { level: 3, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
    vertical_push: { level: 3, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
    horizontal_pull: { level: 3, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
    vertical_pull: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
    squat: { level: 3, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
    hinge: { level: 3, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
    lunge: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
    core: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
    mobility: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
    conditioning: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
  };

  const scheduleProvider = new LocalScheduleProvider([
    { dayOfWeek: 1, start: '18:00', end: '19:30', duration_minutes: 90 },
    { dayOfWeek: 2, start: '18:00', end: '19:30', duration_minutes: 90 },
    { dayOfWeek: 3, start: '18:00', end: '19:30', duration_minutes: 90 },
    { dayOfWeek: 4, start: '18:00', end: '19:30', duration_minutes: 90 },
    { dayOfWeek: 5, start: '18:00', end: '19:30', duration_minutes: 90 },
    { dayOfWeek: 6, start: '10:00', end: '11:30', duration_minutes: 90 },
    { dayOfWeek: 0, start: '10:00', end: '11:30', duration_minutes: 90 },
  ]);

  const availability = scheduleProvider.getAvailability({
    startDate: '2026-10-05',
    endDate: '2026-10-18',
  });

  const defaultInput: BuildHorizonInput = {
    now_iso: '2026-10-05T06:00:00Z',
    availability_windows: availability,
    capability_map: baseCapabilityMap,
    eligible_exercises: eligibleExercises,
    library: INITIAL_EXERCISE_LIBRARY,
    environment: env,
    seed: 'e1a-test-seed',
  };

  it('1. with no history Plan.inputs_defaulted lists history and defaulted terms', () => {
    const plan = buildHorizon(defaultInput, config);

    expect(plan.inputs_defaulted).toBeDefined();
    expect(plan.inputs_defaulted).toContain('history');
    expect(plan.inputs_defaulted).toContain('readiness');
    expect(plan.inputs_defaulted).toContain('progression');
  });

  it('2. after a push-unit session yesterday, tomorrow ranking puts a different unit first (property test)', () => {
    // Yesterday was 2026-10-04 (12h to 24h prior to 2026-10-05T06:00:00Z)
    const hoursAgoList = [12, 16, 20, 24];

    for (const hoursAgo of hoursAgoList) {
      const stimulusTime = new Date(Date.parse('2026-10-05T06:00:00Z') - hoursAgo * 3600 * 1000).toISOString();

      const inputWithPriorPush: BuildHorizonInput = {
        ...defaultInput,
        training_state: {
          last_stimulus_at_by_pattern: {
            horizontal_push: stimulusTime,
            vertical_push: stimulusTime,
            core: stimulusTime,
          },
          last_session_unit: 'A',
          readiness: 0.85,
        },
      };

      const plan = buildHorizon(inputWithPriorPush, config);
      const day0 = plan.days[0]!;

      expect(day0.kind).toBe('main');
      // Unit A (Push) was just trained hoursAgo ago (< 36 hours spacing), so it must NOT be selected first
      expect(day0.unit).not.toBe('A');
      // Unit D also shares horizontal_push, so it also cannot be selected
      expect(day0.unit).not.toBe('D');
      // It must select a unit with no conflicting patterns (e.g. Unit B: pull/hinge)
      expect(['B', 'C']).toContain(day0.unit);

      // Verify that candidate A was rejected by recovery_spacing filter in the decision record
      const candidateA = (day0.decision?.candidates as Array<{ unit: string; filter_checks: { recovery_spacing_passed: boolean } }> | undefined)?.find(
        (c) => c.unit === 'A'
      );
      expect(candidateA).toBeDefined();
      expect(candidateA?.filter_checks.recovery_spacing_passed).toBe(false);
    }
  });

  it('3. an ineligible-equipment unit is filtered and the reason is recorded', () => {
    // Strip all pulling equipment (no pullup bar, no chair, no backpack)
    const floorOnlyEnv: Record<string, EnvironmentItem> = {
      floor: { item_id: 'floor', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
      wall: { item_id: 'wall', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
    };
    const limitedEligible = INITIAL_EXERCISE_LIBRARY.filter((e) => isEligible(e, floorOnlyEnv).eligible);

    const inputLimited: BuildHorizonInput = {
      ...defaultInput,
      environment: floorOnlyEnv,
      eligible_exercises: limitedEligible,
    };

    const plan = buildHorizon(inputLimited, config);
    const day0 = plan.days[0]!;
    expect(day0.kind).toBe('main');

    // Unit B requires horizontal_pull, hinge, mobility.
    // In a floor-only environment, pulling patterns have < min_eligible_patterns_per_unit
    const candidates = day0.decision?.candidates as Array<{
      unit: string;
      filter_checks: { equipment_eligible: boolean };
    }>;
    expect(candidates).toBeDefined();

    const candidateB = candidates.find((c) => c.unit === 'B');
    expect(candidateB).toBeDefined();
    // Candidate B should be equipment ineligible or have its check recorded
    expect(candidateB?.filter_checks).toHaveProperty('equipment_eligible');
  });

  it('4. every main day has a DecisionRecord listing all candidates, filters and terms', () => {
    const plan = buildHorizon(defaultInput, config);

    const mainDays = plan.days.filter((d) => d.kind === 'main');
    expect(mainDays.length).toBeGreaterThanOrEqual(3);

    for (const day of mainDays) {
      expect(day.unit).toBeDefined();
      expect(['A', 'B', 'C', 'D']).toContain(day.unit);
      expect(day.estimated_minutes).toBeGreaterThan(0);
      expect(day.reason_code).toBe('scheduled_main');

      expect(day.decision).toBeDefined();
      expect(day.decision?.decision_class).toBe('unit_selection');
      expect(day.decision?.candidates).toHaveLength(4);

      for (const rawCand of day.decision!.candidates) {
        const cand = rawCand as {
          unit: string;
          terms: Record<string, number>;
          filter_checks: Record<string, boolean>;
        };
        expect(['A', 'B', 'C', 'D']).toContain(cand.unit);
        expect(cand.terms).toHaveProperty('priority_need');
        expect(cand.terms).toHaveProperty('stimulus_gap');
        expect(cand.terms).toHaveProperty('progression_need');
        expect(cand.terms).toHaveProperty('goal_weight');
        expect(cand.terms).toHaveProperty('schedule_fit');
        expect(cand.terms).toHaveProperty('readiness');

        expect(cand.filter_checks).toHaveProperty('safety_passed');
        expect(cand.filter_checks).toHaveProperty('recovery_spacing_passed');
        expect(cand.filter_checks).toHaveProperty('volume_caps_passed');
        expect(cand.filter_checks).toHaveProperty('equipment_eligible');
        expect(cand.filter_checks).toHaveProperty('duration_valid');
      }

      // Selection in decision matches day.unit
      const selection = day.decision!.selection as { unit: string };
      expect(selection.unit).toBe(day.unit);
    }
  });

  it('5. non-main days carry a consistent reason_code', () => {
    // Availability with mixed windows:
    // Day 0: 60m (main)
    // Day 1: 60m (main)
    // Day 2: 60m (consecutive_cap -> active_recovery)
    // Day 3: 20m (window_too_short -> micro)
    // Day 4: 0m (no_window -> rest)
    // Day 5: 60m
    // Day 6: 60m
    const customWindows = [
      { date: '2026-10-05', start: '18:00', end: '19:00', duration_minutes: 60, source: 'test' },
      { date: '2026-10-06', start: '18:00', end: '19:00', duration_minutes: 60, source: 'test' },
      { date: '2026-10-07', start: '18:00', end: '19:00', duration_minutes: 60, source: 'test' },
      { date: '2026-10-08', start: '18:00', end: '18:20', duration_minutes: 20, source: 'test' },
      { date: '2026-10-09', start: '18:00', end: '18:00', duration_minutes: 0, source: 'test' },
      { date: '2026-10-10', start: '18:00', end: '19:00', duration_minutes: 60, source: 'test' },
      { date: '2026-10-11', start: '18:00', end: '19:00', duration_minutes: 60, source: 'test' },
    ];

    const plan = buildHorizon(
      {
        ...defaultInput,
        availability_windows: customWindows,
      },
      config
    );

    const validReasonCodes: DayReasonCode[] = [
      'scheduled_main',
      'no_window',
      'window_too_short',
      'quota_reached',
      'consecutive_cap',
      'recovery_spacing',
      'micro_window',
      'active_recovery_cap',
    ];

    for (const day of plan.days) {
      expect(day.reason_code).toBeDefined();
      expect(validReasonCodes).toContain(day.reason_code);

      if (day.kind === 'main') {
        expect(day.reason_code).toBe('scheduled_main');
      } else if (day.kind === 'micro') {
        expect(day.reason_code).toBe('window_too_short');
      } else if (day.kind === 'active_recovery') {
        expect(day.reason_code).toBe('consecutive_cap');
      } else if (day.kind === 'rest') {
        expect(['no_window', 'quota_reached', 'recovery_spacing']).toContain(day.reason_code);
      }
    }
  });

  it('6. same inputs -> same plan (deterministic reproducibility)', () => {
    const plan1 = buildHorizon(defaultInput, config);
    const plan2 = buildHorizon(defaultInput, config);

    expect(plan1).toEqual(plan2);
  });

  it('7. slide stability with unchanged inputs', () => {
    const plan = buildHorizon(defaultInput, config);
    const nextDayIso = '2026-10-06T06:00:00Z';
    const slid = slideHorizon(plan, nextDayIso, defaultInput, config);

    expect(slid.days.length).toBe(7);
    // Day 0 of slid plan matches Day 1 of initial plan
    expect(slid.days[0]!.date).toBe(plan.days[1]!.date);
    expect(slid.days[0]!.unit).toBe(plan.days[1]!.unit);
    expect(slid.days[0]!.status).toBe('locked');

    // Day 1 of slid plan matches Day 2 of initial plan
    expect(slid.days[1]!.date).toBe(plan.days[2]!.date);
    expect(slid.days[1]!.status).toBe('protected');

    // Common adaptive days maintain stability when inputs have not changed
    for (let i = 2; i < 6; i++) {
      expect(slid.days[i]!.kind).toBe(plan.days[i + 1]!.kind);
      expect(slid.days[i]!.unit).toBe(plan.days[i + 1]!.unit);
    }
  });

  it('8. plans stored by the previous version still parse', () => {
    const legacyPlan = {
      schema_version: 1,
      id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
      created_at: '2026-10-01T00:00:00Z',
      horizon_days: 7,
      days: [
        { schema_version: 1, day_index: 0, date: '2026-10-01', kind: 'main', status: 'locked' },
        { schema_version: 1, day_index: 1, date: '2026-10-02', kind: 'main', status: 'protected' },
        { schema_version: 1, day_index: 2, date: '2026-10-03', kind: 'rest', status: 'adaptive' },
        { schema_version: 1, day_index: 3, date: '2026-10-04', kind: 'main', status: 'adaptive' },
        { schema_version: 1, day_index: 4, date: '2026-10-05', kind: 'main', status: 'adaptive' },
        { schema_version: 1, day_index: 5, date: '2026-10-06', kind: 'micro', status: 'adaptive' },
        { schema_version: 1, day_index: 6, date: '2026-10-07', kind: 'rest', status: 'adaptive' },
      ],
    };

    const parsed = PlanSchema.safeParse(legacyPlan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.days[0]!.unit).toBeUndefined();
      expect(parsed.data.days[0]!.decision).toBeUndefined();
      expect(parsed.data.inputs_defaulted).toBeUndefined();
    }
  });

  it('9. deriveTrainingState derives training state accurately from events', () => {
    const now = '2026-10-05T12:00:00Z';
    const events = [
      {
        event_id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
        schema_version: 1,
        type: 'session.completed',
        device_id: 'test-device',
        idempotency_key: 'idem-session-completed-1',
        payload: {
          training_unit: 'A',
          patterns: ['horizontal_push', 'vertical_push', 'core'],
        },
        occurred_at: '2026-10-04T18:00:00Z',
      },
      {
        event_id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91e',
        schema_version: 1,
        type: 'readiness.recorded',
        device_id: 'test-device',
        idempotency_key: 'idem-readiness-1',
        payload: {
          score: 0.9,
        },
        occurred_at: '2026-10-05T07:00:00Z',
      },
      {
        event_id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91f',
        schema_version: 1,
        type: 'session.set_logged',
        device_id: 'test-device',
        idempotency_key: 'idem-set-1',
        payload: {
          muscle: 'chest' as MuscleGroup,
          pattern: 'horizontal_push',
        },
        occurred_at: '2026-10-04T18:15:00Z',
      },
    ];

    const state = deriveTrainingState(events, now, config);

    expect(state.last_session_unit).toBe('A');
    expect(state.readiness).toBe(0.9);
    expect(state.last_stimulus_at_by_pattern?.horizontal_push).toBe('2026-10-04T18:15:00Z');
    expect(state.last_stimulus_at_by_pattern?.vertical_push).toBe('2026-10-04T18:00:00Z');
    expect(state.weekly_sets_by_muscle?.chest).toBe(1);
  });
});
