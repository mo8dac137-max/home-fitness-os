# Batch 3 Completion Report (M0-09, M0-10, M0-11, M0-12)

**Project:** Home Fitness OS  
**Status:** Part 1 (Hardening / Rule 10) and Part 2 (M0-09, M0-10, M0-11, M0-12) completed and fully verified.  
**Verification:** `npm ci && npm run lint && npm run typecheck && npm test && npm run build` passed with 0 errors across 11 test files and 96 unit, integration, and fast-check property tests.

---

## 1. Files Created & Modified

### Part 1: Hardening (Rule 10)
- `packages/config/src/index.ts`:
  - Exported typed `EffectiveConfig` representing runtime configuration.
  - Implemented `requireNumber(config, key)`: throws descriptive errors if key is missing or non-finite.
  - Implemented `requireRange(config, key)`: throws descriptive errors if range object (`min`, `max`, optional `target`) is missing or invalid.
  - Implemented `requireArray(config, key)` for typed arrays.
  - Added versioned settings with bounds and consumers:
    - `rep_window_strength` ({ min: 4, max: 8, target: 6 }, consumer: `session_generator`)
    - `rep_window_hypertrophy` ({ min: 6, max: 15, target: 10 }, consumer: `session_generator`)
    - `rep_window_endurance` ({ min: 12, max: 25, target: 15 }, consumer: `session_generator`)
    - `mobility_rest_seconds` (30s, bounds 15–60s, consumer: `session_generator`)
- `packages/engine-core/src/session.ts` & `packages/engine-core/src/validator.ts`:
  - Required `EffectiveConfig` as parameter (defaulting to `getEffectiveConfig()`).
  - Removed all `?? <default>` fallbacks and `as number` casts; all numeric parameters pulled via `requireNumber` / `requireRange`.
  - Removed literal 24 in recovery spacing check; strictly uses `min_hours_between_hard_same_pattern`.
  - `created_at` made a required parameter in `session.ts` (no hard-coded timestamps).
- `packages/engine-core/src/__tests__/numeric-literals-guard.test.ts`:
  - Added strict AST scanner checking all `.ts` files in `packages/engine-core/src/` for numeric literals other than `0`, `1`, `2` outside comments and PRNG implementation blocks, failing with exact file and line number.

### Part 2: Batch 3 Core Milestones (@hfos/engine-core)

- **M0-09 Progression Engine (`packages/engine-core/src/progression.ts`)**:
  - `evaluateFinderAttempt`: Technical-capacity testing evaluating `{ reps, quality, pain, stopped_reason }`. Returns `valid`, `step_up`, `step_down`, or `stop_pain` with pain flag. Never pushes to true failure.
  - `isReviewDue`: Determines whether progression review is due (>=3 main sessions AND >=6 days, or forced >=10 days).
  - `reviewProgression`: Evaluates scope (exercise, pattern, muscle priority, unit) across 5 deterministic outcomes:
    - `insufficient_data`: Fewer than 2 sets recorded.
    - `regress`: Pain reported or quality < 3 in >=50% of sets.
    - `deload`: Consecutive session RPE >= `deload_rpe` or 2-session performance drop.
    - `progress`: Top of rep range in all sets with RIR >= 2 (or quality 3), exposure >= 2 in last 14d, no negative trend. Picks one progression lever following configured `lever_order` (`load` only if verified loadable).
    - `maintain`: Performance stable.
  - `detectStagnation`: Detects 3 consecutive non-progress reviews for a pattern and returns the 6-point diagnostic checklist (technique, recovery, exposure, data sufficiency/nutrition, exercise suitability, need for new stimulus).

- **M0-10 Ranking, Provenance, Hysteresis (`packages/engine-core/src/ranking.ts`)**:
  - Hard filters evaluated first (safety, recovery/spacing, volume caps, equipment, duration). Candidates failing any filter are excluded with recorded reasons.
  - Normalizes 6 evaluation terms to [0, 1]: `priority_need`, `stimulus_gap` (days / target_stimulus_interval_days capped at 1), `progression_need`, `goal_weight`, `schedule_fit`, `readiness`.
  - Calculates weighted sum using versioned rank weights. Ties broken deterministically by unit ascending, then exercise ID ascending.
  - `buildDecisionRecord`: Produces complete `DecisionRecord` documenting candidates, normalized terms, filter outcomes, and chosen selection with `ai_contribution = null`.
  - `shouldReplaceCurrent`: Replaces only when challenger score >= current * (1 + `hysteresis_threshold`) AND `isMaterialChange` is true. Returns reason code (`schedule | readiness | prior_session | threshold | none`).

- **M0-11 Muscle Exposure Calculator (`packages/engine-core/src/exposure.ts`)**:
  - `computeExposure`: Trailing window calculation of fractional weekly sets per muscle group. Primary muscles receive `1.0 * coverage_weight`; secondary muscles receive `secondary_muscle_fraction * coverage_weight`. All output records carry `estimate: true`.
  - `trendFromSeries`: Evaluates history data points. Returns `insufficient_data` when data points < `min_trend_points` (6); otherwise evaluates `up`, `flat`, or `down` relative to `trend_flat_band`. All outputs carry `estimate: true`.

- **M0-12 Knowledge Ledger & Information Needs (`packages/engine-core/src/knowledge.ts`)**:
  - `KnowledgeLedger`: Immutable ledger tracking facts and explicitly rejected inferences (`rejectInference`). Inferred facts for rejected keys are permanently prohibited.
  - `isStale`: Evaluates freshness using configurable per-key policies (`freshness_days_weight`, `freshness_days_waist`, etc.) or explicit `expires_at`.
  - `deriveInformationNeeds`: Emits an `InformationNeed` only when an active decision requires a missing or stale fact. Enforces daily question budget (`max_questions_per_day`).

- **Engine Core Test Suite (`packages/engine-core/src/__tests__/engine-core.test.ts`)**:
  - Added 42 unit and fast-check property tests covering all Batch 3 capabilities:
    - Never progress with pain (property test across random inputs).
    - Never progress with exposure < 2.
    - Pure determinism: identical inputs yield identical outputs.
    - Golden tests for each progression outcome (insufficient_data, regress, deload, progress, maintain).
    - Stagnation diagnostic triggers after exactly 3 non-progress reviews.
    - Hysteresis property test: perturbations below threshold never trigger replacement.
    - Material change boundary conditions (exactly 10%, just below 10%, each trigger alone).
    - Exposure fractional calculation, 0 coverage_weight filtering, trailing window boundaries, trend detection.
    - Knowledge ledger immutability, inference rejection persistence, freshness policies, and question budget enforcement.

---

## 2. Verification Results

- `npm run lint`: Passed with 0 errors.
- `npm run typecheck`: Passed with 0 errors across workspace root and strict `engine-core` `tsconfig.json`.
- `npm test`: Passed with 0 errors (11 test files, 96 tests passed).
- `npm run build`: Production build succeeded.

---

## 3. Deviations
- None. All requirements of Part 1 (Rule 10 hardening) and Part 2 (M0-09, M0-10, M0-11, M0-12) were strictly implemented and verified.

---

## 4. Conflicts with the Brief
- None identified.

---

## 5. Open Issues
- None. Engine progression, ranking, exposure tracking, and knowledge ledger are complete and ready for Milestone 0 Batch 4.
