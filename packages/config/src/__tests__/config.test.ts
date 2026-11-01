import { describe, it, expect, beforeEach } from 'vitest';
import {
  PACKAGE_NAME,
  DEFAULT_SETTINGS,
  registerSettings,
  validateSettingValue,
  getEffectiveConfig,
  validateRankWeights,
  resetRegistry,
  requireNumber,
  requireRange,
  requireArray,
  requireBoolean,
} from '../index.js';
import type { SettingDefinition } from '@hfos/contracts';

describe('@hfos/config', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('exports correct PACKAGE_NAME and seeded DEFAULT_SETTINGS', () => {
    expect(PACKAGE_NAME).toBe('@hfos/config');
    expect(DEFAULT_SETTINGS.length).toBeGreaterThan(0);
  });

  it('seeds all defaults from section 5 of the project brief', () => {
    const config = getEffectiveConfig();
    expect(config['execution_horizon_days']).toBe(7);
    expect(config['min_main_session_minutes']).toBe(30);
    expect(config['transition_seconds']).toBe(15);
    expect(config['rest_dynamic']).toBe(true);
    expect(config['hysteresis_threshold']).toBe(0.1);
    expect(config['material_change_duration_pct']).toBe(0.1);
    expect(config['material_change_hard_sets_pct']).toBe(0.1);
    expect(config['rank_weight_priority_need']).toBe(0.2);
    expect(config['rank_weight_stimulus_gap']).toBe(0.2);
    expect(config['rank_weight_progression_need']).toBe(0.2);
    expect(config['rank_weight_goal_weight']).toBe(0.15);
    expect(config['rank_weight_schedule_fit']).toBe(0.15);
    expect(config['rank_weight_readiness']).toBe(0.1);
    expect(config['progression_min_main_sessions']).toBe(3);
    expect(config['progression_min_days']).toBe(6);
    expect(config['progression_max_days']).toBe(10);
    expect(config['day_start_hour']).toBe(4);
    // Batch 2 settings
    expect(config['items_requiring_validation']).toEqual([
      'table',
      'door',
      'stairs',
      'chair',
      'loaded_backpack',
      'wall',
    ]);
    expect(config['min_hours_between_hard_same_pattern']).toBe(36);
    expect(config['weekly_sets_cap_per_muscle']).toBe(16);
    expect(config['session_hard_sets_cap']).toBe(24);
    expect(config['max_session_minutes']).toBe(60);
    expect(config['warmup_minutes']).toBe(6);
    expect(config['cooldown_minutes']).toBe(6);
    expect(config['default_work_seconds']).toBe(40);
    expect(config['rest_seconds_strength']).toBe(150);
    expect(config['rest_seconds_hypertrophy']).toBe(75);
    expect(config['rest_seconds_endurance']).toBe(40);
  });

  it('verifies that rank weights sum exactly to 1.0', () => {
    const config = getEffectiveConfig();
    const result = validateRankWeights(config);
    expect(result.valid).toBe(true);
  });

  it('rejects rank weights if they do not sum to 1.0', () => {
    const badConfig = {
      ...getEffectiveConfig(),
      rank_weight_readiness: 0.25, // causes sum to be 1.15
    };
    const result = validateRankWeights(badConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must sum to 1.0');
  });

  it('rejects a setting definition without a consumer', () => {
    const invalidSetting: SettingDefinition = {
      schema_version: 1,
      key: 'test_orphan_setting',
      type: 'number',
      default: 42,
      scope: 'user',
      consumer: '', // empty consumer
      version: '1.0.0',
    };

    expect(() => registerSettings([invalidSetting])).toThrow(
      /a setting without a consumer is rejected/i
    );
  });

  it('prevents user scope from modifying safety_locked values', () => {
    // min_main_session_minutes is safety_locked
    const userAttempt = validateSettingValue('min_main_session_minutes', 15, 'user');
    expect(userAttempt.valid).toBe(false);
    expect(userAttempt.error).toContain('safety_locked and cannot be changed by the user');

    // System/admin context is allowed if bounds match
    const systemAttempt = validateSettingValue('min_main_session_minutes', 45, 'safety_locked');
    expect(systemAttempt.valid).toBe(true);

    // getEffectiveConfig ignores user overrides on safety_locked settings
    const effective = getEffectiveConfig({ min_main_session_minutes: 15 });
    expect(effective['min_main_session_minutes']).toBe(30); // stays at default 30
  });

  it('enforces bounds (min, max)', () => {
    // execution_horizon_days bounds are 3-8
    const belowMin = validateSettingValue('execution_horizon_days', 2, 'user');
    expect(belowMin.valid).toBe(false);
    expect(belowMin.error).toContain('below minimum bound');

    const aboveMax = validateSettingValue('execution_horizon_days', 9, 'user');
    expect(aboveMax.valid).toBe(false);
    expect(aboveMax.error).toContain('exceeds maximum bound');

    const withinBounds = validateSettingValue('execution_horizon_days', 5, 'user');
    expect(withinBounds.valid).toBe(true);

    // Transition seconds bounds 10-30
    expect(validateSettingValue('transition_seconds', 9, 'user').valid).toBe(false);
    expect(validateSettingValue('transition_seconds', 31, 'user').valid).toBe(false);
    expect(validateSettingValue('transition_seconds', 20, 'user').valid).toBe(true);
  });

  it('applies valid user overrides to effective config', () => {
    const effective = getEffectiveConfig({
      execution_horizon_days: 6,
      transition_seconds: 25,
    });
    expect(effective['execution_horizon_days']).toBe(6);
    expect(effective['transition_seconds']).toBe(25);
    // Unaltered stays at default
    expect(effective['day_start_hour']).toBe(4);
  });

  describe('Typed accessors requireNumber and requireRange', () => {
    it('successfully extracts valid numbers and ranges', () => {
      const config = getEffectiveConfig();
      expect(requireNumber(config, 'execution_horizon_days')).toBe(7);
      expect(requireNumber(config, 'min_main_session_minutes')).toBe(30);

      const strengthWindow = requireRange(config, 'rep_window_strength');
      expect(strengthWindow.min).toBe(4);
      expect(strengthWindow.max).toBe(8);
      expect(strengthWindow.target).toBe(6);

      const items = requireArray(config, 'items_requiring_validation');
      expect(items).toContain('table');
    });

    it('throws if required key is missing', () => {
      const config = getEffectiveConfig();
      expect(() => requireNumber(config, 'non_existent_key')).toThrow(/Missing required configuration key/);
      expect(() => requireRange(config, 'non_existent_key')).toThrow(/Missing required configuration key/);
      expect(() => requireArray(config, 'non_existent_key')).toThrow(/Missing required configuration key/);
    });

    it('throws if key is not a valid number or range', () => {
      const badConfig = {
        string_val: 'not_a_number',
        bad_range: { min: 'four', max: 8 },
        nan_val: NaN,
        not_an_array: 42,
      };
      expect(() => requireNumber(badConfig, 'string_val')).toThrow(/must be a finite number/);
      expect(() => requireNumber(badConfig, 'nan_val')).toThrow(/must be a finite number/);
      expect(() => requireRange(badConfig, 'string_val')).toThrow(/must be an object with min and max/);
      expect(() => requireRange(badConfig, 'bad_range')).toThrow(/must be a finite number/);
      expect(() => requireArray(badConfig, 'not_an_array')).toThrow(/must be an array/);
    });
  });

  describe('Batch 4 Autonomy and Horizon settings', () => {
    it('seeds autonomy and horizon defaults correctly', () => {
      const config = getEffectiveConfig();
      expect(config['main_sessions_min']).toBe(3);
      expect(config['main_sessions_max']).toBe(5);
      expect(config['max_consecutive_main_days']).toBe(2);
      expect(config['autonomy_change_today']).toBe('ask');
      expect(config['autonomy_change_tomorrow']).toBe('ask');
      expect(config['autonomy_replan_future']).toBe('auto');
      expect(config['autonomy_due_progression']).toBe('notify');
      expect(config['autonomy_global_setting']).toBe('ask');
      expect(config['autonomy_rest_default']).toBe('ask');
      expect(config['autonomy_muscle_target']).toBe('ask');
      expect(config['ai_message_draft_max_length']).toBe(280);
    });

    it('seeds Phase 2A session runner settings correctly', () => {
      const config = getEffectiveConfig();
      expect(config['warmup_sets_default']).toBe(1);
      expect(config['cooldown_duration_minutes']).toBe(5);
      expect(config['rest_floor_seconds']).toBe(30);
      expect(config['rest_ceiling_seconds']).toBe(180);
      expect(config['target_rpe_default']).toBe(7.5);
      expect(config['rest_dynamic']).toBe(true);
    });

    it('validates requireBoolean helper', () => {
      const testConfig = { is_active: true, is_flag: false, not_bool: 'yes' };
      expect(requireBoolean(testConfig, 'is_active')).toBe(true);
      expect(requireBoolean(testConfig, 'is_flag')).toBe(false);
      expect(() => requireBoolean(testConfig, 'missing_key')).toThrow(/Missing required configuration key/);
      expect(() => requireBoolean(testConfig, 'not_bool')).toThrow(/must be a boolean/);
    });
  });
});
