import type { Plan, PlanDay, MuscleGroup, Exercise } from '@hfos/contracts';
import { getEffectiveConfig, requireNumber, type EffectiveConfig } from '@hfos/config';
import {
  buildHorizon,
  slideHorizon,
  isEligible,
  type BuildHorizonInput,
  type EnvironmentItem,
  type CapabilityMap,
  getLocalDateWithDayStart,
  addDays,
} from '@hfos/engine-core';
import { INITIAL_EXERCISE_LIBRARY } from '@hfos/library';
import type { Clock, IdGenerator, ScheduleProvider } from '@hfos/ports';
import { IndexedDbEventLog, KeyValueStore } from '../storage/index.js';
import {
  SystemClock,
  SystemIdGenerator,
  createDefaultScheduleProvider,
  createDefaultCapabilityMap,
} from './engineContext.js';
import { KV_KEY_PROFILE, KV_KEY_ENV, getPersistentDeviceId, type MockEnvironmentState } from '../bootstrap.js';
import type { MockUserProfile } from '@hfos/sim';

export const KV_KEY_PLAN_CURRENT = 'plan.current';
export const KV_KEY_DECISIONS = 'plan.decisions';
export const KV_KEY_PLAN_GEN_TIME = 'plan.last_gen_duration_ms';

export interface PlanServiceOptions {
  clock?: Clock;
  idGenerator?: IdGenerator;
  scheduleProvider?: ScheduleProvider;
  eventLog?: IndexedDbEventLog;
  kvStore?: KeyValueStore;
}

/**
 * Closed set of i18n keys a decision reason line may carry. Every key exists
 * in both i18n dictionaries; the optional `value` is the REAL normalized term
 * contribution (0..100) taken from the day's DecisionRecord term_values.
 */
export type DecisionReasonI18nKey =
  | 'reason.stimulus_gap'
  | 'reason.priority_need'
  | 'reason.progression_need'
  | 'reason.goal_weight'
  | 'reason.schedule_fit'
  | 'reason.readiness'
  | 'reason_day.scheduled_main'
  | 'reason_day.no_window'
  | 'reason_day.window_too_short'
  | 'reason_day.quota_reached'
  | 'reason_day.consecutive_cap'
  | 'reason_day.recovery_spacing'
  | 'reason_day.micro_window'
  | 'reason_day.active_recovery_cap'
  | 'reason_day.rest';

export interface DecisionReasonLine {
  key: DecisionReasonI18nKey;
  /** Real normalized contribution (0..100) when derived from term_values. */
  value?: number;
}

export interface DayDecisionSummary {
  day_index: number;
  date: string;
  /** The unit the ENGINE chose for this day (A-D), or 'rest'. */
  unit: string;
  /** Honest reasons: derived from the day's DecisionRecord or reason_code. */
  top_reasons: DecisionReasonLine[];
  revision_reason?: string; // Real code recorded by slideHorizon on the day itself
  /** Which decision inputs had no data and fell back to named settings. */
  inputs_defaulted: string[];
}

export interface PlanServiceResult {
  plan: Plan;
  decisions: Record<number, DayDecisionSummary>;
  generationDurationMs: number;
}

export class PlanService {
  private clock: Clock;
  private idGenerator: IdGenerator;
  private scheduleProvider: ScheduleProvider;
  private eventLog: IndexedDbEventLog;
  private kvStore: KeyValueStore;

  constructor(options: PlanServiceOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.idGenerator = options.idGenerator ?? new SystemIdGenerator();
    this.scheduleProvider = options.scheduleProvider ?? createDefaultScheduleProvider();
    this.eventLog = options.eventLog ?? new IndexedDbEventLog();
    this.kvStore = options.kvStore ?? new KeyValueStore();
  }

  /**
   * Prepares BuildHorizonInput from stored mock athlete profile, environment, and schedule provider.
   */
  public async prepareHorizonInputs(
    nowIso: string,
    config: EffectiveConfig = getEffectiveConfig()
  ): Promise<BuildHorizonInput> {
    const horizonDays = requireNumber(config, 'execution_horizon_days');
    const dayStartHour = requireNumber(config, 'day_start_hour');
    const todayStr = getLocalDateWithDayStart(nowIso, dayStartHour);
    const endDateStr = addDays(todayStr, horizonDays);

    const windows = await Promise.resolve(
      this.scheduleProvider.getAvailability({
        startDate: todayStr,
        endDate: endDateStr,
      })
    );

    const profile = await this.kvStore.get<MockUserProfile>(KV_KEY_PROFILE);
    const envState = await this.kvStore.get<MockEnvironmentState>(KV_KEY_ENV);

    const environment: Record<string, EnvironmentItem> = {};
    if (envState?.items) {
      for (const [k, v] of Object.entries(envState.items)) {
        environment[k] = {
          item_id: v.item_id,
          status: v.status,
          updated_at: v.updated_at,
        };
      }
    } else {
      environment.floor = { item_id: 'floor', status: 'validated', updated_at: nowIso };
      environment.wall = { item_id: 'wall', status: 'declared', updated_at: nowIso };
      environment.chair = { item_id: 'chair', status: 'validated', updated_at: nowIso };
      environment.loaded_backpack = { item_id: 'loaded_backpack', status: 'validated', updated_at: nowIso };
    }

    const eligibleExercises: Exercise[] = INITIAL_EXERCISE_LIBRARY.filter(
      (ex) => isEligible(ex, environment).eligible
    );

    const capabilityMap: CapabilityMap = createDefaultCapabilityMap(nowIso);

    const priorities: [MuscleGroup, MuscleGroup] =
      profile?.physique_priorities && profile.physique_priorities.length === 2
        ? (profile.physique_priorities as [MuscleGroup, MuscleGroup])
        : ['chest', 'back'];

    return {
      plan_id: this.idGenerator.generateId(),
      now_iso: nowIso,
      availability_windows: windows,
      capability_map: capabilityMap,
      eligible_exercises: eligibleExercises,
      library: INITIAL_EXERCISE_LIBRARY,
      environment,
      physique_priorities: priorities,
      goal_emphasis: 'strength',
      seed: profile?.id ?? 'hfos-mock-athlete-seed',
    };
  }

  /**
   * Builds an HONEST decision summary for a day (E1b): the unit comes from
   * PlanDay.unit (set by buildHorizon), reasons come from the day's
   * DecisionRecord term_values (real normalized contributions) or from the
   * day's reason_code, and the revision reason is the one slideHorizon
   * actually recorded on the day. Nothing is derived from day parity and no
   * sentence is canned here — rendering/localization happens via t() in the UI.
   */
  public generateDecisionSummary(day: PlanDay, plan?: Plan): DayDecisionSummary {
    const unit: string = day.unit ?? 'rest';
    const top_reasons: DecisionReasonLine[] = [];

    if (day.kind === 'main' && day.decision && day.decision.selection) {
      const selection = day.decision.selection as { exercise_id?: unknown } | null;
      const prefix = typeof selection?.exercise_id === 'string' ? selection.exercise_id : '';
      const terms: Record<string, number> = day.decision.term_values ?? {};
      const knownTerms = [
        'stimulus_gap',
        'priority_need',
        'progression_need',
        'schedule_fit',
        'readiness',
        'goal_weight',
      ] as const;

      const scored = knownTerms
        .map((term) => ({ key: `reason.${term}` as DecisionReasonI18nKey, value: terms[`${prefix}:${term}`] }))
        .filter((x): x is { key: DecisionReasonI18nKey; value: number } => typeof x.value === 'number')
        .sort((a, b) => b.value - a.value);

      for (const s of scored.slice(0, 3)) {
        top_reasons.push({ key: s.key, value: Math.round(s.value * 100) });
      }
    }

    if (top_reasons.length === 0) {
      const code: DecisionReasonI18nKey =
        day.kind === 'main'
          ? 'reason_day.scheduled_main'
          : day.kind === 'active_recovery'
            ? 'reason_day.active_recovery_cap'
            : day.reason_code === undefined
              ? 'reason_day.rest'
              : `reason_day.${day.reason_code}`;
      top_reasons.push({ key: code });
    }

    return {
      day_index: day.day_index,
      date: day.date ?? '',
      unit,
      top_reasons,
      revision_reason: day.revision_reason,
      inputs_defaulted: plan?.inputs_defaulted ?? [],
    };
  }

  /**
   * Loads existing plan from kv store or creates a new 7-day adaptive plan.
   * If today is past the stored plan's Day 0 date, slides the horizon forward.
   */
  public async getOrCreatePlan(now?: Date): Promise<PlanServiceResult> {
    const startTime = performance.now();
    const nowIso = (now ?? this.clock.now()).toISOString();
    const config = getEffectiveConfig();
    const dayStartHour = requireNumber(config, 'day_start_hour');
    const todayStr = getLocalDateWithDayStart(nowIso, dayStartHour);

    let plan = await this.kvStore.get<Plan>(KV_KEY_PLAN_CURRENT);
    let decisions = await this.kvStore.get<Record<number, DayDecisionSummary>>(KV_KEY_DECISIONS);
    let isNewPlan = false;
    let isRevised = false;

    if (!plan || !plan.days || plan.days.length !== plan.horizon_days) {
      // Build fresh plan
      const inputs = await this.prepareHorizonInputs(nowIso, config);
      plan = buildHorizon(inputs, config);
      isNewPlan = true;
    } else {
      // Check if Day 0 is stale (date before current local todayStr)
      const storedDay0Date = plan.days[0]?.date;
      if (storedDay0Date && storedDay0Date < todayStr) {
        // Slide horizon
        const inputs = await this.prepareHorizonInputs(nowIso, config);
        const oldPlan = plan;
        plan = slideHorizon(oldPlan, nowIso, inputs, config);
        isRevised = true;
      }
    }

    // Build or update decision records
    if (!decisions || isNewPlan || isRevised) {
      decisions = {};
      for (const d of plan.days) {
        decisions[d.day_index] = this.generateDecisionSummary(d, plan);
      }
    }

    const durationMs = Math.round((performance.now() - startTime) * 10) / 10;

    // Persist plan and decisions
    await this.kvStore.set(KV_KEY_PLAN_CURRENT, plan);
    await this.kvStore.set(KV_KEY_DECISIONS, decisions);
    await this.kvStore.set(KV_KEY_PLAN_GEN_TIME, durationMs);

    // Emit event (device_id is the persistent installation id, never a hard-coded label)
    const deviceId = await getPersistentDeviceId(this.kvStore);
    if (isNewPlan) {
      await this.eventLog.append({
        event_id: this.idGenerator.generateId(),
        type: 'plan.generated',
        occurred_at: nowIso,
        device_id: deviceId,
        idempotency_key: `plan-gen-${plan.id}`,
        schema_version: 1,
        payload: {
          plan_id: plan.id,
          horizon_days: plan.horizon_days,
          created_at: plan.created_at,
          day_0_date: plan.days[0]?.date,
        },
      });
    } else if (isRevised) {
      await this.eventLog.append({
        event_id: this.idGenerator.generateId(),
        type: 'plan.revised',
        occurred_at: nowIso,
        device_id: deviceId,
        idempotency_key: `plan-rev-${plan.id}-${todayStr}`,
        schema_version: 1,
        payload: {
          plan_id: plan.id,
          reason: 'schedule_slide',
          day_0_date: plan.days[0]?.date,
        },
      });
    }

    return {
      plan,
      decisions,
      generationDurationMs: durationMs,
    };
  }
}
