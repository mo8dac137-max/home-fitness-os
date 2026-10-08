import { describe, it, expect } from 'vitest';
import {
  PACKAGE_NAME,
  UuidV7Schema,
  MovementPatternEnum,
  MuscleGroupEnum,
  EquipmentIdEnum,
  ExerciseTypeEnum,
  DayKindEnum,
  SessionKindEnum,
  ChangeCommandEnum,
  ValidationStatusEnum,
  AutonomyLevelEnum,
  FactSourceEnum,
  EquipmentRequirementSchema,
  EnvironmentItemStateSchema,
  SetPrescriptionSchema,
  PrescriptionSnapshotSchema,
  ExerciseSchema,
  PlanDaySchema,
  PlanSchema,
  ChangeRequestSchema,
  ChangeProposalSchema,
  KnowledgeFactSchema,
  InformationNeedSchema,
  DecisionRecordSchema,
  SettingDefinitionSchema,
  ALLOWED_AI_ACTIONS,
  FORBIDDEN_AI_ACTIONS,
  AiRequestSchema,
  AiResponseSchema,
} from '../index.js';

const VALID_UUID_V7 = '018f6c38-89c0-7b56-8a5b-9d48b1bfb91d';
const INVALID_UUID_V4 = '018f6c38-89c0-4b56-8a5b-9d48b1bfb91d'; // version 4, not 7

describe('@hfos/contracts', () => {
  it('exports correct PACKAGE_NAME', () => {
    expect(PACKAGE_NAME).toBe('@hfos/contracts');
  });

  describe('UUID v7 validator', () => {
    it('accepts a valid UUID v7', () => {
      expect(UuidV7Schema.parse(VALID_UUID_V7)).toBe(VALID_UUID_V7);
    });

    it('rejects a non-v7 UUID (v4) or invalid strings', () => {
      expect(() => UuidV7Schema.parse(INVALID_UUID_V4)).toThrow();
      expect(() => UuidV7Schema.parse('not-a-uuid')).toThrow();
    });
  });

  describe('Enums validate expected domain values', () => {
    it('validates MovementPatternEnum', () => {
      expect(MovementPatternEnum.parse('horizontal_push')).toBe('horizontal_push');
      expect(() => MovementPatternEnum.parse('unsupported_pattern')).toThrow();
    });

    it('validates MuscleGroupEnum', () => {
      expect(MuscleGroupEnum.parse('chest')).toBe('chest');
      expect(() => MuscleGroupEnum.parse('biceps_peak')).toThrow();
    });

    it('validates EquipmentIdEnum', () => {
      expect(EquipmentIdEnum.parse('bodyweight')).toBe('bodyweight');
      expect(EquipmentIdEnum.parse('table')).toBe('table');
      expect(() => EquipmentIdEnum.parse('laser_gun')).toThrow();
    });

    it('validates ExerciseTypeEnum', () => {
      expect(ExerciseTypeEnum.parse('compound')).toBe('compound');
      expect(() => ExerciseTypeEnum.parse('cardio_burst')).toThrow();
    });

    it('validates DayKindEnum & SessionKindEnum', () => {
      expect(DayKindEnum.parse('main')).toBe('main');
      expect(SessionKindEnum.parse('micro')).toBe('micro');
    });

    it('validates ChangeCommandEnum', () => {
      expect(ChangeCommandEnum.parse('make_harder')).toBe('make_harder');
      expect(ChangeCommandEnum.parse('shorten_session')).toBe('shorten_session');
    });

    it('validates ValidationStatusEnum and AutonomyLevelEnum', () => {
      expect(ValidationStatusEnum.parse('accepted_with_warning')).toBe('accepted_with_warning');
      expect(AutonomyLevelEnum.parse('notify')).toBe('notify');
    });

    it('validates FactSourceEnum', () => {
      expect(FactSourceEnum.parse('inferred')).toBe('inferred');
    });
  });

  describe('Schemas round-trip and validation', () => {
    it('validates EquipmentRequirementSchema round-trip and requires schema_version', () => {
      const fixture = {
        schema_version: 1,
        all: ['bodyweight'] as const,
        any: ['dumbbells', 'bands'] as const,
      };
      const parsed = EquipmentRequirementSchema.parse(fixture);
      expect(parsed).toEqual(fixture);

      // Fails without schema_version
      const { schema_version: _, ...withoutVersion } = fixture;
      expect(() => EquipmentRequirementSchema.parse(withoutVersion)).toThrow();
    });

    it('validates EnvironmentItemStateSchema round-trip and requires schema_version', () => {
      const fixture = {
        schema_version: 1,
        item_id: 'table' as const,
        status: 'validated' as const,
        validated_at: '2026-10-06T12:00:00Z',
        updated_at: '2026-10-06T12:00:00Z',
        notes: 'Validated sturdy dining table',
      };
      const parsed = EnvironmentItemStateSchema.parse(fixture);
      expect(parsed).toEqual(fixture);

      const { schema_version: _, ...withoutVersion } = fixture;
      expect(() => EnvironmentItemStateSchema.parse(withoutVersion)).toThrow();
    });

    it('validates SetPrescriptionSchema round-trip and requires schema_version', () => {
      const fixture = {
        schema_version: 1,
        set_number: 1,
        target_reps: 10,
        target_rpe: 8,
        rest_seconds: 90,
      };
      const parsed = SetPrescriptionSchema.parse(fixture);
      expect(parsed).toEqual(fixture);

      const { schema_version: _, ...withoutVersion } = fixture;
      expect(() => SetPrescriptionSchema.parse(withoutVersion)).toThrow();
    });

    it('validates PrescriptionSnapshotSchema round-trip and requires schema_version', () => {
      const fixture = {
        schema_version: 1,
        id: VALID_UUID_V7,
        exercises: [
          {
            exercise_id: 'pushup-standard',
            sets: [
              {
                schema_version: 1,
                set_number: 1,
                target_reps: 12,
                rest_seconds: 60,
              },
            ],
          },
        ],
        rules: ['rest_dynamic'],
        engine_version: '0.1.0',
        config_version: '1.0.0',
        created_at: '2026-10-06T12:00:00Z',
      };
      const parsed = PrescriptionSnapshotSchema.parse(fixture);
      expect(parsed.id).toBe(VALID_UUID_V7);

      const { schema_version: _, ...withoutVersion } = fixture;
      expect(() => PrescriptionSnapshotSchema.parse(withoutVersion)).toThrow();
    });

    it('validates ExerciseSchema round-trip and requires schema_version', () => {
      const fixture = {
        schema_version: 1,
        id: 'pushup_standard',
        name: 'Standard Push-up',
        pattern: 'horizontal_push' as const,
        primary_muscles: ['chest'] as const,
        secondary_muscles: ['arms', 'shoulders'] as const,
        unilateral: false,
        coverage_weight: 1,
        level: 3,
        equipment_requirement: {
          schema_version: 1,
          all: ['bodyweight'] as const,
        },
        progression_links: {
          progression_id: 'diamond_pushup',
          regression_id: 'incline_pushup',
        },
        safety_flags: [],
        type: 'compound' as const,
        asset_status: 'ready' as const,
      };
      const parsed = ExerciseSchema.parse(fixture);
      expect(parsed.id).toBe('pushup_standard');

      const { schema_version: _, ...withoutVersion } = fixture;
      expect(() => ExerciseSchema.parse(withoutVersion)).toThrow();
    });

    it('validates PlanDay and PlanSchema round-trip and requires schema_version', () => {
      const dayFixture = {
        schema_version: 1,
        day_index: 0,
        kind: 'main' as const,
        status: 'locked' as const,
      };
      expect(PlanDaySchema.parse(dayFixture).status).toBe('locked');

      const makePlanFixture = (horizon: number) => ({
        schema_version: 1,
        id: VALID_UUID_V7,
        created_at: '2026-10-06T12:00:00Z',
        horizon_days: horizon,
        current_unit: 'A' as const,
        days: Array.from({ length: horizon }, (_, i) => ({
          schema_version: 1,
          day_index: i,
          kind: i === 0 || i === 2 || i === 4 ? ('main' as const) : ('rest' as const),
          status: i === 0 ? ('locked' as const) : i === 1 ? ('protected' as const) : ('adaptive' as const),
        })),
      });

      // Valid horizons: 3, 7, 8
      expect(PlanSchema.parse(makePlanFixture(3)).days).toHaveLength(3);
      expect(PlanSchema.parse(makePlanFixture(7)).days).toHaveLength(7);
      expect(PlanSchema.parse(makePlanFixture(8)).days).toHaveLength(8);

      // Mismatch: days.length != horizon_days
      const mismatchedPlan = {
        ...makePlanFixture(7),
        horizon_days: 7,
        days: makePlanFixture(3).days, // only 3 days instead of 7
      };
      expect(() => PlanSchema.parse(mismatchedPlan)).toThrow(/must equal horizon_days/i);

      // Out of bounds horizon
      const invalidHorizon = {
        ...makePlanFixture(2),
        horizon_days: 2,
      };
      expect(() => PlanSchema.parse(invalidHorizon)).toThrow();

      const planFixture = makePlanFixture(7);
      const { schema_version: _, ...withoutVersion } = planFixture;
      expect(() => PlanSchema.parse(withoutVersion)).toThrow();
    });

    it('validates ChangeRequestSchema and ChangeProposalSchema and requires schema_version', () => {
      const reqFixture = {
        schema_version: 1,
        id: VALID_UUID_V7,
        source: 'manual' as const,
        command: 'make_harder' as const,
        target_exercise_id: 'pushup_standard',
        created_at: '2026-10-06T12:00:00Z',
      };
      expect(ChangeRequestSchema.parse(reqFixture).command).toBe('make_harder');
      const { schema_version: _r, ...reqNoVer } = reqFixture;
      expect(() => ChangeRequestSchema.parse(reqNoVer)).toThrow();

      const propFixture = {
        schema_version: 1,
        id: VALID_UUID_V7,
        request_id: VALID_UUID_V7,
        diff: {
          summary: 'Increased reps from 10 to 12',
          changes: ['pushup_standard target_reps: 10 -> 12'],
        },
        decision_class: 'exercise_progression',
        autonomy_level: 'ask' as const,
        status: 'pending' as const,
        validation_status: 'accepted' as const,
        warnings: [],
        created_at: '2026-10-06T12:00:00Z',
      };
      expect(ChangeProposalSchema.parse(propFixture).status).toBe('pending');
      const { schema_version: _p, ...propNoVer } = propFixture;
      expect(() => ChangeProposalSchema.parse(propNoVer)).toThrow();
    });

    it('validates KnowledgeFact and InformationNeed and requires schema_version', () => {
      const factFixture = {
        schema_version: 1,
        id: VALID_UUID_V7,
        key: 'equipment.pull_up_bar.available',
        source: 'declared' as const,
        confidence: 1.0,
        value: true,
        updated_at: '2026-10-06T12:00:00Z',
      };
      expect(KnowledgeFactSchema.parse(factFixture).confidence).toBe(1.0);
      const { schema_version: _f, ...factNoVer } = factFixture;
      expect(() => KnowledgeFactSchema.parse(factNoVer)).toThrow();

      const needFixture = {
        schema_version: 1,
        id: VALID_UUID_V7,
        reason: 'Select progression variant',
        consumer: 'engine.planner',
        priority: 'high' as const,
        question_key: 'equipment.pull_up_bar.sturdiness',
        created_at: '2026-10-06T12:00:00Z',
      };
      expect(InformationNeedSchema.parse(needFixture).priority).toBe('high');
      const { schema_version: _n, ...needNoVer } = needFixture;
      expect(() => InformationNeedSchema.parse(needNoVer)).toThrow();
    });

    it('validates DecisionRecord and SettingDefinition and requires schema_version', () => {
      const decFixture = {
        schema_version: 1,
        id: VALID_UUID_V7,
        decision_class: 'unit_selection',
        candidates: ['Unit A', 'Unit B'],
        term_values: { priority_need: 0.8, stimulus_gap: 0.6 },
        filters: ['equipment_available', 'fatigue_threshold'],
        selection: 'Unit A',
        created_at: '2026-10-06T12:00:00Z',
      };
      expect(DecisionRecordSchema.parse(decFixture).selection).toBe('Unit A');
      const { schema_version: _d, ...decNoVer } = decFixture;
      expect(() => DecisionRecordSchema.parse(decNoVer)).toThrow();

      const setFixture = {
        schema_version: 1,
        key: 'execution_horizon_days',
        type: 'number' as const,
        default: 7,
        bounds: { min: 3, max: 8 },
        scope: 'user' as const,
        consumer: 'planner',
        version: '1.0.0',
      };
      expect(SettingDefinitionSchema.parse(setFixture).key).toBe('execution_horizon_days');
      const { schema_version: _s, ...setNoVer } = setFixture;
      expect(() => SettingDefinitionSchema.parse(setNoVer)).toThrow();
    });

    it('validates AiRequest, AiResponse, and action sets (M0-14)', () => {
      expect(ALLOWED_AI_ACTIONS).toContain('rank');
      expect(FORBIDDEN_AI_ACTIONS).toContain('create_exercise');
      expect(FORBIDDEN_AI_ACTIONS).toContain('write_data');

      const req = {
        task: 'rank' as const,
        candidates: [{ id: 'cand_1', short_label: 'Candidate 1' }],
        context_summary: { readiness: 0.8 },
      };
      const parsedReq = AiRequestSchema.parse(req);
      expect(parsedReq.task).toBe('rank');

      const res = {
        selected_candidate_id: 'cand_1',
        ranking_ids: ['cand_1'],
        rationale_codes: ['stimulus_need' as const],
        message_draft: 'Looks good.',
      };
      const parsedRes = AiResponseSchema.parse(res);
      expect(parsedRes.selected_candidate_id).toBe('cand_1');
    });
  });
});
