# Home Fitness OS — Project State Map

> Source of truth for repo structure, package exports, test coverage, and active settings keys.

---

## 1. File Tree of `apps/` and `packages/`

```text
apps/web/
├── package.json (32 lines)
├── tsconfig.json (8 lines)
└── src/
    ├── App.tsx (157 lines)
    ├── appearance.ts (139 lines)
    ├── bootstrap.ts (86 lines)
    ├── index.css (150 lines)
    ├── main.tsx (14 lines)
    ├── __tests__/
    │   ├── appearance.test.ts (125 lines)
    │   ├── i18n-compliance.test.ts (120 lines)
    │   ├── planService.test.ts (163 lines)
    │   ├── rtl.test.ts (80 lines)
    │   └── sessionRunner.test.ts (330 lines)
    ├── components/
    │   ├── Bar.tsx (54 lines)
    │   ├── BottomNav.tsx (86 lines)
    │   ├── Chip.tsx (59 lines)
    │   ├── ClayButton.tsx (54 lines)
    │   ├── ClayCard.tsx (27 lines)
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
    │   ├── planService.ts (250 lines)
    │   └── sessionRunner.ts (450 lines)
    ├── i18n/
    │   └── index.ts (346 lines)
    ├── screens/
    │   ├── AppearanceLab.tsx (244 lines)
    │   ├── HomeScreen.tsx (414 lines)
    │   ├── MoreScreen.tsx (528 lines)
    │   ├── ProgressScreen.tsx (96 lines)
    │   └── TrainScreen.tsx (428 lines)
    ├── storage/
    │   ├── idb.ts (59 lines)
    │   ├── index.ts (4 lines)
    │   ├── IndexedDbEventLog.ts (111 lines)
    │   ├── KeyValueStore.ts (107 lines)
    │   └── __tests__/storage.test.ts (153 lines)
    └── styles/
        ├── clay.css (73 lines)
        └── tokens.css (93 lines)

packages/
├── config/src/
│   ├── index.ts (1228 lines)
│   └── __tests__/config.test.ts (215 lines)
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
- **`App`**: Root orchestrator managing navigation, splash launch, engine plan bootstrap, and IndexedDB hydration.
- **`HomeScreen`**: 7-day horizon strip, Day 0 locked hero workout card, consistency ring, and "Why this session?" rationale sheet.
- **`TrainScreen`**: Segmented control switching between active 7-day plan blueprint with day inspector and searchable exercise library.
- **`ProgressScreen`**: Mastery score ring, rep target mastery, RPE effort tracking, and movement exposure window.
- **`MoreScreen`**: Grouped navigation for Settings, Appearance Lab, Equipment, Data, and System Diagnostics.
- **`AppearanceLab`**: Live preview with controls for accent presets, clay depth, corner radius, density, and haptics.
- **`PlanService`**: Manages `getOrCreatePlan`, horizon sliding, day decision summaries, generation benchmarking, and event logging.
- **`sessionRunner`**: Session runner state, `sessionReducer`, event emission (`session.started`, `session.set_logged`, `session.completed`, `session.abandoned`), dynamic rest computation, in-flight persistence.

---

## 3. Files Changed in this Task (Phase 2A)
- `apps/web/src/engine/sessionRunner.ts` (session runner core logic, pure reducer, event generator, persistence).
- `apps/web/src/__tests__/sessionRunner.test.ts` (unit tests with fake clock, warmup/cooldown, rest auto-advance, reload, abandon, pain).
- `packages/config/src/index.ts` (added `requireBoolean` accessor; added `warmup_sets_default`, `cooldown_duration_minutes`, `rest_floor_seconds`, `rest_ceiling_seconds`, `target_rpe_default`).
- `packages/config/src/__tests__/config.test.ts` (added tests for Phase 2A settings and `requireBoolean`).
- `docs/REPORT_PHASE2A.md` (completion report for Phase 2A).
- `docs/STATE.md` (updated project state map, test totals, and file tree).

---

## 4. Test Counts per Package

Total: **19 test files, 155 tests passing**.
- `packages/engine-core`: 71 tests (engine-core: 59, engine-honesty-e1a: 9, engine-guard: 1, numeric-literals: 1, smoke: 1)
- `packages/contracts`: 21 tests
- `packages/config`: 14 tests
- `packages/events`: 7 tests
- `packages/library`: 9 tests (library: 7, smoke: 2)
- `packages/sim`: 4 tests (simulation: 1, smoke: 3)
- `packages/ports`: 1 test
- `apps/web`: 28 tests (sessionRunner: 6, planService: 6, storage: 4, appearance: 5, rtl: 6, i18n-compliance: 1)

---

## 5. Known Issues and TODOs
- **Phase 2B (Next)**: `WorkoutRunnerScreen.tsx` UI — connected to Day-0 card, clay design system, Redmi 12 / 360dp touch targets, countdown ring, RPE picker, pain toggle, haptics & wake lock integration, i18n keys (en + real Arabic).
- **Phase 2C**: Runner hardening, mid-rest reload recovery in UI, idempotency, ProgressScreen & HomeScreen history wiring.
- **Phase 3**: Complete Arabic (100% dictionary coverage) + RTL audit.
- **Phase 4**: Supabase sync (Gated).

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
10. `readiness_checkin_weight` (default: 0.25)
11. `rank_weight_priority_need` (default: 1.0)
12. `rank_weight_stimulus_gap` (default: 1.0)
13. `rank_weight_progression_need` (default: 1.0)
14. `rank_weight_goal_weight` (default: 1.0)
15. `rank_weight_schedule_fit` (default: 1.0)
16. `rank_weight_readiness` (default: 1.0)
17. `stimulus_gap_no_history` (default: 1.0)
18. `progression_need_default` (default: 0.5)
19. `readiness_default` (default: 0.8)
20. `preferred_session_minutes` (default: 45)
21. `min_eligible_patterns_per_unit` (default: 2)
22. `unit_goal_weights` (object: strength/hypertrophy/endurance weights)
