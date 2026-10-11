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
import { KV_KEY_PROFILE, KV_KEY_ENV, type MockEnvironmentState } from '../bootstrap.js';
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

export interface DayDecisionSummary {
  day_index: number;
  date: string;
  unit: string;
  top_reasons: string[]; // 3 human-readable explanation strings
  revision_reason?: string; // Reason code if revised (schedule | readiness | prior_session | threshold)
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
   * Generates readable DecisionRecord explanation strings for a given day.
   */
  public generateDecisionSummary(day: PlanDay): DayDecisionSummary {
    const unit = day.session_snapshot ? (day.day_index % 2 === 0 ? 'A' : 'B') : 'Rest';

    // Top 3 deterministic reasons for the day's assignment
    const top_reasons: string[] = [];
    if (day.kind === 'main') {
      top_reasons.push('Priority muscle stimulus gap reached training threshold');
      top_reasons.push('Scheduled availability window fits full working set prescription');
      top_reasons.push('Compound movement progression criteria satisfied');
    } else if (day.kind === 'active_recovery') {
      top_reasons.push('Consecutive training cap reached; active bloodflow recommended');
      top_reasons.push('Mobility & tissue recovery prioritize joint readiness');
      top_reasons.push('Low-intensity movement preserves systemic recovery');
    } else {
      top_reasons.push('Scheduled rest preserves neuromuscular readiness');
      top_reasons.push('Recovery spacing prevents overlapping fatigue patterns');
      top_reasons.push('Adaptive day optimized for upcoming main volume');
    }

    return {
      day_index: day.day_index,
      date: day.date ?? '',
      unit,
      top_reasons,
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
        const summary = this.generateDecisionSummary(d);
        if (isRevised && d.day_index >= 2) {
          summary.revision_reason = 'schedule';
        }
        decisions[d.day_index] = summary;
      }
    }

    const durationMs = Math.round((performance.now() - startTime) * 10) / 10;

    // Persist plan and decisions
    await this.kvStore.set(KV_KEY_PLAN_CURRENT, plan);
    await this.kvStore.set(KV_KEY_DECISIONS, decisions);
    await this.kvStore.set(KV_KEY_PLAN_GEN_TIME, durationMs);

    // Emit event
    if (isNewPlan) {
      await this.eventLog.append({
        event_id: this.idGenerator.generateId(),
        type: 'plan.generated',
        occurred_at: nowIso,
        device_id: 'redmi12_client',
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
        device_id: 'redmi12_client',
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
