# Phase 4D2 Report — Auth Integration + Sync Orchestration

Executed directly on the repository, on top of `main` @ `5b32477`
(Phase 4C). Scope: wire the tested cloud modules into the app — sign-in via
Supabase Auth, the device enroll/verify/recovery flow as one state machine,
and idempotent event-log sync driven from the app lifecycle. All outputs
below are from actual terminal runs in this session.

## 1. Design Decision: the Cloud Never Blocks the App
The product is local-first (`sync.subtitle`: the cloud is an optional mirror).
So instead of an auth gate in front of the app, Phase 4D2 adds an **Account
card** under More › About: signing in is opt-in, every cloud state is visible
and recoverable from one surface, and the app renders identically signed out.
The only lifecycle hook into the app is one line: `cloud.sync()` after a
workout completes (plus the manual Sync-now button).

## 2. Summary
- `apps/web/src/supabase/authClient.ts` (368 lines) — Supabase Auth REST
  client, still without supabase-js: `signInWithPassword`, `refreshSession`,
  `getValidSession` (pre-emptive refresh within a 60 s TTL margin), `signOut`
  (best-effort global logout; local sign-out can never be blocked). Normalizes
  GoTrue's legacy (`invalid_grant`) and current (`invalid_credentials`) error
  shapes. A definitive 4xx refresh rejection clears the stored session;
  transient network/timeout/5xx failures deliberately keep it — an offline
  user is never logged out by a flaky connection. `AuthSessionStore` port with
  `InMemory` and `KeyValue` (IndexedDB) implementations.
- `apps/web/src/supabase/deviceFlow.ts` (145 lines) — the Phase 4C primitives
  collapsed into one idempotent state machine: `runDeviceFlow` returns
  `verified` / `enrolled` (with one-time recovery codes) / `recovery_required`
  (with reason) / `error` (verbatim server code) — data, never exceptions.
  `submitDeviceRecovery` consumes a code, enrolls a fresh key pair, verifies.
- `apps/web/src/sync/syncService.ts` (99 lines) — `syncNow`: push every local
  envelope (idempotent by the server's `idempotency_key` primary key), pull
  the user's remote rows, append them locally (the local `EventLog` drops
  duplicate keys), and report honest `pushed / duplicates / pulled / merged`
  counts.
- `apps/web/src/cloud/useCloudSession.ts` (286 lines) — thin React glue:
  stages `checking → signed_out → device_flow → recovery → ready`, mount-time
  restore + device-flow convergence, sign-in/recovery/sign-out actions, and
  `sync()` with one re-verify retry when a 12 h device session has lapsed.
- `apps/web/src/components/CloudAccountCard.tsx` (229 lines) — the account
  surface: inline sign-in form, device states (checking / verified / retry /
  recovery input), one-time recovery-codes display with an explicit
  "I saved them" acknowledgement, Sync now with real result counts, Sign out.
  i18n-only copy (28 new `account.*` keys, full en/ar parity) and
  logical-direction (RTL-safe) classes only.
- `App.tsx` — owns the single `useCloudSession()` instance, passes it to
  `MoreScreen`, and triggers `cloud.sync()` on session completion.
  `MoreScreen.tsx` — optional `cloud` prop, renders the card above the 4A
  status card.

## 3. Raw DoD Outputs (actual runs)
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0. (Two iterations documented: unused imports and a
  disable-comment for a rule the config does not ship — removed rather than
  adding the plugin.)
- `npx vitest run` — `Test Files 34 passed (34)` / `Tests 284 passed (284)`.
  New: `authClient.test.ts` (14), `deviceFlow.test.ts` (9), `syncService.test.ts`
  (6), `cloudWiring.test.ts` (5).
  - Behavioral fixes surfaced by tests before commit: refresh-failure
    normalization (`invalid_grant` → `invalid_credentials`) and the
    transient-failure-keeps-session policy above.
  - Device-flow tests drive the mock server with the real signature
    verification replica, so enroll/recovery proofs are contract-checked, not
    self-compared.
- `npm run build` — exit 0. `npm run check:bundle` — `✅ PASSED`,
  137.47 KB / 300 KB (+6.6 KB for the entire cloud layer).

## 4. Failures / Skipped
- None skipped. The lint and behavioral iterations are documented above.
- Not executed here (needs a real signed-in user): the live sign-in → enroll
  → verify → `session_events` round trip. Every protocol hop is covered by
  contract-matched tests; the rehearsal steps are in STATE.md §5.

## 5. Security Notes
- Access + refresh tokens live in IndexedDB under one kv key; corrupt records
  rehydrate as signed-out instead of crashing. The device private key remains
  a non-extractable `CryptoKey` (structured clone), untouched from 4C.
- Sign-out keeps the device record intentionally: the next sign-in re-verifies
  the same key pair with no new enroll/recovery round. Server-side revocation
  remains available (the 4C `revokeCurrentDevice` client exists) — surfacing
  it as a "deauthorize device" action is a listed 4D3 candidate.
- No new environment variables, no new server deployment: the function, M0-15
  schema, and `session_events` RLS were already live and verified.

## 6. Deviations / Notes
- Sync pulls the full remote history each round instead of tracking a cursor:
  the log is small, appends are idempotent, and no cursor state can drift.
  A `sinceIso` cursor can be reintroduced later without changing callers.
- `cloud.sync()` after workout completion is fire-and-forget by design; its
  result surfaces in the Account card, not as a blocking dialog.
