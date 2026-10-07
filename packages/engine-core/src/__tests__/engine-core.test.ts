import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateRankScore,
  rankCandidates,
  isMaterialChange,
  verifyPlanIntegrity,
  transitionEnvironmentItem,
  isEligible,
  coverageByPattern,
  validateChange,
  findNearestAlternative,
  PlanStore,
  createDeterministicPrng,
  estimateDuration,
  generateSession,
  RankingWeights,
  CandidateMetric,
  EnvironmentItem,
} from '../index.js';
import { getEffectiveConfig } from '@hfos/config';
import type { Exercise, Plan, ChangeRequest } from '@hfos/contracts';
import { INITIAL_EXERCISE_LIBRARY } from '@hfos/library';

const VALID_UUID_V7 = '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d';

const sampleExerciseA: Exercise = {
  schema_version: 1,
  id: 'exercise_a',
  name: 'Exercise A',
  pattern: 'horizontal_push',
  primary_muscles: ['chest'],
  secondary_muscles: ['arms'],
  unilateral: false,
  coverage_weight: 1,
  level: 1,
  equipment_requirement: { schema_version: 1, all: ['bodyweight'] },
  progression_links: {},
  safety_flags: [],
  type: 'compound',
  asset_status: 'ready',
};

const sampleExerciseB: Exercise = {
  ...sampleExerciseA,
  id: 'exercise_b',
  name: 'Exercise B',
};

const sampleExerciseC: Exercise = {
  ...sampleExerciseA,
  id: 'exercise_c',
  name: 'Exercise C',
};

const defaultWeights: RankingWeights = {
  priority_need: 0.2,
  stimulus_gap: 0.2,
  progression_need: 0.2,
  goal_weight: 0.15,
  schedule_fit: 0.15,
  readiness: 0.1,
};

describe('@hfos/engine-core - Real Engine Tests', () => {
  describe('calculateRankScore', () => {
    it('calculates the exact weighted sum of candidate metrics', () => {
      const metric = {
        priority_need: 1.0,
        stimulus_gap: 1.0,
        progression_need: 1.0,
        goal_weight: 1.0,
        schedule_fit: 1.0,
        readiness: 1.0,
      };
      const score = calculateRankScore(metric, defaultWeights);
      expect(score).toBeCloseTo(1.0, 5);

      const partialMetric = {
        priority_need: 0.5,
        stimulus_gap: 0.0,
        progression_need: 1.0,
        goal_weight: 0.5,
        schedule_fit: 0.8,
        readiness: 0.9,
      };
      const partialScore = calculateRankScore(partialMetric, defaultWeights);
      expect(partialScore).toBeCloseTo(0.585, 5);
    });
  });

  describe('rankCandidates', () => {
    it('orders candidates deterministically by score descending', () => {
      const candidates: CandidateMetric[] = [
        {
          exercise: sampleExerciseA,
          priority_need: 0.2,
          stimulus_gap: 0.2,
          progression_need: 0.2,
          goal_weight: 0.2,
          schedule_fit: 0.2,
          readiness: 0.2,
        },
        {
          exercise: sampleExerciseB,
          priority_need: 0.9,
          stimulus_gap: 0.9,
          progression_need: 0.9,
          goal_weight: 0.9,
          schedule_fit: 0.9,
          readiness: 0.9,
        },
        {
          exercise: sampleExerciseC,
          priority_need: 0.5,
          stimulus_gap: 0.5,
          progression_need: 0.5,
          goal_weight: 0.5,
          schedule_fit: 0.5,
          readiness: 0.5,
        },
      ];

      const ranked = rankCandidates(candidates, defaultWeights);
      expect(ranked[0]?.exercise.id).toBe('exercise_b');
      expect(ranked[1]?.exercise.id).toBe('exercise_c');
      expect(ranked[2]?.exercise.id).toBe('exercise_a');
    });

    it('tie-breaks by exercise id alphabetically when scores are equal', () => {
      const candidateC: CandidateMetric = {
        exercise: sampleExerciseC,
        priority_need: 0.5,
        stimulus_gap: 0.5,
        progression_need: 0.5,
        goal_weight: 0.5,
        schedule_fit: 0.5,
        readiness: 0.5,
      };
      const candidateA: CandidateMetric = {
        exercise: sampleExerciseA,
        priority_need: 0.5,
        stimulus_gap: 0.5,
        progression_need: 0.5,
        goal_weight: 0.5,
        schedule_fit: 0.5,
        readiness: 0.5,
      };

      const ranked1 = rankCandidates([candidateC, candidateA], defaultWeights);
      expect(ranked1[0]?.exercise.id).toBe('exercise_a');
      expect(ranked1[1]?.exercise.id).toBe('exercise_c');

      const ranked2 = rankCandidates([candidateA, candidateC], defaultWeights);
      expect(ranked2[0]?.exercise.id).toBe('exercise_a');
      expect(ranked2[1]?.exercise.id).toBe('exercise_c');
    });

    it('gives identical output when given the exact same input twice (deterministic purity)', () => {
      const candidates: CandidateMetric[] = [
        {
          exercise: sampleExerciseB,
          priority_need: 0.7,
          stimulus_gap: 0.4,
          progression_need: 0.8,
          goal_weight: 0.5,
          schedule_fit: 0.6,
          readiness: 0.9,
        },
        {
          exercise: sampleExerciseA,
          priority_need: 0.3,
          stimulus_gap: 0.9,
          progression_need: 0.2,
          goal_weight: 0.8,
          schedule_fit: 0.7,
          readiness: 0.4,
        },
      ];

      const result1 = rankCandidates(candidates, defaultWeights);
      const result2 = rankCandidates(candidates, defaultWeights);
      expect(result1).toEqual(result2);
    });
  });

  describe('isMaterialChange (wired with @hfos/config settings)', () => {
    const config = getEffectiveConfig();
    const thresholdDuration = config['material_change_duration_pct'] as number;
    const thresholdHardSets = config['material_change_hard_sets_pct'] as number;

    it('returns true when duration delta is exactly at 10% threshold', () => {
      expect(
        isMaterialChange({
          exercise_sets_changed: false,
          duration_delta_pct: 0.1,
          hard_sets_delta_pct: 0,
          pattern_focus_changed: false,
          threshold_duration_pct: thresholdDuration,
          threshold_hard_sets_pct: thresholdHardSets,
        })
      ).toBe(true);

      expect(
        isMaterialChange({
          exercise_sets_changed: false,
          duration_delta_pct: -0.1,
          hard_sets_delta_pct: 0,
          pattern_focus_changed: false,
          threshold_duration_pct: thresholdDuration,
          threshold_hard_sets_pct: thresholdHardSets,
        })
      ).toBe(true);
    });

    it('returns false when duration delta is just below 10% threshold (e.g. 9.9%)', () => {
      expect(
        isMaterialChange({
          exercise_sets_changed: false,
          duration_delta_pct: 0.099,
          hard_sets_delta_pct: 0,
          pattern_focus_changed: false,
          threshold_duration_pct: thresholdDuration,
          threshold_hard_sets_pct: thresholdHardSets,
        })
      ).toBe(false);
    });

    it('returns true when hard sets delta is exactly at 10% and false just below', () => {
      expect(
        isMaterialChange({
          exercise_sets_changed: false,
          duration_delta_pct: 0,
          hard_sets_delta_pct: 0.1,
          pattern_focus_changed: false,
          threshold_duration_pct: thresholdDuration,
          threshold_hard_sets_pct: thresholdHardSets,
        })
      ).toBe(true);

      expect(
        isMaterialChange({
          exercise_sets_changed: false,
          duration_delta_pct: 0,
          hard_sets_delta_pct: 0.099,
          pattern_focus_changed: false,
          threshold_duration_pct: thresholdDuration,
          threshold_hard_sets_pct: thresholdHardSets,
        })
      ).toBe(false);
    });

    it('triggers individually for each single trigger alone', () => {
      expect(
        isMaterialChange({
          exercise_sets_changed: true,
          duration_delta_pct: 0,
          hard_sets_delta_pct: 0,
          pattern_focus_changed: false,
          threshold_duration_pct: thresholdDuration,
          threshold_hard_sets_pct: thresholdHardSets,
        })
      ).toBe(true);

      expect(
        isMaterialChange({
          exercise_sets_changed: false,
          duration_delta_pct: 0,
          hard_sets_delta_pct: 0,
          pattern_focus_changed: true,
          threshold_duration_pct: thresholdDuration,
          threshold_hard_sets_pct: thresholdHardSets,
        })
      ).toBe(true);
    });
  });

  describe('verifyPlanIntegrity', () => {
    const buildPlan = (
      horizon: number,
      day0Status: 'locked' | 'protected' | 'adaptive' = 'locked',
      day1Status: 'locked' | 'protected' | 'adaptive' = 'protected'
    ): Plan => ({
      schema_version: 1,
      id: VALID_UUID_V7,
      created_at: '2026-10-06T04:00:00Z',
      horizon_days: horizon,
      days: Array.from({ length: horizon }, (_, i) => ({
        schema_version: 1,
        day_index: i,
        kind: i % 2 === 0 ? ('main' as const) : ('rest' as const),
        status: i === 0 ? day0Status : i === 1 ? day1Status : ('adaptive' as const),
      })),
    });

    it('passes for horizon 3, 7, and 8 when Day 0 is locked and Day 1 is protected', () => {
      expect(verifyPlanIntegrity(buildPlan(3))).toBe(true);
      expect(verifyPlanIntegrity(buildPlan(7))).toBe(true);
      expect(verifyPlanIntegrity(buildPlan(8))).toBe(true);
    });

    it('fails when days.length does not match horizon_days', () => {
      const mismatchedPlan = {
        ...buildPlan(7),
        days: buildPlan(3).days,
      };
      expect(verifyPlanIntegrity(mismatchedPlan)).toBe(false);
    });
  });

  // ==========================================
  // M0-06 Environment and Eligibility
  // ==========================================
  describe('M0-06 Environment and Eligibility', () => {
    it('transitions environment items through valid lifecycle: unknown -> declared -> validated -> retired', () => {
      const initial: EnvironmentItem = {
        item_id: 'table',
        status: 'unknown',
        updated_at: '2026-10-06T00:00:00Z',
      };

      const declared = transitionEnvironmentItem(initial, {
        type: 'declare',
        timestamp: '2026-10-06T01:00:00Z',
        notes: 'Dining table declared',
      });
      expect(declared.status).toBe('declared');
      expect(declared.notes).toBe('Dining table declared');

      const validated = transitionEnvironmentItem(declared, {
        type: 'validate',
        timestamp: '2026-10-06T02:00:00Z',
        validated_at: '2026-10-06T02:00:00Z',
      });
      expect(validated.status).toBe('validated');
      expect(validated.validated_at).toBe('2026-10-06T02:00:00Z');

      const retired = transitionEnvironmentItem(validated, {
        type: 'retire',
        timestamp: '2026-10-06T03:00:00Z',
      });
      expect(retired.status).toBe('retired');

      // Invalid transitions
      expect(() =>
        transitionEnvironmentItem(initial, {
          type: 'validate',
          timestamp: '2026-10-06T04:00:00Z',
          validated_at: '2026-10-06T04:00:00Z',
        })
      ).toThrow();

      expect(() =>
        transitionEnvironmentItem(retired, {
          type: 'declare',
          timestamp: '2026-10-06T04:00:00Z',
        })
      ).toThrow();
    });

    it('marks table exercises ineligible when table is missing or not validated', () => {
      const tableEx = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === 'inverted_table_row')!;
      expect(tableEx).toBeDefined();

      const envWithoutTable: Record<string, EnvironmentItem> = {};
      expect(isEligible(tableEx, envWithoutTable).eligible).toBe(false);
      expect(isEligible(tableEx, envWithoutTable).reasons).toContain('missing:table');

      const envWithDeclaredTable: Record<string, EnvironmentItem> = {
        table: { item_id: 'table', status: 'declared', updated_at: '2026-10-06T00:00:00Z' },
      };
      expect(isEligible(tableEx, envWithDeclaredTable).eligible).toBe(false);
      expect(isEligible(tableEx, envWithDeclaredTable).reasons).toContain('not_validated:table');

      const envWithValidatedTable: Record<string, EnvironmentItem> = {
        table: {
          item_id: 'table',
          status: 'validated',
          validated_at: '2026-10-06T01:00:00Z',
          updated_at: '2026-10-06T01:00:00Z',
        },
      };
      expect(isEligible(tableEx, envWithValidatedTable).eligible).toBe(true);
    });

    it('marks loaded backpack exercises ineligible when backpack load is unverified', () => {
      const backpackEx = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === 'backpack_pushup')!;
      expect(backpackEx).toBeDefined();

      const envDeclaredBackpack: Record<string, EnvironmentItem> = {
        loaded_backpack: {
          item_id: 'loaded_backpack',
          status: 'declared',
          updated_at: '2026-10-06T00:00:00Z',
        },
      };
      const res = isEligible(backpackEx, envDeclaredBackpack);
      expect(res.eligible).toBe(false);
      expect(res.reasons).toContain('load_unverified:loaded_backpack');
    });

    it('evaluates all/any equipment expressions accurately', () => {
      // feet_elevated_pushup has any: ['chair', 'stairs']
      const declinePushup = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === 'feet_elevated_pushup')!;
      expect(declinePushup).toBeDefined();

      const envWithChair: Record<string, EnvironmentItem> = {
        chair: {
          item_id: 'chair',
          status: 'validated',
          validated_at: '2026-10-06T00:00:00Z',
          updated_at: '2026-10-06T00:00:00Z',
        },
      };
      expect(isEligible(declinePushup, envWithChair).eligible).toBe(true);

      const emptyEnv: Record<string, EnvironmentItem> = {};
      expect(isEligible(declinePushup, emptyEnv).eligible).toBe(false);
    });

    it('produces ZERO vertical_pull coverage with the Mock User environment', () => {
      // Mock User environment: floor, wall declared, chair validated, backpack validated, no table
      const mockUserEnv: Record<string, EnvironmentItem> = {
        floor: { item_id: 'floor', status: 'validated', updated_at: '2026-10-06T00:00:00Z' },
        wall: { item_id: 'wall', status: 'declared', updated_at: '2026-10-06T00:00:00Z' },
        chair: {
          item_id: 'chair',
          status: 'validated',
          validated_at: '2026-10-06T00:00:00Z',
          updated_at: '2026-10-06T00:00:00Z',
        },
        loaded_backpack: {
          item_id: 'loaded_backpack',
          status: 'validated',
          validated_at: '2026-10-06T00:00:00Z',
          updated_at: '2026-10-06T00:00:00Z',
        },
      };

      const coverage = coverageByPattern(INITIAL_EXERCISE_LIBRARY, mockUserEnv);
      expect(coverage.counts.vertical_pull).toBe(0);
      expect(coverage.active_limitations.vertical_pull).toBe(
        'no equipment-free vertical pull available'
      );
      expect(coverage.counts.horizontal_push).toBeGreaterThan(0);
      expect(coverage.counts.squat).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // M0-07 Validator Pipeline + PlanStore
  // ==========================================
  describe('M0-07 Validator Pipeline & PlanStore', () => {
    const defaultEnv: Record<string, EnvironmentItem> = {
      floor: { item_id: 'floor', status: 'validated', updated_at: '2026-10-06T00:00:00Z' },
      chair: {
        item_id: 'chair',
        status: 'validated',
        validated_at: '2026-10-06T00:00:00Z',
        updated_at: '2026-10-06T00:00:00Z',
      },
    };

    const basePlan: Plan = {
      schema_version: 1,
      id: VALID_UUID_V7,
      created_at: '2026-10-06T04:00:00Z',
      horizon_days: 7,
      days: Array.from({ length: 7 }, (_, i) => ({
        schema_version: 1,
        day_index: i,
        kind: i % 2 === 0 ? ('main' as const) : ('rest' as const),
        status: i === 0 ? ('locked' as const) : i === 1 ? ('protected' as const) : ('adaptive' as const),
        session_snapshot:
          i % 2 === 0
            ? {
                schema_version: 1,
                id: VALID_UUID_V7,
                session_id: VALID_UUID_V7,
                exercises: [
                  {
                    exercise_id: 'pushup_standard',
                    sets: [
                      { schema_version: 1, set_number: 1, rest_seconds: 60 },
                      { schema_version: 1, set_number: 2, rest_seconds: 60 },
                      { schema_version: 1, set_number: 3, rest_seconds: 60 },
                    ],
                  },
                ],
                rules: [],
                engine_version: '0.1.0',
                config_version: '1.0.0',
                created_at: '2026-10-06T04:00:00Z',
              }
            : null,
      })),
    };

    it('finds nearest eligible alternative for replace_exercise deterministically', () => {
      const target = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === 'pushup_standard')!; // level 3, horizontal_push
      const alt = findNearestAlternative(target, INITIAL_EXERCISE_LIBRARY, defaultEnv);
      expect(alt).toBeDefined();
      expect(alt?.pattern).toBe('horizontal_push');
      expect(Math.abs(alt!.level - target.level)).toBeLessThanOrEqual(1);
      expect(alt?.id).not.toBe(target.id);
    });

    it('warns (never rejects) when goal alignment detects priority muscle removal', () => {
      const request: ChangeRequest = {
        schema_version: 1,
        id: VALID_UUID_V7,
        source: 'manual',
        command: 'replace_exercise',
        target_day_index: 2,
        target_exercise_id: 'pushup_standard', // primary muscle chest
        parameters: { replacement_exercise_id: 'diamond_pushup' }, // diamond has primary arms, secondary chest
        created_at: '2026-10-06T04:00:00Z',
      };

      const result = validateChange(request, {
        plan: basePlan,
        library: INITIAL_EXERCISE_LIBRARY,
        environment: defaultEnv,
        physique_priorities: ['chest', 'back'],
      });

      expect(result.status).toBe('accepted_with_warning');
      expect(result.issues.some((i) => i.stage === 'goal_alignment')).toBe(true);
    });

    it('rejects changes that reduce main session below safety-locked 30 minutes', () => {
      const request: ChangeRequest = {
        schema_version: 1,
        id: VALID_UUID_V7,
        source: 'manual',
        command: 'shorten_session',
        target_day_index: 2,
        parameters: { duration_minutes: 20 }, // 20 < 30
        created_at: '2026-10-06T04:00:00Z',
      };

      const result = validateChange(request, {
        plan: basePlan,
        library: INITIAL_EXERCISE_LIBRARY,
        environment: defaultEnv,
      });

      expect(result.status).toBe('rejected');
      expect(result.issues.some((i) => i.stage === 'duration')).toBe(true);
    });

    it('Property test: PlanStore never mutates input and rejects invalid changes safely', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 29 }), // below 30 min duration
          (badDuration) => {
            const request: ChangeRequest = {
              schema_version: 1,
              id: VALID_UUID_V7,
              source: 'manual',
              command: 'shorten_session',
              target_day_index: 2,
              parameters: { duration_minutes: badDuration },
              created_at: '2026-10-06T04:00:00Z',
            };

            const planBefore = JSON.stringify(basePlan);
            const res = PlanStore.applyChange(basePlan, request, {
              library: INITIAL_EXERCISE_LIBRARY,
              environment: defaultEnv,
            });

            expect(res.success).toBe(false);
            expect(res.status).toBe('rejected');
            // Input plan remains unmodified
            expect(JSON.stringify(basePlan)).toBe(planBefore);
          }
        )
      );
    });
  });

  // ==========================================
  // M0-08 Session Generator + Duration Calculator
  // ==========================================
  describe('M0-08 Session Generator & Duration Calculator', () => {
    const config = getEffectiveConfig();
    const defaultEnv: Record<string, EnvironmentItem> = {
      floor: { item_id: 'floor', status: 'validated', updated_at: '2026-10-06T00:00:00Z' },
      chair: {
        item_id: 'chair',
        status: 'validated',
        validated_at: '2026-10-06T00:00:00Z',
        updated_at: '2026-10-06T00:00:00Z',
      },
      loaded_backpack: {
        item_id: 'loaded_backpack',
        status: 'validated',
        validated_at: '2026-10-06T00:00:00Z',
        updated_at: '2026-10-06T00:00:00Z',
      },
    };

    const eligibleExercises = INITIAL_EXERCISE_LIBRARY.filter(
      (e) => isEligible(e, defaultEnv).eligible
    );

    it('generates identical session snapshots for the exact same seed (deterministic purity)', () => {
      const capabilityMap = {
        horizontal_push: 3,
        vertical_push: 3,
        core: 2,
      };

      const session1 = generateSession({
        training_unit: 'A',
        capability_map: capabilityMap,
        eligible_exercises: eligibleExercises,
        settings: config,
        goal_emphasis: 'hypertrophy',
        seed: 'fixed-seed-redmi-12',
      });

      const session2 = generateSession({
        training_unit: 'A',
        capability_map: capabilityMap,
        eligible_exercises: eligibleExercises,
        settings: config,
        goal_emphasis: 'hypertrophy',
        seed: 'fixed-seed-redmi-12',
      });

      expect(session1).toEqual(session2);
    });

    it('satisfies duration and cap constraints across 100 generated capability maps', () => {
      const units: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
      const emphases: Array<'strength' | 'hypertrophy' | 'endurance'> = [
        'strength',
        'hypertrophy',
        'endurance',
      ];

      for (let i = 0; i < 100; i++) {
        const prng = createDeterministicPrng(`test-run-${i}`);
        const unit = units[Math.floor(prng() * units.length)]!;
        const emphasis = emphases[Math.floor(prng() * emphases.length)]!;

        const capabilityMap = {
          horizontal_push: 1 + Math.floor(prng() * 6),
          vertical_push: 1 + Math.floor(prng() * 5),
          horizontal_pull: 1 + Math.floor(prng() * 3),
          vertical_pull: 1 + Math.floor(prng() * 2),
          squat: 1 + Math.floor(prng() * 5),
          hinge: 1 + Math.floor(prng() * 4),
          lunge: 1 + Math.floor(prng() * 3),
          core: 1 + Math.floor(prng() * 4),
          mobility: 1 + Math.floor(prng() * 2),
          conditioning: 1 + Math.floor(prng() * 2),
        };

        const session = generateSession({
          training_unit: unit,
          capability_map: capabilityMap,
          eligible_exercises: eligibleExercises,
          settings: config,
          goal_emphasis: emphasis,
          physique_priorities: ['chest', 'back'],
          seed: `run-seed-${i}`,
        });

        const duration = estimateDuration(session, config);

        // 1. Duration within [30, 60]
        expect(duration).toBeGreaterThanOrEqual(30);
        expect(duration).toBeLessThanOrEqual(60);

        // 2. Session hard sets cap respected (<= 24)
        const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
        expect(totalSets).toBeLessThanOrEqual(24);

        // 3. No ineligible exercises present
        for (const item of session.exercises) {
          const ex = eligibleExercises.find((e) => e.id === item.exercise_id);
          expect(ex).toBeDefined();
        }
      }
    });
  });
});
