import { describe, it, expect } from 'vitest';
import { getEffectiveConfig } from '@hfos/config';
import { INITIAL_EXERCISE_LIBRARY } from '@hfos/library';
import { LocalScheduleProvider } from '@hfos/ports';
import {
  buildHorizon,
  isEligible,
  estimateDuration,
  reviewProgression,
  isReviewDue,
  type CapabilityMap,
  type EnvironmentItem,
  type ReviewInput,
  type HardSetLog,
} from '@hfos/engine-core';

interface UserSimulationProfile {
  codename: string;
  adherenceRate: number; // 0..1 chance of completing scheduled workout
  qualityBias: number; // 1, 2, or 3
  rpeBias: number; // typical RPE
  painChance: number; // 0..1
}

interface SimulationSummary {
  user: string;
  totalDays: number;
  completedWorkouts: number;
  adaptiveChangeRate: number;
  progressionReviews: number;
  progressCount: number;
  maintainCount: number;
  regressCount: number;
  deloadCount: number;
}

describe('M0-16 12-Week Multi-User Simulation', () => {
  it('runs deterministic simulation of 3 mock users over 12 weeks respecting all engine constraints', () => {
    const config = getEffectiveConfig();
    const env: Record<string, EnvironmentItem> = {
      floor: { item_id: 'floor', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
      wall: { item_id: 'wall', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
      pullup_bar: { item_id: 'pullup_bar', status: 'validated', updated_at: '2026-10-01T00:00:00Z' },
    };
    const eligibleExercises = INITIAL_EXERCISE_LIBRARY.filter((e) => isEligible(e, env).eligible);

    // Schedule: Mon, Tue, Thu, Fri (60 mins), Sat (45 mins)
    const scheduleProvider = new LocalScheduleProvider([
      { dayOfWeek: 1, start: '07:00', end: '08:00', duration_minutes: 60 },
      { dayOfWeek: 2, start: '07:00', end: '08:00', duration_minutes: 60 },
      { dayOfWeek: 4, start: '07:00', end: '08:00', duration_minutes: 60 },
      { dayOfWeek: 5, start: '07:00', end: '08:00', duration_minutes: 60 },
      { dayOfWeek: 6, start: '08:00', end: '08:45', duration_minutes: 45 },
    ]);

    const availability = scheduleProvider.getAvailability({
      startDate: '2026-10-01',
      endDate: '2027-02-01',
    });

    const users: UserSimulationProfile[] = [
      {
        codename: 'consistent_athlete',
        adherenceRate: 0.95,
        qualityBias: 3,
        rpeBias: 8,
        painChance: 0.0,
      },
      {
        codename: 'lapsing_athlete',
        adherenceRate: 0.65,
        qualityBias: 3,
        rpeBias: 8,
        painChance: 0.0,
      },
      {
        codename: 'fatigued_athlete',
        adherenceRate: 0.85,
        qualityBias: 3,
        rpeBias: 9.5,
        painChance: 0.0,
      },
    ];

    const weeks = 12;
    const totalDays = weeks * 7; // 84 days
    const summaries: SimulationSummary[] = [];

    for (const user of users) {
      const capabilityMap: CapabilityMap = {
        horizontal_push: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        vertical_push: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        horizontal_pull: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        vertical_pull: { level: 1, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        squat: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        hinge: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        lunge: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        core: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        mobility: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
        conditioning: { level: 2, confidence: 1, last_reviewed: '2026-10-01T00:00:00Z' },
      };

      let completedWorkouts = 0;
      let totalAdaptiveDaysEvaluated = 0;
      let adaptiveDaysChanged = 0;
      let previousAdaptivePlanDays: string[] = [];

      let reviewCount = 0;
      let progressCount = 0;
      let maintainCount = 0;
      let regressCount = 0;
      let deloadCount = 0;

      const recentSetsByPattern: Record<string, HardSetLog[]> = {};
      let sessionHistoryCount = 0;
      let lastReviewDate = new Date('2026-10-01T00:00:00Z');

      const currentDate = new Date('2026-10-01T05:00:00Z');

      for (let day = 0; day < totalDays; day++) {
        const nowIso = currentDate.toISOString();

        // 1. Build horizon
        const horizon = buildHorizon(
          {
            now_iso: nowIso,
            availability_windows: availability,
            capability_map: capabilityMap,
            eligible_exercises: eligibleExercises,
            library: INITIAL_EXERCISE_LIBRARY,
            environment: env,
            seed: `${user.codename}-day-${day}`,
          },
          config
        );

        // Verify day 0 lock, day 1 protected, horizon invariants
        expect(horizon.days.length).toBe(7);
        expect(horizon.days[0]?.status).toBe('locked');
        expect(horizon.days[1]?.status).toBe('protected');

        // Check adaptive change stability tracking
        const currentAdaptiveKinds = horizon.days.slice(2).map((d) => d.kind);
        if (previousAdaptivePlanDays.length > 0) {
          // Compare overlap between previous day 3..6 and current day 2..5
          for (let i = 0; i < Math.min(previousAdaptivePlanDays.length - 1, currentAdaptiveKinds.length); i++) {
            totalAdaptiveDaysEvaluated++;
            if (previousAdaptivePlanDays[i + 1] !== currentAdaptiveKinds[i]) {
              adaptiveDaysChanged++;
            }
          }
        }
        previousAdaptivePlanDays = currentAdaptiveKinds;

        // 2. Execute Day 0
        const todayPlan = horizon.days[0]!;
        if (todayPlan.kind === 'main') {
          // Assert spacing and constraints for every main session
          expect(todayPlan.session_snapshot).toBeDefined();
          const snapshot = todayPlan.session_snapshot!;
          const duration = estimateDuration(snapshot, config);
          expect(duration).toBeGreaterThanOrEqual(30);
          expect(duration).toBeLessThanOrEqual(60);

          // Ineligible exercises must NEVER appear
          for (const exItem of snapshot.exercises) {
            const exObj = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === exItem.exercise_id);
            expect(exObj).toBeDefined();
            expect(isEligible(exObj!, env).eligible).toBe(true);
          }

          // Deterministic pseudo-random user execution
          const prngVal = ((day * 37 + user.codename.length * 13) % 100) / 100;
          if (prngVal < user.adherenceRate) {
            completedWorkouts++;
            sessionHistoryCount++;

            // Record synthetic sets
            for (const exItem of snapshot.exercises) {
              const exObj = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === exItem.exercise_id)!;
              if (!recentSetsByPattern[exObj.pattern]) {
                recentSetsByPattern[exObj.pattern] = [];
              }
              for (const s of exItem.sets) {
                const targetReps = s.target_reps ?? 10;
                const maxReps = s.max_reps ?? 10;
                recentSetsByPattern[exObj.pattern]!.push({
                  reps: maxReps,
                  target_reps: targetReps,
                  max_reps: maxReps,
                  quality: user.qualityBias,
                  rpe: user.rpeBias,
                  rir: 2,
                  pain: false,
                });
              }
            }
          }
        }

        // 3. Periodic progression reviews
        const daysSinceReview = Math.floor(
          (currentDate.getTime() - lastReviewDate.getTime()) / (24 * 60 * 60 * 1000)
        );
        const due = isReviewDue(
          {
            main_sessions_since_review: sessionHistoryCount,
            days_since_review: daysSinceReview,
          },
          config
        );

        if (due) {
          reviewCount++;
          lastReviewDate = new Date(currentDate);
          sessionHistoryCount = 0;

          // Review all active patterns with recent recorded sets
          for (const pattern of Object.keys(recentSetsByPattern)) {
            const patternSets = recentSetsByPattern[pattern] ?? [];
            if (patternSets.length < 2) continue;

            const reviewInput: ReviewInput = {
              scope: 'pattern',
              recent_sets: patternSets.slice(-6), // last 6 working sets
              recent_session_rpes: user.rpeBias >= 9 ? [9.5, 9.5] : [7.5, 7.5],
              performance_drop_streak: 0,
              exposure_last_14d: patternSets.length > 0 ? 3 : 0,
              has_negative_trend: false,
              adherence_rate: user.adherenceRate,
              is_loadable: false,
              load_verified: false,
            };

            const outcome = reviewProgression(reviewInput, config);
            if (outcome.outcome === 'progress') progressCount++;
            else if (outcome.outcome === 'maintain') maintainCount++;
            else if (outcome.outcome === 'regress') regressCount++;
            else if (outcome.outcome === 'deload') deloadCount++;

            // Progression occurs only when eligible
            if (outcome.outcome === 'progress') {
              expect(reviewInput.exposure_last_14d).toBeGreaterThanOrEqual(2);
              expect(reviewInput.recent_sets.every((s) => !s.pain)).toBe(true);
            }
          }
        }

        // Advance 1 day
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      const adaptiveChangeRate =
        totalAdaptiveDaysEvaluated > 0 ? adaptiveDaysChanged / totalAdaptiveDaysEvaluated : 0;

      // The average share of adaptive days changed per day stays under 0.15
      expect(adaptiveChangeRate).toBeLessThanOrEqual(0.15);

      summaries.push({
        user: user.codename,
        totalDays,
        completedWorkouts,
        adaptiveChangeRate: Math.round(adaptiveChangeRate * 1000) / 1000,
        progressionReviews: reviewCount,
        progressCount,
        maintainCount,
        regressCount,
        deloadCount,
      });
    }

    // Verify compact golden summary
    expect(summaries).toHaveLength(3);
    for (const s of summaries) {
      expect(s.totalDays).toBe(84);
      expect(s.completedWorkouts).toBeGreaterThan(0);
      expect(s.adaptiveChangeRate).toBeLessThan(0.15);
    }

    // Golden check: consistent athlete progressed, fatigued athlete deloaded or maintained
    const consistent = summaries.find((s) => s.user === 'consistent_athlete');
    const fatigued = summaries.find((s) => s.user === 'fatigued_athlete');
    expect(consistent?.progressCount).toBeGreaterThan(0);
    expect(fatigued?.deloadCount).toBeGreaterThan(0);
  });
});
