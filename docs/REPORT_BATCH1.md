# Batch 1 Completion Report (M0-01 to M0-04)

**Project:** Home Fitness OS  
**Status:** All tasks in Batch 1 (M0-01, M0-02, M0-03, M0-04) completed and verified.  
**Verification:** `npm ci && npm run lint && npm run typecheck && npm test` passed with 0 errors across 43 unit and property tests.

---

## 1. Files Created & Modified

### Project Governance & Documentation
- `docs/PROJECT_BRIEF.md`: Verbatim copy of the project brief (source of truth).
- `AGENTS.md`: Root document containing section 3 (HARD RULES) plus pointer to `docs/PROJECT_BRIEF.md`.
- `README.md`: Overview of the monorepo, packages, hard rules, and development scripts.
- `.editorconfig`: Coding standards (2 spaces, LF line endings, utf-8).
- `.github/workflows/ci.yml`: GitHub Actions quality job (`npm ci`, `lint`, `typecheck`, `test` on Node LTS).

### Monorepo Scaffold & Tooling (M0-01)
- `package.json`: Root monorepo configuration with npm workspaces (`packages/*`, `apps/*`), strict dev dependencies, and verification scripts (`lint`, `typecheck`, `test`, `build`, `dev`).
- `package-lock.json`: Lockfile generated and validated for `npm ci`.
- `tsconfig.base.json`: Base TypeScript configuration (`strict: true`, `target: ES2022`, `noUncheckedIndexedAccess: true`, module resolution `bundler`).
- `tsconfig.json`: Root TypeScript configuration extending base.
- `eslint.config.js`: ESLint flat config with `typescript-eslint`, strictly prohibiting `any`, and configuring the engine-core guard.
- `vitest.config.ts`: Vitest configuration with workspace aliases.

### Packages
- **`packages/ports`** (M0-04):
  - `package.json`, `tsconfig.json`, `src/index.ts`, `src/__tests__/smoke.test.ts`
  - Defines `Clock` and `IdGenerator` interfaces.
- **`packages/contracts`** (M0-02):
  - `package.json`, `tsconfig.json`, `src/index.ts`, `src/__tests__/contracts.test.ts`
  - Enums: `MovementPattern`, `MuscleGroup`, `EquipmentId`, `ExerciseType`, `DayKind`, `SessionKind`, `ChangeCommand`, `ValidationStatus`, `AutonomyLevel`, `FactSource`.
  - UUID v7 regex format validator.
  - Zod Schemas requiring `schema_version`: `Exercise`, `EquipmentRequirement` (all/any expression), `EnvironmentItemState`, `SetPrescription`, `PrescriptionSnapshot`, `PlanDay`, `Plan`, `ChangeRequest`, `ChangeProposal`, `KnowledgeFact`, `InformationNeed`, `DecisionRecord`, `SettingDefinition`.
  - Inferred TypeScript types and comprehensive round-trip / rejection test suite.
- **`packages/config`** (M0-03):
  - `package.json`, `tsconfig.json`, `src/index.ts`, `src/__tests__/config.test.ts`
  - Settings registry API: `registerSettings`, `validateSettingValue`, `getEffectiveConfig`, `validateRankWeights`.
  - Section 5 defaults seeded (`execution_horizon_days: 7`, `min_main_session_minutes: 30` safety-locked, `transition_seconds: 15`, `rest_dynamic: true`, `hysteresis_threshold: 0.10`, material change thresholds, the six rank weights summing to 1.00, progression review cadence, and `day_start_hour: 4`).
  - Unit tests verifying orphan rejection, safety-locked protection, bounds enforcement, and rank weights summation.
- **`packages/events`** (M0-04):
  - `package.json`, `tsconfig.json`, `src/index.ts`, `src/__tests__/events.test.ts`
  - `EventEnvelope` with UUID v7 `event_id`, `type`, `occurred_at`, `device_id`, `idempotency_key`, `schema_version`, `payload`, `supersedes_event_id`.
  - All 23 domain event types supported.
  - `InMemoryEventLog` with deduplication on duplicate `idempotency_key` and deterministic ordering by `occurred_at` then `event_id`.
  - Pure reducer `reduce` and `replay` engine.
  - Property tests via `fast-check` (deterministic replay equality, duplicate invariance, and non-destructive correction supersede).
- **`packages/engine-core`** (M0-01):
  - `package.json`, `tsconfig.json`, `src/index.ts`, `src/__tests__/smoke.test.ts`, `src/__tests__/engine-guard.test.ts`
  - Deterministic candidate ranking and material change detection.
  - Dual guard: ESLint import/global restrictions and Vitest file scanning test verifying zero references to `fs`, `path`, `node:`, `window`, `document`, `fetch`, `localStorage`, `indexedDB`.
- **`packages/library`** (M0-01):
  - `package.json`, `tsconfig.json`, `src/index.ts`, `src/__tests__/smoke.test.ts`
  - Initial bodyweight exercise library data fixtures.
- **`packages/sim`** (M0-01):
  - `package.json`, `tsconfig.json`, `src/index.ts`, `src/__tests__/smoke.test.ts`
  - `MockUser` profile (no real personal data), `MockClock`, and `MockIdGenerator`.

### Web Client App (`apps/web` & root entry points)
- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/index.css`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`.
- Minimal Vite + React + TypeScript placeholder page with dark background, target phone metadata (Redmi 12), package inventory, and live config inspection from `@hfos/config`.
- Root `metadata.json`, `index.html`, `src/App.tsx`, and `vite.config.ts` synchronized for development and build verification.

---

## 2. Decisions Made
1. **Monorepo Package Resolution:** Used npm workspaces standard `"@hfos/*": "*"` in package manifests to ensure complete compatibility with npm 10.x.
2. **UUID v7 Strict Validation:** Implemented regex `/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` validating the 8-4-4-4-12 pattern, version digit `7`, and variant bits `[89ab]`.
3. **Engine-Core Guard Implementation:** Created both ESLint restrictions (`no-restricted-imports`, `no-restricted-globals`) and a filesystem-level Vitest test scanning all non-test files under `packages/engine-core/src` to guarantee pure deterministic execution.
4. **Correction Handling:** Event history remains strictly append-only. Corrections reference target events via `supersedes_event_id`, and `replay()` bypasses the state mutation of superseded events while preserving their historical record.
5. **Property-Based Testing:** Tested event reduction invariants using `fast-check` with generated event streams to verify idempotency and determinism.

---

## 3. Deviations
- **Server Dependencies:** Removed template boilerplate server dependencies (`express`, `@google/genai`, `dotenv`) from the initial repo scaffold to strictly conform to Hard Rule 1 ("Static client PWA: React + Vite + TypeScript. NO Firebase. NO Node/Express server").
- **TypeScript Version:** Standardized TypeScript to `~5.7.3` because `typescript-eslint` 8.x requires TypeScript `<6.1.0`.
- **tailwindcss & @types/node:** Maintained `tailwindcss` and `@types/node` in root devDependencies to facilitate styling in `apps/web` and execution in node-based test/build tooling.
- **Root Entry Shim:** Added root entry files (`index.html`, `src/App.tsx`, `src/main.tsx`, `vite.config.ts`) as development shims delegating to `apps/web` to ensure compatibility with single-directory container runners while keeping `apps/web/vite.config.ts` as canonical.
- **Provisional Engine & Library Code:** Provided initial pure implementations (`rankCandidates`, `isMaterialChange`, `verifyPlanIntegrity` in `packages/engine-core`, and `INITIAL_EXERCISE_LIBRARY` in `packages/library`) explicitly marked `// PROVISIONAL: superseded by M0-05/M0-10/M0-13`.

---

## 4. Conflicts with the Brief
- None. All requirements from the brief and Batch 1 tasks (M0-01, M0-02, M0-03, M0-04) are fully aligned.

---

## 5. Open Issues
- None for Batch 1. Ready for Batch 2 when scheduled.
