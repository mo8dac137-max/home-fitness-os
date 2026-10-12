import { z } from 'zod';

export const PACKAGE_NAME = '@hfos/contracts';

// ==========================================
// UUID v7 Format Validator
// ==========================================
export const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const UuidV7Schema = z
  .string()
  .regex(UUID_V7_REGEX, 'Value must be a valid UUID v7 format');

export type UuidV7 = z.infer<typeof UuidV7Schema>;

// Helper to validate or check
export function isValidUuidV7(id: string): boolean {
  return UUID_V7_REGEX.test(id);
}

// ==========================================
// Enums
// ==========================================
export const MovementPatternEnum = z.enum([
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'core',
  'mobility',
  'conditioning',
]);
export type MovementPattern = z.infer<typeof MovementPatternEnum>;

export const MuscleGroupEnum = z.enum([
  'shoulders',
  'back',
  'chest',
  'arms',
  'abs',
  'hip_mobility',
  'legs',
]);
export type MuscleGroup = z.infer<typeof MuscleGroupEnum>;

export const EquipmentIdEnum = z.enum([
  'bodyweight',
  'floor',
  'wall',
  'chair',
  'loaded_backpack',
  'towel',
  'table',
  'stairs',
  'door',
  'dumbbells',
  'resistance_band',
  'pull_up_bar',
  'bands',
  'dip_bars',
  'bench',
  'parallettes',
]);
export type EquipmentId = z.infer<typeof EquipmentIdEnum>;

export const ExerciseTypeEnum = z.enum([
  'compound',
  'accessory',
  'mobility',
  'conditioning',
]);
export type ExerciseType = z.infer<typeof ExerciseTypeEnum>;

export const DayKindEnum = z.enum([
  'main',
  'micro',
  'flex',
  'active_recovery',
  'rest',
]);
export type DayKind = z.infer<typeof DayKindEnum>;

export const SessionKindEnum = z.enum([
  'main',
  'micro',
  'flex',
  'active_recovery',
]);
export type SessionKind = z.infer<typeof SessionKindEnum>;

export const ChangeCommandEnum = z.enum([
  'make_harder',
  'make_easier',
  'replace_exercise',
  'increase_muscle_focus',
  'shorten_session',
]);
export type ChangeCommand = z.infer<typeof ChangeCommandEnum>;

export const ValidationStatusEnum = z.enum([
  'accepted',
  'accepted_with_warning',
  'rejected',
]);
export type ValidationStatus = z.infer<typeof ValidationStatusEnum>;

export const AutonomyLevelEnum = z.enum([
  'ask',
  'notify',
  'auto',
]);
export type AutonomyLevel = z.infer<typeof AutonomyLevelEnum>;

export const FactSourceEnum = z.enum([
  'declared',
  'measured',
  'inferred',
]);
export type FactSource = z.infer<typeof FactSourceEnum>;

// ==========================================
// Schemas
// ==========================================

// Equipment Requirement (all/any expression)
export const EquipmentRequirementSchema = z.object({
  schema_version: z.number().int().positive(),
  all: z.array(EquipmentIdEnum).optional(),
  any: z.array(EquipmentIdEnum).optional(),
  none: z.array(EquipmentIdEnum).optional(),
});
export type EquipmentRequirement = z.infer<typeof EquipmentRequirementSchema>;

// Environment Item State
export const EnvironmentItemStateSchema = z.object({
  schema_version: z.number().int().positive(),
  item_id: EquipmentIdEnum,
  status: z.enum(['unknown', 'declared', 'validated', 'retired']),
  validated_at: z.string().datetime({ offset: true }).nullable().optional(),
  updated_at: z.string().datetime({ offset: true }),
  notes: z.string().optional(),
});
export type EnvironmentItemState = z.infer<typeof EnvironmentItemStateSchema>;

// Set Prescription
export const SetPrescriptionSchema = z.object({
  schema_version: z.number().int().positive(),
  set_number: z.number().int().positive(),
  target_reps: z.number().int().positive().optional(),
  min_reps: z.number().int().positive().optional(),
  max_reps: z.number().int().positive().optional(),
  target_rpe: z.number().min(1).max(10).optional(),
  rest_seconds: z.number().int().nonnegative(),
  load_kg: z.number().nonnegative().optional(),
  tempo: z.string().optional(),
  is_warmup: z.boolean().optional(),
});
export type SetPrescription = z.infer<typeof SetPrescriptionSchema>;

// Prescription Exercise Item
export const PrescriptionExerciseItemSchema = z.object({
  exercise_id: z.string().min(1),
  sets: z.array(SetPrescriptionSchema).min(1),
  rest_seconds: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});
export type PrescriptionExerciseItem = z.infer<typeof PrescriptionExerciseItemSchema>;

// Prescription Snapshot
export const PrescriptionSnapshotSchema = z.object({
  schema_version: z.number().int().positive(),
  id: UuidV7Schema,
  session_id: UuidV7Schema.optional(),
  exercises: z.array(PrescriptionExerciseItemSchema),
  rules: z.array(z.string()).default([]),
  engine_version: z.string().min(1),
  config_version: z.string().min(1),
  created_at: z.string().datetime({ offset: true }),
});
export type PrescriptionSnapshot = z.infer<typeof PrescriptionSnapshotSchema>;

// Exercise
export const ExerciseSchema = z.object({
  schema_version: z.number().int().positive(),
  id: z.string().min(1),
  name: z.string().min(1),
  pattern: MovementPatternEnum,
  primary_muscles: z.array(MuscleGroupEnum).min(1),
  secondary_muscles: z.array(MuscleGroupEnum).default([]),
  unilateral: z.boolean().default(false),
  coverage_weight: z.number().min(0).max(1).default(1),
  level: z.number().int().min(1).max(10),
  equipment_requirement: EquipmentRequirementSchema,
  progression_links: z.object({
    progression_id: z.string().nullable().optional(),
    regression_id: z.string().nullable().optional(),
  }),
  safety_flags: z.array(z.string()),
  type: ExerciseTypeEnum,
  asset_status: z.enum(['placeholder', 'ready', 'missing']),
  description: z.string().optional(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

// Decision Record
export const DecisionRecordSchema = z.object({
  schema_version: z.number().int().positive(),
  id: UuidV7Schema,
  decision_class: z.string().min(1),
  candidates: z.array(z.unknown()),
  term_values: z.record(z.string(), z.number()),
  filters: z.array(z.string()),
  selection: z.unknown(),
  created_at: z.string().datetime({ offset: true }),
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

// Day Reason Code
export const DayReasonCodeEnum = z.enum([
  'scheduled_main',
  'no_window',
  'window_too_short',
  'quota_reached',
  'consecutive_cap',
  'recovery_spacing',
  'micro_window',
  'active_recovery_cap',
]);
export type DayReasonCode = z.infer<typeof DayReasonCodeEnum>;

// Plan Revision Reason
export const PlanRevisionReasonEnum = z.enum([
  'schedule',
  'readiness',
  'prior_session',
  'threshold',
]);
export type PlanRevisionReason = z.infer<typeof PlanRevisionReasonEnum>;

// Plan Day
export const PlanDaySchema = z.object({
  schema_version: z.number().int().positive(),
  day_index: z.number().int().min(0).max(7),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  kind: DayKindEnum,
  session_snapshot: PrescriptionSnapshotSchema.nullable().optional(),
  status: z.enum(['locked', 'protected', 'adaptive']),
  notes: z.string().optional(),
  unit: z.enum(['A', 'B', 'C', 'D']).optional(),
  estimated_minutes: z.number().nonnegative().optional(),
  reason_code: DayReasonCodeEnum.optional(),
  decision: DecisionRecordSchema.optional(),
  revision_reason: PlanRevisionReasonEnum.optional(),
});
export type PlanDay = z.infer<typeof PlanDaySchema>;

// Plan
export const PlanSchema = z
  .object({
    schema_version: z.number().int().positive(),
    id: UuidV7Schema,
    created_at: z.string().datetime({ offset: true }),
    days: z.array(PlanDaySchema),
    horizon_days: z.number().int().min(3).max(8).default(7),
    current_unit: z.enum(['A', 'B', 'C', 'D']).optional(),
    inputs_defaulted: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.days.length !== data.horizon_days) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Plan.days length (${data.days.length}) must equal horizon_days (${data.horizon_days})`,
        path: ['days'],
      });
    }
  });
export type Plan = z.infer<typeof PlanSchema>;

// Change Request
export const ChangeRequestSchema = z.object({
  schema_version: z.number().int().positive(),
  id: UuidV7Schema,
  source: z.enum(['manual', 'quick', 'ai']),
  command: ChangeCommandEnum,
  target_day_index: z.number().int().min(0).max(7).optional(),
  target_exercise_id: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string().datetime({ offset: true }),
});
export type ChangeRequest = z.infer<typeof ChangeRequestSchema>;

// Change Proposal
export const ChangeProposalSchema = z.object({
  schema_version: z.number().int().positive(),
  id: UuidV7Schema,
  request_id: UuidV7Schema,
  diff: z.object({
    summary: z.string(),
    changes: z.array(z.string()),
    before: z.unknown().optional(),
    after: z.unknown().optional(),
  }),
  decision_class: z.string().min(1),
  autonomy_level: AutonomyLevelEnum,
  status: z.enum(['pending', 'approved', 'rejected', 'auto_applied']),
  validation_status: ValidationStatusEnum,
  nearest_valid_alternative: z.unknown().optional(),
  warnings: z.array(z.string()).default([]),
  created_at: z.string().datetime({ offset: true }),
});
export type ChangeProposal = z.infer<typeof ChangeProposalSchema>;

// Knowledge Fact
export const KnowledgeFactSchema = z.object({
  schema_version: z.number().int().positive(),
  id: UuidV7Schema,
  key: z.string().min(1),
  source: FactSourceEnum,
  confidence: z.number().min(0).max(1),
  value: z.unknown(),
  updated_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});
export type KnowledgeFact = z.infer<typeof KnowledgeFactSchema>;

// Information Need
export const InformationNeedSchema = z.object({
  schema_version: z.number().int().positive(),
  id: UuidV7Schema,
  reason: z.string().min(1),
  consumer: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  question_key: z.string().min(1),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  created_at: z.string().datetime({ offset: true }),
});
export type InformationNeed = z.infer<typeof InformationNeedSchema>;

// Setting Definition
export const SettingDefinitionSchema = z.object({
  schema_version: z.number().int().positive(),
  key: z.string().min(1),
  type: z.enum(['number', 'boolean', 'string', 'array', 'object']),
  default: z.unknown(),
  bounds: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      allowed: z.array(z.unknown()).optional(),
    })
    .optional(),
  scope: z.enum(['user', 'safety_locked']),
  consumer: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
});
export type SettingDefinition = z.infer<typeof SettingDefinitionSchema>;

// ==========================================
// M0-14 AI Contract Schemas
// ==========================================

export const ALLOWED_AI_ACTIONS = [
  'rank',
  'explain',
  'phrase_question',
  'parse_note',
] as const;

export const FORBIDDEN_AI_ACTIONS = [
  'create_exercise',
  'modify_exercise',
  'change_loads',
  'change_rules',
  'write_data',
  'medical_advice',
] as const;

export const AiTaskEnum = z.enum([
  'rank',
  'explain',
  'phrase_question',
  'parse_note',
]);
export type AiTask = z.infer<typeof AiTaskEnum>;

export const AiCandidateItemSchema = z.object({
  id: z.string().min(1),
  short_label: z.string().min(1),
});
export type AiCandidateItem = z.infer<typeof AiCandidateItemSchema>;

export const AiRationaleCodeEnum = z.enum([
  'stimulus_need',
  'fatigue_management',
  'schedule_fit',
  'progression_step',
  'exercise_variety',
  'user_goal',
]);
export type AiRationaleCode = z.infer<typeof AiRationaleCodeEnum>;

export const AiRequestSchema = z.object({
  task: AiTaskEnum,
  candidates: z.array(AiCandidateItemSchema),
  context_summary: z.record(z.string(), z.unknown()),
});
export type AiRequest = z.infer<typeof AiRequestSchema>;

export const AiResponseSchema = z.object({
  selected_candidate_id: z.string().optional(),
  ranking_ids: z.array(z.string()).default([]),
  rationale_codes: z.array(AiRationaleCodeEnum).default([]),
  message_draft: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type AiResponse = z.infer<typeof AiResponseSchema>;

