import type {
  Exercise,
  MovementPattern,
  MuscleGroup,
  PrescriptionSnapshot,
  SetPrescription,
} from '@hfos/contracts';
import type { EffectiveConfig } from '@hfos/config';
import { requireNumber, requireRange, getEffectiveConfig } from '@hfos/config';
import type { CapabilityMap } from './progression.js';

export type TrainingUnitKind = 'A' | 'B' | 'C' | 'D';
export type GoalEmphasis = 'strength' | 'hypertrophy' | 'endurance';

export type GenerateSessionResult =
  | {
      status: 'ready';
      snapshot: PrescriptionSnapshot;
    }
  | {
      status: 'needs_baseline';
      patterns: MovementPattern[];
    };

export interface SessionGeneratorParams {
  training_unit: TrainingUnitKind;
  capability_map: CapabilityMap;
  eligible_exercises: Exercise[];
  settings?: EffectiveConfig;
  goal_emphasis?: GoalEmphasis;
  physique_priorities?: [MuscleGroup, MuscleGroup];
  seed: string;
  session_id?: string;
  created_at: string;
}

export const UNIT_PATTERNS: Record<TrainingUnitKind, MovementPattern[]> = {
  A: ['horizontal_push', 'vertical_push', 'core'],
  B: ['horizontal_pull', 'hinge', 'mobility'],
  C: ['squat', 'lunge', 'core', 'mobility'],
  D: ['horizontal_push', 'horizontal_pull', 'squat', 'hinge', 'core'],
};

/**
 * Deterministic PRNG using Murmur-inspired hash and Mulberry32 generator.
 * Zero external deps, zero Math.random, zero Date.now.
 * PRNG constants exempted from Rule 10 numeric literal scanner.
 */
/* PRNG */
export function createDeterministicPrng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const seed = (Math.imul(h ^ (h >>> 16), 2246822507) ^ 0x6d2b79f5) >>> 0;

  let state = seed;
  return function () {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* END PRNG */

/**
 * Estimates session duration in minutes:
 * warmup + sum(sets * (work + rest)) + transitions + mobility + cooldown
 */
export function estimateDuration(
  session: PrescriptionSnapshot,
  settings: EffectiveConfig = getEffectiveConfig()
): number {
  const warmup = requireNumber(settings, 'warmup_minutes');
  const cooldown = requireNumber(settings, 'cooldown_minutes');
  const defaultWorkSeconds = requireNumber(settings, 'default_work_seconds');
  const transitionSeconds = requireNumber(settings, 'transition_seconds');
  const secondsPerMinute = requireNumber(settings, 'seconds_per_minute');

  let totalSeconds = (warmup + cooldown) * secondsPerMinute;

  for (let i = 0; i < session.exercises.length; i++) {
    const exItem = session.exercises[i]!;
    for (const s of exItem.sets) {
      const rest = s.rest_seconds;
      const work = defaultWorkSeconds;
      totalSeconds += work + rest;
    }
    // Inter-set transitions within exercise
    if (exItem.sets.length > 1) {
      totalSeconds += (exItem.sets.length - 1) * transitionSeconds;
    }
    // Inter-exercise transition
    if (i > 0) {
      totalSeconds += transitionSeconds;
    }
  }

  return totalSeconds / secondsPerMinute;
}

/**
 * Generates an immutable PrescriptionSnapshot deterministically:
 * - Selects exercises from eligible_exercises matching training_unit patterns and user capability levels
 * - Assigns sets, reps, and dynamic rest based on goal emphasis
 * - Ensures main session duration >= min_main_session_minutes by adding mobility first, then priority sets
 * - Enforces caps (max_session_minutes, session_hard_sets_cap)
 */
export function generateSession(params: SessionGeneratorParams): GenerateSessionResult {
  const {
    training_unit,
    capability_map,
    eligible_exercises,
    settings = getEffectiveConfig(),
    goal_emphasis = 'hypertrophy',
    physique_priorities,
    seed,
    session_id = '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d',
    created_at,
  } = params;

  const targetPatterns = UNIT_PATTERNS[training_unit];

  // 0. Check if all target patterns have capability entries
  const missingPatterns = targetPatterns.filter((pattern) => {
    const entry = capability_map[pattern];
    return !entry || typeof entry.level !== 'number';
  });

  if (missingPatterns.length > 0) {
    return {
      status: 'needs_baseline',
      patterns: missingPatterns,
    };
  }

  const _prng = createDeterministicPrng(seed);

  const minMainSessionMinutes = requireNumber(settings, 'min_main_session_minutes');
  const maxSessionMinutes = requireNumber(settings, 'max_session_minutes');
  const sessionHardSetsCap = requireNumber(settings, 'session_hard_sets_cap');

  const restSeconds =
    goal_emphasis === 'strength'
      ? requireNumber(settings, 'rest_seconds_strength')
      : goal_emphasis === 'endurance'
      ? requireNumber(settings, 'rest_seconds_endurance')
      : requireNumber(settings, 'rest_seconds_hypertrophy');

  const repRange =
    goal_emphasis === 'strength'
      ? requireRange(settings, 'rep_window_strength')
      : goal_emphasis === 'endurance'
      ? requireRange(settings, 'rep_window_endurance')
      : requireRange(settings, 'rep_window_hypertrophy');

  const mobilityRestSeconds = requireNumber(settings, 'mobility_rest_seconds');
  const defaultSetsPerExercise = requireNumber(settings, 'default_sets_per_exercise');
  const defaultMobilitySets = requireNumber(settings, 'default_mobility_sets');
  const rpeTargetMobility = requireNumber(settings, 'rpe_target_mobility');
  const rpeTargetStrength = requireNumber(settings, 'rpe_target_strength');
  const rpeTargetDefault = requireNumber(settings, 'rpe_target_default');

  const chosenExercises: Exercise[] = [];

  // 1. Pick best matching eligible exercise for each target pattern
  for (const pattern of targetPatterns) {
    const capabilityEntry = capability_map[pattern]!;
    const userLevel = capabilityEntry.level;
    const candidates = eligible_exercises.filter((e) => e.pattern === pattern);

    if (candidates.length === 0) continue;

    // Pick closest to capability level, tie-break by ID
    candidates.sort((a, b) => {
      const distA = Math.abs(a.level - userLevel);
      const distB = Math.abs(b.level - userLevel);
      if (distA !== distB) return distA - distB;
      return a.id.localeCompare(b.id);
    });

    const chosen = candidates[0];
    if (chosen && !chosenExercises.some((e) => e.id === chosen.id)) {
      chosenExercises.push(chosen);
    }
  }

  // 2. Build initial exercise prescriptions
  const buildSets = (count: number, isMobility: boolean = false): SetPrescription[] => {
    return Array.from({ length: count }, (_, idx) => ({
      schema_version: 1,
      set_number: idx + 1,
      target_reps: isMobility ? undefined : repRange.target,
      min_reps: isMobility ? undefined : repRange.min,
      max_reps: isMobility ? undefined : repRange.max,
      target_rpe: isMobility
        ? rpeTargetMobility
        : goal_emphasis === 'strength'
        ? rpeTargetStrength
        : rpeTargetDefault,
      rest_seconds: isMobility ? mobilityRestSeconds : restSeconds,
    }));
  };

  const exerciseItems = chosenExercises.map((ex) => ({
    exercise_id: ex.id,
    sets: buildSets(defaultSetsPerExercise, ex.type === 'mobility'),
  }));

  const snapshot: PrescriptionSnapshot = {
    schema_version: 1,
    id: session_id,
    session_id,
    exercises: exerciseItems,
    rules: [
      `goal_emphasis:${goal_emphasis}`,
      `unit:${training_unit}`,
      'rest_dynamic',
    ],
    engine_version: '0.1.0',
    config_version: '1.0.0',
    created_at,
  };

  let currentDuration = estimateDuration(snapshot, settings);
  let totalSets = snapshot.exercises.reduce((acc, e) => acc + e.sets.length, 0);

  // 3. If under min_main_session_minutes, add content in strict order:
  // Order: mobility block (hips first), then one extra set for a HIGH-priority muscle within caps
  if (currentDuration < minMainSessionMinutes) {
    // 3a. Add mobility block (hips first)
    const mobilityCandidates = eligible_exercises.filter((e) => e.pattern === 'mobility');
    const hipMobilityExercises = mobilityCandidates.filter((e) =>
      e.primary_muscles.includes('hip_mobility')
    );

    const mobilityPool =
      hipMobilityExercises.length > 0 ? hipMobilityExercises : mobilityCandidates;

    // Pick a mobility exercise not yet in session
    for (const mobEx of mobilityPool) {
      if (currentDuration >= minMainSessionMinutes) break;
      if (!snapshot.exercises.some((e) => e.exercise_id === mobEx.id)) {
        snapshot.exercises.push({
          exercise_id: mobEx.id,
          sets: buildSets(defaultMobilitySets, true),
        });
        currentDuration = estimateDuration(snapshot, settings);
        totalSets = snapshot.exercises.reduce((acc, e) => acc + e.sets.length, 0);
      }
    }

    // 3b. Add extra sets for HIGH-priority muscles if still under min and within caps
    if (currentDuration < minMainSessionMinutes && totalSets < sessionHardSetsCap) {
      for (const item of snapshot.exercises) {
        if (currentDuration >= minMainSessionMinutes || totalSets >= sessionHardSetsCap) break;
        const ex = eligible_exercises.find((e) => e.id === item.exercise_id);
        if (
          ex &&
          ex.type !== 'mobility' &&
          physique_priorities &&
          ex.primary_muscles.some((m) => physique_priorities.includes(m))
        ) {
          item.sets.push({
            schema_version: 1,
            set_number: item.sets.length + 1,
            target_reps: repRange.target,
            min_reps: repRange.min,
            max_reps: repRange.max,
            target_rpe: rpeTargetDefault,
            rest_seconds: restSeconds,
          });
          currentDuration = estimateDuration(snapshot, settings);
          totalSets = snapshot.exercises.reduce((acc, e) => acc + e.sets.length, 0);
        }
      }
    }

    // 3c. If still under min and within caps, add 1 working set to non-mobility exercises
    if (currentDuration < minMainSessionMinutes && totalSets < sessionHardSetsCap) {
      for (const item of snapshot.exercises) {
        if (currentDuration >= minMainSessionMinutes || totalSets >= sessionHardSetsCap) break;
        const ex = eligible_exercises.find((e) => e.id === item.exercise_id);
        if (ex && ex.type !== 'mobility') {
          item.sets.push({
            schema_version: 1,
            set_number: item.sets.length + 1,
            target_reps: repRange.target,
            min_reps: repRange.min,
            max_reps: repRange.max,
            target_rpe: rpeTargetDefault,
            rest_seconds: restSeconds,
          });
          currentDuration = estimateDuration(snapshot, settings);
          totalSets = snapshot.exercises.reduce((acc, e) => acc + e.sets.length, 0);
        }
      }
    }
  }

  // 4. Ensure maxSessionMinutes cap is respected
  while (currentDuration > maxSessionMinutes && snapshot.exercises.length > 0) {
    const last = snapshot.exercises[snapshot.exercises.length - 1];
    if (!last) break;
    if (last.sets.length > 1) {
      last.sets.pop();
    } else {
      snapshot.exercises.pop();
    }
    currentDuration = estimateDuration(snapshot, settings);
  }

  return {
    status: 'ready',
    snapshot,
  };
}
