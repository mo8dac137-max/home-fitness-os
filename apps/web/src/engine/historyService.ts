import type { EventEnvelope, EventLog } from '@hfos/events';
import type { Plan } from '@hfos/contracts';
import { getEffectiveConfig, requireNumber, type EffectiveConfig } from '@hfos/config';
import { INITIAL_EXERCISE_LIBRARY } from '@hfos/library';

/**
 * History service (deferred item, wired in Phase "history wiring").
 *
 * Derives honest home/progress history metrics from the append-only session
 * event log (`session.completed`, `session.set_logged`). Pure computation:
 * events are passed in, `nowMs` is injected, config windows come from
 * @hfos/config — no DOM, no wall clock, trivially testable with InMemoryEventLog.
 */

export interface TrainingHistorySummary {
  /** True when at least one set or session event exists at all. */
  has_session_data: boolean;
  /** All-time count of session.completed events. */
  total_completed_sessions: number;
  /** session.completed count inside the trailing consistency window. */
  completed_sessions_in_window: number;
  /** Planned main sessions in the current plan horizon (0 when plan missing). */
  planned_main_sessions: number;
  /** Working sets logged inside the trailing exposure window. */
  sets_total: number;
  /** Logged sets whose reps reached target_reps (exposure window). */
  sets_hit: number;
  /** sets_hit / sets_total, null when no sets logged. */
  rep_target_hit_rate: number | null;
  /** Mean RPE across sets that carried one (exposure window), null when none. */
  avg_rpe: number | null;
  /** pattern -> logged set count (exposure window). */
  pattern_exposure: Record<string, number>;
  /** muscle -> logged set count (consistency window, one count per primary muscle). */
  muscle_exposure: Record<string, number>;
  /** Resolved windows (days) from @hfos/config, echoed for honest display. */
  window_days: number;
  exposure_window_days: number;
}

const MS_PER_DAY = 86_400_000;

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function payloadOf(event: EventEnvelope): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>;
}

/** exercise_id -> primary muscles from the static library (unknown ids map to []). */
const MUSCLES_BY_EXERCISE: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const ex of INITIAL_EXERCISE_LIBRARY) {
    map[ex.id] = [...ex.primary_muscles];
  }
  return map;
})();

/** exercise_id -> movement pattern fallback when a set event omits it. */
const PATTERN_BY_EXERCISE: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const ex of INITIAL_EXERCISE_LIBRARY) {
    map[ex.id] = ex.pattern;
  }
  return map;
})();

export function buildHistorySummary(
  events: EventEnvelope[],
  plan: Plan | null,
  nowMs: number,
  config: EffectiveConfig = getEffectiveConfig()
): TrainingHistorySummary {
  const windowDays = requireNumber(config, 'history_consistency_window_days');
  const exposureDays = requireNumber(config, 'history_exposure_window_days');
  const windowStartMs = nowMs - windowDays * MS_PER_DAY;
  const exposureStartMs = nowMs - exposureDays * MS_PER_DAY;

  const seenIdempotencyKeys = new Set<string>();
  const patternExposure: Record<string, number> = {};
  const muscleExposure: Record<string, number> = {};

  let totalCompleted = 0;
  let completedInWindow = 0;
  let setsTotal = 0;
  let setsHit = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  let hasSessionData = false;

  for (const event of events) {
    // Defensive idempotency: the log already dedupes on append, but a
    // duplicated envelope in a fetched batch must never double-count.
    if (seenIdempotencyKeys.has(event.idempotency_key)) continue;
    seenIdempotencyKeys.add(event.idempotency_key);

    if (event.type === 'session.completed') {
      hasSessionData = true;
      totalCompleted++;
      const atMs = Date.parse(event.occurred_at);
      if (!Number.isNaN(atMs) && atMs >= windowStartMs && atMs <= nowMs) {
        completedInWindow++;
      }
      continue;
    }

    if (event.type === 'session.abandoned') {
      // Abandoned sessions are honest history but do not count as completion.
      hasSessionData = true;
      continue;
    }

    if (event.type !== 'session.set_logged') continue;

    const payload = payloadOf(event);
    const atMs = Date.parse(event.occurred_at);
    const inExposureWindow = !Number.isNaN(atMs) && atMs >= exposureStartMs && atMs <= nowMs;
    if (!inExposureWindow) continue;

    const reps = asNumber(payload['reps']);
    const targetReps = asNumber(payload['target_reps']);
    const rpe = asNumber(payload['rpe']);
    const exerciseId = asString(payload['exercise_id']);

    hasSessionData = true;
    setsTotal++;
    if (reps !== null && targetReps !== null && reps >= targetReps) {
      setsHit++;
    }
    if (rpe !== null && rpe > 0) {
      rpeSum += rpe;
      rpeCount++;
    }

    const pattern = asString(payload['pattern']) ?? (exerciseId ? PATTERN_BY_EXERCISE[exerciseId] : null);
    if (pattern) {
      patternExposure[pattern] = (patternExposure[pattern] ?? 0) + 1;
    }

    if (exerciseId) {
      for (const muscle of MUSCLES_BY_EXERCISE[exerciseId] ?? []) {
        muscleExposure[muscle] = (muscleExposure[muscle] ?? 0) + 1;
      }
    }
  }

  const plannedMainSessions = plan
    ? plan.days.filter((day) => day.kind === 'main').length
    : 0;

  return {
    has_session_data: hasSessionData,
    total_completed_sessions: totalCompleted,
    completed_sessions_in_window: completedInWindow,
    planned_main_sessions: plannedMainSessions,
    sets_total: setsTotal,
    sets_hit: setsHit,
    rep_target_hit_rate: setsTotal > 0 ? setsHit / setsTotal : null,
    avg_rpe: rpeCount > 0 ? rpeSum / rpeCount : null,
    pattern_exposure: patternExposure,
    muscle_exposure: muscleExposure,
    window_days: windowDays,
    exposure_window_days: exposureDays,
  };
}

/**
 * Loads every envelope from the given log and builds the summary.
 * Storage failures propagate to the caller (screens keep honest empty states).
 */
export async function loadHistorySummary(
  eventLog: EventLog,
  plan: Plan | null,
  nowMs: number = Date.now(),
  config: EffectiveConfig = getEffectiveConfig()
): Promise<TrainingHistorySummary> {
  const events = await eventLog.getAll();
  return buildHistorySummary(events, plan, nowMs, config);
}
