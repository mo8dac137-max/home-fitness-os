import type { Exercise, MovementPattern } from '@hfos/contracts';
import { MovementPatternEnum, EquipmentIdEnum } from '@hfos/contracts';

export const PACKAGE_NAME = '@hfos/library';

export const LIBRARY_LIMITATIONS: Partial<Record<MovementPattern, string>> = {
  vertical_pull: 'no equipment-free vertical pull available',
};

// PROVISIONAL: superseded by M0-05/M0-10/M0-13
export const INITIAL_EXERCISE_LIBRARY: Exercise[] = [
  // ==========================================
  // Horizontal Push (9)
  // ==========================================
  {
    schema_version: 1,
    id: 'wall_pushup',
    name: 'Wall Push-up',
    pattern: 'horizontal_push',
    primary_muscles: ['chest', 'shoulders'],
    secondary_muscles: ['arms'],
    unilateral: false,
    coverage_weight: 1,
    level: 1,
    equipment_requirement: { schema_version: 1, all: ['wall'] },
    progression_links: { progression_id: 'incline_pushup', regression_id: null },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Standing push-up against a wall.',
  },
  {
    schema_version: 1,
    id: 'incline_pushup',
    name: 'Incline Push-up',
    pattern: 'horizontal_push',
    primary_muscles: ['chest'],
    secondary_muscles: ['shoulders', 'arms'],
    unilateral: false,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, any: ['chair', 'table'] },
    progression_links: { progression_id: 'pushup_standard', regression_id: 'wall_pushup' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Push-up with hands elevated on chair or table.',
  },
  {
    schema_version: 1,
    id: 'pushup_standard',
    name: 'Standard Push-up',
    pattern: 'horizontal_push',
    primary_muscles: ['chest'],
    secondary_muscles: ['shoulders', 'arms'],
    unilateral: false,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'tempo_pushup', regression_id: 'incline_pushup' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Classic floor bodyweight push-up.',
  },
  {
    schema_version: 1,
    id: 'tempo_pushup',
    name: 'Tempo Push-up',
    pattern: 'horizontal_push',
    primary_muscles: ['chest'],
    secondary_muscles: ['shoulders', 'arms'],
    unilateral: false,
    coverage_weight: 1,
    level: 4,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'feet_elevated_pushup', regression_id: 'pushup_standard' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Push-up with 3s eccentric and 1s pause.',
  },
  {
    schema_version: 1,
    id: 'feet_elevated_pushup',
    name: 'Feet-Elevated Push-up',
    pattern: 'horizontal_push',
    primary_muscles: ['chest', 'shoulders'],
    secondary_muscles: ['arms'],
    unilateral: false,
    coverage_weight: 1,
    level: 5,
    equipment_requirement: { schema_version: 1, any: ['chair', 'stairs'] },
    progression_links: { progression_id: 'archer_pushup', regression_id: 'tempo_pushup' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Decline push-up with feet elevated on chair or stairs.',
  },
  {
    schema_version: 1,
    id: 'diamond_pushup',
    name: 'Diamond Push-up',
    pattern: 'horizontal_push',
    primary_muscles: ['arms'],
    secondary_muscles: ['chest', 'shoulders'],
    unilateral: false,
    coverage_weight: 1,
    level: 5,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'archer_pushup', regression_id: 'tempo_pushup' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Close-grip push-up emphasizing triceps.',
  },
  {
    schema_version: 1,
    id: 'archer_pushup',
    name: 'Archer Push-up',
    pattern: 'horizontal_push',
    primary_muscles: ['chest'],
    secondary_muscles: ['arms', 'shoulders'],
    unilateral: true,
    coverage_weight: 1,
    level: 6,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'pseudo_planche_pushup', regression_id: 'feet_elevated_pushup' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Asymmetric push-up shifting weight to one arm.',
  },
  {
    schema_version: 1,
    id: 'pseudo_planche_pushup',
    name: 'Pseudo Planche Push-up',
    pattern: 'horizontal_push',
    primary_muscles: ['shoulders', 'chest'],
    secondary_muscles: ['arms', 'abs'],
    unilateral: false,
    coverage_weight: 1,
    level: 7,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: 'archer_pushup' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Hands placed near hips with significant forward lean.',
  },
  {
    schema_version: 1,
    id: 'backpack_pushup',
    name: 'Backpack Push-up',
    pattern: 'horizontal_push',
    primary_muscles: ['chest'],
    secondary_muscles: ['arms', 'shoulders'],
    unilateral: false,
    coverage_weight: 1,
    level: 6,
    equipment_requirement: { schema_version: 1, all: ['loaded_backpack', 'floor'] },
    progression_links: { progression_id: 'pseudo_planche_pushup', regression_id: 'feet_elevated_pushup' },
    safety_flags: ['requires_validated_load'],
    type: 'compound',
    asset_status: 'ready',
    description: 'Floor push-up with loaded backpack for added external resistance.',
  },

  // ==========================================
  // Vertical Push (3)
  // ==========================================
  {
    schema_version: 1,
    id: 'pike_pushup',
    name: 'Pike Push-up',
    pattern: 'vertical_push',
    primary_muscles: ['shoulders'],
    secondary_muscles: ['arms'],
    unilateral: false,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'feet_elevated_pike_pushup', regression_id: null },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Pike stance push-up targeting vertical shoulder pressing.',
  },
  {
    schema_version: 1,
    id: 'feet_elevated_pike_pushup',
    name: 'Feet-Elevated Pike Push-up',
    pattern: 'vertical_push',
    primary_muscles: ['shoulders'],
    secondary_muscles: ['arms'],
    unilateral: false,
    coverage_weight: 1,
    level: 4,
    equipment_requirement: { schema_version: 1, any: ['chair', 'stairs'] },
    progression_links: { progression_id: 'wall_handstand_hold', regression_id: 'pike_pushup' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Pike push-up with feet elevated on chair or stairs.',
  },
  {
    schema_version: 1,
    id: 'wall_handstand_hold',
    name: 'Wall Handstand Hold',
    pattern: 'vertical_push',
    primary_muscles: ['shoulders'],
    secondary_muscles: ['arms', 'abs'],
    unilateral: false,
    coverage_weight: 1,
    level: 5,
    equipment_requirement: { schema_version: 1, all: ['wall'] },
    progression_links: { progression_id: null, regression_id: 'feet_elevated_pike_pushup' },
    safety_flags: ['fall_risk', 'requires_validated_wall'],
    type: 'compound',
    asset_status: 'ready',
    description: 'Chest-to-wall handstand isometric hold.',
  },

  // ==========================================
  // Horizontal Pull (4)
  // ==========================================
  {
    schema_version: 1,
    id: 'prone_ytw',
    name: 'Prone Y-T-W',
    pattern: 'horizontal_pull',
    primary_muscles: ['back'],
    secondary_muscles: ['shoulders'],
    unilateral: false,
    coverage_weight: 1,
    level: 1,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'backpack_row_bilateral', regression_id: null },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Lying prone arm raises for scapular retractors and rear delts.',
  },
  {
    schema_version: 1,
    id: 'backpack_row_bilateral',
    name: 'Bilateral Backpack Row',
    pattern: 'horizontal_pull',
    primary_muscles: ['back'],
    secondary_muscles: ['arms'],
    unilateral: false,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['loaded_backpack'] },
    progression_links: { progression_id: 'backpack_row_single_arm', regression_id: 'prone_ytw' },
    safety_flags: ['requires_validated_load'],
    type: 'compound',
    asset_status: 'ready',
    description: 'Bent-over bilateral row using a loaded backpack.',
  },
  {
    schema_version: 1,
    id: 'backpack_row_single_arm',
    name: 'Single-Arm Backpack Row',
    pattern: 'horizontal_pull',
    primary_muscles: ['back'],
    secondary_muscles: ['arms'],
    unilateral: true,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['loaded_backpack', 'chair'] },
    progression_links: { progression_id: null, regression_id: 'backpack_row_bilateral' },
    safety_flags: ['requires_validated_load'],
    type: 'compound',
    asset_status: 'ready',
    description: 'Single-arm row supported on a sturdy chair.',
  },
  {
    schema_version: 1,
    id: 'inverted_table_row',
    name: 'Inverted Table Row',
    pattern: 'horizontal_pull',
    primary_muscles: ['back'],
    secondary_muscles: ['arms'],
    unilateral: false,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['table'] },
    progression_links: { progression_id: null, regression_id: 'backpack_row_bilateral' },
    safety_flags: ['requires_validated_table'],
    type: 'compound',
    asset_status: 'ready',
    description: 'Bodyweight horizontal row underneath a sturdy table.',
  },

  // ==========================================
  // Vertical Pull (1) - Coverage weight 0
  // ==========================================
  {
    schema_version: 1,
    id: 'backpack_pullover_lying',
    name: 'Lying Backpack Pullover',
    pattern: 'vertical_pull',
    primary_muscles: ['back'],
    secondary_muscles: ['arms', 'chest'],
    unilateral: false,
    coverage_weight: 0,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['loaded_backpack'] },
    progression_links: { progression_id: null, regression_id: null },
    safety_flags: ['requires_validated_load'],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Floor pullover simulating lat stretch without vertical hanging.',
  },

  // ==========================================
  // Squat (9)
  // ==========================================
  {
    schema_version: 1,
    id: 'wall_sit',
    name: 'Wall Sit',
    pattern: 'squat',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['wall'] },
    progression_links: { progression_id: 'tempo_squat', regression_id: null },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Isometric quad hold against a wall.',
  },
  {
    schema_version: 1,
    id: 'bodyweight_squat',
    name: 'Bodyweight Squat',
    pattern: 'squat',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'tempo_squat', regression_id: null },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Bilateral full range of motion squat.',
  },
  {
    schema_version: 1,
    id: 'tempo_squat',
    name: 'Tempo Squat',
    pattern: 'squat',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'bulgarian_split_squat', regression_id: 'bodyweight_squat' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Squat with controlled 3-second descent.',
  },
  {
    schema_version: 1,
    id: 'pause_squat',
    name: 'Pause Squat',
    pattern: 'squat',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'bulgarian_split_squat', regression_id: 'bodyweight_squat' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Squat with 2-second hold in bottom hole.',
  },
  {
    schema_version: 1,
    id: 'split_squat',
    name: 'Split Squat',
    pattern: 'squat',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: true,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'bulgarian_split_squat', regression_id: 'bodyweight_squat' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Static lunge stance unilateral squat.',
  },
  {
    schema_version: 1,
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat',
    pattern: 'squat',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: true,
    coverage_weight: 1,
    level: 4,
    equipment_requirement: { schema_version: 1, all: ['chair'] },
    progression_links: { progression_id: 'backpack_bulgarian_split_squat', regression_id: 'split_squat' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Rear foot elevated split squat on chair.',
  },
  {
    schema_version: 1,
    id: 'backpack_bulgarian_split_squat',
    name: 'Backpack Bulgarian Split Squat',
    pattern: 'squat',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: true,
    coverage_weight: 1,
    level: 5,
    equipment_requirement: { schema_version: 1, all: ['loaded_backpack', 'chair'] },
    progression_links: { progression_id: 'pistol_to_chair', regression_id: 'bulgarian_split_squat' },
    safety_flags: ['requires_validated_load'],
    type: 'compound',
    asset_status: 'ready',
    description: 'Loaded rear-foot elevated split squat.',
  },
  {
    schema_version: 1,
    id: 'shrimp_squat_assisted',
    name: 'Assisted Shrimp Squat',
    pattern: 'squat',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: true,
    coverage_weight: 1,
    level: 5,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'pistol_to_chair', regression_id: 'bulgarian_split_squat' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Single-leg squat holding back foot with light fingertip assist.',
  },
  {
    schema_version: 1,
    id: 'pistol_to_chair',
    name: 'Pistol Squat to Chair',
    pattern: 'squat',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: true,
    coverage_weight: 1,
    level: 6,
    equipment_requirement: { schema_version: 1, all: ['chair'] },
    progression_links: { progression_id: null, regression_id: 'shrimp_squat_assisted' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Single-leg squat box tap on chair.',
  },

  // ==========================================
  // Hinge (5)
  // ==========================================
  {
    schema_version: 1,
    id: 'glute_bridge',
    name: 'Glute Bridge',
    pattern: 'hinge',
    primary_muscles: ['legs'],
    secondary_muscles: ['abs'],
    unilateral: false,
    coverage_weight: 1,
    level: 1,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'single_leg_glute_bridge', regression_id: null },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Bilateral glute bridge on floor.',
  },
  {
    schema_version: 1,
    id: 'single_leg_glute_bridge',
    name: 'Single-Leg Glute Bridge',
    pattern: 'hinge',
    primary_muscles: ['legs'],
    secondary_muscles: ['abs'],
    unilateral: true,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'hip_thrust_chair', regression_id: 'glute_bridge' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Unilateral floor glute bridge.',
  },
  {
    schema_version: 1,
    id: 'hip_thrust_chair',
    name: 'Hip Thrust on Chair',
    pattern: 'hinge',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['chair'] },
    progression_links: { progression_id: null, regression_id: 'single_leg_glute_bridge' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Shoulders elevated on chair for full hip extension.',
  },
  {
    schema_version: 1,
    id: 'single_leg_rdl',
    name: 'Single-Leg RDL',
    pattern: 'hinge',
    primary_muscles: ['legs'],
    secondary_muscles: ['abs'],
    unilateral: true,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: 'single_leg_glute_bridge' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Bodyweight Romanian deadlift balancing on one leg.',
  },
  {
    schema_version: 1,
    id: 'towel_slider_curl',
    name: 'Towel Hamstring Slider Curl',
    pattern: 'hinge',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['towel'] },
    progression_links: { progression_id: null, regression_id: 'glute_bridge' },
    safety_flags: ['needs_smooth_floor'],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Lying hamstring curl using towel sliding across smooth floor.',
  },

  // ==========================================
  // Lunge (3)
  // ==========================================
  {
    schema_version: 1,
    id: 'step_up_chair',
    name: 'Chair Step-up',
    pattern: 'lunge',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: true,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['chair'] },
    progression_links: { progression_id: 'cossack_squat', regression_id: null },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Step-up on stable chair.',
  },
  {
    schema_version: 1,
    id: 'reverse_lunge',
    name: 'Reverse Lunge',
    pattern: 'lunge',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: true,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'cossack_squat', regression_id: null },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Stepping back into unilateral lunge.',
  },
  {
    schema_version: 1,
    id: 'cossack_squat',
    name: 'Cossack Squat',
    pattern: 'lunge',
    primary_muscles: ['legs', 'hip_mobility'],
    secondary_muscles: [],
    unilateral: true,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: 'reverse_lunge' },
    safety_flags: [],
    type: 'compound',
    asset_status: 'ready',
    description: 'Lateral lunge testing deep hip mobility and strength.',
  },

  // ==========================================
  // Core (9)
  // ==========================================
  {
    schema_version: 1,
    id: 'plank',
    name: 'Forearm Plank',
    pattern: 'core',
    primary_muscles: ['abs'],
    secondary_muscles: ['shoulders'],
    unilateral: false,
    coverage_weight: 1,
    level: 1,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'lying_leg_raise', regression_id: null },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Standard isometric forearm plank.',
  },
  {
    schema_version: 1,
    id: 'dead_bug',
    name: 'Dead Bug',
    pattern: 'core',
    primary_muscles: ['abs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 1,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'lying_leg_raise', regression_id: null },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Supine anti-extension core control.',
  },
  {
    schema_version: 1,
    id: 'lying_leg_raise',
    name: 'Lying Leg Raise',
    pattern: 'core',
    primary_muscles: ['abs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'hollow_hold', regression_id: 'dead_bug' },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Floor leg raises targeting lower abdominals.',
  },
  {
    schema_version: 1,
    id: 'side_plank',
    name: 'Side Plank',
    pattern: 'core',
    primary_muscles: ['abs'],
    secondary_muscles: ['shoulders'],
    unilateral: true,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'side_plank_leg_lift', regression_id: null },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Lateral isometric core hold.',
  },
  {
    schema_version: 1,
    id: 'side_plank_leg_lift',
    name: 'Side Plank with Leg Lift',
    pattern: 'core',
    primary_muscles: ['abs', 'hip_mobility'],
    secondary_muscles: ['shoulders'],
    unilateral: true,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'long_lever_side_plank', regression_id: 'side_plank' },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Side plank abducting the top leg for hip and oblique strength.',
  },
  {
    schema_version: 1,
    id: 'hollow_hold',
    name: 'Hollow Body Hold',
    pattern: 'core',
    primary_muscles: ['abs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 3,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'v_up', regression_id: 'lying_leg_raise' },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Gymnastics hollow body isometric hold.',
  },
  {
    schema_version: 1,
    id: 'v_up',
    name: 'V-Up',
    pattern: 'core',
    primary_muscles: ['abs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 4,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: 'hollow_hold' },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Simultaneous upper and lower body flexion.',
  },
  {
    schema_version: 1,
    id: 'long_lever_plank',
    name: 'Long-Lever Plank',
    pattern: 'core',
    primary_muscles: ['abs'],
    secondary_muscles: ['shoulders'],
    unilateral: false,
    coverage_weight: 1,
    level: 4,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: 'plank' },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Plank with elbows extended well past shoulders.',
  },
  {
    schema_version: 1,
    id: 'long_lever_side_plank',
    name: 'Long-Lever Side Plank',
    pattern: 'core',
    primary_muscles: ['abs'],
    secondary_muscles: ['shoulders'],
    unilateral: true,
    coverage_weight: 1,
    level: 4,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: 'side_plank_leg_lift' },
    safety_flags: [],
    type: 'accessory',
    asset_status: 'ready',
    description: 'Extended lever side plank for maximum oblique shear torque.',
  },

  // ==========================================
  // Mobility (5)
  // ==========================================
  {
    schema_version: 1,
    id: 'deep_squat_hold',
    name: 'Deep Squat Hold',
    pattern: 'mobility',
    primary_muscles: ['hip_mobility'],
    secondary_muscles: ['legs'],
    unilateral: false,
    coverage_weight: 1,
    level: 1,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: null },
    safety_flags: [],
    type: 'mobility',
    asset_status: 'ready',
    description: 'Deep resting squat hold opening ankles and hips.',
  },
  {
    schema_version: 1,
    id: 'hip_90_90',
    name: 'Hip 90/90 Flow',
    pattern: 'mobility',
    primary_muscles: ['hip_mobility'],
    secondary_muscles: [],
    unilateral: true,
    coverage_weight: 1,
    level: 1,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: null },
    safety_flags: [],
    type: 'mobility',
    asset_status: 'ready',
    description: 'Ground-based internal and external hip rotation flow.',
  },
  {
    schema_version: 1,
    id: 'couch_stretch_wall',
    name: 'Couch Stretch on Wall',
    pattern: 'mobility',
    primary_muscles: ['hip_mobility', 'legs'],
    secondary_muscles: [],
    unilateral: true,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['wall'] },
    progression_links: { progression_id: null, regression_id: null },
    safety_flags: [],
    type: 'mobility',
    asset_status: 'ready',
    description: 'Deep hip flexor and quad stretch using wall.',
  },
  {
    schema_version: 1,
    id: 'wall_angels',
    name: 'Wall Angels',
    pattern: 'mobility',
    primary_muscles: ['shoulders', 'back'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['wall'] },
    progression_links: { progression_id: null, regression_id: null },
    safety_flags: [],
    type: 'mobility',
    asset_status: 'ready',
    description: 'Thoracic extension and scapular upward rotation against wall.',
  },
  {
    schema_version: 1,
    id: 'cat_camel',
    name: 'Cat-Camel Stretch',
    pattern: 'mobility',
    primary_muscles: ['back'],
    secondary_muscles: ['abs'],
    unilateral: false,
    coverage_weight: 1,
    level: 1,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: null },
    safety_flags: [],
    type: 'mobility',
    asset_status: 'ready',
    description: 'Segmental spinal flexion and extension on quadruped.',
  },

  // ==========================================
  // Conditioning (3)
  // ==========================================
  {
    schema_version: 1,
    id: 'brisk_walk',
    name: 'Brisk Walk',
    pattern: 'conditioning',
    primary_muscles: ['legs'],
    secondary_muscles: [],
    unilateral: false,
    coverage_weight: 1,
    level: 1,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: 'mountain_climber', regression_id: null },
    safety_flags: [],
    type: 'conditioning',
    asset_status: 'ready',
    description: 'Low-impact aerobic conditioning step pace.',
  },
  {
    schema_version: 1,
    id: 'mountain_climber',
    name: 'Mountain Climber',
    pattern: 'conditioning',
    primary_muscles: ['abs', 'legs'],
    secondary_muscles: ['shoulders'],
    unilateral: false,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: 'brisk_walk' },
    safety_flags: [],
    type: 'conditioning',
    asset_status: 'ready',
    description: 'Dynamic plank-based conditioning intervals.',
  },
  {
    schema_version: 1,
    id: 'shadow_boxing',
    name: 'Shadow Boxing',
    pattern: 'conditioning',
    primary_muscles: ['shoulders', 'arms'],
    secondary_muscles: ['legs', 'abs'],
    unilateral: false,
    coverage_weight: 1,
    level: 2,
    equipment_requirement: { schema_version: 1, all: ['floor', 'bodyweight'] },
    progression_links: { progression_id: null, regression_id: null },
    safety_flags: [],
    type: 'conditioning',
    asset_status: 'ready',
    description: 'Multi-planar aerobic conditioning with punches and footwork.',
  },
];

export interface LibraryValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates exercise library invariants:
 * - unique ids
 * - every progression/regression link exists
 * - progression level > source level (regression level < source level)
 * - no cycles in progression or regression chains
 * - equipment expressions valid
 * - every pattern has an exercise or an entry in LIBRARY_LIMITATIONS
 */
export function validateLibrary(library: Exercise[]): LibraryValidationResult {
  const errors: string[] = [];
  const exerciseMap = new Map<string, Exercise>();

  // 1. Unique IDs
  for (const ex of library) {
    if (exerciseMap.has(ex.id)) {
      errors.push(`Duplicate exercise id detected: "${ex.id}"`);
    }
    exerciseMap.set(ex.id, ex);
  }

  // 2. Links existence & level checks
  for (const ex of library) {
    const progId = ex.progression_links.progression_id;
    if (progId) {
      const target = exerciseMap.get(progId);
      if (!target) {
        errors.push(`Exercise "${ex.id}" references non-existent progression_id "${progId}"`);
      } else if (target.level <= ex.level) {
        errors.push(
          `Exercise "${ex.id}" (level ${ex.level}) progression "${progId}" must have higher level (found ${target.level})`
        );
      }
    }

    const regId = ex.progression_links.regression_id;
    if (regId) {
      const target = exerciseMap.get(regId);
      if (!target) {
        errors.push(`Exercise "${ex.id}" references non-existent regression_id "${regId}"`);
      } else if (target.level >= ex.level) {
        errors.push(
          `Exercise "${ex.id}" (level ${ex.level}) regression "${regId}" must have lower level (found ${target.level})`
        );
      }
    }
  }

  // 3. No cycles
  for (const ex of library) {
    // Check progression chain
    const progVisited = new Set<string>([ex.id]);
    let currentProg: string | null | undefined = ex.progression_links.progression_id;
    while (currentProg) {
      if (progVisited.has(currentProg)) {
        errors.push(`Progression cycle detected originating at "${ex.id}" through "${currentProg}"`);
        break;
      }
      progVisited.add(currentProg);
      const nextEx = exerciseMap.get(currentProg);
      currentProg = nextEx?.progression_links.progression_id;
    }

    // Check regression chain
    const regVisited = new Set<string>([ex.id]);
    let currentReg: string | null | undefined = ex.progression_links.regression_id;
    while (currentReg) {
      if (regVisited.has(currentReg)) {
        errors.push(`Regression cycle detected originating at "${ex.id}" through "${currentReg}"`);
        break;
      }
      regVisited.add(currentReg);
      const nextEx = exerciseMap.get(currentReg);
      currentReg = nextEx?.progression_links.regression_id;
    }
  }

  // 4. Equipment expressions valid
  for (const ex of library) {
    const req = ex.equipment_requirement;
    if (req.all) {
      for (const eq of req.all) {
        if (!EquipmentIdEnum.options.includes(eq)) {
          errors.push(`Exercise "${ex.id}" has invalid equipment in 'all': "${eq}"`);
        }
      }
    }
    if (req.any) {
      for (const eq of req.any) {
        if (!EquipmentIdEnum.options.includes(eq)) {
          errors.push(`Exercise "${ex.id}" has invalid equipment in 'any': "${eq}"`);
        }
      }
    }
  }

  // 5. Every movement pattern has an eligible exercise or an entry in LIBRARY_LIMITATIONS
  const allPatterns = MovementPatternEnum.options;
  for (const pattern of allPatterns) {
    const matchingExercises = library.filter(
      (e) => e.pattern === pattern && e.coverage_weight > 0
    );
    if (matchingExercises.length === 0 && !LIBRARY_LIMITATIONS[pattern]) {
      errors.push(
        `Pattern "${pattern}" has no covered exercises and no entry in LIBRARY_LIMITATIONS.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
