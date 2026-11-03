# Home Fitness OS — Project State Map

> Source of truth for repo structure, package exports, test coverage, and active settings keys.

---

## 1. File Tree of `apps/` and `packages/`

```text
apps/web/
├── package.json (32 lines)
├── tsconfig.json (8 lines)
└── src/
    ├── App.tsx (223 lines)
    ├── appearance.ts (139 lines)
    ├── bootstrap.ts (86 lines)
    ├── index.css (150 lines)
    ├── main.tsx (14 lines)
    ├── __tests__/
    │   ├── appearance.test.ts (125 lines)
    │   ├── i18n-compliance.test.ts (120 lines)
    │   ├── historyService.test.ts (249 lines)
    │   ├── historyWiring.test.ts (48 lines)
    │   ├── i18nArabicCoverage.test.ts (65 lines)
    │   ├── planService.test.ts (163 lines)
    │   ├── rtl.test.ts (129 lines)
    │   ├── sessionRunner.test.ts (330 lines)
    │   ├── sessionRunnerHardening.test.ts (433 lines)
    │   ├── supabaseEnv.test.ts (54 lines)
    │   ├── supabaseProbe.test.ts (91 lines)
    │   ├── supabaseWiring.test.ts (43 lines)
    │   ├── syncTransport.test.ts (173 lines)
    │   └── workoutRunnerScreen.test.ts (84 lines)
    ├── components/
    │   ├── Bar.tsx (54 lines)
    │   ├── BottomNav.tsx (86 lines)
    │   ├── Chip.tsx (59 lines)
    │   ├── ClayButton.tsx (54 lines)
    │   ├── ClayCard.tsx (27 lines)
    │   ├── CloudSyncCard.tsx (94 lines)
    │   ├── DayChip.tsx (77 lines)
    │   ├── EmptyState.tsx (48 lines)
    │   ├── IconSet.tsx (133 lines)
    │   ├── indicatorOffset.ts (23 lines)
    │   ├── LogoIntro.tsx (97 lines)
    │   ├── Ring.tsx (68 lines)
    │   ├── SectionHeader.tsx (34 lines)
    │   ├── StatTile.tsx (42 lines)
    │   └── UpdateBanner.tsx (63 lines)
    ├── engine/
    │   ├── engineContext.ts (86 lines)
    │   ├── historyService.ts (184 lines)
    │   ├── planService.ts (250 lines)
    │   └── sessionRunner.ts (669 lines)
    ├── i18n/
    │   └── index.ts (663 lines)
    ├── screens/
    │   ├── AppearanceLab.tsx (244 lines)
    │   ├── HomeScreen.tsx (394 lines)
    │   ├── MoreScreen.tsx (531 lines)
    │   ├── ProgressScreen.tsx (174 lines)
    │   ├── TrainScreen.tsx (428 lines)
    │   └── WorkoutRunnerScreen.tsx (1020 lines)
    ├── storage/
    │   ├── idb.ts (59 lines)
    │   ├── index.ts (4 lines)
    │   ├── IndexedDbEventLog.ts (111 lines)
    │   ├── KeyValueStore.ts (107 lines)
    │   └── __tests__/storage.test.ts (153 lines)
    ├── supabase/
    │   ├── env.ts (61 lines)
    │   ├── probe.ts (56 lines)
    │   └── syncTransport.ts (280 lines)
    └── styles/
        ├── clay.css (73 lines)
        └── tokens.css (93 lines)

packages/
├── config/src/
│   ├── index.ts (1261 lines)
│   └── __tests__/config.test.ts (235 lines)
├── contracts/src/
│   ├── index.ts (422 lines)
│   └── __tests__/contracts.test.ts (205 lines)
├── engine-core/src/
│   ├── ai-contract.ts (227 lines)
│   ├── environment.ts (222 lines)
│   ├── exposure.ts (140 lines)
│   ├── horizon.ts (840 lines)
│   ├── index.ts (26 lines)
│   ├── knowledge.ts (192 lines)
│   ├── progression.ts (304 lines)
│   ├── ranking.ts (278 lines)
│   ├── session.ts (320 lines)
│   ├── validator.ts (403 lines)
│   └── __tests__/
│       ├── engine-core.test.ts (1422 lines)
│       ├── engine-guard.test.ts (28 lines)
│       ├── engine-honesty-e1a.test.ts (350 lines)
│       ├── numeric-literals-guard.test.ts (121 lines)
│       └── smoke.test.ts (12 lines)
├── events/src/
│   ├── index.ts (431 lines)
│   └── __tests__/events.test.ts (180 lines)
├── library/src/
│   ├── index.ts (1039 lines)
│   └── __tests__/library.test.ts (120 lines)
├── ports/src/
│   ├── index.ts (75 lines)
│   └── __tests__/smoke.test.ts (15 lines)
└── sim/src/
    ├── index.ts (90 lines)
    └── __tests__/simulation.test.ts (85 lines)
```

---

## 2. Exported Functions & Components per Package / Screen

### Packages
- **`@hfos/contracts`**: Zod schemas & types for UUIDv7, events, movements, exercises, units, sessions, athlete states.
- **`@hfos/config`**: `getEffectiveConfig`, `requireNumber`, `requireBoolean`, `requireRange`, `requireArray`, `requireObject`, `validateSettingValue`, `DEFAULT_SETTINGS`.
- **`@hfos/events`**: `EventLog` interface, event type guards, schemas, event factory helpers, `reduce`, `replay`.
- **`@hfos/library`**: `INITIAL_EXERCISE_LIBRARY`, progression links, equipment requirements.
- **`@hfos/ports`**: Storage, analytics, clock, id-generator, schedule-provider, and service port interfaces.
- **`@hfos/sim`**: `MOCK_USER`, simulation athlete generator, deterministic mock runners.
- **`@hfos/engine-core`**: Deterministic pure-TS training engine: `buildHorizon`, `slideHorizon`, `deriveTrainingState`, `generateSession`, `evaluateProgression`, `validateWorkoutPlan`, `rankCandidates`.

### Web App (`apps/web`)
- **`App`**: Root orchestrator managing navigation, splash launch, engine plan bootstrap, active workout routing, and IndexedDB hydration.
- **`HomeScreen`**: 7-day horizon strip, Day 0 locked hero workout card, consistency ring, and "Why this session?" rationale sheet.
- **`WorkoutRunnerScreen`**: Full-screen active workout execution UI: phase tracking, isolated Rest countdown Ring, config-driven RPE selector, reps stepper, honest pain toggle, pause/abandon modal dialogs with focus management + Escape, wake lock with visibility re-acquisition, degraded-storage banner, haptics, WebAudio rest chime.
- **`TrainScreen`**: Segmented control switching between active 7-day plan blueprint with day inspector and searchable exercise library.
- **`ProgressScreen`**: Mastery score ring, rep target mastery, RPE effort tracking, and movement exposure window.
- **`MoreScreen`**: Grouped navigation for Settings, Appearance Lab, Equipment, Data, and System Diagnostics.
- **`AppearanceLab`**: Live preview with controls for accent presets, clay depth, corner radius, density, and haptics.
- **`CloudSyncCard`**: Honest cloud status card (More › About) — validates env config, probes the project's auth health endpoint once per mount, reports connected/unreachable/not-configured via i18n only.
- **`supabase/env` + `supabase/probe`**: env-driven config plumbing (`readSupabaseEnv`, degrades to typed `missing`/`invalid_url`, never throws) and injected-I/O liveness probe (`probeCloudConnection`); no supabase-js dependency yet (lands with auth in 4B/4C).
- **`PlanService`**: Manages `getOrCreatePlan`, horizon sliding, day decision summaries, generation benchmarking, and event logging.
- **`sessionRunner`**: Session runner state, `sessionReducer`, event emission (`session.started`, `session.set_logged`, `session.completed`, `session.abandoned`), dynamic rest computation with ceiling-clamped extensions, in-flight persistence.

---

## 3. Files Changed in this Task (Phase 4B/4D1 — Live Schema + Sync Data Layer)
- `supabase/migrations/20261103000000_p4d1_session_events_sync.sql` (new, 45 lines: append-only `session_events` cloud mirror of the EventEnvelope log — `idempotency_key` PK, user FK, payload jsonb, occurred_at indexes; RLS authoritative with user scoping **and** `device_session_valid()` gate; select+insert only for authenticated — no update/delete policies).
- `apps/web/src/supabase/syncTransport.ts` (new, 280 lines: `toSyncRow`/`envelopeFromSyncRow` mapping with defensive rehydration; `pushEvents` — batched POST with `resolution=ignore-duplicates,return=representation` for honest pushed/duplicates accounting; `pullEvents` — cursor pagination by `occurred_at`; injected fetch/clock/timeout, no supabase-js).
- `apps/web/src/__tests__/syncTransport.test.ts` (new, 7 tests: mapping round-trip incl. `supersedes_event_id`, malformed-row tolerance, batch chunking 25→3 chunks, duplicate accounting 3/22, auth+Prefer headers, pull pagination via short page, HTTP failure paths).
- `docs/REPORT_PHASE4D1.md`, `docs/STATE.md`.

### Previous: Files Changed in this Task (Phase 4A — Supabase Foundation Wiring)
- `.env.example` (placeholders for `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`; real values live only in the gitignored `.env` — publishable key is public by design, never the secret/service_role).
- `apps/web/src/supabase/env.ts` (new, 61 lines: `readSupabaseEnv` validates and origin-normalizes config from `import.meta.env`; degrades to typed `missing`/`invalid_url` results, never throws; plain http accepted on loopback only).
- `apps/web/src/supabase/probe.ts` (new, 56 lines: `probeCloudConnection` against the project's `/auth/v1/health` with injected fetch/clock/timeout; honest `online`/`latency_ms`/`http_status`).
- `apps/web/src/components/CloudSyncCard.tsx` (new, 94 lines: honest cloud status card — not configured / invalid config / checking / connected / unreachable; i18n-only copy; RTL-safe logical classes).
- `apps/web/src/screens/MoreScreen.tsx` (renders `<CloudSyncCard />` in the About diagnostics view).
- `apps/web/src/i18n/index.ts` (added 8 `sync.*` keys in both dicts; now 284/284 parity).
- `apps/web/src/__tests__/supabaseEnv.test.ts` (new, 4 tests), `supabaseProbe.test.ts` (new, 5 tests: success latency, trailing-slash normalization, 521 paused-project, network failure, timeout abort), `supabaseWiring.test.ts` (new, 3 source guards incl. `.env` gitignored and no hard-coded copy).
- `docs/REPORT_PHASE4A.md`, `docs/STATE.md`.

### Previous: Files Changed in (History Wiring — deferred item)
- `apps/web/src/engine/historyService.ts` (new, 184 lines: pure `buildHistorySummary` over injected envelopes + `loadHistorySummary` EventLog loader; window sizes from `@hfos/config`; pattern fallback via `@hfos/library`; defensive idempotency dedupe).
- `apps/web/src/__tests__/historyService.test.ts` (new, 9 behavioral tests: empty-log honesty, 7-day completion window, rep-target hits + average RPE, 14d pattern vs 7d muscle exposure, library pattern fallback, planned main sessions, idempotency dedupe, abandoned semantics, InMemoryEventLog round-trip).
- `apps/web/src/__tests__/historyWiring.test.ts` (new, 3 source guards: App wiring, non-estimate bars, i18n-only labels).
- `apps/web/src/screens/ProgressScreen.tsx` (real mastery ring = rep-target hit rate, real sets/RPE tiles, real pattern exposure bars with `estimate={false}`, conditional honest empty state; static mock values removed).
- `apps/web/src/screens/HomeScreen.tsx` (consistency ring fed by real counts with overflow clamp, i18n interpolation for consistency line, unit labels via i18n keys, mock session title removed).
- `apps/web/src/App.tsx` (loads history after plan, refreshes after session completion, passes summary to both screens).
- `packages/config/src/index.ts` (added `history_consistency_window_days` (7), `history_exposure_window_days` (14); consumer `history_service`).
- `packages/config/src/__tests__/config.test.ts` (history window settings test).
- `apps/web/src/i18n/index.ts` (added 10 `pattern.*` labels + `progress.tracked_locally` + `home.consistency_progress` + 4 unit keys, both dicts; now 268/268 parity).
- `docs/REPORT_HISTORY_WIRING.md`, `docs/STATE.md`.

### Previous: Files Changed in Phase 3
- `apps/web/src/i18n/index.ts` (added the 146 missing Arabic translations — arDict now covers all 252 enDict keys; declaration tightened from `Partial<typeof enDict>` to `Record<keyof typeof enDict, string>` so missing keys are a compile error).
- `apps/web/src/__tests__/i18nArabicCoverage.test.ts` (new, 65 lines: key parity, Arabic-script presence, `{placeholder}` parity, and `t()` resolving every key from arDict in Arabic mode).
- `apps/web/src/__tests__/rtl.test.ts` (added the permanent RTL audit guard: physical direction classes (`ml-/mr-/pl-/pr-/text-left/text-right/rounded-l/rounded-r/border-l/border-r/left-N/right-N`) and physical CSS box properties fail the suite).
- `apps/web/src/screens/HomeScreen.tsx` (`ml-1` → `ms-1`).
- `apps/web/src/screens/MoreScreen.tsx` (`text-left` → `text-start`, 5 occurrences).
- `apps/web/src/screens/TrainScreen.tsx` (`text-right` → `text-end`).
- `docs/REPORT_PHASE3.md`, `docs/STATE.md`.

### Previous: Files Changed in Phase 2C
- `packages/config/src/index.ts` (added `rpe_min`, `rpe_max`, `rpe_step` settings).
- `packages/config/src/__tests__/config.test.ts` (Phase 2C RPE scale settings test).
- `apps/web/src/engine/sessionRunner.ts` (EXTEND_REST ceiling clamp + no backward motion; `target_reps` added to `session.set_logged` payload; SKIP_SET-out-of-warmup fix so rest advances to the working exercise).
- `apps/web/src/screens/WorkoutRunnerScreen.tsx` (config-driven RPE scale via `buildRpeOptions`; visibilitychange wake-lock re-acquisition + stale-deadline re-sync; degraded-storage banner; modal focus management + Escape; aria-live phase chip).
- `apps/web/src/i18n/index.ts` (added `runner.degraded_banner`, `runner.degraded_dismiss` in both dicts).
- `apps/web/src/__tests__/sessionRunnerHardening.test.ts` (12 behavioral reducer tests).
- `apps/web/src/__tests__/workoutRunnerScreen.test.ts` (guard test 4 updated for config-driven RPE).
- `docs/REPORT_PHASE2C.md`, `docs/STATE.md`.

### Previous: Files Changed in Phase 2B
- `apps/web/src/screens/WorkoutRunnerScreen.tsx` (UI for workout session execution).
- `apps/web/src/screens/HomeScreen.tsx` (connected Day-0 card Start Workout to `onStartWorkout`).
- `apps/web/src/App.tsx` (wired `activeWorkoutDay`, restored in-flight workout, hidden navigation during session).
- `apps/web/src/i18n/index.ts` (added all `runner.*` keys in English and real Arabic).
- `apps/web/src/__tests__/workoutRunnerScreen.test.ts` (10 unit/guard tests verifying component contracts and props).
- `docs/REPORT_PHASE2B.md` (completion report for Phase 2B).
- `docs/STATE.md` (updated project state map, test totals, and file tree).

---

## 4. Test Counts per Package

Total: **28 test files, 215 tests passing**.
- `packages/engine-core`: 71 tests (engine-core: 59, engine-honesty-e1a: 9, engine-guard: 1, numeric-literals: 1, smoke: 1)
- `packages/contracts`: 21 tests
- `packages/config`: 16 tests
- `packages/events`: 7 tests
- `packages/library`: 9 tests (library: 7, smoke: 2)
- `packages/sim`: 4 tests (simulation: 1, smoke: 3)
- `packages/ports`: 1 test
- `apps/web`: 86 tests (sessionRunnerHardening: 12, historyService: 9, workoutRunnerScreen: 10, syncTransport: 7, supabaseProbe: 5, sessionRunner: 6, planService: 6, storage: 4, appearance: 5, supabaseEnv: 4, rtl: 7, i18nArabicCoverage: 4, historyWiring: 3, supabaseWiring: 3, i18n-compliance: 1)

---

## 5. Known Issues and TODOs
- **Done (Phase 3)**: Arabic dictionary is at 100% coverage (now 268/268 keys in both dicts) and a permanent RTL audit guard blocks physical direction classes/CSS.
- **Done (History Wiring)**: the deferred item is complete — ProgressScreen and HomeScreen now derive mastery, consistency, and exposure from the append-only session event log via `historyService`; static mock metrics were removed.
- **Done (Phase 4A)**: Supabase foundation wiring — env-driven config (`.env` gitignored; `.env.example` placeholders), `readSupabaseEnv` validation, `probeCloudConnection` auth-health probe, `CloudSyncCard` honest status (More › About).
- **Done (Phase 4B)**: M0-15 schema applied live by the owner via the SQL editor (`Success. No rows returned`); externally verified — `spike_data` anon access flipped from `404 PGRST205` (table missing) to `401 42501` (permission denied), exactly the revoked-privilege posture.
- **Done (4C verification)**: the `device-auth` edge function survived the pause — it responds `401 {"error":"missing_token"}` (its own contract error, not "Function not found"). No redeploy needed.
- **Done (Phase 4D1)**: sync data layer — `session_events` migration (append-only, user + device-session RLS) and `syncTransport` (batched idempotent push, cursor pull) with 7 tests. The new migration awaits the owner's SQL-editor run.
- **Phase 4D2 (Next)**: auth integration in the app — sign-in UI + device enroll/verify flow against the live `device-auth` function, then sync orchestration (push local log, pull remote) wired into App lifecycle.

---

## 6. Current Settings Keys (`@hfos/config`)
1. `execution_horizon_days` (default: 7)
2. `min_main_session_minutes` (default: 30)
3. `transition_seconds` (default: 15)
4. `rest_dynamic` (default: true)
5. `rest_floor_seconds` (default: 30)
6. `rest_ceiling_seconds` (default: 180)
7. `warmup_sets_default` (default: 1)
8. `cooldown_duration_minutes` (default: 5)
9. `target_rpe_default` (default: 7.5)
10. `rpe_min` (default: 6.0)
11. `rpe_max` (default: 9.5)
12. `rpe_step` (default: 0.5)
12a. `history_consistency_window_days` (default: 7)
12b. `history_exposure_window_days` (default: 14)
13. `readiness_checkin_weight` (default: 0.25)
14. `rank_weight_priority_need` (default: 1.0)
15. `rank_weight_stimulus_gap` (default: 1.0)
16. `rank_weight_progression_need` (default: 1.0)
17. `rank_weight_goal_weight` (default: 1.0)
18. `rank_weight_schedule_fit` (default: 1.0)
19. `rank_weight_readiness` (default: 1.0)
20. `stimulus_gap_no_history` (default: 1.0)
21. `progression_need_default` (default: 0.5)
22. `readiness_default` (default: 0.8)
23. `preferred_session_minutes` (default: 45)
24. `min_eligible_patterns_per_unit` (default: 2)
25. `unit_goal_weights` (object: strength/hypertrophy/endurance weights)
