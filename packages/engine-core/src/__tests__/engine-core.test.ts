import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  rankCandidates,
  buildDecisionRecord,
  isMaterialChange,
  shouldReplaceCurrent,
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
  evaluateFinderAttempt,
  isReviewDue,
  reviewProgression,
  detectStagnation,
  computeExposure,
  trendFromSeries,
  createKnowledgeLedger,
  upsertFact,
  getFact,
  rejectInference,
  isStale,
  deriveInformationNeeds,
  EnvironmentItem,
  CandidateEvaluationInput,
  ReviewInput,
  CapabilityMap,
  buildHorizon,
  slideHorizon,
  makeHarder,
  makeEasier,
  replaceExercise,
  increaseMuscleFocus,
  shortenSession,
  getLocalDateWithDayStart,
  validateAiResponse,
  minimizeContext,
  decideWithAi,
  buildAiAuditRecord,
  fnv1a,
} from '../index.js';
import { getEffectiveConfig, validateRankWeights, requiresApproval } from '@hfos/config';
import { LocalScheduleProvider } from '@hfos/ports';
import { MockAiProvider } from '@hfos/sim';
import type { Exercise, Plan, ChangeRequest, KnowledgeFact, AiRequest, AiResponse } from '@hfos/contracts';
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

describe('@hfos/engine-core - Comprehensive Engine Tests', () => {
  const config = getEffectiveConfig();

  // ==========================================
  // M0-10 Ranking, Provenance, Hysteresis
  // ==========================================
  describe('M0-10 Ranking, Provenance & Hysteresis', () => {
    it('verifies that rank weights sum to 1.0', () => {
      const result = validateRankWeights(config);
      expect(result.valid).toBe(true);
    });

    it('runs hard filters before scoring and records rejections', () => {
      const candidates: CandidateEvaluationInput[] = [
        {
          exercise: sampleExerciseA,
          unit: 'A',
          terms: {
            priority_need: 0.9,
            days_since_last_stimulus: 4,
            progression_need: 0.8,
            goal_weight: 0.9,
            available_window_minutes: 60,
            duration_minutes: 45,
            readiness: 0.9,
          },
          filter_checks: {
            safety_passed: false, // fails safety!
            recovery_spacing_passed: true,
            volume_caps_passed: true,
            equipment_eligible: true,
            duration_valid: true,
          },
        },
        {
          exercise: sampleExerciseB,
          unit: 'A',
          terms: {
            priority_need: 0.5,
            days_since_last_stimulus: 3,
            progression_need: 0.5,
            goal_weight: 0.5,
            available_window_minutes: 60,
            duration_minutes: 45,
            readiness: 0.5,
          },
          filter_checks: {
            safety_passed: true,
            recovery_spacing_passed: true,
            volume_caps_passed: true,
            equipment_eligible: true,
            duration_valid: true,
          },
        },
      ];

      const ranked = rankCandidates(candidates, config);
      expect(ranked[0]?.exercise.id).toBe('exercise_b');
      expect(ranked[0]?.passed_filters).toBe(true);
      expect(ranked[0]?.rank_score).toBeGreaterThan(0);

      expect(ranked[1]?.exercise.id).toBe('exercise_a');
      expect(ranked[1]?.passed_filters).toBe(false);
      expect(ranked[1]?.rank_score).toBe(0);
      expect(ranked[1]?.filter_rejections).toContain('safety_failed');
    });

    it('tie-breaks deterministically by unit then exercise id', () => {
      const candA: CandidateEvaluationInput = {
        exercise: sampleExerciseA,
        unit: 'B',
        terms: {
          priority_need: 0.5,
          days_since_last_stimulus: 3,
          progression_need: 0.5,
          goal_weight: 0.5,
          available_window_minutes: 60,
          duration_minutes: 45,
          readiness: 0.5,
        },
        filter_checks: {
          safety_passed: true,
          recovery_spacing_passed: true,
          volume_caps_passed: true,
          equipment_eligible: true,
          duration_valid: true,
        },
      };

      const candC: CandidateEvaluationInput = {
        exercise: sampleExerciseC,
        unit: 'A',
        terms: {
          priority_need: 0.5,
          days_since_last_stimulus: 3,
          progression_need: 0.5,
          goal_weight: 0.5,
          available_window_minutes: 60,
          duration_minutes: 45,
          readiness: 0.5,
        },
        filter_checks: {
          safety_passed: true,
          recovery_spacing_passed: true,
          volume_caps_passed: true,
          equipment_eligible: true,
          duration_valid: true,
        },
      };

      // Unit A ranks before Unit B when scores are equal
      const res = rankCandidates([candA, candC], config);
      expect(res[0]?.exercise.id).toBe('exercise_c'); // unit A
      expect(res[1]?.exercise.id).toBe('exercise_a'); // unit B
    });

    it('builds full DecisionRecord recording all candidates, terms, and filters', () => {
      const candidates: CandidateEvaluationInput[] = [
        {
          exercise: sampleExerciseA,
          unit: 'A',
          terms: {
            priority_need: 0.8,
            days_since_last_stimulus: 3,
            progression_need: 0.7,
            goal_weight: 0.6,
            available_window_minutes: 60,
            duration_minutes: 45,
            readiness: 0.8,
          },
          filter_checks: {
            safety_passed: true,
            recovery_spacing_passed: true,
            volume_caps_passed: true,
            equipment_eligible: true,
            duration_valid: true,
          },
        },
      ];

      const ranked = rankCandidates(candidates, config);
      const record = buildDecisionRecord(ranked, ranked[0]!, {
        decision_id: VALID_UUID_V7,
        created_at: '2026-10-06T04:00:00Z',
      });

      expect(record.id).toBe(VALID_UUID_V7);
      expect(record.candidates.length).toBe(1);
      expect(record.term_values['exercise_a:priority_need']).toBe(0.8);
      expect(record.selection).toBeDefined();
    });

    it('Property test: Perturbing inputs below hysteresis threshold never triggers plan replacement', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 1.0, noNaN: true }),
          fc.double({ min: 0.001, max: 0.09, noNaN: true }), // strictly less than 0.10 hysteresis
          (baseScore, deltaFraction) => {
            const currentScore = baseScore;
            const challengerScore = baseScore * (1 + deltaFraction); // below 1.10 threshold

            const decision = shouldReplaceCurrent(currentScore, challengerScore, true, config);
            expect(decision.shouldReplace).toBe(false);
            expect(decision.reason).toBe('none');
          }
        )
      );
    });

    it('replaces current plan when challenger exceeds hysteresis threshold and change is material', () => {
      const currentScore = 0.5;
      const challengerScore = 0.56; // 0.5 * 1.10 = 0.55 hurdle
      const material = true;

      const decision = shouldReplaceCurrent(
        currentScore,
        challengerScore,
        material,
        config,
        { trigger: 'schedule' }
      );
      expect(decision.shouldReplace).toBe(true);
      expect(decision.reason).toBe('schedule');
    });

    describe('isMaterialChange', () => {
      it('returns true when duration delta is exactly at 10% threshold', () => {
        expect(
          isMaterialChange(
            {
              exercise_sets_changed: false,
              duration_delta_pct: 0.1,
              hard_sets_delta_pct: 0,
              pattern_focus_changed: false,
            },
            config
          )
        ).toBe(true);
      });

      it('returns false when duration delta is just below 10% threshold', () => {
        expect(
          isMaterialChange(
            {
              exercise_sets_changed: false,
              duration_delta_pct: 0.099,
              hard_sets_delta_pct: 0,
              pattern_focus_changed: false,
            },
            config
          )
        ).toBe(false);
      });

      it('returns true when hard sets delta is exactly at 10% threshold', () => {
        expect(
          isMaterialChange(
            {
              exercise_sets_changed: false,
              duration_delta_pct: 0,
              hard_sets_delta_pct: 0.1,
              pattern_focus_changed: false,
            },
            config
          )
        ).toBe(true);
      });

      it('returns false when hard sets delta is just below 10% threshold', () => {
        expect(
          isMaterialChange(
            {
              exercise_sets_changed: false,
              duration_delta_pct: 0,
              hard_sets_delta_pct: 0.099,
              pattern_focus_changed: false,
            },
            config
          )
        ).toBe(false);
      });

      it('triggers on each boolean trigger alone', () => {
        expect(
          isMaterialChange(
            {
              exercise_sets_changed: true,
              duration_delta_pct: 0,
              hard_sets_delta_pct: 0,
              pattern_focus_changed: false,
            },
            config
          )
        ).toBe(true);

        expect(
          isMaterialChange(
            {
              exercise_sets_changed: false,
              duration_delta_pct: 0,
              hard_sets_delta_pct: 0,
              pattern_focus_changed: true,
            },
            config
          )
        ).toBe(true);
      });
    });
  });

  // ==========================================
  // M0-09 Progression Engine
  // ==========================================
  describe('M0-09 Progression Engine', () => {
    describe('evaluateFinderAttempt', () => {
      it('returns valid when reps in [4, 8] and quality == 3 with no pain', () => {
        const res = evaluateFinderAttempt(
          { reps: 6, quality: 3, pain: false, stopped_reason: 'target_reached' },
          config
        );
        expect(res.evaluation).toBe('valid');
      });

      it('returns step_up when reps > 8 with quality 3', () => {
        const res = evaluateFinderAttempt(
          { reps: 10, quality: 3, pain: false, stopped_reason: 'target_reached' },
          config
        );
        expect(res.evaluation).toBe('step_up');
      });

      it('returns step_down when reps < 4 or quality < 3', () => {
        const res1 = evaluateFinderAttempt(
          { reps: 3, quality: 3, pain: false, stopped_reason: 'technical_failure' },
          config
        );
        expect(res1.evaluation).toBe('step_down');

        const res2 = evaluateFinderAttempt(
          { reps: 6, quality: 2, pain: false, stopped_reason: 'technical_failure' },
          config
        );
        expect(res2.evaluation).toBe('step_down');
      });

      it('returns stop_pain and pain flag when pain is reported', () => {
        const res = evaluateFinderAttempt(
          { reps: 6, quality: 3, pain: true, stopped_reason: 'pain' },
          config
        );
        expect(res.evaluation).toBe('stop_pain');
        expect(res.pain_flag).toBe(true);
      });
    });

    describe('isReviewDue', () => {
      it('is due when >=3 sessions and >=6 days since review', () => {
        expect(isReviewDue({ main_sessions_since_review: 3, days_since_review: 6 }, config)).toBe(
          true
        );
        expect(isReviewDue({ main_sessions_since_review: 2, days_since_review: 6 }, config)).toBe(
          false
        );
        expect(isReviewDue({ main_sessions_since_review: 3, days_since_review: 5 }, config)).toBe(
          false
        );
      });

      it('is forced due when >= 10 days regardless of session count', () => {
        expect(isReviewDue({ main_sessions_since_review: 0, days_since_review: 10 }, config)).toBe(
          true
        );
      });
    });

    describe('reviewProgression outcomes', () => {
      it('Golden Example: insufficient_data when sets < 2', () => {
        const input: ReviewInput = {
          scope: 'exercise',
          recent_sets: [{ reps: 8, target_reps: 8, max_reps: 8, quality: 3 }],
          recent_session_rpes: [7],
          performance_drop_streak: 0,
          exposure_last_14d: 3,
          has_negative_trend: false,
          adherence_rate: 1.0,
        };
        const res = reviewProgression(input, config);
        expect(res.outcome).toBe('insufficient_data');
      });

      it('Golden Example: regress on pain or majority low quality', () => {
        const inputWithPain: ReviewInput = {
          scope: 'exercise',
          recent_sets: [
            { reps: 8, target_reps: 8, max_reps: 8, quality: 3, pain: true },
            { reps: 8, target_reps: 8, max_reps: 8, quality: 3 },
          ],
          recent_session_rpes: [7],
          performance_drop_streak: 0,
          exposure_last_14d: 3,
          has_negative_trend: false,
          adherence_rate: 1.0,
        };
        expect(reviewProgression(inputWithPain, config).outcome).toBe('regress');

        const inputLowQuality: ReviewInput = {
          ...inputWithPain,
          recent_sets: [
            { reps: 8, target_reps: 8, max_reps: 8, quality: 2 },
            { reps: 8, target_reps: 8, max_reps: 8, quality: 3 },
          ],
        };
        expect(reviewProgression(inputLowQuality, config).outcome).toBe('regress');
      });

      it('Golden Example: deload when RPE >= 9 for 2 sessions or performance drops for 2 sessions', () => {
        const inputHighRpe: ReviewInput = {
          scope: 'exercise',
          recent_sets: [
            { reps: 8, target_reps: 8, max_reps: 8, quality: 3 },
            { reps: 8, target_reps: 8, max_reps: 8, quality: 3 },
          ],
          recent_session_rpes: [9.5, 9],
          performance_drop_streak: 0,
          exposure_last_14d: 3,
          has_negative_trend: false,
          adherence_rate: 1.0,
        };
        expect(reviewProgression(inputHighRpe, config).outcome).toBe('deload');
      });

      it('Golden Example: progress when top rep reached, high quality, exposure >= 2, no negative trend', () => {
        const inputProgress: ReviewInput = {
          scope: 'exercise',
          recent_sets: [
            { reps: 8, target_reps: 8, max_reps: 8, quality: 3, rir: 2 },
            { reps: 8, target_reps: 8, max_reps: 8, quality: 3, rir: 2 },
          ],
          recent_session_rpes: [7, 7.5],
          performance_drop_streak: 0,
          exposure_last_14d: 3,
          has_negative_trend: false,
          adherence_rate: 0.9,
          is_loadable: true,
          load_verified: true,
        };
        const res = reviewProgression(inputProgress, config);
        expect(res.outcome).toBe('progress');
        expect(res.lever).toBeDefined();
      });

      it('Golden Example: maintain when performance is stable but not ready to progress', () => {
        const inputMaintain: ReviewInput = {
          scope: 'exercise',
          recent_sets: [
            { reps: 6, target_reps: 8, max_reps: 8, quality: 3 },
            { reps: 6, target_reps: 8, max_reps: 8, quality: 3 },
          ],
          recent_session_rpes: [7, 7],
          performance_drop_streak: 0,
          exposure_last_14d: 3,
          has_negative_trend: false,
          adherence_rate: 1.0,
        };
        expect(reviewProgression(inputMaintain, config).outcome).toBe('maintain');
      });

      it('Property test: NEVER progress with pain', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 2, max: 10 }),
            (setCount) => {
              const sets = Array.from({ length: setCount }, (_, i) => ({
                reps: 10,
                target_reps: 8,
                max_reps: 8,
                quality: 3,
                pain: i === 0, // pain on first set
              }));
              const input: ReviewInput = {
                scope: 'exercise',
                recent_sets: sets,
                recent_session_rpes: [7],
                performance_drop_streak: 0,
                exposure_last_14d: 4,
                has_negative_trend: false,
                adherence_rate: 1.0,
              };
              const res = reviewProgression(input, config);
              expect(res.outcome).not.toBe('progress');
            }
          )
        );
      });

      it('Property test: NEVER progress with exposure < 2', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 1 }),
            (exposure) => {
              const input: ReviewInput = {
                scope: 'exercise',
                recent_sets: [
                  { reps: 8, target_reps: 8, max_reps: 8, quality: 3, rir: 2 },
                  { reps: 8, target_reps: 8, max_reps: 8, quality: 3, rir: 2 },
                ],
                recent_session_rpes: [7],
                performance_drop_streak: 0,
                exposure_last_14d: exposure,
                has_negative_trend: false,
                adherence_rate: 1.0,
              };
              const res = reviewProgression(input, config);
              expect(res.outcome).not.toBe('progress');
            }
          )
        );
      });

      it('stagnation diagnostic triggers after exactly 3 non-progress reviews', () => {
        const history2 = [{ outcome: 'maintain' as const }, { outcome: 'maintain' as const }];
        expect(detectStagnation(history2, config).stagnated).toBe(false);

        const history3 = [
          { outcome: 'maintain' as const },
          { outcome: 'regress' as const },
          { outcome: 'maintain' as const },
        ];
        const res3 = detectStagnation(history3, config);
        expect(res3.stagnated).toBe(true);
        expect(res3.checklist).toHaveLength(6);
      });
    });
  });

  // ==========================================
  // M0-11 Muscle Exposure
  // ==========================================
  describe('M0-11 Muscle Exposure', () => {
    it('computes fractional sets correctly with primary 1.0 and secondary 0.5', () => {
      const now = '2026-10-06T12:00:00Z';
      const setLogs = [
        {
          exercise: INITIAL_EXERCISE_LIBRARY.find((e) => e.id === 'pushup_standard')!, // primary chest, secondary shoulders & arms
          performed_at: '2026-10-05T12:00:00Z',
          hard_set: true,
        },
      ];

      const exposure = computeExposure(setLogs, now, config);
      expect(exposure.chest.weekly_sets_fractional).toBe(1.0);
      expect(exposure.arms.weekly_sets_fractional).toBe(0.5);
      expect(exposure.shoulders.weekly_sets_fractional).toBe(0.5);
      expect(exposure.chest.estimate).toBe(true);
    });

    it('contributes nothing when coverage_weight is 0', () => {
      const now = '2026-10-06T12:00:00Z';
      const pullover = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === 'backpack_pullover_lying')!;
      expect(pullover.coverage_weight).toBe(0);

      const exposure = computeExposure(
        [{ exercise: pullover, performed_at: '2026-10-05T12:00:00Z', hard_set: true }],
        now,
        config
      );
      expect(exposure.back.weekly_sets_fractional).toBe(0);
      expect(exposure.back.data_points).toBe(0);
    });

    it('excludes sets outside the trailing window boundary', () => {
      const now = '2026-10-15T12:00:00Z'; // 15 days later
      const pushup = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === 'pushup_standard')!;

      const exposure = computeExposure(
        [{ exercise: pushup, performed_at: '2026-10-01T12:00:00Z', hard_set: true }], // 14 days ago > 7 days window
        now,
        config
      );
      expect(exposure.chest.weekly_sets_fractional).toBe(0);
    });

    it('trendFromSeries returns insufficient_data below 6 points, otherwise up/flat/down', () => {
      expect(trendFromSeries([10, 11, 12, 13, 14], config).trend).toBe('insufficient_data');

      // 6 points
      expect(trendFromSeries([10, 10, 10, 10, 10, 15], config).trend).toBe('up');
      expect(trendFromSeries([10, 10, 10, 10, 10, 7], config).trend).toBe('down');
      expect(trendFromSeries([10, 10, 10, 10, 10, 10], config).trend).toBe('flat');
    });
  });

  // ==========================================
  // M0-12 Knowledge Ledger & Information Needs
  // ==========================================
  describe('M0-12 Knowledge Ledger & Information Needs', () => {
    it('manages immutable ledger and rejects previously rejected inferences', () => {
      let ledger = createKnowledgeLedger();
      const weightFact: KnowledgeFact = {
        schema_version: 1,
        id: VALID_UUID_V7,
        key: 'weight',
        source: 'inferred',
        confidence: 0.8,
        value: 75,
        updated_at: '2026-10-06T00:00:00Z',
      };

      ledger = upsertFact(ledger, weightFact);
      expect(getFact(ledger, 'weight')?.value).toBe(75);

      // User rejects inference
      ledger = rejectInference(ledger, 'weight');
      expect(getFact(ledger, 'weight')).toBeUndefined();

      // Subsequent inferred upsert of rejected key is ignored
      ledger = upsertFact(ledger, weightFact);
      expect(getFact(ledger, 'weight')).toBeUndefined();
    });

    it('flags stale values according to freshness policies', () => {
      const now = '2026-10-25T00:00:00Z'; // 25 days later
      const weightFact: KnowledgeFact = {
        schema_version: 1,
        id: VALID_UUID_V7,
        key: 'weight',
        source: 'measured',
        confidence: 1.0,
        value: 75,
        updated_at: '2026-10-01T00:00:00Z', // 24 days old (> 14 days)
      };

      expect(isStale(weightFact, now, config)).toBe(true);

      const freshFact: KnowledgeFact = {
        ...weightFact,
        updated_at: '2026-10-20T00:00:00Z', // 5 days old (< 14 days)
      };
      expect(isStale(freshFact, now, config)).toBe(false);
    });

    it('deriveInformationNeeds returns need only when decision requires missing/stale fact', () => {
      const now = '2026-10-06T00:00:00Z';
      const ledger = createKnowledgeLedger();

      const needs = deriveInformationNeeds(
        {
          decision_class: 'body_composition_review',
          required_facts: ['weight'],
          consumer: 'body_comp_engine',
        },
        ledger,
        now,
        config
      );

      expect(needs.length).toBe(1);
      expect(needs[0]?.question_key).toBe('weight');
      expect(needs[0]?.priority).toBe('urgent');
    });

    it('respects daily question budget max_questions_per_day', () => {
      const now = '2026-10-06T00:00:00Z';
      const ledger = createKnowledgeLedger();

      const needs = deriveInformationNeeds(
        {
          decision_class: 'full_diagnostic',
          required_facts: ['weight', 'waist', 'baseline_test'],
          consumer: 'diagnostics',
        },
        ledger,
        now,
        config
      );

      // max_questions_per_day default is 1
      expect(needs.length).toBe(1);
    });
  });

  // ==========================================
  // M0-06 Environment and Eligibility
  // ==========================================
  describe('M0-06 Environment and Eligibility', () => {
    it('transitions environment items through valid lifecycle', () => {
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

      const validated = transitionEnvironmentItem(declared, {
        type: 'validate',
        timestamp: '2026-10-06T02:00:00Z',
        validated_at: '2026-10-06T02:00:00Z',
      });
      expect(validated.status).toBe('validated');

      const retired = transitionEnvironmentItem(validated, {
        type: 'retire',
        timestamp: '2026-10-06T03:00:00Z',
      });
      expect(retired.status).toBe('retired');
    });

    it('produces ZERO vertical_pull coverage with the Mock User environment', () => {
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

    it('rejects changes reducing main session below safety-locked 30 minutes', () => {
      const request: ChangeRequest = {
        schema_version: 1,
        id: VALID_UUID_V7,
        source: 'manual',
        command: 'shorten_session',
        target_day_index: 2,
        parameters: { duration_minutes: 20 },
        created_at: '2026-10-06T04:00:00Z',
      };

      const res = validateChange(request, {
        plan: basePlan,
        library: INITIAL_EXERCISE_LIBRARY,
        environment: defaultEnv,
        settings: config,
      });

      expect(res.status).toBe('rejected');
    });

    it('PlanStore never mutates input', () => {
      const request: ChangeRequest = {
        schema_version: 1,
        id: VALID_UUID_V7,
        source: 'manual',
        command: 'shorten_session',
        target_day_index: 2,
        parameters: { duration_minutes: 20 },
        created_at: '2026-10-06T04:00:00Z',
      };

      const copyBefore = JSON.stringify(basePlan);
      const res = PlanStore.applyChange(basePlan, request, {
        library: INITIAL_EXERCISE_LIBRARY,
        environment: defaultEnv,
        settings: config,
      });

      expect(res.success).toBe(false);
      expect(JSON.stringify(basePlan)).toBe(copyBefore);
    });

    it('finds nearest eligible alternative for replace_exercise matching pattern and within ±1 level', () => {
      const target = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === 'pushup_standard')!;
      const alt = findNearestAlternative(target, INITIAL_EXERCISE_LIBRARY, defaultEnv);
      expect(alt).toBeDefined();
      expect(alt?.pattern).toBe(target.pattern);
      expect(Math.abs(alt!.level - target.level)).toBeLessThanOrEqual(1);
      expect(alt?.id).not.toBe(target.id);
    });

    describe('verifyPlanIntegrity', () => {
      function makePlan(
        horizon: number,
        day0Status: 'locked' | 'protected' | 'adaptive' = 'locked',
        day1Status: 'locked' | 'protected' | 'adaptive' = 'protected'
      ): Plan {
        return {
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
        };
      }

      it('returns true for valid plans with horizon 3, 7, and 8', () => {
        expect(verifyPlanIntegrity(makePlan(3))).toBe(true);
        expect(verifyPlanIntegrity(makePlan(7))).toBe(true);
        expect(verifyPlanIntegrity(makePlan(8))).toBe(true);
      });

      it('returns false for plan horizon mismatch or invalid lock/protected invariants', () => {
        const mismatchedPlan: Plan = {
          ...makePlan(7),
          horizon_days: 8,
        };
        expect(verifyPlanIntegrity(mismatchedPlan)).toBe(false);

        const unlockedDay0 = makePlan(7, 'adaptive', 'protected');
        expect(verifyPlanIntegrity(unlockedDay0)).toBe(false);

        const unprotectedDay1 = makePlan(7, 'locked', 'adaptive');
        expect(verifyPlanIntegrity(unprotectedDay1)).toBe(false);
      });
    });
  });

  // ==========================================
  // M0-08 Session Generator + Duration Calculator
  // ==========================================
  describe('M0-08 Session Generator & Duration Calculator', () => {
    const defaultEnv: Record<string, EnvironmentItem> = {
      floor: { item_id: 'floor', status: 'validated', updated_at: '2026-10-06T00:00:00Z' },
      chair: {
        item_id: 'chair',
        status: 'validated',
        validated_at: '2026-10-06T00:00:00Z',
        updated_at: '2026-10-06T00:00:00Z',
      },
    };

    const eligibleExercises = INITIAL_EXERCISE_LIBRARY.filter(
      (e) => isEligible(e, defaultEnv).eligible
    );

    it('generates identical session snapshots for the exact same seed', () => {
      const capabilityMap: CapabilityMap = {
        horizontal_push: { level: 3, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        vertical_push: { level: 3, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        core: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
      };

      const session1 = generateSession({
        training_unit: 'A',
        capability_map: capabilityMap,
        eligible_exercises: eligibleExercises,
        settings: config,
        goal_emphasis: 'hypertrophy',
        seed: 'fixed-seed-1',
        created_at: '2026-10-06T04:00:00Z',
      });

      const session2 = generateSession({
        training_unit: 'A',
        capability_map: capabilityMap,
        eligible_exercises: eligibleExercises,
        settings: config,
        goal_emphasis: 'hypertrophy',
        seed: 'fixed-seed-1',
        created_at: '2026-10-06T04:00:00Z',
      });

      expect(session1.status).toBe('ready');
      expect(session2.status).toBe('ready');
      expect(session1).toEqual(session2);
    });

    it('returns needs_baseline when target pattern is missing from capability map', () => {
      const incompleteCapabilityMap: CapabilityMap = {
        horizontal_push: { level: 3, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        // vertical_push and core missing for unit A
      };

      const result = generateSession({
        training_unit: 'A',
        capability_map: incompleteCapabilityMap,
        eligible_exercises: eligibleExercises,
        settings: config,
        goal_emphasis: 'hypertrophy',
        seed: 'fixed-seed-1',
        created_at: '2026-10-06T04:00:00Z',
      });

      expect(result.status).toBe('needs_baseline');
      if (result.status === 'needs_baseline') {
        expect(result.patterns).toContain('vertical_push');
        expect(result.patterns).toContain('core');
        expect(result.patterns).not.toContain('horizontal_push');
      }
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

        const capabilityMap: CapabilityMap = {
          horizontal_push: { level: 1 + Math.floor(prng() * 6), confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
          vertical_push: { level: 1 + Math.floor(prng() * 5), confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
          horizontal_pull: { level: 1 + Math.floor(prng() * 3), confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
          vertical_pull: { level: 1 + Math.floor(prng() * 2), confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
          squat: { level: 1 + Math.floor(prng() * 5), confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
          hinge: { level: 1 + Math.floor(prng() * 4), confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
          lunge: { level: 1 + Math.floor(prng() * 3), confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
          core: { level: 1 + Math.floor(prng() * 4), confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
          mobility: { level: 1 + Math.floor(prng() * 2), confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
          conditioning: { level: 1 + Math.floor(prng() * 2), confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        };

        const result = generateSession({
          training_unit: unit,
          capability_map: capabilityMap,
          eligible_exercises: eligibleExercises,
          settings: config,
          goal_emphasis: emphasis,
          physique_priorities: ['chest', 'back'],
          seed: `run-seed-${i}`,
          created_at: '2026-10-06T04:00:00Z',
        });

        expect(result.status).toBe('ready');
        if (result.status === 'ready') {
          const session = result.snapshot;
          const duration = estimateDuration(session, config);
          expect(duration).toBeGreaterThanOrEqual(30);
          expect(duration).toBeLessThanOrEqual(60);

          const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
          expect(totalSets).toBeLessThanOrEqual(24);
        }
      }
    });
  });

  describe('M0-13 Horizon and Quick Commands', () => {
    const config = getEffectiveConfig();
    const env: Record<string, EnvironmentItem> = {
      floor: { item_id: 'floor', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
      wall: { item_id: 'wall', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
      pullup_bar: { item_id: 'pullup_bar', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
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

    // User availability: 60 mins every weekday, 20 mins on Saturday, 0 on Sunday
    const scheduleProvider = new LocalScheduleProvider([
      { dayOfWeek: 1, start: '07:00', end: '08:00', duration_minutes: 60 },
      { dayOfWeek: 2, start: '07:00', end: '08:00', duration_minutes: 60 },
      { dayOfWeek: 3, start: '07:00', end: '08:00', duration_minutes: 60 },
      { dayOfWeek: 4, start: '07:00', end: '08:00', duration_minutes: 60 },
      { dayOfWeek: 5, start: '07:00', end: '08:00', duration_minutes: 60 },
      { dayOfWeek: 6, start: '08:00', end: '08:20', duration_minutes: 20 },
    ]);

    const availability = scheduleProvider.getAvailability({
      startDate: '2026-10-05', // Monday
      endDate: '2026-10-18',
    });

    it('buildHorizon constructs plan matching execution_horizon_days with correct day statuses', () => {
      const plan = buildHorizon(
        {
          now_iso: '2026-10-05T06:00:00Z',
          availability_windows: availability,
          capability_map: baseCapabilityMap,
          eligible_exercises: eligibleExercises,
          library: INITIAL_EXERCISE_LIBRARY,
          environment: env,
        },
        config
      );

      expect(plan.days.length).toBe(7);
      expect(plan.horizon_days).toBe(7);

      expect(plan.days[0]?.status).toBe('locked');
      expect(plan.days[1]?.status).toBe('protected');
      expect(plan.days[2]?.status).toBe('adaptive');
      expect(plan.days[3]?.status).toBe('adaptive');
      expect(plan.days[4]?.status).toBe('adaptive');
      expect(plan.days[5]?.status).toBe('adaptive');
      expect(plan.days[6]?.status).toBe('adaptive');
    });

    it('respects day_start_hour when computing local date', () => {
      // 03:00 UTC with day_start_hour = 4 belongs to previous calendar day
      const dateBeforeCutoff = getLocalDateWithDayStart('2026-10-05T03:00:00Z', 4);
      expect(dateBeforeCutoff).toBe('2026-10-04');

      // 05:00 UTC belongs to current calendar day
      const dateAfterCutoff = getLocalDateWithDayStart('2026-10-05T05:00:00Z', 4);
      expect(dateAfterCutoff).toBe('2026-10-05');
    });

    it('enforces main sessions limits and consecutive limits', () => {
      const plan = buildHorizon(
        {
          now_iso: '2026-10-05T06:00:00Z',
          availability_windows: availability,
          capability_map: baseCapabilityMap,
          eligible_exercises: eligibleExercises,
          library: INITIAL_EXERCISE_LIBRARY,
          environment: env,
        },
        config
      );

      const mainDays = plan.days.filter((d) => d.kind === 'main');
      expect(mainDays.length).toBeGreaterThanOrEqual(3);
      expect(mainDays.length).toBeLessThanOrEqual(5);

      // Verify no more than 2 consecutive main days
      let consecutive = 0;
      for (const d of plan.days) {
        if (d.kind === 'main') {
          consecutive++;
          expect(consecutive).toBeLessThanOrEqual(2);
        } else {
          consecutive = 0;
        }
      }
    });

    it('assigns micro or rest when availability window is shorter than min_main_session_minutes', () => {
      const plan = buildHorizon(
        {
          now_iso: '2026-10-05T06:00:00Z', // Day 5 is Saturday (20 min window)
          availability_windows: availability,
          capability_map: baseCapabilityMap,
          eligible_exercises: eligibleExercises,
          library: INITIAL_EXERCISE_LIBRARY,
          environment: env,
        },
        config
      );

      // Saturday (day index 5) has 20 min availability (< 30 min minMainSession)
      const saturday = plan.days[5];
      expect(saturday?.kind).toBe('micro');
    });

    it('Property: sliding horizon with unchanged inputs produces identical adaptive days', () => {
      const input = {
        now_iso: '2026-10-05T06:00:00Z',
        availability_windows: availability,
        capability_map: baseCapabilityMap,
        eligible_exercises: eligibleExercises,
        library: INITIAL_EXERCISE_LIBRARY,
        environment: env,
      };

      const initialPlan = buildHorizon(input, config);
      const nextDayIso = '2026-10-06T06:00:00Z';
      const slidPlan = slideHorizon(initialPlan, nextDayIso, input, config);

      expect(slidPlan.days.length).toBe(7);
      // Day 0 of slid plan should match day 1 of initial plan
      expect(slidPlan.days[0]?.date).toBe(initialPlan.days[1]?.date);
      expect(slidPlan.days[0]?.status).toBe('locked');
      expect(slidPlan.days[1]?.status).toBe('protected');

      // Adaptive days in common should maintain kinds
      for (let i = 2; i < 6; i++) {
        expect(slidPlan.days[i]?.kind).toBe(initialPlan.days[i + 1]?.kind);
      }
    });

    it('Quick commands return validated proposals and never mutate plan', () => {
      const plan = buildHorizon(
        {
          now_iso: '2026-10-05T06:00:00Z',
          availability_windows: availability,
          capability_map: baseCapabilityMap,
          eligible_exercises: eligibleExercises,
          library: INITIAL_EXERCISE_LIBRARY,
          environment: env,
        },
        config
      );

      const targetExerciseId = plan.days[0]?.session_snapshot?.exercises[0]?.exercise_id ?? 'pushup_standard';
      const planBefore = JSON.stringify(plan);

      const proposalHarder = makeHarder(plan, 0, targetExerciseId, {
        library: INITIAL_EXERCISE_LIBRARY,
        environment: env,
        settings: config,
      });

      expect(proposalHarder.schema_version).toBe(1);
      expect(proposalHarder.validation_status).toBe('accepted');
      expect(proposalHarder.autonomy_level).toBe('ask'); // change_today defaults to ask
      expect(JSON.stringify(plan)).toBe(planBefore); // Immutable

      const proposalEasier = makeEasier(plan, 0, targetExerciseId, {
        library: INITIAL_EXERCISE_LIBRARY,
        environment: env,
        settings: config,
      });
      expect(proposalEasier.validation_status).toBe('accepted');

      const proposalReplace = replaceExercise(plan, 0, targetExerciseId, 'tempo_pushup', {
        library: INITIAL_EXERCISE_LIBRARY,
        environment: env,
        settings: config,
      });
      expect(proposalReplace.validation_status).toBe('accepted');

      const proposalFocus = increaseMuscleFocus(plan, 'chest', {
        library: INITIAL_EXERCISE_LIBRARY,
        environment: env,
        settings: config,
      });
      expect(proposalFocus.validation_status).toBe('accepted');

      const proposalShorten = shortenSession(plan, 0, {
        library: INITIAL_EXERCISE_LIBRARY,
        environment: env,
        settings: config,
      });
      expect(proposalShorten.validation_status).toBe('accepted');
    });

    it('PlanStore rejects manual changes on day index >= 2 with use_quick_command', () => {
      const plan = buildHorizon(
        {
          now_iso: '2026-10-05T06:00:00Z',
          availability_windows: availability,
          capability_map: baseCapabilityMap,
          eligible_exercises: eligibleExercises,
          library: INITIAL_EXERCISE_LIBRARY,
          environment: env,
        },
        config
      );

      const manualRequestOnDay3: ChangeRequest = {
        schema_version: 1,
        id: VALID_UUID_V7,
        source: 'manual',
        command: 'replace_exercise',
        target_day_index: 3,
        target_exercise_id: 'pushup_standard',
        parameters: { replacement_exercise_id: 'pushup_kneeling' },
        created_at: '2026-10-05T06:00:00Z',
      };

      const result = PlanStore.applyChange(plan, manualRequestOnDay3, {
        library: INITIAL_EXERCISE_LIBRARY,
        environment: env,
        settings: config,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('rejected');
      expect(result.issues.some((i) => i.message === 'use_quick_command')).toBe(true);
    });

    it('requiresApproval respects autonomy setting defaults', () => {
      expect(requiresApproval('change_today', config)).toBe(true);
      expect(requiresApproval('change_tomorrow', config)).toBe(true);
      expect(requiresApproval('replan_future', config)).toBe(false); // auto
      expect(requiresApproval('due_progression', config)).toBe(false); // notify
      expect(requiresApproval('global_setting', config)).toBe(true);
      expect(requiresApproval('rest_default', config)).toBe(true);
      expect(requiresApproval('muscle_target', config)).toBe(true);
    });
  });

  describe('M0-14 AI Contract and Safety Guard', () => {
    const config = getEffectiveConfig();

    const sampleRequest: AiRequest = {
      task: 'rank',
      candidates: [
        { id: 'cand_pushup', short_label: 'Standard Push-up' },
        { id: 'cand_dip', short_label: 'Dip' },
      ],
      context_summary: {
        training_unit: 'A',
        readiness_score: 0.8,
      },
    };

    it('rejects invalid candidate id not present in request', () => {
      const response: AiResponse = {
        selected_candidate_id: 'unknown_hallucinated_id',
        ranking_ids: ['unknown_hallucinated_id'],
        rationale_codes: ['stimulus_need'],
      };

      const result = validateAiResponse(response, sampleRequest, config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('not in request candidates'))).toBe(true);
    });

    it('rejects extra unknown fields in AI response', () => {
      const responseWithExtra = {
        selected_candidate_id: 'cand_pushup',
        ranking_ids: ['cand_pushup'],
        rationale_codes: ['stimulus_need'],
        hallucinated_custom_field: 'illegal',
      };

      const result = validateAiResponse(responseWithExtra, sampleRequest, config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unknown field'))).toBe(true);
    });

    it('rejects unknown rationale codes', () => {
      const responseBadRationale = {
        selected_candidate_id: 'cand_pushup',
        ranking_ids: ['cand_pushup'],
        rationale_codes: ['invalid_rationale_code' as unknown as 'stimulus_need'],
      };

      const result = validateAiResponse(responseBadRationale, sampleRequest, config);
      expect(result.valid).toBe(false);
    });

    it('rejects message drafts that exceed ai_message_draft_max_length', () => {
      const longMessage = 'A'.repeat(300); // Max is 280
      const responseLong = {
        selected_candidate_id: 'cand_pushup',
        ranking_ids: ['cand_pushup'],
        rationale_codes: ['stimulus_need' as const],
        message_draft: longMessage,
      };

      const result = validateAiResponse(responseLong, sampleRequest, config);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum allowed length'))).toBe(true);
    });

    it('minimizeContext strictly removes forbidden fields and personal data', () => {
      const rawContext = {
        name: 'John Doe',
        age: 32,
        email: 'john@example.com',
        user_notes: 'Felt tired after work',
        photos: ['photo1.jpg'],
        training_unit: 'A',
        readiness_score: 0.85,
        goal_emphasis: 'hypertrophy',
      };

      const minimized = minimizeContext(rawContext);
      expect(minimized['name']).toBeUndefined();
      expect(minimized['age']).toBeUndefined();
      expect(minimized['email']).toBeUndefined();
      expect(minimized['user_notes']).toBeUndefined();
      expect(minimized['photos']).toBeUndefined();

      expect(minimized['training_unit']).toBe('A');
      expect(minimized['readiness_score']).toBe(0.85);
      expect(minimized['goal_emphasis']).toBe('hypertrophy');
    });

    it('decideWithAi works cleanly without any provider, falling back to top engine candidate', async () => {
      const result = await decideWithAi(sampleRequest, undefined, 'cand_pushup', config);
      expect(result.selected_candidate_id).toBe('cand_pushup');
      expect(result.fallback_used).toBe(true);
      expect(result.fallback_reason).toBe('no_provider');
      expect(result.audit.model).toBe('none');
      expect(result.audit.validator_verdict).toBe('skipped');
    });

    it('decideWithAi catches provider error and falls back gracefully', async () => {
      const failingProvider = new MockAiProvider(undefined, true); // shouldFail = true
      const result = await decideWithAi(sampleRequest, failingProvider, 'cand_pushup', config);

      expect(result.selected_candidate_id).toBe('cand_pushup');
      expect(result.fallback_used).toBe(true);
      expect(result.fallback_reason).toBe('provider_error');
      expect(result.audit.validator_verdict).toBe('invalid');
    });

    it('decideWithAi successfully adopts valid provider output and records audit hash', async () => {
      const provider = new MockAiProvider('cand_dip');
      const result = await decideWithAi(sampleRequest, provider, 'cand_pushup', config);

      expect(result.selected_candidate_id).toBe('cand_dip');
      expect(result.fallback_used).toBe(false);
      expect(result.audit.validator_verdict).toBe('valid');
      expect(typeof result.audit.request_hash).toBe('string');
      expect(result.audit.request_hash.length).toBeGreaterThan(0);

      const manualAudit = buildAiAuditRecord('provider', sampleRequest, result.response, 'valid');
      expect(manualAudit.request_hash).toBe(fnv1a(JSON.stringify(sampleRequest)));
    });
  });
});
