# Batch 2 Completion Report (M0-05, M0-06, M0-07, M0-08)

**Project:** Home Fitness OS  
**Status:** Part 1 (Small Fixes) and Part 2 (M0-05, M0-06, M0-07, M0-08) completed and fully verified.  
**Verification:** `npm ci && npm run lint && npm run typecheck && npm test && npm run build` passed with 0 errors across 10 test files and 71 unit and property tests.

---

## 1. Files Created & Modified

### Part 1: Small Fixes
- `apps/web/src/App.tsx`: Drastically simplified to dark background, title "Home Fitness OS", subtitle "Milestone 0 - engine foundation", and a small "Engine ready" status pill rendered when `getEffectiveConfig()` succeeds.
- `package.json`: Updated `"typecheck"` script to execute both `tsc --noEmit` AND `tsc --noEmit -p packages/engine-core/tsconfig.json`.
- `.github/workflows/ci.yml`: Added step "Build" (`npm run build`) following the "Test" step.
- `packages/contracts/src/index.ts`: Updated `ChangeRequestSchema.target_day_index` to allow `0..7` to accommodate flexible horizons up to 8 days.

### Part 2: Batch 2 Milestones
- **Contracts (`packages/contracts/src/index.ts`, `contracts.test.ts`)**:
  - `EquipmentIdEnum`: Expanded to include `bodyweight`, `floor`, `wall`, `chair`, `loaded_backpack`, `towel`, `table`, `stairs`, `door`, `dumbbells`, `resistance_band`, `pull_up_bar`, `bands`, `dip_bars`, `bench`, `parallettes`.
  - `ExerciseSchema`: Replaced `muscles` with `primary_muscles` (min 1) and `secondary_muscles` (default `[]`). Added `unilateral` (boolean) and `coverage_weight` (0..1, default 1).
- **Library (`packages/library/src/index.ts`, `packages/library/src/__tests__/library.test.ts`)**:
  - Implemented 51 bodyweight & home equipment exercises across all movement patterns (levels 1–7) with progression and regression links, equipment requirements, safety flags, and exercise types.
  - Exported `LIBRARY_LIMITATIONS` with `vertical_pull: "no equipment-free vertical pull available"`.
  - Implemented `validateLibrary(library)` enforcing unique IDs, valid progression/regression links, strictly increasing progression levels (`target.level > source.level`), cycle detection, equipment validity, and pattern coverage/limitations.
  - Validated the real library with zero errors in automated tests.
- **Config Settings (`packages/config/src/index.ts`, `config.test.ts`)**:
  - Added versioned settings for Batch 2:
    - `items_requiring_validation`: `['table', 'door', 'stairs', 'chair', 'loaded_backpack', 'wall']`
    - `min_hours_between_hard_same_pattern`: 36
    - `weekly_sets_cap_per_muscle`: 16
    - `session_hard_sets_cap`: 24
    - `max_session_minutes`: 60
    - `warmup_minutes`: 6, `cooldown_minutes`: 6, `default_work_seconds`: 40
    - Rest windows by emphasis: strength (150s), hypertrophy (75s), endurance (40s)
- **Engine Core Environment & Eligibility (`packages/engine-core/src/environment.ts`)**:
  - Implemented pure state machine transitions `unknown -> declared -> validated(date) -> retired` via `transitionEnvironmentItem` with invalid transition rejection.
  - Implemented `isEligible(exercise, environment, itemsRequiringValidation)`:
    - `bodyweight` and `floor` are always available.
    - Items requiring validation must be validated (wall required only for exercises with `fall_risk`).
    - Evaluates `all` and `any` equipment expressions.
  - Implemented `coverageByPattern(library, environment)` returning pattern counts and active limitations.
- **Engine Core Validator Pipeline & PlanStore (`packages/engine-core/src/validator.ts`)**:
  - Implemented multi-stage pure validation pipeline `validateChange`:
    `schema -> environment -> safety -> recovery_spacing -> volume -> duration -> goal_alignment`.
  - Goal alignment only warns (never rejects).
  - Main sessions under 30 minutes are always rejected.
  - Implemented `findNearestAlternative` for `replace_exercise` (same pattern, level within ±1, deterministic ordering by level distance then alphabetical ID).
  - Implemented `PlanStore.applyChange`: Re-validates before writing, never mutates inputs, returns immutable updated plan or rejection result.
- **Engine Core Session Generator & Duration Calculator (`packages/engine-core/src/session.ts`)**:
  - Pure deterministic PRNG (`createDeterministicPrng`) using FNV/Murmur hash and Mulberry32 (no `Math.random()`, no `Date.now()`).
  - Implemented `estimateDuration`: `warmup + sum(sets * (work + rest)) + transitions + mobility + cooldown`.
  - Implemented `generateSession`: Selects exercises for training units A, B, C, D; dynamic rest by goal emphasis; scales content (mobility first, then priority muscle sets) to guarantee main session duration ≥ 30 min while respecting `max_session_minutes` (60) and `session_hard_sets_cap` (24).
- **Engine Core Test Suite (`packages/engine-core/src/__tests__/engine-core.test.ts`)**:
  - Added 21 tests covering environment transitions, eligibility, Mock User environment zero `vertical_pull` coverage, validator stages, `fast-check` property tests on `PlanStore` immutability, deterministic session snapshots, and duration/cap conformance across 100 generated capability maps.

---

## 2. Decisions Made
1. **Deterministic PRNG:** Built a self-contained Mulberry32 PRNG initialized from seed strings, completely eliminating non-deterministic APIs while ensuring reproducibility.
2. **Dynamic Duration Padding:** When generated sessions fall below the 30-minute threshold, extra content is padded in strictly specified order: first a mobility block (prioritizing hip mobility), then additional sets for high-priority muscles within hard caps. No arbitrary filler exercises are added.
3. **Immutability in PlanStore:** `PlanStore.applyChange` performs deep cloning after validation, ensuring that callers cannot experience shared mutable state regressions.
4. **Isolated Engine-Core Typecheck:** Configured root `"typecheck"` to explicitly trigger isolated compilation with engine-core's custom `tsconfig.json` (`lib: ["ES2022"]`, `types: []`), guaranteeing that DOM and Node APIs are completely barred from the core engine.

---

## 3. Deviations
- None. All requirements of M0-05 through M0-08 and Part 1 fixes were followed strictly.

---

## 4. Conflicts with the Brief
- None identified.

---

## 5. Open Issues
- None for Batch 2. Core engine, validator, library, environment state machine, and session generator are verified and ready for Milestone 0 Batch 3.
