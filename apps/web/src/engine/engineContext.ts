import type { Clock, IdGenerator } from '@hfos/ports';
import { LocalScheduleProvider, type UserWeeklyWindow } from '@hfos/ports';
import type { CapabilityMap } from '@hfos/engine-core';
import type { MovementPattern } from '@hfos/contracts';

/**
 * System Clock using real device time.
 */
export class SystemClock implements Clock {
  public now(): Date {
    return new Date();
  }

  public nowIso(): string {
    return new Date().toISOString();
  }

  public nowTimestamp(): number {
    return Date.now();
  }
}

/**
 * UUID v7 IdGenerator for standard production events and plans.
 */
export class SystemIdGenerator implements IdGenerator {
  public generateId(): string {
    // Generate UUID v7 compliant format
    // 18 random hex chars: 3 (version tail) + 3 (variant tail) + 12 (node)
    const now = Date.now();
    const timeHex = now.toString(16).padStart(12, '0');
    const randomHex = Array.from({ length: 18 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    // Format: 8-4-4-4-12 (time-low, time-mid, ver 7, variant 8, random node)
    return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-7${randomHex.slice(0, 3)}-8${randomHex.slice(3, 6)}-${randomHex.slice(6, 18)}`;
  }
}

/**
 * Default weekly schedule windows:
 * Weekdays (Mon-Fri, days 1-5): 18:00 - 19:30 (90 min)
 * Weekends (Sat-Sun, days 0, 6): 10:00 - 12:00 (120 min)
 */
export const DEFAULT_WEEKLY_WINDOWS: UserWeeklyWindow[] = [
  { dayOfWeek: 0, start: '10:00', end: '12:00', duration_minutes: 120 }, // Sunday
  { dayOfWeek: 1, start: '18:00', end: '19:30', duration_minutes: 90 }, // Monday
  { dayOfWeek: 2, start: '18:00', end: '19:30', duration_minutes: 90 }, // Tuesday
  { dayOfWeek: 3, start: '18:00', end: '19:30', duration_minutes: 90 }, // Wednesday
  { dayOfWeek: 4, start: '18:00', end: '19:30', duration_minutes: 90 }, // Thursday
  { dayOfWeek: 5, start: '18:00', end: '19:30', duration_minutes: 90 }, // Friday
  { dayOfWeek: 6, start: '10:00', end: '12:00', duration_minutes: 120 }, // Saturday
];

export function createDefaultScheduleProvider(): LocalScheduleProvider {
  return new LocalScheduleProvider(DEFAULT_WEEKLY_WINDOWS);
}

/**
 * Baseline capability map for mock athlete (Level 3 baseline across patterns).
 */
export function createDefaultCapabilityMap(nowIso: string): CapabilityMap {
  const patterns: MovementPattern[] = [
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
  ];

  const map: CapabilityMap = {};
  for (const p of patterns) {
    map[p] = {
      level: 3,
      confidence: 0.8,
      last_reviewed: nowIso,
    };
  }
  return map;
}
