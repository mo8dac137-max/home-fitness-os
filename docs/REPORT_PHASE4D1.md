# Phase 4B/4D1 Report — Live Schema Applied + Sync Data Layer

Executed directly on the repository, on top of `main` @ `33a2089` (Phase 4A).
Scope: verify the live database state after the owner applied the M0-15
migration, verify the deployed edge function, then implement the Phase 4D1
sync data layer (new migration + client transport + tests). All outputs below
are from actual terminal runs / live HTTP probes in this session.

## 1. Live Verification (owner applied M0-15 via SQL editor)
- Owner reported: `Success. No rows returned`.
- External probe 1 — `GET /rest/v1/spike_data` (anon publishable key):
  **401 `42501 permission denied for table spike_data`** — previously
  `404 PGRST205` (table missing). The flip proves the table now exists AND
  the `revoke all ... from anon` privileges are active.
- External probe 2 — anonymous `POST /rest/v1/spike_data`: **401 denied**.
- External probe 3 — `POST /functions/v1/device-auth` with no token:
  **401 `{"error":"missing_token"}`** — the edge function is deployed and
  answering with its own contract error (not "Function not found"). The M0-15
  function deployment survived the project pause; no redeploy needed.

## 2. Summary (Phase 4D1)
- `supabase/migrations/20261103000000_p4d1_session_events_sync.sql`: the
  append-only cloud mirror of the local event log. `idempotency_key` is the
  primary key (re-push = safe no-op), user FK cascades on account deletion,
  two indexes for the sync query paths (user+occurred_at, user+type). RLS is
  authoritative: user-scoped select/insert **and** the M0-15
  `device_session_valid()` gate; authenticated gets select+insert only — no
  update/delete policies exist, so the API cannot rewrite or erase history.
- `apps/web/src/supabase/syncTransport.ts` (plain PostgREST, injected
  fetch/clock/timeout, no supabase-js — same minimal-bundle decision as 4A):
  - `toSyncRow` / `envelopeFromSyncRow`: typed mapping with defensive
    rehydration (malformed rows are dropped, not thrown).
  - `pushEvents`: batched POST (default 100), `Prefer:
    resolution=ignore-duplicates,return=representation` — counts
    `pushed` vs `duplicates` honestly from the returned representation.
  - `pullEvents`: `order=occurred_at.asc`, `occurred_at=gt.<sinceIso>` cursor,
    paginated until a short page.
- The transport is not yet imported by app code (deliberate): 4D2 wires auth
  (sign-in + device enroll) before any real token exists. Bundle unchanged.

## 3. Raw DoD Outputs (actual runs)
- `npm run typecheck` — exit 0, no output. (One iteration: the first test
  draft violated `payload`'s static type; fixed with a structural-view
  assignment simulating runtime-malformed data, no `any`/`as any`.)
- `npm run lint` — exit 0, no output.
- `npx vitest run` — `Test Files 28 passed (28)` / `Tests 215 passed (215)`.
  New: `syncTransport.test.ts` (7).
- `npm run build` — `precache 14 entries`; bundle total unchanged at
  `130.83 KB / 300 KB` (transport tree-shaken until 4D2 imports it).
- `git status` — clean after commit; no `.env` in history.

## 4. Failures / Skipped
- None skipped. Typecheck iteration documented above.
- Not executed (out of scope for 4D1): the M0-15 RLS selftest (`supabase/
  tests/m0_15_rls_selftest.sql`) — offered to the owner, not yet run; it
  covers the M0-15 tables, while `session_events` gets its external probe
  after the owner applies the new migration.

## 5. Handoff (single owner step)
- Paste `supabase/migrations/20261103000000_p4d1_session_events_sync.sql`
  into the SQL editor (same flow as M0-15). Expected: `Success. No rows
  returned`. External verification afterwards: anon `GET /rest/v1/
  session_events` must answer **401 permission denied** (privileges revoked),
  and the table must appear in the dashboard's Table Editor.

## 6. Deviations / Notes
- `session_events` policies intentionally reuse `device_session_valid()`
  rather than inventing a second gate — one security contract for all
  user data, per the M0-15 model ("Supabase RLS is authoritative").
- `synced_at` (server default `now()`) records when a row landed; the client
  never sets it. It exists for debugging/audit only — sync ordering uses
  `occurred_at`.
