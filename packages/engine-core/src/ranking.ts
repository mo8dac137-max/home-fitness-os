import type { Exercise, DecisionRecord } from '@hfos/contracts';
import type { EffectiveConfig } from '@hfos/config';
import { requireNumber, getEffectiveConfig } from '@hfos/config';

export interface CandidateTerms {
  priority_need: number; // 0..1
  days_since_last_stimulus: number;
  progression_need: number; // 0..1
  goal_weight: number; // 0..1
  available_window_minutes: number;
  duration_minutes: number;
  readiness: number; // 0..1
}

export interface CandidateEvaluationInput {
  exercise: Exercise;
  unit?: string;
  terms: CandidateTerms;
  filter_checks: {
    safety_passed: boolean;
    recovery_spacing_passed: boolean;
    volume_caps_passed: boolean;
    equipment_eligible: boolean;
    duration_valid: boolean;
  };
  rejection_reasons?: string[];
}

export interface EvaluatedCandidate {
  exercise: Exercise;
  unit: string;
  passed_filters: boolean;
  filter_rejections: string[];
  term_values: {
    priority_need: number;
    stimulus_gap: number;
    progression_need: number;
    goal_weight: number;
    schedule_fit: number;
    readiness: number;
  };
  rank_score: number;
}

/**
 * M0-10 Ranking:
 * 1. Hard filters first (safety, recovery/spacing, volume caps, equipment, duration).
 * 2. Candidates failing any filter are excluded from selection with reasons recorded.
 * 3. Terms normalized to 0..1:
 *    - priority_need
 *    - stimulus_gap (days_since_last_stimulus / target_stimulus_interval_days, capped at 1)
 *    - progression_need
 *    - goal_weight
 *    - schedule_fit (min(1, available_window / duration))
 *    - readiness
 * 4. Weighted sum over config weights.
 * 5. Tie-break: unit ascending, then exercise id ascending.
 */
export function rankCandidates(
  candidates: CandidateEvaluationInput[],
  config: EffectiveConfig = getEffectiveConfig()
): EvaluatedCandidate[] {
  const targetStimulusInterval = requireNumber(config, 'target_stimulus_interval_days');

  const wPriority = requireNumber(config, 'rank_weight_priority_need');
  const wStimulus = requireNumber(config, 'rank_weight_stimulus_gap');
  const wProgression = requireNumber(config, 'rank_weight_progression_need');
  const wGoal = requireNumber(config, 'rank_weight_goal_weight');
  const wSchedule = requireNumber(config, 'rank_weight_schedule_fit');
  const wReadiness = requireNumber(config, 'rank_weight_readiness');

  const evaluated: EvaluatedCandidate[] = candidates.map((cand) => {
    const unit = cand.unit ?? '';
    const rejections: string[] = [...(cand.rejection_reasons ?? [])];

    if (!cand.filter_checks.safety_passed) rejections.push('safety_failed');
    if (!cand.filter_checks.recovery_spacing_passed) rejections.push('recovery_spacing_failed');
    if (!cand.filter_checks.volume_caps_passed) rejections.push('volume_caps_exceeded');
    if (!cand.filter_checks.equipment_eligible) rejections.push('equipment_ineligible');
    if (!cand.filter_checks.duration_valid) rejections.push('duration_invalid');

    const passed_filters = rejections.length === 0;

    // Normalize terms
    const priority_need = Math.max(0, Math.min(1, cand.terms.priority_need));
    const stimulus_gap = Math.max(
      0,
      Math.min(1, cand.terms.days_since_last_stimulus / targetStimulusInterval)
    );
    const progression_need = Math.max(0, Math.min(1, cand.terms.progression_need));
    const goal_weight = Math.max(0, Math.min(1, cand.terms.goal_weight));

    const schedule_fit =
      cand.terms.duration_minutes > 0
        ? Math.max(
            0,
            Math.min(1, cand.terms.available_window_minutes / cand.terms.duration_minutes)
          )
        : 1;

    const readiness = Math.max(0, Math.min(1, cand.terms.readiness));

    const rank_score = passed_filters
      ? priority_need * wPriority +
        stimulus_gap * wStimulus +
        progression_need * wProgression +
        goal_weight * wGoal +
        schedule_fit * wSchedule +
        readiness * wReadiness
      : 0;

    return {
      exercise: cand.exercise,
      unit,
      passed_filters,
      filter_rejections: rejections,
      term_values: {
        priority_need,
        stimulus_gap,
        progression_need,
        goal_weight,
        schedule_fit,
        readiness,
      },
      rank_score,
    };
  });

  return evaluated.sort((a, b) => {
    // Eligible candidates before filtered candidates
    if (a.passed_filters !== b.passed_filters) {
      return a.passed_filters ? -1 : 1;
    }
    // Highest rank score first
    if (b.rank_score !== a.rank_score) {
      return b.rank_score - a.rank_score;
    }
    // Tie-break by unit
    const unitCmp = a.unit.localeCompare(b.unit);
    if (unitCmp !== 0) {
      return unitCmp;
    }
    // Tie-break by exercise id
    return a.exercise.id.localeCompare(b.exercise.id);
  });
}

/**
 * Builds the full DecisionRecord preserving complete provenance.
 */
export function buildDecisionRecord(
  candidates: EvaluatedCandidate[],
  selected: EvaluatedCandidate | null,
  context: {
    decision_id: string;
    decision_class?: string;
    created_at: string;
  }
): DecisionRecord {
  const termValuesRecord: Record<string, number> = {};
  const filterList: string[] = [];

  for (const c of candidates) {
    termValuesRecord[`${c.exercise.id}:rank_score`] = c.rank_score;
    termValuesRecord[`${c.exercise.id}:priority_need`] = c.term_values.priority_need;
    termValuesRecord[`${c.exercise.id}:stimulus_gap`] = c.term_values.stimulus_gap;
    termValuesRecord[`${c.exercise.id}:progression_need`] = c.term_values.progression_need;
    termValuesRecord[`${c.exercise.id}:goal_weight`] = c.term_values.goal_weight;
    termValuesRecord[`${c.exercise.id}:schedule_fit`] = c.term_values.schedule_fit;
    termValuesRecord[`${c.exercise.id}:readiness`] = c.term_values.readiness;

    if (!c.passed_filters) {
      filterList.push(`${c.exercise.id}:rejected:[${c.filter_rejections.join(',')}]`);
    }
  }

  return {
    schema_version: 1,
    id: context.decision_id,
    decision_class: context.decision_class ?? 'exercise_selection',
    candidates: candidates.map((c) => ({
      exercise_id: c.exercise.id,
      unit: c.unit,
      passed_filters: c.passed_filters,
      rank_score: c.rank_score,
      rejections: c.filter_rejections,
    })),
    term_values: termValuesRecord,
    filters: filterList,
    selection: selected
      ? {
          exercise_id: selected.exercise.id,
          unit: selected.unit,
          rank_score: selected.rank_score,
        }
      : null,
    created_at: context.created_at,
  };
}

export interface MaterialChangeParams {
  exercise_sets_changed: boolean;
  duration_delta_pct: number;
  hard_sets_delta_pct: number;
  pattern_focus_changed: boolean;
  threshold_duration_pct?: number;
  threshold_hard_sets_pct?: number;
}

/**
 * Pure material change detector parameterized via config settings.
 */
export function isMaterialChange(
  params: MaterialChangeParams,
  config: EffectiveConfig = getEffectiveConfig()
): boolean {
  const threshDuration =
    params.threshold_duration_pct ?? requireNumber(config, 'material_change_duration_pct');
  const threshHardSets =
    params.threshold_hard_sets_pct ?? requireNumber(config, 'material_change_hard_sets_pct');

  if (params.exercise_sets_changed) return true;
  if (params.pattern_focus_changed) return true;
  if (Math.abs(params.duration_delta_pct) >= threshDuration) return true;
  if (Math.abs(params.hard_sets_delta_pct) >= threshHardSets) return true;

  return false;
}

export type ReplaceReasonCode =
  | 'schedule'
  | 'readiness'
  | 'prior_session'
  | 'threshold'
  | 'none';

export interface ReplaceDecision {
  shouldReplace: boolean;
  reason: ReplaceReasonCode;
}

/**
 * shouldReplaceCurrent(current, challenger, config) =
 * challenger score >= current score * (1 + hysteresis_threshold) AND isMaterialChange is true.
 * Returns reason code: schedule | readiness | prior_session | threshold | none.
 */
export function shouldReplaceCurrent(
  currentScore: number,
  challengerScore: number,
  isMaterial: boolean,
  config: EffectiveConfig = getEffectiveConfig(),
  reasonContext?: { trigger?: ReplaceReasonCode }
): ReplaceDecision {
  const hysteresis = requireNumber(config, 'hysteresis_threshold');
  const hurdleScore = currentScore * (1 + hysteresis);

  if (challengerScore >= hurdleScore && isMaterial) {
    const reason = reasonContext?.trigger ?? 'threshold';
    return {
      shouldReplace: true,
      reason,
    };
  }

  return {
    shouldReplace: false,
    reason: 'none',
  };
}
