# Phase 4D4 Report — Opportunistic Auto-Sync + Honest Device Facts

Executed on top of `main` @ `7d59cc3` (Appearance Skins, pushed, CI green).
Scope: the two 4D4 candidates from `STATE.md` that are fully deliverable
client-side — (1) auto-sync when the app comes back to life, (2) surfacing
server-side device truth in the Account card. All outputs below are from
actual terminal runs in this session.

## 1. Why these two

A phone-first workout app spends most of its life in the background. Until
now the cloud only synced on three moments: app start (once, after the device
flow converges), workout completion, and the manual "Sync now" button. That
meant a morning workout finished offline stayed cloud-only until the next
cold start, and a device that came back online silently never caught up.

## 2. What was added

### `sync/syncTriggers.ts` — the trigger policy (new module)
- Pure, dependency-injected state machine: `shouldSync({ ready, busy })` +
  `markStarted()`. No React, no Supabase types, no I/O.
- Gates: never fires while the cloud is not `ready`, never while a round is
  in flight, and at most one round per **`MIN_AUTO_SYNC_INTERVAL_MS` (30 s)**
  so rapid tab flips or a flaky connection cannot hammer the edge functions.
- Deliberately trigger-agnostic (`visible`/`online` share one gate today);
  the comment documents where a per-trigger cadence would live if ever needed.

### `cloud/useCloudSession.ts` — thin wiring, existing contracts untouched
- **Opportunistic rounds**: one mount-scoped effect listens to
  `window online` + `document visibilitychange` (fires only when
  `visibilityState === 'visible'`), consults the policy via a `stateRef`
  snapshot, marks the limiter, then reuses the existing `sync()` — the same
  path that re-validates the session, re-verifies the device on `403`, and
  surfaces honest failures. Listeners are removed on unmount.
- **Cold start feeds the limiter**: the Phase 4D3 once-per-cold-start round
  now also calls `markStarted()`, so backgrounding and returning seconds
  after launch cannot double-fire.
- **Device facts (once per readiness epoch)**: on reaching `ready` the hook
  loads this browser's enrolled device id from the local key store
  (`loadEnrolledDeviceId`) and probes the server's existing `status` action
  (`fetchDeviceStatus` → `active_devices`). A failed probe is informational
  only: the count stays unknown, no error noise. Leaving `ready` (sign-out,
  deauthorize, expiry-driven `signed_out`) resets the facts and re-arms the
  epoch.
- **`lastSyncAt`**: every completed sync round (success or honest failure)
  is stamped with `Date.now()`.

### `components/CloudAccountCard.tsx` — the ready card shows real facts
Under the verified row, three null-guarded lines (each renders only when its
fact is actually known — no invented values):
- `Active devices: {count}` — server truth via the existing status action.
- `This device · {id}` — short 8-char id in mono/LTR, full id kept as the
  `title` tooltip.
- `Last sync {time}` — wall-clock label of the last finished round (HH:mm).

### i18n
3 new keys in **both** dictionaries (`account.active_devices`,
`account.this_device`, `account.last_sync`), placeholder-parity-guarded by a
new test. Totals: 271/271 keys.

## 3. Deliberately NOT done (honest scope)
- **Per-device rows (id / label / last_seen per device)**: the deployed
  `device-auth` `status` action returns only `{ active_devices,
  session_verified }`. Surfacing per-device last-seen needs a function change
  **plus a redeploy** — an owner action, not a client-side one. The client
  now shows everything the live contract can honestly provide.
- **pg_cron scheduled cleanup**: still pending pg_cron availability
  confirmation on the project (unchanged from 4D3; migration + snippet are
  already in the repo).
- **Cursor-based pull**: still deliberately a full pull each round — the log
  is small and appends are idempotent; a cursor is drift surface, not value,
  at this size.

## 4. Verification (actual runs)
- `npm run typecheck` clean; `npm run lint` clean.
- **Tests: 36 files / 317 passing** (+16: 6 policy unit tests with an
  injected fake clock, 6 hook wiring guards, 2 card guards, 2 i18n guards).
  The full battery includes the Phase 4D3 guards — the additive wiring kept
  every pinned string intact.
- `vite build` clean (PWA precache 14 entries, as before).
- Bundle: **140.51 / 300 KB gzipped** (+0.67 KB for the policy module, the
  status probe, and the three UI lines).
