import type {
  Plan,
  PlanDay,
  ChangeRequest,
  ChangeProposal,
  Exercise,
  MuscleGroup,
  MovementPattern,
  DayKind,
  DayReasonCode,
  PlanRevisionReason,
  DecisionRecord,
} from '@hfos/contracts';
import type { EffectiveConfig } from '@hfos/config';
import {
  requireNumber,
  requireObject,
  getEffectiveConfig,
  requiresApproval,
} from '@hfos/config';
import type { AvailabilityWindow } from '@hfos/ports';
import type { EventEnvelope } from '@hfos/events';
import type { CapabilityMap } from './progression.js';
import type { EnvironmentItem } from './environment.js';
import {
  generateSession,
  estimateDuration,
  UNIT_PATTERNS,
  type TrainingUnitKind,
} from './session.js';
import {
  rankCandidates,
  shouldReplaceCurrent,
  isMaterialChange,
  buildDecisionRecord,
  type CandidateEvaluationInput,
} from './ranking.js';
import { validateChange, type ValidationContext } from './validator.js';

export interface TrainingState {
  last_stimulus_at_by_pattern?: Partial<Record<MovementPattern, string>>;
  weekly_sets_by_muscle?: Partial<Record<MuscleGroup, number>>;
  readiness?: number | null;
  last_session_unit?: 'A' | 'B' | 'C' | 'D';
  review_outcome_by_pattern?: Partial<Record<MovementPattern, string>>;
  pain_flags?: string[];
}

export interface BuildHorizonInput {
  plan_id?: string;
  now_iso: string; // ISO string representing now
  availability_windows: AvailabilityWindow[];
  capability_map: CapabilityMap;
  eligible_exercises: Exercise[];
  library: Exercise[];
  environment: Record<string, EnvironmentItem>;
  physique_priorities?: [MuscleGroup, MuscleGroup];
  goal_emphasis?: 'strength' | 'hypertrophy' | 'endurance';
  user_pain_flags?: string[];
  seed?: string;
  training_state?: TrainingState;
}

export interface SlideHorizonInput {
  plan: Plan;
  new_today_iso: string;
  horizon_inputs: BuildHorizonInput;
}

/**
 * Formats a Date object to YYYY-MM-DD using ISO representation.
 */
function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/**
 * Computes local date YYYY-MM-DD from an ISO timestamp taking into account day_start_hour.
 * If hour < day_start_hour, it belongs to the previous calendar date.
 */
export function getLocalDateWithDayStart(isoString: string, dayStartHour: number): string {
  const d = new Date(isoString);
  const hour = d.getUTCHours();
  if (hour < dayStartHour) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return toDateString(d);
}

/**
 * Adds N days to a YYYY-MM-DD date string.
 */
export function addDays(dateStr: string, daysToAdd: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + daysToAdd);
  return toDateString(d);
}

const UNIT_ROTATION: TrainingUnitKind[] = ['A', 'B', 'C', 'D'];

/**
 * Derives TrainingState pure from historical session and performance events.
 */
export function deriveTrainingState(
  events: EventEnvelope[],
  now: string | Date,
  config: EffectiveConfig = getEffectiveConfig()
): TrainingState {
  const nowIso = typeof now === 'string' ? now : now.toISOString();
  const nowMs = Date.parse(nowIso);
  const exposureWindowDays = requireNumber(config, 'exposure_window_days');
  const msPerDay = requireNumber(config, 'milliseconds_per_day');
  const windowMs = exposureWindowDays * msPerDay;

  const lastStimulus: Partial<Record<MovementPattern, string>> = {};
  const weeklySets: Partial<Record<MuscleGroup, number>> = {};
  let readinessVal: number | null = null;
  let lastUnit: ('A' | 'B' | 'C' | 'D') | undefined = undefined;
  const reviewOutcomes: Partial<Record<MovementPattern, string>> = {};
  const painFlags: string[] = [];

  const sortedEvents = [...events].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  for (const event of sortedEvents) {
    const payload = (event.payload ?? {}) as Record<string, unknown>;

    if (event.type === 'session.started' || event.type === 'session.completed') {
      const unit = (payload.training_unit ?? payload.unit) as ('A' | 'B' | 'C' | 'D') | undefined;
      if (unit && (unit === 'A' || unit === 'B' || unit === 'C' || unit === 'D')) {
        lastUnit = unit;
        const patterns = UNIT_PATTERNS[unit];
        for (const p of patterns) {
          lastStimulus[p] = event.occurred_at;
        }
      }
      if (Array.isArray(payload.patterns)) {
        for (const p of payload.patterns as MovementPattern[]) {
          lastStimulus[p] = event.occurred_at;
        }
      }
    } else if (event.type === 'session.set_logged') {
      if (payload.pattern) {
        lastStimulus[payload.pattern as MovementPattern] = event.occurred_at;
      }
      if (payload.pain) {
        const flag = (payload.pattern ?? payload.exercise_id ?? 'pain') as string;
        if (!painFlags.includes(flag)) {
          painFlags.push(flag);
        }
      }
      if (payload.muscle) {
        const age = nowMs - Date.parse(event.occurred_at);
        if (age >= 0 && age <= windowMs) {
          const m = payload.muscle as MuscleGroup;
          weeklySets[m] = (weeklySets[m] ?? 0) + 1;
        }
      }
    } else if (event.type === 'readiness.recorded') {
      if (typeof payload.score === 'number') {
        readinessVal = payload.score;
      }
    } else if (event.type === 'progression.applied' || event.type === 'progression.evaluated') {
      if (payload.pattern && payload.outcome) {
        reviewOutcomes[payload.pattern as MovementPattern] = String(payload.outcome);
      }
    } else if (event.type === 'override.requested') {
      if (typeof payload.pain_flag === 'string' && !painFlags.includes(payload.pain_flag)) {
        painFlags.push(payload.pain_flag);
      }
    }
  }

  return {
    last_stimulus_at_by_pattern: Object.keys(lastStimulus).length > 0 ? lastStimulus : undefined,
    weekly_sets_by_muscle: Object.keys(weeklySets).length > 0 ? weeklySets : undefined,
    readiness: readinessVal,
    last_session_unit: lastUnit,
    review_outcome_by_pattern: Object.keys(reviewOutcomes).length > 0 ? reviewOutcomes : undefined,
    pain_flags: painFlags.length > 0 ? painFlags : undefined,
  };
}

/**
 * M0-13 / E1a buildHorizon:
 * Computes rolling execution horizon with real normalized terms, real filters, and real provenance.
 * Day 0 locked, Day 1 protected, Days 2-6 adaptive.
 * Every main day records chosen unit, estimated_minutes, reason_code, and DecisionRecord.
 * Non-main days record the exact branch DayReasonCode.
 * Plan records inputs_defaulted indicating which data points were missing.
 */
export function buildHorizon(
  input: BuildHorizonInput,
  config: EffectiveConfig = getEffectiveConfig()
): Plan {
  const horizonDays = requireNumber(config, 'execution_horizon_days');
  const dayStartHour = requireNumber(config, 'day_start_hour');
  const minMainMinutes = requireNumber(config, 'min_main_session_minutes');
  const mainMin = requireNumber(config, 'main_sessions_min');
  const mainMax = requireNumber(config, 'main_sessions_max');
  const maxConsecutiveMain = requireNumber(config, 'max_consecutive_main_days');
  const msPerDay = requireNumber(config, 'milliseconds_per_day');
  const msPerHour = requireNumber(config, 'milliseconds_per_hour');
  const minHoursSpacing = requireNumber(config, 'min_hours_between_hard_same_pattern');
  const minEligiblePatterns = requireNumber(config, 'min_eligible_patterns_per_unit');
  const progressionNeedDefault = requireNumber(config, 'progression_need_default');
  const readinessDefault = requireNumber(config, 'readiness_default');
  const unitGoalWeights = requireObject<Record<string, Record<string, number>>>(
    config,
    'unit_goal_weights'
  );

  const todayStr = getLocalDateWithDayStart(input.now_iso, dayStartHour);
  const seed = input.seed ?? 'horizon-default-seed';

  const inputsDefaultedSet = new Set<string>();
  const trainingState = input.training_state;

  if (
    !trainingState?.last_stimulus_at_by_pattern ||
    Object.keys(trainingState.last_stimulus_at_by_pattern).length === 0
  ) {
    inputsDefaultedSet.add('history');
  }
  if (trainingState?.readiness === undefined || trainingState?.readiness === null) {
    inputsDefaultedSet.add('readiness');
  }
  if (
    !trainingState?.review_outcome_by_pattern ||
    Object.keys(trainingState.review_outcome_by_pattern).length === 0
  ) {
    inputsDefaultedSet.add('progression');
  }

  const rollingLastStimulus: Partial<Record<MovementPattern, string>> = {
    ...(trainingState?.last_stimulus_at_by_pattern ?? {}),
  };
  const rollingWeeklySets: Partial<Record<MuscleGroup, number>> = {
    ...(trainingState?.weekly_sets_by_muscle ?? {}),
  };

  const days: PlanDay[] = [];
  let unitIndex = 0;
  let consecutiveMainCount = 0;
  let totalMainCount = 0;

  for (let dayIndex = 0; dayIndex < horizonDays; dayIndex++) {
    const dateStr = addDays(todayStr, dayIndex);

    // Day status
    const status: 'locked' | 'protected' | 'adaptive' =
      dayIndex === 0 ? 'locked' : dayIndex === 1 ? 'protected' : 'adaptive';

    // Find availability window for this date
    const windowForDay = input.availability_windows.find((w) => w.date === dateStr);
    const availableMinutes = windowForDay ? windowForDay.duration_minutes : 0;

    // Check if main session is eligible on this day
    const canHaveConsecutive = consecutiveMainCount < maxConsecutiveMain;
    const canHaveMoreMain = totalMainCount < mainMax;
    const hasEnoughTime = availableMinutes >= minMainMinutes;

    const daysRemaining = horizonDays - dayIndex;
    const neededMain = mainMin - totalMainCount;
    const mustBeMainIfPossible =
      neededMain > 0 && daysRemaining <= neededMain && canHaveConsecutive;

    const shouldScheduleMain =
      hasEnoughTime && canHaveConsecutive && (canHaveMoreMain || mustBeMainIfPossible);

    let kind: DayKind = 'rest';
    let sessionSnapshot = null;
    let chosenUnit: TrainingUnitKind | undefined = undefined;
    let estimatedMinutes: number | undefined = undefined;
    let reasonCode: DayReasonCode = 'scheduled_main';
    let decisionRecord: DecisionRecord | undefined = undefined;

    if (shouldScheduleMain) {
      kind = 'main';
      reasonCode = 'scheduled_main';
      consecutiveMainCount++;
      totalMainCount++;

      const candidateUnits = UNIT_ROTATION;
      const hourStr = String(dayStartHour);
      const hourPrefix = hourStr.length === 1 ? `0${hourStr}` : hourStr;
      const dayDateMs = Date.parse(`${dateStr}T${hourPrefix}:00:00Z`);

      const unitInputs: CandidateEvaluationInput[] = candidateUnits.map((u) => {
        const patterns = UNIT_PATTERNS[u];

        // 1. Representative exercise using UNIT_PATTERNS
        const repExercise =
          input.eligible_exercises.find((e) => patterns.includes(e.pattern)) ??
          input.eligible_exercises[0]!;

        // 2. days_since_last_stimulus (normalized stimulus_gap and schedule_fit
        // are derived by rankCandidates from these raw term inputs)
        let daysSinceForTerms = 0;
        const timestamps = patterns
          .map((p) => rollingLastStimulus[p])
          .filter((t): t is string => !!t);

        if (timestamps.length > 0) {
          const mostRecentStimulusMs = Math.max(...timestamps.map((t) => Date.parse(t)));
          const daysSince = Math.max(0, (dayDateMs - mostRecentStimulusMs) / msPerDay);
          daysSinceForTerms = daysSince;
        } else if (!trainingState?.last_stimulus_at_by_pattern) {
          inputsDefaultedSet.add('history');
        }

        // 3. priority_need
        const highPriorities: MuscleGroup[] = input.physique_priorities ? [...input.physique_priorities] : [];
        let highPriorityServingPatterns = 0;
        if (highPriorities.length > 0) {
          for (const p of patterns) {
            const eligibleForP = input.eligible_exercises.filter((e) => e.pattern === p);
            const servesHigh = eligibleForP.some((e) =>
              e.primary_muscles.some((m) => highPriorities.includes(m))
            );
            if (servesHigh) {
              highPriorityServingPatterns++;
            }
          }
        }
        const priority_need =
          patterns.length > 0 ? highPriorityServingPatterns / patterns.length : 0;

        // 4. progression_need
        let progression_need = progressionNeedDefault;
        if (trainingState?.review_outcome_by_pattern) {
          const outcomes = patterns
            .map((p) => trainingState.review_outcome_by_pattern![p])
            .filter((o): o is string => !!o);

          if (outcomes.length > 0) {
            const scoreProgress = requireNumber(config, 'progression_score_progress');
            const scoreMaintain = requireNumber(config, 'progression_score_maintain');
            const scoreRegress = requireNumber(config, 'progression_score_regress');
            let outcomeSum = 0;
            for (const o of outcomes) {
              if (o === 'progress') outcomeSum += scoreProgress;
              else if (o === 'maintain') outcomeSum += scoreMaintain;
              else outcomeSum += scoreRegress;
            }
            progression_need = outcomeSum / outcomes.length;
          } else {
            inputsDefaultedSet.add('progression');
          }
        } else {
          inputsDefaultedSet.add('progression');
        }

        // 5. goal_weight
        const goalEmphasis = input.goal_emphasis ?? 'strength';
        const goal_weight = unitGoalWeights[goalEmphasis]?.[u] ?? 1.0;

        // 6. schedule_fit is derived by rankCandidates from
        //    available_window_minutes / duration_minutes term inputs.

        // 7. readiness
        let readiness = readinessDefault;
        if (trainingState?.readiness !== undefined && trainingState.readiness !== null) {
          readiness = Math.min(1, Math.max(0, trainingState.readiness));
        } else {
          inputsDefaultedSet.add('readiness');
        }

        // REAL FILTERS
        // Equipment filter
        const eligiblePatternsCount = patterns.filter((p) =>
          input.eligible_exercises.some((e) => e.pattern === p)
        ).length;
        const equipment_eligible = eligiblePatternsCount >= minEligiblePatterns;

        // Recovery spacing filter
        let recovery_spacing_passed = true;
        for (const p of patterns) {
          const lastStimulus = rollingLastStimulus[p];
          if (lastStimulus) {
            const hoursSince = (dayDateMs - Date.parse(lastStimulus)) / msPerHour;
            if (hoursSince < minHoursSpacing) {
              recovery_spacing_passed = false;
              break;
            }
          }
        }

        // Volume caps filter
        let volume_caps_passed = true;
        const weeklyCap = requireNumber(config, 'weekly_sets_cap_per_muscle');
        for (const p of patterns) {
          const eligibleForP = input.eligible_exercises.filter((e) => e.pattern === p);
          for (const ex of eligibleForP) {
            for (const m of ex.primary_muscles) {
              const currentSets = rollingWeeklySets[m] ?? 0;
              if (currentSets >= weeklyCap) {
                volume_caps_passed = false;
                break;
              }
            }
            if (!volume_caps_passed) break;
          }
          if (!volume_caps_passed) break;
        }

        // Duration filter
        const duration_valid = availableMinutes >= minMainMinutes;

        // Safety filter
        const allPainFlags = [
          ...(input.user_pain_flags ?? []),
          ...(trainingState?.pain_flags ?? []),
        ];
        const safety_passed = !patterns.some((p) => allPainFlags.includes(p));

        return {
          exercise: repExercise,
          unit: u,
          terms: {
            priority_need,
            days_since_last_stimulus: daysSinceForTerms,
            progression_need,
            goal_weight,
            available_window_minutes: availableMinutes,
            duration_minutes: minMainMinutes,
            readiness,
          },
          filter_checks: {
            safety_passed,
            recovery_spacing_passed,
            volume_caps_passed,
            equipment_eligible,
            duration_valid,
          },
        };
      });

      const ranked = rankCandidates(unitInputs, config);
      const chosenCandidate = ranked[0];
      chosenUnit =
        (chosenCandidate?.unit as TrainingUnitKind) ??
        UNIT_ROTATION[unitIndex % UNIT_ROTATION.length]!;
      unitIndex++;

      const genResult = generateSession({
        training_unit: chosenUnit,
        capability_map: input.capability_map,
        eligible_exercises: input.eligible_exercises,
        settings: config,
        goal_emphasis: input.goal_emphasis,
        physique_priorities: input.physique_priorities,
        seed: `${seed}-day-${dayIndex}`,
        created_at: `${dateStr}T04:00:00Z`,
      });

      if (genResult.status === 'ready') {
        sessionSnapshot = genResult.snapshot;
      }

      // Update rolling stimulus timestamps and weekly sets for subsequent horizon days
      for (const p of UNIT_PATTERNS[chosenUnit]) {
        rollingLastStimulus[p] = `${dateStr}T${hourPrefix}:00:00Z`;
      }
      if (sessionSnapshot) {
        for (const exItem of sessionSnapshot.exercises) {
          const exDef = input.library.find((e) => e.id === exItem.exercise_id);
          if (exDef) {
            for (const m of exDef.primary_muscles) {
              rollingWeeklySets[m] = (rollingWeeklySets[m] ?? 0) + exItem.sets.length;
            }
          }
        }
      }

      estimatedMinutes = sessionSnapshot
        ? estimateDuration(sessionSnapshot, config)
        : minMainMinutes;

      decisionRecord = buildDecisionRecord(ranked, chosenCandidate ?? null, {
        decision_id: `dec-${seed}-day-${dayIndex}`,
        decision_class: 'unit_selection',
        created_at: `${dateStr}T04:00:00Z`,
      });
    } else {
      consecutiveMainCount = 0;
      if (availableMinutes > 0 && availableMinutes < minMainMinutes) {
        kind = 'micro';
        reasonCode = 'window_too_short';
      } else if (availableMinutes >= minMainMinutes && !canHaveConsecutive) {
        kind = 'active_recovery';
        reasonCode = 'consecutive_cap';
      } else if (availableMinutes >= minMainMinutes && !canHaveMoreMain) {
        kind = 'rest';
        reasonCode = 'quota_reached';
      } else if (availableMinutes === 0) {
        kind = 'rest';
        reasonCode = 'no_window';
      } else {
        kind = 'rest';
        reasonCode = 'recovery_spacing';
      }
    }

    days.push({
      schema_version: 1,
      day_index: dayIndex,
      date: dateStr,
      kind,
      status,
      session_snapshot: sessionSnapshot,
      unit: chosenUnit,
      estimated_minutes: estimatedMinutes,
      reason_code: reasonCode,
      decision: decisionRecord,
    });
  }

  return {
    schema_version: 1,
    id: input.plan_id ?? '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
    created_at: input.now_iso,
    days,
    horizon_days: horizonDays,
    current_unit: days[0]?.unit,
    inputs_defaulted: Array.from(inputsDefaultedSet),
  };
}

/**
 * M0-13 / E1a slideHorizon:
 * Drops Day 0, appends a new last day.
 * Preserves decision provenance across shifts.
 * Adaptive days change only when shouldReplaceCurrent evaluates true, recording real revision_reason.
 * With unchanged inputs the days stay identical.
 */
export function slideHorizon(
  plan: Plan,
  newTodayIso: string,
  inputs: BuildHorizonInput,
  config: EffectiveConfig = getEffectiveConfig()
): Plan {
  const freshPlan = buildHorizon({ ...inputs, now_iso: newTodayIso }, config);

  const updatedDays: PlanDay[] = [];

  // Drop old Day 0: take indices 1..(horizon - 1) from existing plan and re-index
  for (let i = 1; i < plan.days.length; i++) {
    const existingDay = plan.days[i]!;
    const newDayIndex = i - 1;
    const freshCounterpart = freshPlan.days[newDayIndex];

    const targetStatus: 'locked' | 'protected' | 'adaptive' =
      newDayIndex === 0 ? 'locked' : newDayIndex === 1 ? 'protected' : 'adaptive';

    if (newDayIndex === 0 || newDayIndex === 1) {
      // Day 0 (was day 1) becomes locked; Day 1 (was day 2) becomes protected
      updatedDays.push({
        ...existingDay,
        day_index: newDayIndex,
        status: targetStatus,
      });
    } else {
      // Adaptive day: evaluate shouldReplaceCurrent
      if (!freshCounterpart || !existingDay.session_snapshot || !freshCounterpart.session_snapshot) {
        updatedDays.push({
          ...existingDay,
          day_index: newDayIndex,
          status: 'adaptive',
        });
      } else {
        const currentSnapshot = existingDay.session_snapshot;
        const challengerSnapshot = freshCounterpart.session_snapshot;

        const currentDuration = currentSnapshot.exercises.reduce(
          (acc, ex) => acc + ex.sets.reduce((sAcc, s) => sAcc + s.rest_seconds, 0),
          0
        );
        const challengerDuration = challengerSnapshot.exercises.reduce(
          (acc, ex) => acc + ex.sets.reduce((sAcc, s) => sAcc + s.rest_seconds, 0),
          0
        );
        const currentSets = currentSnapshot.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
        const challengerSets = challengerSnapshot.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

        const durationDeltaPct =
          currentDuration > 0 ? (challengerDuration - currentDuration) / currentDuration : 0;
        const hardSetsDeltaPct =
          currentSets > 0 ? (challengerSets - currentSets) / currentSets : 0;

        const isMaterial = isMaterialChange(
          {
            exercise_sets_changed: currentSets !== challengerSets,
            duration_delta_pct: durationDeltaPct,
            hard_sets_delta_pct: hardSetsDeltaPct,
            pattern_focus_changed: existingDay.unit !== freshCounterpart.unit,
          },
          config
        );

        const currentScore =
          (existingDay.decision?.selection as { rank_score?: number } | undefined)?.rank_score ??
          requireNumber(config, 'rank_weight_readiness');
        const challengerScore =
          (freshCounterpart.decision?.selection as { rank_score?: number } | undefined)?.rank_score ??
          requireNumber(config, 'rank_weight_readiness');

        const decision = shouldReplaceCurrent(
          currentScore,
          challengerScore,
          isMaterial,
          config
        );

        if (decision.shouldReplace) {
          let revision_reason: PlanRevisionReason = 'threshold';
          const oldWindow = inputs.availability_windows.find((w) => w.date === existingDay.date);
          const newWindow = inputs.availability_windows.find(
            (w) => w.date === freshCounterpart.date
          );

          if (oldWindow?.duration_minutes !== newWindow?.duration_minutes) {
            revision_reason = 'schedule';
          } else if (
            inputs.training_state?.readiness !== undefined &&
            inputs.training_state.readiness !== null
          ) {
            revision_reason = 'readiness';
          } else if (inputs.training_state?.last_session_unit) {
            revision_reason = 'prior_session';
          }

          updatedDays.push({
            ...freshCounterpart,
            day_index: newDayIndex,
            status: 'adaptive',
            revision_reason,
          });
        } else {
          updatedDays.push({
            ...existingDay,
            day_index: newDayIndex,
            status: 'adaptive',
          });
        }
      }
    }
  }

  // Append new last day from freshPlan
  const lastFreshDay = freshPlan.days[freshPlan.days.length - 1];
  if (lastFreshDay) {
    updatedDays.push({
      ...lastFreshDay,
      day_index: updatedDays.length,
      status: 'adaptive',
    });
  }

  return {
    ...freshPlan,
    id: plan.id,
    days: updatedDays,
    inputs_defaulted: freshPlan.inputs_defaulted,
  };
}


/**
 * Quick commands helper to construct and validate ChangeProposal
 */
function createValidatedProposal(
  request: ChangeRequest,
  validationContext: ValidationContext,
  decisionClass: string,
  summary: string,
  changes: string[]
): ChangeProposal {
  const validation = validateChange(request, validationContext);
  const config = validationContext.settings ?? getEffectiveConfig();
  const requiresAppr = requiresApproval(decisionClass, config);
  const autonomyLevel = requiresAppr ? 'ask' : 'auto';

  return {
    schema_version: 1,
    id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
    request_id: request.id,
    diff: {
      summary,
      changes,
    },
    decision_class: decisionClass,
    autonomy_level: autonomyLevel,
    status: validation.status === 'rejected' ? 'rejected' : 'pending',
    validation_status: validation.status,
    nearest_valid_alternative: validation.nearest_alternative,
    warnings: validation.issues.filter((i) => i.severity === 'warning').map((i) => i.message),
    created_at: request.created_at,
  };
}

/**
 * Quick Command: makeHarder
 */
export function makeHarder(
  plan: Plan,
  targetDayIndex: number,
  targetExerciseId: string,
  context: Omit<ValidationContext, 'plan'>
): ChangeProposal {
  const request: ChangeRequest = {
    schema_version: 1,
    id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
    source: 'quick',
    command: 'make_harder',
    target_day_index: targetDayIndex,
    target_exercise_id: targetExerciseId,
    created_at: plan.created_at,
  };

  return createValidatedProposal(
    request,
    { ...context, plan },
    'change_today',
    `Increase intensity for ${targetExerciseId} on day ${targetDayIndex}`,
    [`Increment load or difficulty for exercise ${targetExerciseId}`]
  );
}

/**
 * Quick Command: makeEasier
 */
export function makeEasier(
  plan: Plan,
  targetDayIndex: number,
  targetExerciseId: string,
  context: Omit<ValidationContext, 'plan'>
): ChangeProposal {
  const request: ChangeRequest = {
    schema_version: 1,
    id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
    source: 'quick',
    command: 'make_easier',
    target_day_index: targetDayIndex,
    target_exercise_id: targetExerciseId,
    created_at: plan.created_at,
  };

  return createValidatedProposal(
    request,
    { ...context, plan },
    'change_today',
    `Decrease intensity for ${targetExerciseId} on day ${targetDayIndex}`,
    [`Reduce load or progression level for exercise ${targetExerciseId}`]
  );
}

/**
 * Quick Command: replaceExercise
 */
export function replaceExercise(
  plan: Plan,
  targetDayIndex: number,
  targetExerciseId: string,
  replacementExerciseId: string,
  context: Omit<ValidationContext, 'plan'>
): ChangeProposal {
  const request: ChangeRequest = {
    schema_version: 1,
    id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
    source: 'quick',
    command: 'replace_exercise',
    target_day_index: targetDayIndex,
    target_exercise_id: targetExerciseId,
    parameters: {
      replacement_exercise_id: replacementExerciseId,
    },
    created_at: plan.created_at,
  };

  return createValidatedProposal(
    request,
    { ...context, plan },
    'change_today',
    `Replace exercise ${targetExerciseId} with ${replacementExerciseId} on day ${targetDayIndex}`,
    [`Swap ${targetExerciseId} -> ${replacementExerciseId}`]
  );
}

/**
 * Quick Command: increaseMuscleFocus
 */
export function increaseMuscleFocus(
  plan: Plan,
  muscle: MuscleGroup,
  context: Omit<ValidationContext, 'plan'>
): ChangeProposal {
  const request: ChangeRequest = {
    schema_version: 1,
    id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
    source: 'quick',
    command: 'increase_muscle_focus',
    parameters: {
      target_muscle: muscle,
    },
    created_at: plan.created_at,
  };

  return createValidatedProposal(
    request,
    { ...context, plan },
    'muscle_target',
    `Increase training stimulus for priority muscle: ${muscle}`,
    [`Add volume emphasis for ${muscle}`]
  );
}

/**
 * Quick Command: shortenSession
 */
export function shortenSession(
  plan: Plan,
  targetDayIndex: number,
  context: Omit<ValidationContext, 'plan'>
): ChangeProposal {
  const request: ChangeRequest = {
    schema_version: 1,
    id: '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
    source: 'quick',
    command: 'shorten_session',
    target_day_index: targetDayIndex,
    created_at: plan.created_at,
  };

  return createValidatedProposal(
    request,
    { ...context, plan },
    'change_today',
    `Shorten session on day ${targetDayIndex}`,
    [`Reduce set counts or drop exercise on day ${targetDayIndex}`]
  );
}
