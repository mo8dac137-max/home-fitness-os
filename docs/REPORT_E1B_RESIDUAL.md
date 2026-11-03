# Report — E1b Residuals (honest UI + persistent device id)

Commit: `6bad8a5` · Date: 2026-11-03 · CI: green (run 41623669875)

## Problem (from PROJECT_HANDOVER_AND_MEMORY.md §8.3 / §9.1.3)

The engine honesty pass (E1a) landed real inputs in `buildHorizon` and put
`unit`, `reason_code`, `decision` and `revision_reason` on `PlanDay`, but the UI
layer still invented what the engine now provides:

- `planService` emitted `plan.generated` / `plan.revised` events with the
  hard-coded `device_id: 'redmi12_client'`.
- `WorkoutRunnerScreen` emitted all session events with
  `deviceId: 'device-redmi12-local'`.
- `generateDecisionSummary` derived the unit from `day_index % 2` parity,
  returned three canned English sentences per day kind, and stamped
  `revision_reason = 'schedule'` on every revised day.
- `HomeScreen`'s "Why this session?" sheet rendered the canned strings with a
  canned fallback array when no decision existed.
- **Found by the new tests:** `SystemIdGenerator` produced malformed UUIDv7s —
  the final group was 10 hex chars instead of 12 (`randomHex` had 16 chars but
  `slice(6, 18)` needs 18). Every production event/plan id was malformed.

## Changes

- `apps/web/src/bootstrap.ts` (86 → 105): `getPersistentDeviceId(kv)` — one
  UUIDv7 per installation, stored under `hfos.device_id`, corrupt stored values
  transparently regenerated.
- `apps/web/src/engine/planService.ts` (250 → 305): events carry the persistent
  device id; `DayDecisionSummary` is now honest — `unit` from `PlanDay.unit`
  (`'rest'` otherwise), `top_reasons` as typed i18n keys
  (`DecisionReasonI18nKey`, closed set) with the REAL top-3 normalized term
  contributions (0–100) taken from the day's `DecisionRecord.term_values`, or a
  `reason_day.<code>` key from the day's `reason_code` for non-main days;
  `revision_reason` passes through from the day record; `inputs_defaulted`
  mirrors `Plan.inputs_defaulted`.
- `apps/web/src/screens/WorkoutRunnerScreen.tsx` (1020 → 1039): device id
  resolved once per mount from the kv store; session events carry it.
- `apps/web/src/screens/HomeScreen.tsx` (395 → 429): why-sheet renders typed
  reason keys via `t()` plus the real numeric contribution chip (`ltr-num`);
  legacy persisted string summaries still render, explicitly labeled as
  estimates; empty state uses `home.no_reasons`; an honesty banner lists the
  defaulted decision inputs when present.
- `apps/web/src/engine/engineContext.ts`: `SystemIdGenerator` fixed — 18 random
  hex chars, true 8-4-4-4-12 layout.
- `apps/web/src/i18n/index.ts` (663 → 761): 20 new keys in BOTH dicts (6 term
  reasons, 9 day reasons, 3 defaulted-input labels, 2 sheet strings); removed
  the dead mock keys `train.session_unit` / `train.session_duration` ("Upper
  push (Unit A)" / "38 min") — they were unused anywhere.
- `apps/web/src/__tests__/planService.test.ts` (163 → 273): 3 new tests —
  device id is a persistent valid UUIDv7 shared across service instances and
  never a hard-coded label; summaries use the engine unit + exactly the top-3
  real term contributions from the DecisionRecord; `revision_reason`
  passthrough never claims a revision the day does not record.

## Decisions

- Reasons travel as **i18n keys + numeric values**, never as English sentences
  from services — the UI localizes; the number is rendered as a separate chip
  (no `t()` interpolation change needed).
- Legacy summaries already persisted in kv are rendered as-is and labeled
  `(estimate)` instead of crashing or silently reinterpreting them; they are
  rebuilt on the next plan generation/slide.
- The malformed-UUID fix changes future ids only; existing stored envelopes are
  untouched (ids are opaque text in IndexedDB and in `session_events`).

## Deviations

None. No new dependencies; no engine-core behavior change (E1a output is
consumed as-is); i18n parity kept (the Arabic-coverage test enforces it).

## Open issues

- `device_id` values in already-synced cloud rows remain the old labels —
  cosmetic; future rows are correct.
- Still open from the handover §9.1: onboarding/PAR-Q+, readiness check-in,
  equipment & environment screen, quick commands UI (B2), M0-15b hardening,
  the Redmi 12 PWA rehearsal.
