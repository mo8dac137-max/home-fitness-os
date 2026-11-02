import type {
  PrescriptionSnapshot,
  MovementPattern,
  Exercise,
} from '@hfos/contracts';
import type { Clock, IdGenerator } from '@hfos/ports';
import type { EventEnvelope } from '@hfos/events';
import {
  getEffectiveConfig,
  requireNumber,
  requireBoolean,
  type EffectiveConfig,
} from '@hfos/config';
import { KeyValueStore } from '../storage/index.js';
import { INITIAL_EXERCISE_LIBRARY } from '@hfos/library';
import { UNIT_PATTERNS, type TrainingUnitKind } from '@hfos/engine-core';

export const KV_KEY_ACTIVE_SESSION = 'session.active';

export type SessionPhase = 'warmup' | 'exercise' | 'rest' | 'cooldown' | 'done';

export interface SetRecord {
  exercise_id: string;
  set_index: number;
  target_reps: number;
  done_reps?: number;
  rpe?: number;
  pain?: boolean;
  completed_at: string;
  is_warmup?: boolean;
}

export interface SessionRunnerState {
  snapshot: PrescriptionSnapshot;
  phase: SessionPhase;
  current_exercise_index: number;
  current_set_index: number;
  warmup_set_index: number;
  total_warmup_sets: number;
  set_records: SetRecord[];
  session_started_at: string;
  session_id: string;
  training_unit?: TrainingUnitKind;
  patterns: MovementPattern[];
  is_paused: boolean;
  paused_at?: string;
  paused_remaining_ms?: number;
  rest_deadline: string | null;
  rest_duration_seconds: number;
  is_abandoned: boolean;
  abandon_reason?: string;
  completed_at?: string;
}

export type SessionRunnerAction =
  | { type: 'START_SESSION' }
  | { type: 'COMPLETE_SET'; done_reps?: number; rpe?: number; pain?: boolean }
  | { type: 'SKIP_SET' }
  | { type: 'START_REST'; duration_seconds?: number }
  | { type: 'EXTEND_REST'; seconds: number }
  | { type: 'SKIP_REST' }
  | { type: 'NEXT_EXERCISE' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'ABANDON'; reason: string }
  | { type: 'FINISH' }
  | { type: 'AUTO_ADVANCE' };

export interface SessionRunnerDeps {
  clock: Clock;
  idGenerator: IdGenerator;
  config?: EffectiveConfig;
  library?: Exercise[];
  deviceId?: string;
}

/**
 * Creates the initial SessionRunnerState from a Day-0 PrescriptionSnapshot.
 */
export function createInitialRunnerState(
  snapshot: PrescriptionSnapshot,
  unit: TrainingUnitKind | undefined,
  deps: SessionRunnerDeps
): SessionRunnerState {
  const config = deps.config ?? getEffectiveConfig();
  const warmupSetsDefault = requireNumber(config, 'warmup_sets_default');
  const sessionId = snapshot.session_id || deps.idGenerator.generateId();

  // Deduce patterns from unit or exercises
  const patterns: MovementPattern[] = unit && UNIT_PATTERNS[unit]
    ? [...UNIT_PATTERNS[unit]]
    : [];

  if (patterns.length === 0) {
    const library = deps.library ?? INITIAL_EXERCISE_LIBRARY;
    for (const item of snapshot.exercises) {
      const ex = library.find((e) => e.id === item.exercise_id);
      if (ex && !patterns.includes(ex.pattern)) {
        patterns.push(ex.pattern);
      }
    }
  }

  const initialPhase: SessionPhase = warmupSetsDefault > 0 ? 'warmup' : 'exercise';

  return {
    snapshot,
    phase: initialPhase,
    current_exercise_index: 0,
    current_set_index: 0,
    warmup_set_index: 0,
    total_warmup_sets: warmupSetsDefault,
    set_records: [],
    session_started_at: deps.clock.nowIso(),
    session_id: sessionId,
    training_unit: unit,
    patterns,
    is_paused: false,
    rest_deadline: null,
    rest_duration_seconds: 0,
    is_abandoned: false,
  };
}

/**
 * Calculates dynamic rest duration for a set or transition between exercises.
 */
export function computeRestDuration(
  prescribedRest: number | undefined,
  isExerciseTransition: boolean,
  config: EffectiveConfig = getEffectiveConfig()
): number {
  const restDynamic = requireBoolean(config, 'rest_dynamic');
  const restFloor = requireNumber(config, 'rest_floor_seconds');
  const restCeiling = requireNumber(config, 'rest_ceiling_seconds');
  const transitionSec = requireNumber(config, 'transition_seconds');

  if (isExerciseTransition) {
    return Math.max(transitionSec, restFloor);
  }

  const rawRest = prescribedRest ?? 60;
  if (!restDynamic) {
    return rawRest;
  }

  return Math.max(restFloor, Math.min(restCeiling, rawRest));
}

/**
 * Pure reducer for session runner state.
 */
export function sessionReducer(
  state: SessionRunnerState,
  action: SessionRunnerAction,
  deps: SessionRunnerDeps
): SessionRunnerState {
  const config = deps.config ?? getEffectiveConfig();
  const nowMs = deps.clock.nowTimestamp();
  const nowIso = deps.clock.nowIso();
  const targetRpeDefault = requireNumber(config, 'target_rpe_default');
  const cooldownDurationMinutes = requireNumber(config, 'cooldown_duration_minutes');

  // Guard: if already done, ignore further actions
  if (state.phase === 'done' && action.type !== 'START_SESSION') {
    return state;
  }

  switch (action.type) {
    case 'START_SESSION': {
      return {
        ...state,
        session_started_at: nowIso,
        phase: state.total_warmup_sets > 0 ? 'warmup' : 'exercise',
        warmup_set_index: 0,
        current_exercise_index: 0,
        current_set_index: 0,
        is_paused: false,
        is_abandoned: false,
        rest_deadline: null,
      };
    }

    case 'COMPLETE_SET': {
      if (state.is_paused) return state;

      if (state.phase === 'warmup') {
        const firstEx = state.snapshot.exercises[0];
        const exId = firstEx?.exercise_id ?? 'warmup_movement';
        const targetReps = 10;
        const newRecord: SetRecord = {
          exercise_id: exId,
          set_index: state.warmup_set_index,
          target_reps: targetReps,
          done_reps: action.done_reps ?? targetReps,
          rpe: action.rpe ?? 6.0,
          pain: Boolean(action.pain),
          completed_at: nowIso,
          is_warmup: true,
        };

        const nextWarmupIndex = state.warmup_set_index + 1;
        const hasMoreWarmup = nextWarmupIndex < state.total_warmup_sets;

        if (hasMoreWarmup) {
          const restDuration = computeRestDuration(30, false, config);
          return {
            ...state,
            phase: 'rest',
            warmup_set_index: nextWarmupIndex,
            set_records: [...state.set_records, newRecord],
            rest_duration_seconds: restDuration,
            rest_deadline: new Date(nowMs + restDuration * 1000).toISOString(),
          };
        } else {
          // Warmup complete, transition to first working exercise
          const restDuration = computeRestDuration(undefined, true, config);
          return {
            ...state,
            phase: 'rest',
            warmup_set_index: nextWarmupIndex,
            current_exercise_index: 0,
            current_set_index: 0,
            set_records: [...state.set_records, newRecord],
            rest_duration_seconds: restDuration,
            rest_deadline: new Date(nowMs + restDuration * 1000).toISOString(),
          };
        }
      }

      if (state.phase === 'exercise') {
        const currentEx = state.snapshot.exercises[state.current_exercise_index];
        if (!currentEx) {
          return { ...state, phase: 'done', completed_at: nowIso };
        }

        const currentPrescription = currentEx.sets[state.current_set_index];
        const targetReps =
          currentPrescription?.target_reps ??
          currentPrescription?.max_reps ??
          currentPrescription?.min_reps ??
          10;

        const targetRpe = currentPrescription?.target_rpe ?? targetRpeDefault;

        const newRecord: SetRecord = {
          exercise_id: currentEx.exercise_id,
          set_index: state.current_set_index,
          target_reps: targetReps,
          done_reps: action.done_reps !== undefined ? action.done_reps : targetReps,
          rpe: action.rpe !== undefined ? action.rpe : targetRpe,
          pain: Boolean(action.pain),
          completed_at: nowIso,
          is_warmup: false,
        };

        const nextSetIndex = state.current_set_index + 1;
        const hasMoreSets = nextSetIndex < currentEx.sets.length;

        if (hasMoreSets) {
          const restDuration = computeRestDuration(
            currentPrescription?.rest_seconds,
            false,
            config
          );
          return {
            ...state,
            phase: 'rest',
            current_set_index: nextSetIndex,
            set_records: [...state.set_records, newRecord],
            rest_duration_seconds: restDuration,
            rest_deadline: new Date(nowMs + restDuration * 1000).toISOString(),
          };
        } else {
          // Finished all sets of this exercise
          const nextExIndex = state.current_exercise_index + 1;
          const hasMoreExercises = nextExIndex < state.snapshot.exercises.length;

          if (hasMoreExercises) {
            const restDuration = computeRestDuration(undefined, true, config);
            return {
              ...state,
              phase: 'rest',
              current_exercise_index: nextExIndex,
              current_set_index: 0,
              set_records: [...state.set_records, newRecord],
              rest_duration_seconds: restDuration,
              rest_deadline: new Date(nowMs + restDuration * 1000).toISOString(),
            };
          } else {
            // All exercises complete! Proceed to cooldown or finish
            if (cooldownDurationMinutes > 0) {
              const cooldownSec = cooldownDurationMinutes * 60;
              return {
                ...state,
                phase: 'cooldown',
                set_records: [...state.set_records, newRecord],
                rest_duration_seconds: cooldownSec,
                rest_deadline: new Date(nowMs + cooldownSec * 1000).toISOString(),
              };
            } else {
              return {
                ...state,
                phase: 'done',
                set_records: [...state.set_records, newRecord],
                completed_at: nowIso,
                rest_deadline: null,
              };
            }
          }
        }
      }

      return state;
    }

    case 'SKIP_SET': {
      if (state.is_paused) return state;

      if (state.phase === 'warmup') {
        const nextWarmupIndex = state.warmup_set_index + 1;
        if (nextWarmupIndex < state.total_warmup_sets) {
          return {
            ...state,
            warmup_set_index: nextWarmupIndex,
          };
        } else {
          // Warmup skipped/consumed: mark warmup_set_index at total so that
          // SKIP_REST and AUTO_ADVANCE from the following rest return to the
          // working exercise instead of bouncing back into warmup (Phase 2C fix).
          return {
            ...state,
            phase: 'exercise',
            warmup_set_index: nextWarmupIndex,
            current_exercise_index: 0,
            current_set_index: 0,
            rest_deadline: null,
          };
        }
      }

      if (state.phase === 'exercise') {
        const currentEx = state.snapshot.exercises[state.current_exercise_index];
        if (!currentEx) return state;

        const nextSetIndex = state.current_set_index + 1;
        if (nextSetIndex < currentEx.sets.length) {
          return {
            ...state,
            current_set_index: nextSetIndex,
          };
        } else {
          const nextExIndex = state.current_exercise_index + 1;
          if (nextExIndex < state.snapshot.exercises.length) {
            return {
              ...state,
              current_exercise_index: nextExIndex,
              current_set_index: 0,
            };
          } else if (cooldownDurationMinutes > 0) {
            const cooldownSec = cooldownDurationMinutes * 60;
            return {
              ...state,
              phase: 'cooldown',
              rest_duration_seconds: cooldownSec,
              rest_deadline: new Date(nowMs + cooldownSec * 1000).toISOString(),
            };
          } else {
            return {
              ...state,
              phase: 'done',
              completed_at: nowIso,
              rest_deadline: null,
            };
          }
        }
      }

      return state;
    }

    case 'START_REST': {
      const restSec = action.duration_seconds ?? computeRestDuration(undefined, false, config);
      return {
        ...state,
        phase: 'rest',
        rest_duration_seconds: restSec,
        rest_deadline: new Date(nowMs + restSec * 1000).toISOString(),
      };
    }

    case 'EXTEND_REST': {
      if (!state.rest_deadline) return state;
      const restCeiling = requireNumber(config, 'rest_ceiling_seconds');
      // Clamp the total rest (initial duration + accumulated extensions) to the
      // configured ceiling, and never allow the deadline to move backwards.
      const headroomSec = Math.max(0, restCeiling - state.rest_duration_seconds);
      const allowedSec = Math.min(action.seconds, headroomSec);
      if (allowedSec <= 0) return state;
      const currentDeadlineMs = Date.parse(state.rest_deadline);
      return {
        ...state,
        rest_duration_seconds: state.rest_duration_seconds + allowedSec,
        rest_deadline: new Date(currentDeadlineMs + allowedSec * 1000).toISOString(),
      };
    }

    case 'SKIP_REST': {
      if (state.phase === 'cooldown') {
        return {
          ...state,
          phase: 'done',
          completed_at: nowIso,
          rest_deadline: null,
        };
      }

      if (state.warmup_set_index < state.total_warmup_sets) {
        return {
          ...state,
          phase: 'warmup',
          rest_deadline: null,
        };
      }

      return {
        ...state,
        phase: 'exercise',
        rest_deadline: null,
      };
    }

    case 'NEXT_EXERCISE': {
      const nextExIndex = state.current_exercise_index + 1;
      if (nextExIndex < state.snapshot.exercises.length) {
        return {
          ...state,
          phase: 'exercise',
          current_exercise_index: nextExIndex,
          current_set_index: 0,
          rest_deadline: null,
        };
      } else if (cooldownDurationMinutes > 0) {
        const cooldownSec = cooldownDurationMinutes * 60;
        return {
          ...state,
          phase: 'cooldown',
          rest_duration_seconds: cooldownSec,
          rest_deadline: new Date(nowMs + cooldownSec * 1000).toISOString(),
        };
      } else {
        return {
          ...state,
          phase: 'done',
          completed_at: nowIso,
          rest_deadline: null,
        };
      }
    }

    case 'AUTO_ADVANCE': {
      if (state.is_paused) return state;
      if (!state.rest_deadline) return state;

      const deadlineMs = Date.parse(state.rest_deadline);
      if (nowMs < deadlineMs) {
        return state; // Deadline has not yet elapsed
      }

      if (state.phase === 'cooldown') {
        return {
          ...state,
          phase: 'done',
          completed_at: nowIso,
          rest_deadline: null,
        };
      }

      if (state.phase === 'rest') {
        if (state.warmup_set_index < state.total_warmup_sets) {
          return {
            ...state,
            phase: 'warmup',
            rest_deadline: null,
          };
        }
        return {
          ...state,
          phase: 'exercise',
          rest_deadline: null,
        };
      }

      return state;
    }

    case 'PAUSE': {
      if (state.is_paused) return state;
      let remainingMs: number | undefined = undefined;
      if (state.rest_deadline) {
        remainingMs = Math.max(0, Date.parse(state.rest_deadline) - nowMs);
      }
      return {
        ...state,
        is_paused: true,
        paused_at: nowIso,
        paused_remaining_ms: remainingMs,
      };
    }

    case 'RESUME': {
      if (!state.is_paused) return state;
      let newDeadline: string | null = null;
      if (state.paused_remaining_ms !== undefined) {
        newDeadline = new Date(nowMs + state.paused_remaining_ms).toISOString();
      }
      return {
        ...state,
        is_paused: false,
        paused_at: undefined,
        paused_remaining_ms: undefined,
        rest_deadline: newDeadline,
      };
    }

    case 'ABANDON': {
      return {
        ...state,
        phase: 'done',
        is_abandoned: true,
        abandon_reason: action.reason,
        completed_at: nowIso,
        rest_deadline: null,
      };
    }

    case 'FINISH': {
      return {
        ...state,
        phase: 'done',
        completed_at: nowIso,
        rest_deadline: null,
      };
    }

    default:
      return state;
  }
}

/**
 * Emits append-only events from a completed or abandoned session state.
 */
export function generateSessionEvents(
  state: SessionRunnerState,
  deps: SessionRunnerDeps
): EventEnvelope[] {
  const library = deps.library ?? INITIAL_EXERCISE_LIBRARY;
  const deviceId = deps.deviceId ?? 'device-local';
  const events: EventEnvelope[] = [];

  // 1. session.started
  events.push({
    event_id: deps.idGenerator.generateId(),
    schema_version: 1,
    type: 'session.started',
    occurred_at: state.session_started_at,
    device_id: deviceId,
    idempotency_key: `session-started-${state.session_id}`,
    payload: {
      session_id: state.session_id,
      training_unit: state.training_unit,
      patterns: state.patterns,
    },
  });

  // 2. session.set_logged for each recorded set
  for (const record of state.set_records) {
    const ex = library.find((e) => e.id === record.exercise_id);
    const pattern = ex?.pattern;
    const muscle = ex?.primary_muscles?.[0];

    const warmupSuffix = record.is_warmup ? '-warmup' : '';
    events.push({
      event_id: deps.idGenerator.generateId(),
      schema_version: 1,
      type: 'session.set_logged',
      occurred_at: record.completed_at,
      device_id: deviceId,
      idempotency_key: `set-${state.session_id}-${record.exercise_id}-${record.set_index}${warmupSuffix}`,
      payload: {
        session_id: state.session_id,
        exercise_id: record.exercise_id,
        set_number: record.set_index + 1,
        reps: record.done_reps ?? record.target_reps,
        target_reps: record.target_reps,
        rpe: record.rpe,
        pain: Boolean(record.pain),
        pattern,
        muscle,
        is_warmup: Boolean(record.is_warmup),
      },
    });
  }

  // 3. session.completed OR session.abandoned
  const endedAt = state.completed_at ?? deps.clock.nowIso();
  const workingSetsCount = state.set_records.filter((r) => !r.is_warmup).length;
  const durationSeconds = Math.max(
    0,
    Math.round((Date.parse(endedAt) - Date.parse(state.session_started_at)) / 1000)
  );

  if (state.is_abandoned) {
    events.push({
      event_id: deps.idGenerator.generateId(),
      schema_version: 1,
      type: 'session.abandoned',
      occurred_at: endedAt,
      device_id: deviceId,
      idempotency_key: `session-abandoned-${state.session_id}`,
      payload: {
        session_id: state.session_id,
        training_unit: state.training_unit,
        patterns: state.patterns,
        reason: state.abandon_reason || 'user_abandoned',
        sets_completed: workingSetsCount,
      },
    });
  } else {
    events.push({
      event_id: deps.idGenerator.generateId(),
      schema_version: 1,
      type: 'session.completed',
      occurred_at: endedAt,
      device_id: deviceId,
      idempotency_key: `session-completed-${state.session_id}`,
      payload: {
        session_id: state.session_id,
        training_unit: state.training_unit,
        patterns: state.patterns,
        sets_count: workingSetsCount,
        duration_seconds: durationSeconds,
      },
    });
  }

  return events;
}

/**
 * Persistence helpers for in-flight session runner.
 */
export async function saveSessionRunner(
  kvStore: KeyValueStore,
  state: SessionRunnerState
): Promise<void> {
  await kvStore.set(KV_KEY_ACTIVE_SESSION, state);
}

export async function loadSessionRunner(
  kvStore: KeyValueStore
): Promise<SessionRunnerState | null> {
  return await kvStore.get<SessionRunnerState>(KV_KEY_ACTIVE_SESSION);
}

export async function clearSessionRunner(kvStore: KeyValueStore): Promise<void> {
  await kvStore.delete(KV_KEY_ACTIVE_SESSION);
}
