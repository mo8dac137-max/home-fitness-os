import type { Exercise, Plan } from '@hfos/contracts';

export const PACKAGE_NAME = '@hfos/engine-core';

export * from './environment.js';
export * from './validator.js';
export * from './session.js';

export interface RankingWeights {
  priority_need: number;
  stimulus_gap: number;
  progression_need: number;
  goal_weight: number;
  schedule_fit: number;
  readiness: number;
}

export interface CandidateMetric {
  exercise: Exercise;
  priority_need: number;
  stimulus_gap: number;
  progression_need: number;
  goal_weight: number;
  schedule_fit: number;
  readiness: number;
}

export interface RankedCandidate {
  exercise: Exercise;
  rank_score: number;
  metrics: Omit<CandidateMetric, 'exercise'>;
}

/**
 * Deterministic rank score calculation:
 * Hard filters must be applied prior to ranking, then weighted sum:
 * priority_need 0.20, stimulus_gap 0.20, progression_need 0.20,
 * goal_weight 0.15, schedule_fit 0.15, readiness 0.10
 */
export function calculateRankScore(
  metric: Omit<CandidateMetric, 'exercise'>,
  weights: RankingWeights
): number {
  return (
    metric.priority_need * weights.priority_need +
    metric.stimulus_gap * weights.stimulus_gap +
    metric.progression_need * weights.progression_need +
    metric.goal_weight * weights.goal_weight +
    metric.schedule_fit * weights.schedule_fit +
    metric.readiness * weights.readiness
  );
}

/**
 * Deterministic candidate ranking:
 * Produces deterministic ordering (by score descending, then exercise id ascending)
 * PROVISIONAL: superseded by M0-05/M0-10/M0-13
 */
export function rankCandidates(
  candidates: CandidateMetric[],
  weights: RankingWeights
): RankedCandidate[] {
  return candidates
    .map((c) => {
      const { exercise, ...metrics } = c;
      const rank_score = calculateRankScore(metrics, weights);
      return { exercise, rank_score, metrics };
    })
    .sort((a, b) => {
      if (b.rank_score !== a.rank_score) {
        return b.rank_score - a.rank_score;
      }
      return a.exercise.id.localeCompare(b.exercise.id);
    });
}

/**
 * Material change test:
 * A plan revision qualifies as a material change if:
 * 1. An exercise set is changed, OR
 * 2. Duration changes by >= threshold_duration_pct, OR
 * 3. Hard sets change by >= threshold_hard_sets_pct, OR
 * 4. Movement pattern focus is changed.
 *
 * All thresholds are versioned settings from @hfos/config (Rule 10: no hard-coded numbers).
 */
export interface MaterialChangeParams {
  exercise_sets_changed: boolean;
  duration_delta_pct: number;
  hard_sets_delta_pct: number;
  pattern_focus_changed: boolean;
  threshold_duration_pct: number;
  threshold_hard_sets_pct: number;
}

// PROVISIONAL: superseded by M0-05/M0-10/M0-13
export function isMaterialChange(params: MaterialChangeParams): boolean {
  if (params.exercise_sets_changed) return true;
  if (params.pattern_focus_changed) return true;
  if (Math.abs(params.duration_delta_pct) >= params.threshold_duration_pct) return true;
  if (Math.abs(params.hard_sets_delta_pct) >= params.threshold_hard_sets_pct) return true;

  return false;
}

/**
 * Checks if Day 0 is locked and Day 1 is protected according to plan invariants
 * PROVISIONAL: superseded by M0-05/M0-10/M0-13
 */
export function verifyPlanIntegrity(plan: Plan): boolean {
  if (plan.days.length !== plan.horizon_days) return false;
  const day0 = plan.days[0];
  const day1 = plan.days[1];
  if (!day0 || day0.status !== 'locked') return false;
  if (!day1 || day1.status !== 'protected') return false;
  return true;
}
