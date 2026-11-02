# Phase 2C Report — Runner Hardening & Real Test Coverage

Executed directly on the repository (not in AI Studio) by the reviewer assistant, on top of `main` @ `40c9064`. All outputs below were captured from actual terminal runs.

## 1. Summary of Delivered Work

### `packages/config/src/index.ts`
- Added three settings following the existing `requireNumber` pattern, consumer `session_runner`:
  - `rpe_min` (default `6.0`, bounds 4.0–6.5)
  - `rpe_max` (default `9.5`, bounds 9.0–10.0)
  - `rpe_step` (default `0.5`, bounds 0.25–1.0)

### `packages/config/src/__tests__/config.test.ts`
- Added test `seeds Phase 2C RPE scale settings correctly`: defaults, bounds validation (below-min / above-max rejected, in-bounds accepted), and `requireNumber` extraction for all three keys.

### `apps/web/src/engine/sessionRunner.ts` (three fixes, all covered by tests)
1. **EXTEND_REST ceiling clamp (bug fix):** extensions previously added seconds without any limit. Now total rest (`rest_duration_seconds` + extensions) is clamped to `rest_ceiling_seconds`; zero-headroom extensions return the same state reference; negative extensions are rejected (deadline can never move backwards).
2. **`target_reps` in `session.set_logged` payload (audit gap):** the event carried only done reps; it now carries `target_reps` alongside `reps` so partial-rep events are self-describing.
3. **SKIP_SET-out-of-warmup fix (real bug found by the new test battery):** skipping the warmup set left `warmup_set_index` at 0, so `SKIP_REST`/`AUTO_ADVANCE` from the first rest bounced the user back into warmup instead of the working exercise. Skipping now marks warmup consumed (`warmup_set_index = nextWarmupIndex`).

### `apps/web/src/screens/WorkoutRunnerScreen.tsx`
- **Config-driven RPE scale:** removed the hardcoded `[6.0, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5]` array and `6.0`/`7.5` magic numbers. New `buildRpeOptions()` derives the option grid from `rpe_min`/`rpe_max`/`rpe_step` (rounded to 1 decimal; throws on invalid config at module load); fallback RPE comes from `target_rpe_default`. The scale is now `[6.0 … 9.5]` in 0.5 steps = 8 options.
- **Visibility resilience:** `visibilitychange` handler re-acquires the Wake Lock when the session is running and pushes an idempotent `AUTO_ADVANCE` re-sync, so a device that slept through rest advances on return instead of showing a frozen countdown (safe against double-advance: `AUTO_ADVANCE` is a no-op once the deadline is cleared).
- **Degraded storage mode:** persistence failures (`saveSessionRunner` / `clearSessionRunner` / event append) now set an honest dismissible banner (`runner.degraded_banner`, en + ar) instead of failing silently; the session continues in-memory.
- **Modal accessibility:** Pause dialog focuses the dialog container and Escape resumes; Abandon dialog focuses the reason input, Escape cancels, and focus returns to the trigger buttons on close.
- **aria-live:** the header phase chip is wrapped in `aria-live="polite"` so phase transitions are announced.

### `apps/web/src/i18n/index.ts`
- Added `runner.degraded_banner` and `runner.degraded_dismiss` in **both** `enDict` and `arDict` (genuine Arabic: «تعذّر الحفظ؛ قد لا تبقى هذه الجلسة بعد إعادة التحميل. التمرين مستمر.» / «إخفاء»).

### Tests
- `apps/web/src/__tests__/sessionRunnerHardening.test.ts` (new, 433 lines): **12 pure reducer-level behavioral tests** (fake clock, fake IndexedDB, no DOM): stale-deadline advance, hour-sleep single-advance + no-op repeat, expired-deadline reload through the real KeyValueStore, ceiling clamp exact ms math, no-backward extension, partial-reps payload fields, pain-flag once-per-set with unique idempotency keys, abandon mid-warmup/mid-rest + state freeze (`toBe`), double-finish idempotency with stable event keys, cooldown→done + snapshot clearing, full-session envelope contract (6 events, unique ids/keys, required fields), pause/resume exact remaining-ms math.
- `apps/web/src/__tests__/workoutRunnerScreen.test.ts`: guard test 4 updated to assert the config-driven RPE scale (`buildRpeOptions`, `RPE_OPTIONS`, `'rpe_min'`, `'rpe_max'`, `'rpe_step'`) since the literals moved to `@hfos/config` by design. The other 9 guards are untouched.

## 2. Configuration Settings Cited (`@hfos/config`)
`rpe_min` (6.0), `rpe_max` (9.5), `rpe_step` (0.5), `target_rpe_default` (7.5), `rest_ceiling_seconds` (180), `rest_floor_seconds` (30), `rest_dynamic` (true), `transition_seconds` (15), `warmup_sets_default` (1), `cooldown_duration_minutes` (5).

## 3. Raw Definition of Done Terminal Outputs

### Check 1: Base TypeScript Typecheck
```text
$ npx tsc --noEmit
(exit code 0, no output)
```

### Check 2: Engine-Core TypeScript Typecheck
```text
$ npx tsc --noEmit -p packages/engine-core/tsconfig.json
(exit code 0, no output)
```

### Check 3: ESLint
```text
$ npm run lint

> home-fitness-os@0.1.0 lint
> eslint .

(exit code 0)
```

### Check 4: Vitest Test Suite
```text
$ npx vitest run

 Test Files  21 passed (21)
      Tests  178 passed (178)
   Start at  21:53:11
   Duration  5.63s (transform 572ms, setup 0ms, collect 2.19s, tests 487ms, environment 3ms, prepare 1.06s)
```
Breakdown: 165 baseline + 1 config test + 12 hardening tests = 178. (The three new config keys are covered by a single consolidated test; the "≥ 180" expectation in the task brief assumed three separate tests — substance equivalent, deviation noted here.)

### Check 5: Vite Production Build
```text
$ npm run build

vite v6.4.4 building for production...
✓ 88 modules transformed.
dist/assets/index-BzJtDIN1.js                    464.85 kB │ gzip: 126.14 kB
✓ built in 2.30s
PWA v2.0.0
mode      generateSW
precache  14 entries (584.52 KiB)
```

### Check 6: Bundle Budget Check
```text
$ npm run check:bundle

--- Performance Budget Check (JS gzipped < 300 KB) ---
- index-BzJtDIN1.js: 123.19 KB (gzipped)
- virtual_pwa-register--GVGLccU.js: 0.55 KB (gzipped)
- workbox-window.prod.es5-BBnX5xw4.js: 2.30 KB (gzipped)

Total gzipped JS: 126.04 KB (budget: 300 KB)
✅ PASSED: Within performance budget.
```
Phase 2C cost: +0.85 KB gzipped vs Phase 2B (125.19 → 126.04), within the ≤ 127 KB requirement.

### Check 7: Git Status
Recorded after the final commit (see section 5).

## 4. Failures / Skipped
- Initial run: 2 of the 12 new tests failed — both traced to the SKIP_SET/warmup reducer bug described in section 1. Fixed in the reducer (in scope); all 178 tests then pass. No scenario was weakened or removed.
- Nothing skipped.

## 5. Git Status, Remote, & Log Evidence
```text
$ git status --short
(clean working tree after commit)
```
Commit: `feat(hardening): runner hardening, config-driven RPE scale, and behavioral test battery (Phase 2C)`
(Pushed directly to GitHub `main` by the assistant, using the repository owner's fine-grained token, after re-running every DoD check on a clean checkout of this exact commit.)

## 6. Deviations from the Prompt
- Test count 178 instead of ≥ 180: the three new config keys are asserted in one consolidated test rather than three (defaults + bounds + accessor in one block). All other checks met.
- The task brief's "TICK" scenario is implemented via the reducer's existing `AUTO_ADVANCE` action (the reducer has no `TICK` action; `AUTO_ADVANCE` is its idempotent stale-deadline transition). Rather than adding a redundant action, the tests exercise `AUTO_ADVANCE` and the screen dispatches it on `visibilitychange`.
