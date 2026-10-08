import type { Plan } from '@hfos/contracts';

export const PACKAGE_NAME = '@hfos/engine-core';

export * from './environment.js';
export * from './validator.js';
export * from './session.js';
export * from './progression.js';
export * from './ranking.js';
export * from './exposure.js';
export * from './knowledge.js';
export * from './horizon.js';
export * from './ai-contract.js';

/**
 * Checks if Day 0 is locked and Day 1 is protected according to plan invariants.
 */
export function verifyPlanIntegrity(plan: Plan): boolean {
  if (plan.days.length !== plan.horizon_days) return false;
  const day0 = plan.days[0];
  const day1 = plan.days[1];
  if (!day0 || day0.status !== 'locked') return false;
  if (!day1 || day1.status !== 'protected') return false;
  return true;
}
