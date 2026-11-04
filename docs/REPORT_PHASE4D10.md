# Phase 4D10 Report — Cursor-Based Pull

Executed on top of `main` @ `a0749dd` (Phase 4D9: revoked-device history,
CI-green). Scope: the last implementable 4D10 candidate from STATE.md —
`syncNow` deliberately pulled **everything** every round ("no cursor
bookkeeping can drift"), which is honest but O(whole log) forever, and
auto-sync fires on every `visibilitychange`/`online` (rate-limited to
30 s). The cost per round grows without bound as the log accumulates
sessions; the value delivered per round does not.

## 1. What changed for the user

Nothing visible — and that is the point. The sync summary lines, the
account card, all counts (`pushed`/`duplicates`/`pulled`/`merged`) stay
exactly as they were. What changes is the shape of the pull: after the
first full round, every following round downloads only rows inserted since
the last one (minus a replay window), instead of the user's entire
`session_events` mirror. On a months-old account that turns the most
frequent network call in the app from "send my whole history back to me"
into "send me what's new".

## 2. Implementation

- `apps/web/src/supabase/syncTransport.ts`: `pullEvents` gains an optional
  `sinceSyncedIso` — a strict `synced_at=gt.` PostgREST filter — and
  switches the page ordering to `synced_at.asc,idempotency_key.asc` while
  it is set, so the cursor basis stays consistent across pages. `PullResult`
  reports `max_synced_at` (newest server clock value seen, defensively
  parsed, null when no row carries one). Everything is additive: the
  `sinceIso` path and the default ordering are untouched, old callers
  compile and behave identically.
- **The cursor basis is `synced_at`, not `occurred_at` — deliberately.**
  `occurred_at` is client-clock generated and can skew backwards across
  devices; a cursor on it could silently skip rows forever. `synced_at` is
  server-assigned (`timestamptz not null default now()`, 4D1 migration) on
  an append-only table, so it only ever moves forward. No migration needed:
  the filter is never worse than the full pull it replaces (same per-user
  scan).
- `apps/web/src/sync/syncService.ts`: `PullCursorPort`
  (`load`/`save`, user-keyed) on `SyncServiceOptions`; `PULL_OVERLAP_MS`
  = 10 minutes; `cursorSinceIso` (pure) mapping a stored cursor to the
  pull's `sinceSyncedIso`. The cursor **only advances on a successful
  pull**, only forward (a pure overlap replay must not move it backward —
  a non-finite stored value counts as nothing stored, so self-healing
  replaces it), and a missing or garbage cursor honestly falls back to the
  full pull. The 10-minute overlap re-downloads a handful of boundary rows
  every round; the idempotent merge (unchanged) drops them and counts only
  genuinely new keys — the exact "no bookkeeping can drift" safety of the
  old full pull, preserved.
- `apps/web/src/sync/pullCursorStore.ts` (new): `KeyValuePullCursorStore`
  over the existing IndexedDB `kv` store, namespaced
  `hfos.pull_cursor.<userId>` — an account switch can never inherit
  another account's cursor. Like the device key record, it is
  intentionally **not** cleared on sign-out: signing back in resumes
  incremental pulls instead of paying one full round, and a stale key
  costs a few bytes. A corrupted value loads as null (full pull), never a
  crash.
- `apps/web/src/cloud/useCloudSession.ts`: `openStores()` builds the
  cursor store; both `syncNow` calls (first round + post-re-verify retry)
  pass it. No state, no UI, no i18n.

## 3. Deliberately NOT done (honest scope)

- **No `(user_id, synced_at)` index migration**: the cursor filter runs on
  the same per-user scan the full pull already performed, so it is never
  slower than the status quo; an index only matters once a single user's
  row count grows into the thousands. If that day comes it is a one-line
  `create index`, owner-applied like its 4D5 predecessor.
- **No cursor in the sync summary / UI**: `pull_mode` would be diagnostic
  truth nobody renders; the summary stays minimal and every displayed fact
  remains user-meaningful.
- **No server-side cursor (Resume-Cursor header / RPC)**: the client-side
  `synced_at` filter achieves the cost win with zero function changes and
  zero owner actions.
- The remaining 4D10 candidates are unchanged: revoke second factor
  (product decision), pg_cron (owner-blocked), live E2E rehearsal
  (owner-blocked on a test user with Auto Confirm).

## 4. Verification (actual runs)

- `npm run typecheck` clean; `npm run lint` clean.
- **Tests: 42 files / 389 passing** (+13 net), all in the new
  `syncCursor4D10.test.ts`: `cursorSinceIso` (replay math, null for
  missing/garbage), `syncNow` with a cursor (first round full + cursor
  stored; next round incremental with `gt.<cursor − 10 min>` and
  synced-at-first ordering; overlap replay merges for free and never moves
  the cursor backward; pull failure leaves the cursor untouched; garbage
  cursor self-heals into a full pull and is replaced; no `pullCursor`
  option keeps old callers on a full pull), `pullEvents` plumbing (filter +
  ordering switch + `max_synced_at` capture; null when rows carry none),
  and `KeyValuePullCursorStore` over real fake-indexeddb (per-user
  namespacing, corrupted value → null, persistence across instances).
  The garbage-cursor test caught a real bug before it shipped: `NaN`
  comparisons made every stored-garbage cursor unreplaceable — fixed by
  treating a non-finite stored value as "nothing stored".
- `vite build` clean (PWA precache 14 entries).
- Bundle: **143.03 / 300 KB gzipped** (+0.36 KB for the cursor plumbing).

## 5. Owner actions

**None.** Pure client phase — no migration, no function change, nothing to
redeploy. The pending actions remain exactly 4D6's: one `device-auth`
redeploy (which also switches on the 4D9 history section) and the optional
`DEVICE_AUTH_ALLOWED_ORIGINS` hardening.
