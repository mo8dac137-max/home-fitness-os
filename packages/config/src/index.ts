import type { SettingDefinition } from '@hfos/contracts';

export const PACKAGE_NAME = '@hfos/config';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const RANK_WEIGHT_KEYS = [
  'rank_weight_priority_need',
  'rank_weight_stimulus_gap',
  'rank_weight_progression_need',
  'rank_weight_goal_weight',
  'rank_weight_schedule_fit',
  'rank_weight_readiness',
] as const;

// Seeded defaults from Section 5 of PROJECT_BRIEF
export const DEFAULT_SETTINGS: SettingDefinition[] = [
  {
    schema_version: 1,
    key: 'execution_horizon_days',
    type: 'number',
    default: 7,
    bounds: { min: 3, max: 8 },
    scope: 'user',
    consumer: 'planner',
    version: '1.0.0',
    description: 'Planning horizon in days (3-8)',
  },
  {
    schema_version: 1,
    key: 'min_main_session_minutes',
    type: 'number',
    default: 30,
    bounds: { min: 30, max: 120 },
    scope: 'safety_locked',
    consumer: 'session_builder',
    version: '1.0.0',
    description: 'Minimum duration for a main session in minutes (safety-locked)',
  },
  {
    schema_version: 1,
    key: 'transition_seconds',
    type: 'number',
    default: 15,
    bounds: { min: 10, max: 30 },
    scope: 'user',
    consumer: 'session_timer',
    version: '1.0.0',
    description: 'Default transition time between exercises in seconds (10-30)',
  },
  {
    schema_version: 1,
    key: 'rest_dynamic',
    type: 'boolean',
    default: true,
    scope: 'user',
    consumer: 'prescription_engine',
    version: '1.0.0',
    description: 'Dynamic rest calculation per exercise and goal',
  },
  {
    schema_version: 1,
    key: 'hysteresis_threshold',
    type: 'number',
    default: 0.1,
    bounds: { min: 0.05, max: 0.25 },
    scope: 'user',
    consumer: 'plan_adapter',
    version: '1.0.0',
    description: 'Hysteresis threshold to prevent unnecessary plan churn (0.10)',
  },
  {
    schema_version: 1,
    key: 'material_change_duration_pct',
    type: 'number',
    default: 0.1,
    bounds: { min: 0.05, max: 0.5 },
    scope: 'user',
    consumer: 'plan_adapter',
    version: '1.0.0',
    description: 'Percentage threshold in duration to qualify as material change (>=10%)',
  },
  {
    schema_version: 1,
    key: 'material_change_hard_sets_pct',
    type: 'number',
    default: 0.1,
    bounds: { min: 0.05, max: 0.5 },
    scope: 'user',
    consumer: 'plan_adapter',
    version: '1.0.0',
    description: 'Percentage threshold in hard sets to qualify as material change (>=10%)',
  },
  // The six rank weights (sum to 1.00)
  {
    schema_version: 1,
    key: 'rank_weight_priority_need',
    type: 'number',
    default: 0.2,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Candidate ranking weight for priority need (0.20)',
  },
  {
    schema_version: 1,
    key: 'rank_weight_stimulus_gap',
    type: 'number',
    default: 0.2,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Candidate ranking weight for stimulus gap (0.20)',
  },
  {
    schema_version: 1,
    key: 'rank_weight_progression_need',
    type: 'number',
    default: 0.2,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Candidate ranking weight for progression need (0.20)',
  },
  {
    schema_version: 1,
    key: 'rank_weight_goal_weight',
    type: 'number',
    default: 0.15,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Candidate ranking weight for goal alignment (0.15)',
  },
  {
    schema_version: 1,
    key: 'rank_weight_schedule_fit',
    type: 'number',
    default: 0.15,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Candidate ranking weight for schedule fit (0.15)',
  },
  {
    schema_version: 1,
    key: 'rank_weight_readiness',
    type: 'number',
    default: 0.1,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Candidate ranking weight for readiness (0.10)',
  },
  // Progression review settings
  {
    schema_version: 1,
    key: 'progression_min_main_sessions',
    type: 'number',
    default: 3,
    bounds: { min: 1, max: 10 },
    scope: 'user',
    consumer: 'progression_engine',
    version: '1.0.0',
    description: 'Minimum completed main sessions before progression review (>=3)',
  },
  {
    schema_version: 1,
    key: 'progression_min_days',
    type: 'number',
    default: 6,
    bounds: { min: 1, max: 30 },
    scope: 'user',
    consumer: 'progression_engine',
    version: '1.0.0',
    description: 'Minimum days before progression review (>=6)',
  },
  {
    schema_version: 1,
    key: 'progression_max_days',
    type: 'number',
    default: 10,
    bounds: { min: 6, max: 30 },
    scope: 'user',
    consumer: 'progression_engine',
    version: '1.0.0',
    description: 'Maximum days before forced progression review (max 10)',
  },
  {
    schema_version: 1,
    key: 'day_start_hour',
    type: 'number',
    default: 4,
    bounds: { min: 0, max: 12 },
    scope: 'user',
    consumer: 'scheduler',
    version: '1.0.0',
    description: 'Hour of day when new fitness calendar day begins (default 4 AM)',
  },
  // Batch 2 (M0-06 Environment)
  {
    schema_version: 1,
    key: 'items_requiring_validation',
    type: 'array',
    default: ['table', 'door', 'stairs', 'chair', 'loaded_backpack', 'wall'],
    scope: 'user',
    consumer: 'environment_checker',
    version: '1.0.0',
    description: 'Environment items requiring user validation before use',
  },
  // Batch 2 (M0-07 Validator & Volume Caps)
  {
    schema_version: 1,
    key: 'min_hours_between_hard_same_pattern',
    type: 'number',
    default: 36,
    bounds: { min: 12, max: 72 },
    scope: 'user',
    consumer: 'validator',
    version: '1.0.0',
    description: 'Minimum hours between hard sessions targeting the same movement pattern',
  },
  {
    schema_version: 1,
    key: 'weekly_sets_cap_per_muscle',
    type: 'number',
    default: 16,
    bounds: { min: 6, max: 30 },
    scope: 'user',
    consumer: 'validator',
    version: '1.0.0',
    description: 'Weekly hard set limit per muscle group',
  },
  {
    schema_version: 1,
    key: 'session_hard_sets_cap',
    type: 'number',
    default: 24,
    bounds: { min: 10, max: 40 },
    scope: 'user',
    consumer: 'validator',
    version: '1.0.0',
    description: 'Maximum hard sets allowed within a single workout session',
  },
  {
    schema_version: 1,
    key: 'max_session_minutes',
    type: 'number',
    default: 60,
    bounds: { min: 30, max: 120 },
    scope: 'user',
    consumer: 'validator',
    version: '1.0.0',
    description: 'Maximum session duration in minutes',
  },
  // Batch 2 (M0-08 Session Generator & Duration Calculator)
  {
    schema_version: 1,
    key: 'warmup_minutes',
    type: 'number',
    default: 6,
    bounds: { min: 3, max: 15 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Warmup duration in minutes',
  },
  {
    schema_version: 1,
    key: 'cooldown_minutes',
    type: 'number',
    default: 6,
    bounds: { min: 3, max: 15 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Cooldown duration in minutes',
  },
  {
    schema_version: 1,
    key: 'default_work_seconds',
    type: 'number',
    default: 40,
    bounds: { min: 20, max: 90 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Estimated work duration per set in seconds',
  },
  {
    schema_version: 1,
    key: 'rest_seconds_strength',
    type: 'number',
    default: 150,
    bounds: { min: 120, max: 180 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Default rest seconds for strength emphasis (120-180)',
  },
  {
    schema_version: 1,
    key: 'rest_seconds_hypertrophy',
    type: 'number',
    default: 75,
    bounds: { min: 60, max: 90 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Default rest seconds for hypertrophy emphasis (60-90)',
  },
  {
    schema_version: 1,
    key: 'rest_seconds_endurance',
    type: 'number',
    default: 40,
    bounds: { min: 30, max: 45 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Default rest seconds for endurance emphasis (30-45)',
  },
  // Part 1 Hardening & Session Settings
  {
    schema_version: 1,
    key: 'rep_window_strength',
    type: 'object',
    default: { min: 4, max: 8, target: 6 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Target rep window for strength emphasis',
  },
  {
    schema_version: 1,
    key: 'rep_window_hypertrophy',
    type: 'object',
    default: { min: 6, max: 15, target: 10 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Target rep window for hypertrophy emphasis',
  },
  {
    schema_version: 1,
    key: 'rep_window_endurance',
    type: 'object',
    default: { min: 12, max: 25, target: 15 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Target rep window for endurance emphasis',
  },
  {
    schema_version: 1,
    key: 'mobility_rest_seconds',
    type: 'number',
    default: 30,
    bounds: { min: 15, max: 60 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Rest duration after mobility sets in seconds',
  },
  {
    schema_version: 1,
    key: 'seconds_per_minute',
    type: 'number',
    default: 60,
    bounds: { min: 60, max: 60 },
    scope: 'safety_locked',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Seconds per minute constant',
  },
  {
    schema_version: 1,
    key: 'default_sets_per_exercise',
    type: 'number',
    default: 3,
    bounds: { min: 1, max: 6 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Default working set count per exercise in a session',
  },
  {
    schema_version: 1,
    key: 'default_mobility_sets',
    type: 'number',
    default: 2,
    bounds: { min: 1, max: 4 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Default set count for mobility additions',
  },
  {
    schema_version: 1,
    key: 'rpe_target_mobility',
    type: 'number',
    default: 6,
    bounds: { min: 1, max: 10 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Target RPE for mobility exercises',
  },
  {
    schema_version: 1,
    key: 'rpe_target_strength',
    type: 'number',
    default: 8.5,
    bounds: { min: 6, max: 10 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Target RPE for strength compound sets',
  },
  {
    schema_version: 1,
    key: 'rpe_target_default',
    type: 'number',
    default: 8,
    bounds: { min: 6, max: 10 },
    scope: 'user',
    consumer: 'session_generator',
    version: '1.0.0',
    description: 'Default target RPE for hypertrophy/endurance sets',
  },
  // Batch 3 (M0-09 Progression Engine)
  {
    schema_version: 1,
    key: 'finder_rep_min',
    type: 'number',
    default: 4,
    bounds: { min: 1, max: 10 },
    scope: 'user',
    consumer: 'progression',
    version: '1.0.0',
    description: 'Minimum reps for valid finder technical-cap test',
  },
  {
    schema_version: 1,
    key: 'finder_rep_max',
    type: 'number',
    default: 8,
    bounds: { min: 2, max: 20 },
    scope: 'user',
    consumer: 'progression',
    version: '1.0.0',
    description: 'Maximum reps for valid finder technical-cap test',
  },
  {
    schema_version: 1,
    key: 'review_min_sessions',
    type: 'number',
    default: 3,
    bounds: { min: 1, max: 10 },
    scope: 'user',
    consumer: 'progression',
    version: '1.0.0',
    description: 'Minimum sessions before progression review is due',
  },
  {
    schema_version: 1,
    key: 'review_min_days',
    type: 'number',
    default: 6,
    bounds: { min: 1, max: 30 },
    scope: 'user',
    consumer: 'progression',
    version: '1.0.0',
    description: 'Minimum days before progression review is due',
  },
  {
    schema_version: 1,
    key: 'review_max_days',
    type: 'number',
    default: 10,
    bounds: { min: 6, max: 30 },
    scope: 'user',
    consumer: 'progression',
    version: '1.0.0',
    description: 'Maximum days before progression review is forced due',
  },
  {
    schema_version: 1,
    key: 'min_quality_threshold',
    type: 'number',
    default: 3,
    bounds: { min: 1, max: 3 },
    scope: 'user',
    consumer: 'progression',
    version: '1.0.0',
    description: 'Minimum execution quality score required for progression',
  },
  {
    schema_version: 1,
    key: 'stagnation_threshold',
    type: 'number',
    default: 3,
    bounds: { min: 2, max: 5 },
    scope: 'user',
    consumer: 'progression',
    version: '1.0.0',
    description: 'Number of consecutive non-progress reviews triggering stagnation diagnostic',
  },
  {
    schema_version: 1,
    key: 'min_exposure_progression',
    type: 'number',
    default: 2,
    bounds: { min: 1, max: 5 },
    scope: 'user',
    consumer: 'progression',
    version: '1.0.0',
    description: 'Minimum exposure occurrences in trailing 14 days required to progress',
  },
  {
    schema_version: 1,
    key: 'deload_rpe',
    type: 'number',
    default: 9,
    bounds: { min: 7, max: 10 },
    scope: 'user',
    consumer: 'progression',
    version: '1.0.0',
    description: 'Session RPE threshold triggering deload recommendation if sustained',
  },
  {
    schema_version: 1,
    key: 'lever_order',
    type: 'array',
    default: ['reps', 'tempo', 'rom', 'load', 'harder_variation', 'density', 'volume'],
    scope: 'user',
    consumer: 'progression',
    version: '1.0.0',
    description: 'Ordered sequence of progression levers to apply',
  },
  // Batch 3 (M0-10 Ranking & Stimulus Gap)
  {
    schema_version: 1,
    key: 'target_stimulus_interval_days',
    type: 'number',
    default: 3,
    bounds: { min: 1, max: 7 },
    scope: 'user',
    consumer: 'ranking',
    version: '1.0.0',
    description: 'Target days between stimulus exposures for a movement pattern',
  },
  // Batch 3 (M0-11 Muscle Exposure)
  {
    schema_version: 1,
    key: 'exposure_window_days',
    type: 'number',
    default: 7,
    bounds: { min: 3, max: 28 },
    scope: 'user',
    consumer: 'exposure',
    version: '1.0.0',
    description: 'Trailing window in days for muscle exposure calculations',
  },
  {
    schema_version: 1,
    key: 'min_trend_points',
    type: 'number',
    default: 6,
    bounds: { min: 2, max: 20 },
    scope: 'user',
    consumer: 'exposure',
    version: '1.0.0',
    description: 'Minimum data points required to calculate an exposure trend',
  },
  {
    schema_version: 1,
    key: 'trend_flat_band',
    type: 'number',
    default: 0.1,
    bounds: { min: 0.01, max: 0.5 },
    scope: 'user',
    consumer: 'exposure',
    version: '1.0.0',
    description: 'Percentage threshold defining flat band for exposure trend',
  },
  {
    schema_version: 1,
    key: 'secondary_muscle_fraction',
    type: 'number',
    default: 0.5,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'exposure',
    version: '1.0.0',
    description: 'Set fraction credited to secondary muscles',
  },
  {
    schema_version: 1,
    key: 'milliseconds_per_day',
    type: 'number',
    default: 86400000,
    bounds: { min: 86400000, max: 86400000 },
    scope: 'safety_locked',
    consumer: 'time_math',
    version: '1.0.0',
    description: 'Milliseconds per standard day constant',
  },
  {
    schema_version: 1,
    key: 'milliseconds_per_hour',
    type: 'number',
    default: 3600000,
    bounds: { min: 3600000, max: 3600000 },
    scope: 'safety_locked',
    consumer: 'time_math',
    version: '1.0.0',
    description: 'Milliseconds per standard hour constant',
  },
  // Batch 3 (M0-12 Knowledge & Freshness)
  {
    schema_version: 1,
    key: 'freshness_days_weight',
    type: 'number',
    default: 14,
    bounds: { min: 1, max: 90 },
    scope: 'user',
    consumer: 'knowledge',
    version: '1.0.0',
    description: 'Days before bodyweight measurement is considered stale',
  },
  {
    schema_version: 1,
    key: 'freshness_days_waist',
    type: 'number',
    default: 14,
    bounds: { min: 1, max: 90 },
    scope: 'user',
    consumer: 'knowledge',
    version: '1.0.0',
    description: 'Days before waist circumference measurement is considered stale',
  },
  {
    schema_version: 1,
    key: 'freshness_days_baseline_test',
    type: 'number',
    default: 56,
    bounds: { min: 7, max: 180 },
    scope: 'user',
    consumer: 'knowledge',
    version: '1.0.0',
    description: 'Days before baseline physical test is considered stale',
  },
  {
    schema_version: 1,
    key: 'freshness_days_equipment',
    type: 'number',
    default: 90,
    bounds: { min: 7, max: 365 },
    scope: 'user',
    consumer: 'knowledge',
    version: '1.0.0',
    description: 'Days before equipment availability declaration is considered stale',
  },
  {
    schema_version: 1,
    key: 'max_questions_per_day',
    type: 'number',
    default: 1,
    bounds: { min: 1, max: 5 },
    scope: 'user',
    consumer: 'knowledge',
    version: '1.0.0',
    description: 'Maximum information needs questions presented to user per day',
  },
  // Batch 4 (M0-13 Horizon & Autonomy)
  {
    schema_version: 1,
    key: 'main_sessions_min',
    type: 'number',
    default: 3,
    bounds: { min: 1, max: 7 },
    scope: 'user',
    consumer: 'horizon',
    version: '1.0.0',
    description: 'Minimum main sessions per rolling 7 days',
  },
  {
    schema_version: 1,
    key: 'main_sessions_max',
    type: 'number',
    default: 5,
    bounds: { min: 1, max: 7 },
    scope: 'user',
    consumer: 'horizon',
    version: '1.0.0',
    description: 'Maximum main sessions per rolling 7 days',
  },
  {
    schema_version: 1,
    key: 'max_consecutive_main_days',
    type: 'number',
    default: 2,
    bounds: { min: 1, max: 7 },
    scope: 'user',
    consumer: 'horizon',
    version: '1.0.0',
    description: 'Maximum consecutive days with a main session',
  },
  {
    schema_version: 1,
    key: 'autonomy_change_today',
    type: 'string',
    default: 'ask',
    scope: 'user',
    consumer: 'autonomy',
    version: '1.0.0',
    description: 'Autonomy level for changes on current day (ask|notify|auto)',
  },
  {
    schema_version: 1,
    key: 'autonomy_change_tomorrow',
    type: 'string',
    default: 'ask',
    scope: 'user',
    consumer: 'autonomy',
    version: '1.0.0',
    description: 'Autonomy level for changes on tomorrow (ask|notify|auto)',
  },
  {
    schema_version: 1,
    key: 'autonomy_replan_future',
    type: 'string',
    default: 'auto',
    scope: 'user',
    consumer: 'autonomy',
    version: '1.0.0',
    description: 'Autonomy level for replanning adaptive future days (ask|notify|auto)',
  },
  {
    schema_version: 1,
    key: 'autonomy_due_progression',
    type: 'string',
    default: 'notify',
    scope: 'user',
    consumer: 'autonomy',
    version: '1.0.0',
    description: 'Autonomy level for due progression recommendations (ask|notify|auto)',
  },
  {
    schema_version: 1,
    key: 'autonomy_global_setting',
    type: 'string',
    default: 'ask',
    scope: 'user',
    consumer: 'autonomy',
    version: '1.0.0',
    description: 'Autonomy level for global configuration changes (ask|notify|auto)',
  },
  {
    schema_version: 1,
    key: 'autonomy_rest_default',
    type: 'string',
    default: 'ask',
    scope: 'user',
    consumer: 'autonomy',
    version: '1.0.0',
    description: 'Autonomy level for shifting to rest default (ask|notify|auto)',
  },
  {
    schema_version: 1,
    key: 'autonomy_muscle_target',
    type: 'string',
    default: 'ask',
    scope: 'user',
    consumer: 'autonomy',
    version: '1.0.0',
    description: 'Autonomy level for changing target muscle emphasis (ask|notify|auto)',
  },
  // Batch 4 (M0-14 AI Contract)
  {
    schema_version: 1,
    key: 'ai_message_draft_max_length',
    type: 'number',
    default: 280,
    bounds: { min: 50, max: 1000 },
    scope: 'user',
    consumer: 'ai_contract',
    version: '1.0.0',
    description: 'Maximum character length of AI message drafts',
  },
  // Milestone 1-B E1a (Engine Honesty & Real Provenance)
  {
    schema_version: 1,
    key: 'stimulus_gap_no_history',
    type: 'number',
    default: 1.0,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Default stimulus gap score when no training history exists (0..1)',
  },
  {
    schema_version: 1,
    key: 'progression_need_default',
    type: 'number',
    default: 0.5,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Default progression need score when no review outcome data exists (0..1)',
  },
  {
    schema_version: 1,
    key: 'readiness_default',
    type: 'number',
    default: 0.8,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Default readiness score when no check-in score recorded (0..1)',
  },
  {
    schema_version: 1,
    key: 'preferred_session_minutes',
    type: 'number',
    default: 45,
    bounds: { min: 15, max: 120 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Preferred target session duration in minutes for schedule fit normalization',
  },
  {
    schema_version: 1,
    key: 'min_eligible_patterns_per_unit',
    type: 'number',
    default: 2,
    bounds: { min: 1, max: 5 },
    scope: 'safety_locked',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Minimum number of patterns with eligible equipment required for unit to be eligible',
  },
  {
    schema_version: 1,
    key: 'progression_score_progress',
    type: 'number',
    default: 1.0,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Progression need score for progress outcome (0..1)',
  },
  {
    schema_version: 1,
    key: 'progression_score_maintain',
    type: 'number',
    default: 0.5,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Progression need score for maintain outcome (0..1)',
  },
  {
    schema_version: 1,
    key: 'progression_score_regress',
    type: 'number',
    default: 0.2,
    bounds: { min: 0, max: 1 },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Progression need score for regress or deload outcome (0..1)',
  },
  {
    schema_version: 1,
    key: 'unit_goal_weights',
    type: 'object',
    default: {
      strength: { A: 1.0, B: 0.9, C: 0.9, D: 0.8 },
      hypertrophy: { A: 0.9, B: 0.9, C: 1.0, D: 0.8 },
      endurance: { A: 0.8, B: 0.8, C: 0.8, D: 1.0 },
    },
    scope: 'user',
    consumer: 'ranking_engine',
    version: '1.0.0',
    description: 'Goal emphasis weight table per training unit (strength/hypertrophy/endurance)',
  },
  // Phase 2A Session Runner Settings
  {
    schema_version: 1,
    key: 'warmup_sets_default',
    type: 'number',
    default: 1,
    bounds: { min: 0, max: 3 },
    scope: 'user',
    consumer: 'session_runner',
    version: '1.0.0',
    description: 'Number of warmup sets preceding working sets of the first exercise (0-3)',
  },
  {
    schema_version: 1,
    key: 'cooldown_duration_minutes',
    type: 'number',
    default: 5,
    bounds: { min: 1, max: 15 },
    scope: 'user',
    consumer: 'session_runner',
    version: '1.0.0',
    description: 'Cooldown duration in minutes at the end of a session (1-15)',
  },
  {
    schema_version: 1,
    key: 'rest_floor_seconds',
    type: 'number',
    default: 30,
    bounds: { min: 15, max: 60 },
    scope: 'user',
    consumer: 'session_runner',
    version: '1.0.0',
    description: 'Minimum rest duration floor in seconds (15-60)',
  },
  {
    schema_version: 1,
    key: 'rest_ceiling_seconds',
    type: 'number',
    default: 180,
    bounds: { min: 60, max: 300 },
    scope: 'user',
    consumer: 'session_runner',
    version: '1.0.0',
    description: 'Maximum rest duration ceiling in seconds (60-300)',
  },
  {
    schema_version: 1,
    key: 'target_rpe_default',
    type: 'number',
    default: 7.5,
    bounds: { min: 6.0, max: 9.5 },
    scope: 'user',
    consumer: 'session_runner',
    version: '1.0.0',
    description: 'Default target RPE for working sets (6.0-9.5)',
  },
  // Phase 2C RPE Selector Scale Settings
  {
    schema_version: 1,
    key: 'rpe_min',
    type: 'number',
    default: 6.0,
    bounds: { min: 4.0, max: 6.5 },
    scope: 'user',
    consumer: 'session_runner',
    version: '1.0.0',
    description: 'Minimum selectable RPE in the runner RPE selector (4.0-6.5)',
  },
  {
    schema_version: 1,
    key: 'rpe_max',
    type: 'number',
    default: 9.5,
    bounds: { min: 9.0, max: 10.0 },
    scope: 'user',
    consumer: 'session_runner',
    version: '1.0.0',
    description: 'Maximum selectable RPE in the runner RPE selector (9.0-10.0)',
  },
  {
    schema_version: 1,
    key: 'rpe_step',
    type: 'number',
    default: 0.5,
    bounds: { min: 0.25, max: 1.0 },
    scope: 'user',
    consumer: 'session_runner',
    version: '1.0.0',
    description: 'Step increment between selectable RPE values (0.25-1.0)',
  },
];

class SettingsRegistry {
  private definitions: Map<string, SettingDefinition> = new Map();

  constructor() {
    this.registerSettings(DEFAULT_SETTINGS);
  }

  public reset(): void {
    this.definitions.clear();
    this.registerSettings(DEFAULT_SETTINGS);
  }

  public clearAll(): void {
    this.definitions.clear();
  }

  public registerSettings(definitions: SettingDefinition[]): void {
    for (const def of definitions) {
      if (!def.key || typeof def.key !== 'string') {
        throw new Error('SettingDefinition must have a valid string key');
      }
      if (!def.consumer || typeof def.consumer !== 'string' || def.consumer.trim() === '') {
        throw new Error(`Setting "${def.key}" is invalid: a setting without a consumer is rejected.`);
      }
      this.definitions.set(def.key, def);
    }
  }

  public getSettingDefinition(key: string): SettingDefinition | undefined {
    return this.definitions.get(key);
  }

  public getAllSettingDefinitions(): SettingDefinition[] {
    return Array.from(this.definitions.values());
  }

  public validateSettingValue(
    key: string,
    value: unknown,
    scopeContext: 'user' | 'safety_locked' = 'user'
  ): ValidationResult {
    const def = this.definitions.get(key);
    if (!def) {
      return { valid: false, error: `Unknown setting key: "${key}"` };
    }

    if (def.scope === 'safety_locked' && scopeContext === 'user') {
      return {
        valid: false,
        error: `Setting "${key}" is safety_locked and cannot be changed by the user.`,
      };
    }

    // Type checking
    const actualType = typeof value;
    if (def.type === 'number') {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return { valid: false, error: `Setting "${key}" expects a number, received ${actualType}.` };
      }
      if (def.bounds?.min !== undefined && value < def.bounds.min) {
        return {
          valid: false,
          error: `Setting "${key}" value ${value} is below minimum bound ${def.bounds.min}.`,
        };
      }
      if (def.bounds?.max !== undefined && value > def.bounds.max) {
        return {
          valid: false,
          error: `Setting "${key}" value ${value} exceeds maximum bound ${def.bounds.max}.`,
        };
      }
    } else if (def.type === 'boolean') {
      if (typeof value !== 'boolean') {
        return { valid: false, error: `Setting "${key}" expects a boolean, received ${actualType}.` };
      }
    } else if (def.type === 'string') {
      if (typeof value !== 'string') {
        return { valid: false, error: `Setting "${key}" expects a string, received ${actualType}.` };
      }
      if (def.bounds?.allowed && !def.bounds.allowed.includes(value)) {
        return {
          valid: false,
          error: `Setting "${key}" value "${value}" is not in allowed values: ${def.bounds.allowed.join(', ')}.`,
        };
      }
    } else if (def.type === 'array') {
      if (!Array.isArray(value)) {
        return { valid: false, error: `Setting "${key}" expects an array, received ${actualType}.` };
      }
    } else if (def.type === 'object') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { valid: false, error: `Setting "${key}" expects an object, received ${actualType}.` };
      }
    }

    return { valid: true };
  }

  public validateRankWeights(config: Record<string, unknown>): ValidationResult {
    let sum = 0;
    for (const key of RANK_WEIGHT_KEYS) {
      const val = config[key];
      if (typeof val !== 'number') {
        return { valid: false, error: `Rank weight "${key}" is missing or not a number.` };
      }
      sum += val;
    }
    // Allow small floating point margin
    if (Math.abs(sum - 1.0) > 0.0001) {
      return {
        valid: false,
        error: `Rank weights must sum to 1.0, current sum is ${sum.toFixed(4)}.`,
      };
    }
    return { valid: true };
  }

  public getEffectiveConfig(
    userOverrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const effective: Record<string, unknown> = {};

    // Populate defaults
    for (const [key, def] of this.definitions.entries()) {
      effective[key] = def.default;
    }

    // Apply valid user overrides
    for (const [key, val] of Object.entries(userOverrides)) {
      const validation = this.validateSettingValue(key, val, 'user');
      if (validation.valid) {
        effective[key] = val;
      }
    }

    return effective;
  }
}

export const registry = new SettingsRegistry();

export function registerSettings(definitions: SettingDefinition[]): void {
  registry.registerSettings(definitions);
}

export function validateSettingValue(
  key: string,
  value: unknown,
  scopeContext: 'user' | 'safety_locked' = 'user'
): ValidationResult {
  return registry.validateSettingValue(key, value, scopeContext);
}

export type EffectiveConfig = Record<string, unknown>;

export function requireNumber(config: EffectiveConfig, key: string): number {
  if (!(key in config)) {
    throw new Error(`Missing required configuration key: "${key}"`);
  }
  const val = config[key];
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new Error(
      `Configuration key "${key}" must be a finite number, received: ${typeof val} (${String(val)})`
    );
  }
  return val;
}

export function requireBoolean(config: EffectiveConfig, key: string): boolean {
  if (!(key in config)) {
    throw new Error(`Missing required configuration key: "${key}"`);
  }
  const val = config[key];
  if (typeof val !== 'boolean') {
    throw new Error(
      `Configuration key "${key}" must be a boolean, received: ${typeof val} (${String(val)})`
    );
  }
  return val;
}

export interface RangeConfig {
  min: number;
  max: number;
  target?: number;
}

export function requireRange(config: EffectiveConfig, key: string): RangeConfig {
  if (!(key in config)) {
    throw new Error(`Missing required configuration key: "${key}"`);
  }
  const val = config[key];
  if (typeof val !== 'object' || val === null) {
    throw new Error(
      `Configuration key "${key}" must be an object with min and max, received: ${typeof val}`
    );
  }
  const r = val as Record<string, unknown>;
  if (typeof r.min !== 'number' || !Number.isFinite(r.min)) {
    throw new Error(`Configuration key "${key}.min" must be a finite number`);
  }
  if (typeof r.max !== 'number' || !Number.isFinite(r.max)) {
    throw new Error(`Configuration key "${key}.max" must be a finite number`);
  }
  const result: RangeConfig = {
    min: r.min,
    max: r.max,
  };
  if (typeof r.target === 'number' && Number.isFinite(r.target)) {
    result.target = r.target;
  }
  return result;
}

export function requireArray<T = unknown>(config: EffectiveConfig, key: string): T[] {
  if (!(key in config)) {
    throw new Error(`Missing required configuration key: "${key}"`);
  }
  const val = config[key];
  if (!Array.isArray(val)) {
    throw new Error(`Configuration key "${key}" must be an array, received: ${typeof val}`);
  }
  return val as T[];
}

export function requireObject<T = Record<string, unknown>>(config: EffectiveConfig, key: string): T {
  if (!(key in config)) {
    throw new Error(`Missing required configuration key: "${key}"`);
  }
  const val = config[key];
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    throw new Error(`Configuration key "${key}" must be an object, received: ${typeof val}`);
  }
  return val as T;
}

export function getEffectiveConfig(
  userOverrides: Record<string, unknown> = {}
): EffectiveConfig {
  return registry.getEffectiveConfig(userOverrides);
}

export function validateRankWeights(config: Record<string, unknown>): ValidationResult {
  return registry.validateRankWeights(config);
}

export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return registry.getSettingDefinition(key);
}

export function getAllSettingDefinitions(): SettingDefinition[] {
  return registry.getAllSettingDefinitions();
}

export function resetRegistry(): void {
  registry.reset();
}

export function requiresApproval(
  decisionClass: string,
  config: EffectiveConfig = getEffectiveConfig()
): boolean {
  const settingKey = `autonomy_${decisionClass}`;
  const level = (config[settingKey] as string | undefined) ?? 'ask';
  return level === 'ask';
}
