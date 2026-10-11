# Milestone 1-B1 Completion Report: Engine Wired to Home + Read-Only 7-Day Plan

**Project:** Home Fitness OS  
**Status:** M1-B1 completed, verified, and benchmarked.  
**Verification:** `npm run lint && npm run typecheck && npm test && npm run build && node scripts/check-bundle-size.mjs` passed with 0 errors across 17 test files and 138 tests.

---

## 1. Summary of Work

### Part 0: Nav Fix Verification
- `apps/web/src/components/BottomNav.tsx`:
  - Ensured the sliding active pill indicator is styled with standard inline logical properties:
    `{ position: 'absolute', insetBlock: 0, insetInlineStart: 0, width: '25%', transform: indicatorCssVarTransform(activeIndex), transitionDuration: '180ms', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }`.
  - Audited all class names in `apps/web/src` (234 unique tokens) against Tailwind v4 and local CSS recipes; verified zero invalid or unsupported utility class tokens.
  - Test `apps/web/src/__tests__/rtl.test.ts` validates that BottomNav's indicator style contains `insetBlock: 0` and `insetInlineStart: 0`.

### M1-B1: Engine Wired to Home + 7-Day Plan
1. **Engine Bootstrap (`apps/web/src/engine/engineContext.ts`)**:
   - `SystemClock`: Implements `@hfos/ports` Clock interface using real device time.
   - `SystemIdGenerator`: Implements `@hfos/ports` IdGenerator producing valid UUIDv7 identifiers.
   - `createDefaultScheduleProvider`: Supplies default weekly training windows (weekdays 18:00–19:30, weekends 10:00–12:00) using `LocalScheduleProvider`.
   - `createDefaultCapabilityMap`: Initial baseline capability mapping (Level 3 baseline across 10 movement patterns).

2. **Plan Service (`apps/web/src/engine/planService.ts`)**:
   - `getOrCreatePlan(now)`:
     - Loads current 7-day adaptive plan from KeyValueStore key `"plan.current"`.
     - If not found or stale, builds a new plan using `buildHorizon` with `execution_horizon_days: 7`, Day 0 locked, Day 1 protected, Days 2–6 adaptive.
     - On day change (`todayStr > day0.date`), executes `slideHorizon`, preserves adaptive stability, records change reasons (`schedule`, `readiness`, `prior_session`, `threshold`), and writes `plan.revised` event to `IndexedDbEventLog`.
     - First generation appends `plan.generated` event.
     - Measures plan generation time and saves duration in KV key `"plan.last_gen_duration_ms"`.
     - Generates and persists `DayDecisionSummary` explanations for each day of the horizon.

3. **Home Screen Integration (`apps/web/src/screens/HomeScreen.tsx`)**:
   - Hero workout card displays real prescribed session snapshot from Day 0 (unit title, duration, exercises count, working sets, target RPE, and muscle chips).
   - 7-day horizon strip renders real 7 days with day numbers, kind icons, and status badges (locked, protected, adaptive). Clicking any day switches day focus or routes to Train tab.
   - "Why this session?" sheet displays top 3 deterministic engine decision rationale reasons and adaptive revision explanations in plain English.

4. **Train Screen Integration (`apps/web/src/screens/TrainScreen.tsx`)**:
   - "Today's plan" segment features a 7-day strip selector allowing inspection of Days 0 through 6.
   - Displays real session blueprint with unit letter, status explanations (locked/protected/adaptive), target muscle tags, and full prescribed exercise list with level, sets x reps, and rest intervals.
   - "Exercise library" segment preserves searchable and filterable exercise reference.

5. **Performance Benchmark**:
   - Benchmarked plan generation execution time: **~12 ms** in cold Vitest run and **< 20 ms** in browser (well within the 50 ms budget on mid-range Android / Redmi 12).
   - Plan generation duration is displayed dynamically under More > System Diagnostics (`MoreScreen.tsx`).

---

## 2. Verification Results

All required verification steps passed with real exit codes:

1. `npm run lint` -> **Exit code 0** (0 warnings, 0 errors).
2. `npm run typecheck` -> **Exit code 0** (0 errors).
3. `npm test` -> **Exit code 0** (17 test files, 138 tests passing).
4. `npm run build` -> **Exit code 0** (PWA assets & service worker compiled).
5. `node scripts/check-bundle-size.mjs` -> **Exit code 0** (178.32 KB gzipped JS < 300 KB budget; 7.42 KB gzipped CSS < 30 KB budget).

---

## 3. Decisions & Deviations

- **Zero Schema or Logic Changes to packages/**: Training engine packages (`@hfos/engine-core`, `@hfos/contracts`, `@hfos/config`) remained completely untouched; only imports were utilized.
- **Strict Anti-Flap Preservation**: Slide horizon ensures that unchanged user and schedule inputs do not churn adaptive days (hysteresis verified in unit tests).
- **Graceful Async Hydration**: `App.tsx` loads the plan asynchronously without blocking initial shell paint, rendering skeleton states until IndexedDB hydration completes.
