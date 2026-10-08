import type {
  ChangeRequest,
  Plan,
  Exercise,
  MuscleGroup,
  ValidationStatus,
} from '@hfos/contracts';
import type { EffectiveConfig } from '@hfos/config';
import { requireNumber, getEffectiveConfig } from '@hfos/config';
import type { EnvironmentItem } from './environment.js';
import { isEligible } from './environment.js';

export interface ValidationIssue {
  stage:
    | 'schema'
    | 'environment'
    | 'safety'
    | 'recovery_spacing'
    | 'volume'
    | 'duration'
    | 'goal_alignment';
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationContext {
  plan: Plan;
  library: Exercise[];
  environment: Record<string, EnvironmentItem>;
  settings?: EffectiveConfig;
  user_pain_flags?: string[];
  physique_priorities?: [MuscleGroup, MuscleGroup];
}

export interface ChangeValidationResult {
  status: ValidationStatus;
  issues: ValidationIssue[];
  nearest_alternative?: Exercise;
}

/**
 * Finds the nearest eligible alternative exercise for a replacement request:
 * - Must be eligible in environment
 * - Same movement pattern
 * - Level within +-1 of target
 * - Not the target exercise
 * - Deterministic order: smallest level distance, then alphabetical ID
 */
export function findNearestAlternative(
  targetExercise: Exercise,
  library: Exercise[],
  environment: Record<string, EnvironmentItem>
): Exercise | undefined {
  const candidates = library.filter((ex) => {
    if (ex.id === targetExercise.id) return false;
    if (ex.pattern !== targetExercise.pattern) return false;
    if (Math.abs(ex.level - targetExercise.level) > 1) return false;
    const { eligible } = isEligible(ex, environment);
    return eligible;
  });

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => {
    const distA = Math.abs(a.level - targetExercise.level);
    const distB = Math.abs(b.level - targetExercise.level);
    if (distA !== distB) {
      return distA - distB;
    }
    return a.id.localeCompare(b.id);
  });

  return candidates[0];
}

/**
 * Pure multi-stage validation pipeline:
 * schema -> environment -> safety -> recovery_spacing -> volume -> duration -> goal_alignment
 */
export function validateChange(
  request: ChangeRequest,
  context: ValidationContext
): ChangeValidationResult {
  const issues: ValidationIssue[] = [];
  const settings = context.settings ?? getEffectiveConfig();

  const minMainSessionMinutes = requireNumber(settings, 'min_main_session_minutes');
  const maxSessionMinutes = requireNumber(settings, 'max_session_minutes');
  const sessionHardSetsCap = requireNumber(settings, 'session_hard_sets_cap');
  const weeklySetsCapPerMuscle = requireNumber(settings, 'weekly_sets_cap_per_muscle');
  const minHoursBetweenHardSamePattern = requireNumber(
    settings,
    'min_hours_between_hard_same_pattern'
  );

  // 1. Stage: Schema & Horizon constraints
  if (
    request.target_day_index !== undefined &&
    (request.target_day_index < 0 || request.target_day_index >= context.plan.horizon_days)
  ) {
    issues.push({
      stage: 'schema',
      severity: 'error',
      message: `target_day_index ${request.target_day_index} is out of plan horizon bounds [0, ${context.plan.horizon_days - 1}].`,
    });
  }

  // PlanStore rule: a manual change on a day with index >= 2 is rejected with reason use_quick_command
  if (
    request.source === 'manual' &&
    request.target_day_index !== undefined &&
    request.target_day_index >= 2
  ) {
    issues.push({
      stage: 'schema',
      severity: 'error',
      message: 'use_quick_command',
    });
  }

  // 2. Stage: Environment & Eligibility
  let targetExercise: Exercise | undefined;
  if (request.target_exercise_id) {
    targetExercise = context.library.find((e) => e.id === request.target_exercise_id);
    if (!targetExercise) {
      issues.push({
        stage: 'environment',
        severity: 'error',
        message: `Target exercise "${request.target_exercise_id}" not found in exercise library.`,
      });
    }
  }

  const replacementId =
    typeof request.parameters?.replacement_exercise_id === 'string'
      ? request.parameters.replacement_exercise_id
      : undefined;

  if (replacementId) {
    const repExercise = context.library.find((e) => e.id === replacementId);
    if (!repExercise) {
      issues.push({
        stage: 'environment',
        severity: 'error',
        message: `Replacement exercise "${replacementId}" not found in exercise library.`,
      });
    } else {
      const { eligible, reasons } = isEligible(repExercise, context.environment);
      if (!eligible) {
        issues.push({
          stage: 'environment',
          severity: 'error',
          message: `Replacement exercise "${replacementId}" is ineligible in current environment: ${reasons.join(', ')}`,
        });
      }
    }
  }

  // 3. Stage: Safety (Pain flags & contraindicated flags)
  if (context.user_pain_flags && context.user_pain_flags.length > 0) {
    if (replacementId) {
      const repExercise = context.library.find((e) => e.id === replacementId);
      if (repExercise) {
        for (const pain of context.user_pain_flags) {
          if (repExercise.safety_flags.includes(`pain_${pain}`)) {
            issues.push({
              stage: 'safety',
              severity: 'error',
              message: `Exercise "${replacementId}" is contraindicated due to reported pain in "${pain}".`,
            });
          }
        }
      }
    }
  }

  // 4. Stage: Recovery / Spacing
  // Check hours between hard sessions of same pattern (without literal 24)
  if (request.command === 'make_harder' && request.target_day_index !== undefined) {
    const dayIdx = request.target_day_index;
    const prevDay = context.plan.days[dayIdx - 1];
    const nextDay = context.plan.days[dayIdx + 1];

    if (targetExercise) {
      const checkAdjacent = (adjDay?: (typeof context.plan.days)[number]) => {
        if (!adjDay || !adjDay.session_snapshot) return;
        const hasSamePattern = adjDay.session_snapshot.exercises.some((item) => {
          const ex = context.library.find((e) => e.id === item.exercise_id);
          return ex && ex.pattern === targetExercise?.pattern;
        });
        if (hasSamePattern && minHoursBetweenHardSamePattern > 0) {
          issues.push({
            stage: 'recovery_spacing',
            severity: 'error',
            message: `Consecutive hard days targeting "${targetExercise.pattern}" violates min_hours_between_hard_same_pattern (${minHoursBetweenHardSamePattern}h).`,
          });
        }
      };
      checkAdjacent(prevDay);
      checkAdjacent(nextDay);
    }
  }

  // 5. Stage: Volume Caps
  const extraSets =
    typeof request.parameters?.extra_sets === 'number' ? request.parameters.extra_sets : 0;

  if (extraSets > 0 && request.target_day_index !== undefined) {
    const day = context.plan.days[request.target_day_index];
    if (day?.session_snapshot) {
      const currentSessionSets = day.session_snapshot.exercises.reduce(
        (acc, item) => acc + item.sets.length,
        0
      );
      if (currentSessionSets + extraSets > sessionHardSetsCap) {
        issues.push({
          stage: 'volume',
          severity: 'error',
          message: `Session volume (${currentSessionSets + extraSets} sets) exceeds session_hard_sets_cap (${sessionHardSetsCap}).`,
        });
      }
    }

    if (targetExercise) {
      // Weekly cap per muscle
      for (const m of targetExercise.primary_muscles) {
        let weeklyMuscleSets = extraSets;
        for (const d of context.plan.days) {
          if (!d.session_snapshot) continue;
          for (const item of d.session_snapshot.exercises) {
            const ex = context.library.find((e) => e.id === item.exercise_id);
            if (ex && ex.primary_muscles.includes(m)) {
              weeklyMuscleSets += item.sets.length;
            }
          }
        }
        if (weeklyMuscleSets > weeklySetsCapPerMuscle) {
          issues.push({
            stage: 'volume',
            severity: 'error',
            message: `Weekly sets for muscle "${m}" (${weeklyMuscleSets}) exceeds weekly_sets_cap_per_muscle (${weeklySetsCapPerMuscle}).`,
          });
        }
      }
    }
  }

  // 6. Stage: Duration (Main session < 30min is always rejected)
  const proposedDurationMinutes =
    typeof request.parameters?.duration_minutes === 'number'
      ? request.parameters.duration_minutes
      : undefined;

  if (proposedDurationMinutes !== undefined) {
    const isMainSession =
      request.target_day_index !== undefined
        ? context.plan.days[request.target_day_index]?.kind === 'main'
        : true;

    if (isMainSession && proposedDurationMinutes < minMainSessionMinutes) {
      issues.push({
        stage: 'duration',
        severity: 'error',
        message: `Main session duration (${proposedDurationMinutes} min) is below safety-locked minimum of ${minMainSessionMinutes} min.`,
      });
    }

    if (proposedDurationMinutes > maxSessionMinutes) {
      issues.push({
        stage: 'duration',
        severity: 'error',
        message: `Session duration (${proposedDurationMinutes} min) exceeds max_session_minutes (${maxSessionMinutes} min).`,
      });
    }
  }

  // 7. Stage: Goal Alignment (ONLY warns, never rejects)
  if (context.physique_priorities && context.physique_priorities.length > 0) {
    if (request.command === 'replace_exercise' && targetExercise) {
      for (const priorityMuscle of context.physique_priorities) {
        if (targetExercise.primary_muscles.includes(priorityMuscle)) {
          const repExercise = replacementId
            ? context.library.find((e) => e.id === replacementId)
            : undefined;
          if (repExercise && !repExercise.primary_muscles.includes(priorityMuscle)) {
            issues.push({
              stage: 'goal_alignment',
              severity: 'warning',
              message: `Replacing "${targetExercise.id}" removes primary volume for user priority muscle "${priorityMuscle}".`,
            });
          }
        }
      }
    }
  }

  // Compute final status
  const hasErrors = issues.some((i) => i.severity === 'error');
  const hasWarnings = issues.some((i) => i.severity === 'warning');

  let status: ValidationStatus = 'accepted';
  if (hasErrors) {
    status = 'rejected';
  } else if (hasWarnings) {
    status = 'accepted_with_warning';
  }

  // Find nearest valid alternative if rejected on replace_exercise
  let nearest_alternative: Exercise | undefined;
  if (
    request.command === 'replace_exercise' &&
    targetExercise &&
    (status === 'rejected' || !replacementId)
  ) {
    nearest_alternative = findNearestAlternative(
      targetExercise,
      context.library,
      context.environment
    );
  }

  return {
    status,
    issues,
    nearest_alternative,
  };
}

export interface PlanStoreApplyResult {
  success: boolean;
  plan: Plan;
  status: ValidationStatus;
  issues: ValidationIssue[];
  nearest_alternative?: Exercise;
}

/**
 * PlanStore is the authoritative custodian of Plan changes.
 * All writes go through validateChange first.
 * It never mutates input.
 */
export class PlanStore {
  public static applyChange(
    plan: Plan,
    request: ChangeRequest,
    context: Omit<ValidationContext, 'plan'>
  ): PlanStoreApplyResult {
    // 1. Re-validate
    const validation = validateChange(request, { ...context, plan });

    if (validation.status === 'rejected') {
      return {
        success: false,
        plan, // unchanged original plan
        status: 'rejected',
        issues: validation.issues,
        nearest_alternative: validation.nearest_alternative,
      };
    }

    // 2. Clone and apply change immutably
    const newPlan: Plan = JSON.parse(JSON.stringify(plan));

    if (request.target_day_index !== undefined) {
      const day = newPlan.days[request.target_day_index];
      if (day && day.session_snapshot) {
        if (request.command === 'replace_exercise' && request.target_exercise_id) {
          const replacementId =
            (typeof request.parameters?.replacement_exercise_id === 'string'
              ? request.parameters.replacement_exercise_id
              : undefined) ?? validation.nearest_alternative?.id;
          if (replacementId) {
            day.session_snapshot.exercises = day.session_snapshot.exercises.map((item) => {
              if (item.exercise_id === request.target_exercise_id) {
                return {
                  ...item,
                  exercise_id: replacementId,
                };
              }
              return item;
            });
          }
        } else if (request.command === 'shorten_session') {
          // Reduce set count
          for (const item of day.session_snapshot.exercises) {
            if (item.sets.length > 1) {
              item.sets = item.sets.slice(0, item.sets.length - 1);
            }
          }
        }
      }
    }

    return {
      success: true,
      plan: newPlan,
      status: validation.status,
      issues: validation.issues,
      nearest_alternative: validation.nearest_alternative,
    };
  }
}
