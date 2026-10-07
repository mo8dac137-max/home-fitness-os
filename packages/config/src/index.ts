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

export function getEffectiveConfig(
  userOverrides: Record<string, unknown> = {}
): Record<string, unknown> {
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
