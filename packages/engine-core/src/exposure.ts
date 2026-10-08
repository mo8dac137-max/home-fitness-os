import type { Exercise, MuscleGroup } from '@hfos/contracts';
import { MuscleGroupEnum } from '@hfos/contracts';
import type { EffectiveConfig } from '@hfos/config';
import { requireNumber, getEffectiveConfig } from '@hfos/config';

export interface SetLogItem {
  exercise: Exercise;
  performed_at: string; // ISO datetime
  hard_set: boolean;
}

export interface MuscleExposureEstimate {
  muscle: MuscleGroup;
  weekly_sets_fractional: number;
  last_stimulus_at: string | null;
  data_points: number;
  estimate: true;
}

export type ExposureTrend = 'up' | 'flat' | 'down' | 'insufficient_data';

export interface TrendResult {
  trend: ExposureTrend;
  estimate: true;
}

/**
 * M0-11 Muscle exposure calculator:
 * Computes fractional weekly sets per muscle over trailing windowDays.
 * Primary muscles: 1.0 * coverage_weight.
 * Secondary muscles: secondary_muscle_fraction * coverage_weight.
 * Every value carries estimate: true.
 */
export function computeExposure(
  setLogs: SetLogItem[],
  now: string,
  config: EffectiveConfig = getEffectiveConfig()
): Record<MuscleGroup, MuscleExposureEstimate> {
  const windowDays = requireNumber(config, 'exposure_window_days');
  const msPerDay = requireNumber(config, 'milliseconds_per_day');
  const secondaryFraction = requireNumber(config, 'secondary_muscle_fraction');

  const nowMs = Date.parse(now);
  const windowMs = windowDays * msPerDay;

  const result: Record<MuscleGroup, MuscleExposureEstimate> = {} as Record<
    MuscleGroup,
    MuscleExposureEstimate
  >;

  for (const m of MuscleGroupEnum.options) {
    result[m] = {
      muscle: m,
      weekly_sets_fractional: 0,
      last_stimulus_at: null,
      data_points: 0,
      estimate: true,
    };
  }

  for (const log of setLogs) {
    if (!log.hard_set) continue;
    const logMs = Date.parse(log.performed_at);
    const ageMs = nowMs - logMs;

    // Must be in trailing window: age >= 0 and age <= windowMs
    if (ageMs < 0 || ageMs > windowMs) {
      continue;
    }

    const ex = log.exercise;
    const weight = ex.coverage_weight;

    if (weight <= 0) {
      continue;
    }

    for (const m of ex.primary_muscles) {
      const entry = result[m];
      if (entry) {
        entry.weekly_sets_fractional += 1 * weight;
        entry.data_points += 1;
        if (!entry.last_stimulus_at || Date.parse(entry.last_stimulus_at) < logMs) {
          entry.last_stimulus_at = log.performed_at;
        }
      }
    }

    for (const m of ex.secondary_muscles) {
      const entry = result[m];
      if (entry) {
        entry.weekly_sets_fractional += secondaryFraction * weight;
        entry.data_points += 1;
        if (!entry.last_stimulus_at || Date.parse(entry.last_stimulus_at) < logMs) {
          entry.last_stimulus_at = log.performed_at;
        }
      }
    }
  }

  return result;
}

/**
 * Calculates exposure trend from a series of historical data points.
 * Returns 'insufficient_data' unless data_points >= min_trend_points.
 * Otherwise returns 'up' | 'flat' | 'down' based on trend_flat_band.
 * Every value carries estimate: true.
 */
export function trendFromSeries(
  series: number[],
  config: EffectiveConfig = getEffectiveConfig()
): TrendResult {
  const minPoints = requireNumber(config, 'min_trend_points');
  const flatBand = requireNumber(config, 'trend_flat_band');

  if (series.length < minPoints) {
    return {
      trend: 'insufficient_data',
      estimate: true,
    };
  }

  const startVal = series[0]!;
  const endVal = series[series.length - 1]!;

  const base = startVal === 0 ? 1 : startVal;
  const delta = (endVal - startVal) / base;

  if (delta > flatBand) {
    return { trend: 'up', estimate: true };
  }

  if (delta < -flatBand) {
    return { trend: 'down', estimate: true };
  }

  return { trend: 'flat', estimate: true };
}
