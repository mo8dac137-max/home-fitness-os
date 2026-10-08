import type { MovementPattern } from '@hfos/contracts';
import type { EffectiveConfig } from '@hfos/config';
import { requireNumber, requireArray, getEffectiveConfig } from '@hfos/config';

export interface CapabilityEntry {
  level: number;
  confidence: number; // 0..1
  last_reviewed: string;
}

export type CapabilityMap = Partial<Record<MovementPattern, CapabilityEntry>>;

export type FinderStoppedReason = 'technical_failure' | 'target_reached' | 'pain';
export type FinderEvaluation = 'valid' | 'step_up' | 'step_down' | 'stop_pain';

export interface FinderAttempt {
  reps: number;
  quality: number; // 1-3
  pain: boolean;
  stopped_reason: FinderStoppedReason;
}

export interface FinderResult {
  evaluation: FinderEvaluation;
  pain_flag?: boolean;
}

/**
 * M0-09 a) Finder (technical-cap test):
 * Valid = reps within [finder_rep_min, finder_rep_max] AND quality == min_quality_threshold AND no pain.
 * More reps than max with quality 3 -> step_up;
 * Fewer than min or quality < 3 -> step_down;
 * Pain -> stop_pain and a pain flag.
 * Never test to true failure.
 */
export function evaluateFinderAttempt(
  attempt: FinderAttempt,
  config: EffectiveConfig = getEffectiveConfig()
): FinderResult {
  if (attempt.pain || attempt.stopped_reason === 'pain') {
    return {
      evaluation: 'stop_pain',
      pain_flag: true,
    };
  }

  const minReps = requireNumber(config, 'finder_rep_min');
  const maxReps = requireNumber(config, 'finder_rep_max');
  const minQuality = requireNumber(config, 'min_quality_threshold');

  if (attempt.quality < minQuality || attempt.reps < minReps) {
    return {
      evaluation: 'step_down',
    };
  }

  if (attempt.reps > maxReps && attempt.quality >= minQuality) {
    return {
      evaluation: 'step_up',
    };
  }

  return {
    evaluation: 'valid',
  };
}

export interface ReviewState {
  main_sessions_since_review: number;
  days_since_review: number;
}

/**
 * M0-09 b) isReviewDue:
 * Due when >=3 main sessions AND >=6 days since the last review, or >=10 days (max).
 */
export function isReviewDue(
  state: ReviewState,
  config: EffectiveConfig = getEffectiveConfig()
): boolean {
  const minSessions = requireNumber(config, 'review_min_sessions');
  const minDays = requireNumber(config, 'review_min_days');
  const maxDays = requireNumber(config, 'review_max_days');

  if (state.days_since_review >= maxDays) {
    return true;
  }

  return state.main_sessions_since_review >= minSessions && state.days_since_review >= minDays;
}

export type ProgressionOutcome =
  | 'progress'
  | 'maintain'
  | 'regress'
  | 'deload'
  | 'insufficient_data';

export type ProgressionLever =
  | 'reps'
  | 'tempo'
  | 'rom'
  | 'load'
  | 'harder_variation'
  | 'density'
  | 'volume';

export type ReviewScope = 'exercise' | 'pattern' | 'muscle_priority' | 'unit';

export interface HardSetLog {
  reps: number;
  target_reps: number;
  max_reps: number;
  quality: number;
  rir?: number;
  rpe?: number;
  pain?: boolean;
}

export interface ReviewInput {
  scope: ReviewScope;
  recent_sets: HardSetLog[];
  recent_session_rpes: number[];
  performance_drop_streak: number;
  exposure_last_14d: number;
  has_negative_trend: boolean;
  adherence_rate: number; // 0..1
  is_loadable?: boolean;
  load_verified?: boolean;
}

export interface ProgressionReviewResult {
  outcome: ProgressionOutcome;
  lever?: ProgressionLever;
  reasons: string[];
  confidence: number; // 0..1
}

/**
 * M0-09 c) reviewProgression:
 * Rules:
 * - insufficient_data if not enough sessions/sets (less than 2 sets)
 * - regress if quality < 3 in >=50% of recent hard sets or any pain
 * - deload if session RPE >= deload_rpe for 2 consecutive sessions or performance falls for 2 consecutive sessions
 * - progress only if top of rep target range is reached in all working sets with RIR >= 2 (or quality 3)
 *   AND exposure_last_14d >= min_exposure_progression AND no negative trend
 * - else maintain
 * Progress picks ONE lever, the first applicable in lever_order setting.
 * Adherence lowers confidence, never a hard gate.
 */
export function reviewProgression(
  input: ReviewInput,
  config: EffectiveConfig = getEffectiveConfig()
): ProgressionReviewResult {
  const minQuality = requireNumber(config, 'min_quality_threshold');
  const deloadRpe = requireNumber(config, 'deload_rpe');
  const minExposure = requireNumber(config, 'min_exposure_progression');
  const leverOrder = requireArray<ProgressionLever>(config, 'lever_order');

  const confidence = Math.max(0, Math.min(1, input.adherence_rate));

  // 1. Data sufficiency
  if (input.recent_sets.length < 2) {
    return {
      outcome: 'insufficient_data',
      reasons: ['Not enough recorded sets for a valid progression review'],
      confidence,
    };
  }

  // 2. Regress condition: any pain or low quality in >= 50% of sets
  const hasPain = input.recent_sets.some((s) => s.pain);
  const lowQualityCount = input.recent_sets.filter((s) => s.quality < minQuality).length;
  const isMajorityLowQuality = lowQualityCount * 2 >= input.recent_sets.length;

  if (hasPain || isMajorityLowQuality) {
    const reasons: string[] = [];
    if (hasPain) reasons.push('Reported pain during recent performance');
    if (isMajorityLowQuality) reasons.push('Execution quality degraded below threshold in >= 50% of sets');
    return {
      outcome: 'regress',
      reasons,
      confidence,
    };
  }

  // 3. Deload condition: consecutive high RPE or 2-session performance drop
  const recentRpes = input.recent_session_rpes;
  const consecutiveHighRpe =
    recentRpes.length >= 2 &&
    recentRpes[recentRpes.length - 1]! >= deloadRpe &&
    recentRpes[recentRpes.length - 2]! >= deloadRpe;

  const consecutiveDrop = input.performance_drop_streak >= 2;

  if (consecutiveHighRpe || consecutiveDrop) {
    const reasons: string[] = [];
    if (consecutiveHighRpe) reasons.push(`Session RPE sustained >= ${deloadRpe} across consecutive sessions`);
    if (consecutiveDrop) reasons.push('Performance dropped across 2 consecutive sessions');
    return {
      outcome: 'deload',
      reasons,
      confidence,
    };
  }

  // 4. Progress condition:
  // Top of rep window in all sets AND RIR >= 2 (or quality >= 3) AND exposure >= 2 AND no negative trend
  const allReachedTopRep = input.recent_sets.every((s) => s.reps >= s.max_reps);
  const allGoodRirOrQuality = input.recent_sets.every((s) =>
    s.rir !== undefined ? s.rir >= 2 : s.quality >= minQuality
  );
  const goodExposure = input.exposure_last_14d >= minExposure;
  const noNegativeTrend = !input.has_negative_trend;

  if (allReachedTopRep && allGoodRirOrQuality && goodExposure && noNegativeTrend) {
    // Pick first applicable lever from lever_order
    let selectedLever: ProgressionLever | undefined;
    for (const lever of leverOrder) {
      if (lever === 'load') {
        if (input.is_loadable && input.load_verified) {
          selectedLever = lever;
          break;
        }
      } else {
        selectedLever = lever;
        break;
      }
    }

    return {
      outcome: 'progress',
      lever: selectedLever,
      reasons: ['Consistent mastery at top of rep target range with strong recovery and stimulus exposure'],
      confidence,
    };
  }

  // 5. Default outcome: maintain
  return {
    outcome: 'maintain',
    reasons: ['Performance stable; continuing current prescription to consolidate adaptation'],
    confidence,
  };
}

export const STAGNATION_CHECKLIST = [
  'technique',
  'recovery',
  'exposure',
  'data_sufficiency_nutrition',
  'exercise_suitability',
  'need_for_a_new_stimulus',
] as const;

export type StagnationChecklistItem = (typeof STAGNATION_CHECKLIST)[number];

export interface StagnationDiagnostic {
  stagnated: boolean;
  consecutive_non_progress_count: number;
  checklist?: StagnationChecklistItem[];
}

/**
 * M0-09 d) detectStagnation:
 * 3 consecutive non-progress reviews for a pattern returns a diagnostic checklist:
 * technique, recovery, exposure, data sufficiency/nutrition, exercise suitability, need for a new stimulus.
 */
export function detectStagnation(
  reviewHistory: Array<{ outcome: ProgressionOutcome }>,
  config: EffectiveConfig = getEffectiveConfig()
): StagnationDiagnostic {
  const threshold = requireNumber(config, 'stagnation_threshold');

  if (reviewHistory.length < threshold) {
    return {
      stagnated: false,
      consecutive_non_progress_count: 0,
    };
  }

  let consecutiveCount = 0;
  for (let i = reviewHistory.length - 1; i >= 0; i--) {
    if (reviewHistory[i]!.outcome !== 'progress') {
      consecutiveCount += 1;
    } else {
      break;
    }
  }

  if (consecutiveCount >= threshold) {
    return {
      stagnated: true,
      consecutive_non_progress_count: consecutiveCount,
      checklist: [...STAGNATION_CHECKLIST],
    };
  }

  return {
    stagnated: false,
    consecutive_non_progress_count: consecutiveCount,
  };
}
