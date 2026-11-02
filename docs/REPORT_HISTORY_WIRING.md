# Report — History Wiring: ProgressScreen & HomeScreen From Logged Session Events

Executed directly on the repository by the reviewer assistant, on top of `main` @ `07330ef` (Phase 3). Scope: the "Deferred" item from `docs/STATE.md` §5 — "ProgressScreen & HomeScreen history wiring from logged session events". Phase 4 (Supabase sync) remains gated. All outputs below are from actual terminal runs in this session.

## 1. Summary of Delivered Work

### `apps/web/src/engine/historyService.ts` (new)
Pure derivation layer over the append-only event log:
- `buildHistorySummary(events, plan, nowMs, config)` — no DOM, no wall clock (nowMs injected), windows from `@hfos/config`:
  - `history_consistency_window_days` (7) → `completed_sessions_in_window` (`session.completed`) and `muscle_exposure` (one count per primary muscle, resolved through `@hfos/library`).
  - `history_exposure_window_days` (14) → `sets_total` / `sets_hit` (`reps >= target_reps`), `rep_target_hit_rate`, `avg_rpe`, and `pattern_exposure` (payload `pattern`, with library fallback for events that omit it).
  - `planned_main_sessions` from `plan.days.filter(kind === 'main')`.
- Defensive idempotency dedupe (duplicate `idempotency_key` never double-counts); `session.abandoned` marks `has_session_data` honestly without counting as completion; zero `any` (payload access through typed `asNumber`/`asString` guards on `Record<string, unknown>`).
- `loadHistorySummary(eventLog, plan, …)` async wrapper over the `EventLog` port.

### `apps/web/src/screens/ProgressScreen.tsx` (real data replaces static mocks)
- Mastery ring now = rep-target hit rate; label under it is honest (`progress.tracked_locally`), not the fake "Level 3 baseline".
- Tiles: real `{sets_hit} / {sets_total}` and real average RPE (`--` when absent).
- Pattern exposure bars: real counts sorted descending, relative to the max pattern, `estimate={false}` (the "est." chip is gone — these are measured values), window badge echoes the actual configured days.
- The "Collecting data" cards render **only** when the log has no session data; static fake bars (85/60/70/20/50/40 with hard-coded English labels) are gone — pattern names come from new `pattern.*` i18n keys.

### `apps/web/src/screens/HomeScreen.tsx`
- Consistency ring fed with real counts (`completedWorkoutsCount = history.completed_sessions_in_window`, `totalPlannedCount = history.planned_main_sessions`), overflow-clamped ring progress, and the caption rendered through new interpolated key `home.consistency_progress` ("{done} of {total} sessions done" — English literal removed).
- Exposure card sublabels use `home.sets_unit` instead of hard-coded "sets".
- Bonus i18n leaks fixed in the same file: hard-coded `Upper push (Unit A)` template → `t('home.session_title')`; "exercises"/"working sets"/duration "min" split-hack → new unit keys (`home.exercises_count_unit`, `home.working_sets_unit`, `home.duration_unit`).

### `apps/web/src/App.tsx`
- Loads the summary after the plan (`await loadPlan(); loadHistory();`) using a `planRef` mirror, passes `completedWorkoutsCount` / `totalPlannedCount` / `muscleExposure` to `HomeScreen` and `history` to `ProgressScreen`, and refreshes history in `onSessionComplete` so the UI never shows stale values after finishing a workout.

### `packages/config` & i18n
- Two new versioned settings per AGENTS rule 10 (`history_consistency_window_days` 7, bounds 5–14; `history_exposure_window_days` 14, bounds 7–28; consumer `history_service`) + config test.
- 16 new keys in **both** dicts (10 `pattern.*` labels, `progress.tracked_locally`, `home.consistency_progress`, 4 unit keys) — dictionary parity now **268/268**, verified by the Phase 3 coverage tests unchanged.

## 2. Configuration Settings Cited (`@hfos/config`)
`history_consistency_window_days` (7), `history_exposure_window_days` (14); existing keys untouched.

## 3. Raw DoD Terminal Outputs

### Check 1+2: TypeScript Typecheck
```text
$ npm run typecheck
> tsc --noEmit && tsc --noEmit -p packages/engine-core/tsconfig.json
(exit code 0, no output)
```

### Check 3: ESLint
```text
$ npm run lint
> eslint .
(exit code 0)
```
(One intermediate failure — an unused `HOUR_MS` constant in the new test file — was caught by lint and fixed before commit.)

### Check 4: Vitest
```text
$ npx vitest run

 Test Files  24 passed (24)
      Tests  196 passed (196)
```
Breakdown: 183 baseline + 9 historyService + 3 historyWiring + 1 config history-window test = 196.

### Check 5: Vite Production Build
```text
$ npm run build
✓ built (exit code 0)
PWA v2.0.0
mode      generateSW
precache  14 entries (597.90 KiB)
```

### Check 6: Bundle Budget Check
```text
$ npm run check:bundle
--- Performance Budget Check (JS gzipped < 300 KB) ---
- index-BXlVIPKZ.js: 126.80 KB (gzipped)
- virtual_pwa-register-B2Z6CE7Q.js: 0.55 KB (gzipped)
- workbox-window.prod.es5-BBnX5xw4.js: 2.30 KB (gzipped)
Total gzipped JS: 129.65 KB (budget: 300 KB)
✅ PASSED: Within performance budget.
```
History-wiring cost: +1.45 KB gzipped vs Phase 3 (128.20 → 129.65).

### Check 7: Git Status
```text
$ git status --short
(clean working tree after commit — see section 5)
```

## 4. Failures / Skipped
- Nothing skipped. Lint caught one unused constant in the new test file (fixed); everything else passed on first integrated run.
- Known remaining English leaks outside this task's scope (documented, not hidden): `TrainScreen` set-count strings (`{setsCount} sets`, rest/transition `s` units) and the `Mon…Sun` day-name array on `HomeScreen`'s horizon strip (needs an Intl-based fix, touch-sensitive layout). Both are candidates for a follow-up polish task.

## 5. Git Status, Remote, & Log Evidence
```text
$ git status --short
(clean working tree after commit)
```
Commit: `feat(history): derive Progress/Home history from the session event log (deferred item)`
(Pushed directly to GitHub `main` by the assistant, using the repository owner's fine-grained token, after re-running every DoD check on this exact commit.)

## 6. Deviations / Judgment Calls
- Metrics semantics: mastery is presented as the rep-target hit rate over the trailing exposure window — an honest, event-derived measure; the engine's own progression scoring remains untouched (that belongs to `@hfos/engine-core`, not to a UI derivation).
- `reviews due` chip stays "0": progression review scheduling is not wired yet and inventing a count would be dishonest.
- Day names on the horizon strip remain English-only for now (see section 4).
