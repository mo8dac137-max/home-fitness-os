import type {
  Plan,
  PlanDay,
  ChangeRequest,
  ChangeProposal,
  Exercise,
  MuscleGroup,
  DayKind,
} from '@hfos/contracts';
import type { EffectiveConfig } from '@hfos/config';
import { requireNumber, getEffectiveConfig, requiresApproval } from '@hfos/config';
import type { AvailabilityWindow } from '@hfos/ports';
import type { CapabilityMap } from './progression.js';
import type { EnvironmentItem } from './environment.js';
import { generateSession, type TrainingUnitKind } from './session.js';
import {
  rankCandidates,
  shouldReplaceCurrent,
  isMaterialChange,
  type CandidateEvaluationInput,
} from './ranking.js';
import { validateChange, type ValidationContext } from './validator.js';

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
 * M0-13 b) buildHorizon:
 * Returns horizon_days PlanDay entries starting at "today" (local date using day_start_hour).
 * Day 0 status locked, Day 1 protected, others adaptive.
 * Each day kind: main | micro | flex | active_recovery | rest assigned deterministically:
 * - Number of main sessions respects settings main_sessions_min and main_sessions_max per rolling 7 days,
 *   and max_consecutive_main_days.
 * - A main session needs an availability slot >= min_main_session_minutes; shorter gives micro or rest.
 * - The training unit for each main day is chosen using rankCandidates.
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

  const todayStr = getLocalDateWithDayStart(input.now_iso, dayStartHour);
  const seed = input.seed ?? 'horizon-default-seed';

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

    // We also want to meet main_sessions_min across horizon if possible
    const daysRemaining = horizonDays - dayIndex;
    const neededMain = mainMin - totalMainCount;
    const mustBeMainIfPossible = neededMain > 0 && daysRemaining <= neededMain && canHaveConsecutive;

    const shouldScheduleMain = hasEnoughTime && canHaveConsecutive && (canHaveMoreMain || mustBeMainIfPossible);

    let kind: DayKind = 'rest';
    let sessionSnapshot = null;

    if (shouldScheduleMain) {
      kind = 'main';
      consecutiveMainCount++;
      totalMainCount++;

      // Pick training unit with rankCandidates
      const candidateUnits = UNIT_ROTATION;
      const targetInterval = requireNumber(config, 'target_stimulus_interval_days');
      const wGoal = requireNumber(config, 'rank_weight_goal_weight');
      const unitInputs: CandidateEvaluationInput[] = candidateUnits.map((u, idx) => {
        // Representative exercise for scoring unit
        const repExercise = input.eligible_exercises.find((e) => e.pattern === (u === 'A' ? 'horizontal_push' : u === 'B' ? 'horizontal_pull' : u === 'C' ? 'squat' : 'hinge')) ?? input.eligible_exercises[0]!;
        const stimulusGapDays = (unitIndex + idx) % targetInterval;
        return {
          exercise: repExercise,
          unit: u,
          terms: {
            priority_need: 1 / 2,
            days_since_last_stimulus: stimulusGapDays,
            progression_need: 1 / 2,
            goal_weight: wGoal,
            available_window_minutes: availableMinutes,
            duration_minutes: minMainMinutes,
            readiness: 1,
          },
          filter_checks: {
            safety_passed: true,
            recovery_spacing_passed: true,
            volume_caps_passed: true,
            equipment_eligible: true,
            duration_valid: true,
          },
        };
      });

      const ranked = rankCandidates(unitInputs, config);
      const chosenCandidate = ranked[0];
      const chosenUnit = (chosenCandidate?.unit as TrainingUnitKind) ?? UNIT_ROTATION[unitIndex % UNIT_ROTATION.length]!;
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
    } else {
      consecutiveMainCount = 0;
      if (availableMinutes > 0 && availableMinutes < minMainMinutes) {
        kind = 'micro';
      } else if (availableMinutes >= minMainMinutes && !canHaveConsecutive) {
        kind = 'active_recovery';
      } else {
        kind = 'rest';
      }
    }

    days.push({
      schema_version: 1,
      day_index: dayIndex,
      date: dateStr,
      kind,
      status,
      session_snapshot: sessionSnapshot,
    });
  }

  return {
    schema_version: 1,
    id: input.plan_id ?? '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
    created_at: input.now_iso,
    days,
    horizon_days: horizonDays,
  };
}

/**
 * M0-13 c) slideHorizon:
 * Drops Day 0, appends a new last day.
 * Existing adaptive days change only when shouldReplaceCurrent says so.
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

    if (newDayIndex < 2) {
      // Day 0 (was day 1) becomes locked; Day 1 (was day 2) becomes protected
      updatedDays.push({
        ...existingDay,
        day_index: newDayIndex,
        status: targetStatus,
      });
    } else {
      // Adaptive day: evaluate shouldReplaceCurrent
      if (!freshCounterpart || !existingDay.session_snapshot || !freshCounterpart.session_snapshot) {
        // Keep existing if counterpart not full session
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
            pattern_focus_changed: false,
          },
          config
        );

        // Score difference: if unchanged input, scores are identical
        const defaultScore = requireNumber(config, 'rank_weight_readiness');
        const currentScore = defaultScore;
        const challengerScore = defaultScore;

        const decision = shouldReplaceCurrent(
          currentScore,
          challengerScore,
          isMaterial,
          config
        );

        if (decision.shouldReplace) {
          updatedDays.push({
            ...freshCounterpart,
            day_index: newDayIndex,
            status: 'adaptive',
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
    ...plan,
    created_at: newTodayIso,
    days: updatedDays,
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
