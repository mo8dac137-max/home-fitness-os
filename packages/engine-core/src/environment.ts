import type { Exercise, EquipmentId, MovementPattern } from '@hfos/contracts';
import { MovementPatternEnum } from '@hfos/contracts';
import { LIBRARY_LIMITATIONS } from '@hfos/library';

export type EnvironmentStatus = 'unknown' | 'declared' | 'validated' | 'retired';

export interface EnvironmentItem {
  item_id: EquipmentId | string;
  status: EnvironmentStatus;
  validated_at?: string | null;
  updated_at: string;
  notes?: string;
}

export type EnvironmentEvent =
  | { type: 'declare'; timestamp: string; notes?: string }
  | { type: 'validate'; timestamp: string; validated_at: string; notes?: string }
  | { type: 'retire'; timestamp: string; notes?: string };

/**
 * Pure state machine transition function per environment item:
 * unknown -> declared -> validated(date) -> retired
 * Invalid transitions are rejected.
 */
export function transitionEnvironmentItem(
  item: EnvironmentItem,
  event: EnvironmentEvent
): EnvironmentItem {
  switch (event.type) {
    case 'declare': {
      if (item.status !== 'unknown') {
        throw new Error(
          `Invalid transition: cannot declare item "${item.item_id}" with status "${item.status}"`
        );
      }
      return {
        ...item,
        status: 'declared',
        updated_at: event.timestamp,
        notes: event.notes ?? item.notes,
      };
    }
    case 'validate': {
      if (item.status !== 'declared' && item.status !== 'validated') {
        throw new Error(
          `Invalid transition: cannot validate item "${item.item_id}" with status "${item.status}". Item must be declared first.`
        );
      }
      if (!event.validated_at) {
        throw new Error(`Validation requires a valid validated_at timestamp.`);
      }
      return {
        ...item,
        status: 'validated',
        validated_at: event.validated_at,
        updated_at: event.timestamp,
        notes: event.notes ?? item.notes,
      };
    }
    case 'retire': {
      if (item.status === 'retired') {
        throw new Error(`Invalid transition: item "${item.item_id}" is already retired.`);
      }
      if (item.status === 'unknown') {
        throw new Error(`Invalid transition: cannot retire unknown item "${item.item_id}".`);
      }
      return {
        ...item,
        status: 'retired',
        updated_at: event.timestamp,
        notes: event.notes ?? item.notes,
      };
    }
  }
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export const DEFAULT_ITEMS_REQUIRING_VALIDATION: string[] = [
  'table',
  'door',
  'stairs',
  'chair',
  'loaded_backpack',
  'wall',
];

/**
 * Determines exercise eligibility against the user's declared/validated environment.
 * - bodyweight and floor are always available.
 * - items in items_requiring_validation must be validated.
 * - wall only requires validation if exercise has fall_risk safety flag.
 */
export function isEligible(
  exercise: Exercise,
  environment: Record<string, EnvironmentItem>,
  itemsRequiringValidation: string[] = DEFAULT_ITEMS_REQUIRING_VALIDATION
): EligibilityResult {
  const reasons: string[] = [];

  const checkItem = (itemId: string): { satisfied: boolean; reason?: string } => {
    if (itemId === 'bodyweight' || itemId === 'floor') {
      return { satisfied: true };
    }

    const item = environment[itemId];
    if (!item || item.status === 'unknown') {
      return { satisfied: false, reason: `missing:${itemId}` };
    }

    if (item.status === 'retired') {
      return { satisfied: false, reason: `retired:${itemId}` };
    }

    const requiresValidation = itemsRequiringValidation.includes(itemId);
    if (requiresValidation) {
      if (itemId === 'wall') {
        // Wall only requires validation for fall_risk exercises
        if (exercise.safety_flags.includes('fall_risk') && item.status !== 'validated') {
          return { satisfied: false, reason: `fall_risk_unvalidated:wall` };
        }
      } else if (itemId === 'loaded_backpack') {
        if (exercise.safety_flags.includes('requires_validated_load') && item.status !== 'validated') {
          return { satisfied: false, reason: `load_unverified:loaded_backpack` };
        }
      } else if (item.status !== 'validated') {
        return { satisfied: false, reason: `not_validated:${itemId}` };
      }
    }

    return { satisfied: true };
  };

  const req = exercise.equipment_requirement;

  // Evaluate 'all' expression
  if (req.all && req.all.length > 0) {
    for (const eq of req.all) {
      const res = checkItem(eq);
      if (!res.satisfied && res.reason) {
        reasons.push(res.reason);
      }
    }
  }

  // Evaluate 'any' expression
  if (req.any && req.any.length > 0) {
    let anySatisfied = false;
    const anyReasons: string[] = [];
    for (const eq of req.any) {
      const res = checkItem(eq);
      if (res.satisfied) {
        anySatisfied = true;
        break;
      } else if (res.reason) {
        anyReasons.push(res.reason);
      }
    }
    if (!anySatisfied) {
      reasons.push(`unsatisfied_any:[${req.any.join(',')}]`);
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export interface PatternCoverageResult {
  counts: Record<MovementPattern, number>;
  active_limitations: Partial<Record<MovementPattern, string>>;
}

/**
 * Returns eligible counts per movement pattern and active limitations.
 */
export function coverageByPattern(
  library: Exercise[],
  environment: Record<string, EnvironmentItem>,
  itemsRequiringValidation: string[] = DEFAULT_ITEMS_REQUIRING_VALIDATION
): PatternCoverageResult {
  const counts: Record<MovementPattern, number> = {
    horizontal_push: 0,
    vertical_push: 0,
    horizontal_pull: 0,
    vertical_pull: 0,
    squat: 0,
    hinge: 0,
    lunge: 0,
    core: 0,
    mobility: 0,
    conditioning: 0,
  };

  for (const ex of library) {
    if (ex.coverage_weight <= 0) continue;
    const { eligible } = isEligible(ex, environment, itemsRequiringValidation);
    if (eligible) {
      counts[ex.pattern] += 1;
    }
  }

  const active_limitations: Partial<Record<MovementPattern, string>> = {};

  for (const pattern of MovementPatternEnum.options) {
    if (counts[pattern] === 0) {
      active_limitations[pattern] =
        LIBRARY_LIMITATIONS[pattern] ??
        `No eligible exercises available in current environment for ${pattern}`;
    }
  }

  return {
    counts,
    active_limitations,
  };
}
