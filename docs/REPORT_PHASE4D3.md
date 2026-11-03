# Phase 4D3 Report — Auto-Sync on Start, Honest Deauthorize, Server Housekeeping

Executed directly on the repository, on top of `main` @ `c03acb5` (the live-E2E
tooling commit; both commits are ready to push and currently gated only on the
owner's GitHub token). Scope: implement the three 4D3 candidates listed in
`docs/STATE.md` — none of them require owner input to build. All outputs below
are from actual terminal runs in this session.

## 1. Auto-Sync on Start (`cloud/useCloudSession.ts`)
Until now the cloud only synced after a workout completed or via the manual
Sync-now button, so events from an offline day waited for the next workout.
A new mount-time effect fires the existing `sync()` **once per readiness
transition**: when the device flow converges to `ready` (boot restore, fresh
sign-in, or recovery), one sync round runs — push + pull + merge, unchanged,
including its one re-verify retry when a 12 h device session lapsed. The
guard re-arms only when the stage returns to `signed_out`, so a mid-ready
re-render never re-triggers, and the app stays fully usable signed out
(`sync()` itself early-returns when unconfigured or without a session).

## 2. Honest Deauthorize (`CloudAccountCard` + hook action)
The Phase 4C client always had `revokeCurrentDevice`; no UI surfaced it. The
Account card now offers **"Deauthorize this device"** behind a two-step
inline confirm (first tap shows exactly what happens, per the i18n hint):
server `revoke` for this device's key → local key-store clear (inside the
4C client) → local sign-out. The semantics are deliberately distinct from
plain sign-out, which **keeps** the device record so signing back in
re-verifies the same key pair.

The failure posture is honest by construction: if the server revoke fails
(network, timeout, server error), the hook does **not** sign out and does
**not** pretend success — the user stays signed in and verified, and the card
shows the real server code ("Deauthorization failed ({code}) — the device is
still authorized on the server"). Only `not_enrolled` (no local key pair to
revoke) falls through to the local sign-out, which is what the user asked
for anyway. Five new i18n keys ship in both dictionaries:
`account.deauthorize`, `account.deauthorize_hint`, `account.deauthorize_confirm`,
`account.cancel`, `account.deauthorize_failed`.

## 3. Cleanup Migration (`supabase/migrations/20261104000000_p4d3_cleanup_expired_device_auth.sql`)
Expired `device_challenges` and lapsed `device_sessions` otherwise accumulate
forever. The job deletes **only rows the engine already ignores** — challenges
past `expires_at` (verify refuses them) and sessions past `expires_at`
(`device_session_valid()` already treats them as invalid) — and reports the
row counts. It never touches authoritative rows: `authorized_devices`
(explicit revocation is user-owned state) and `recovery_codes` (used codes
must keep existing so reuse attempts keep failing, and they are the audit
trail for recoveries). Two `expires_at` indexes keep the deletes cheap.
**Owner action required to go live**: run the file in the Supabase SQL editor
(same as M0-15 and 4D1); the optional daily `pg_cron` schedule is included as
a comment.

## 4. Verification
- **Tests**: 294 passing (35 files) — 7 new source guards in
  `apps/web/src/__tests__/cloudPhase4D3.test.ts`: the auto-sync fires exactly
  once per readiness transition and re-arms only after `signed_out`; a failed
  revoke never pretends success (the failure branch patches `deviceError` and
  returns **before** any local sign-out; only `not_enrolled` may fall
  through); the card carries the two-step confirm with both dictionaries
  complete; the migration has exactly two `delete` statements and never
  touches `authorized_devices`/`recovery_codes`.
- `npm run typecheck` and `npm run lint` clean; one iteration was needed on
  my own guard test — its first version asserted the wrong sign-out ordering
  (the first `authSignOut` occurrence is the no-live-session branch, which
  legitimately precedes the failure branch); the fixed guard checks the
  **last** occurrence, i.e. the success path.
- **Bundle**: 139.09 / 300 KB gzipped (+0.49 KB for the whole phase).

## 5. Honest Non-Goals
- The cleanup migration is **not yet applied** to the live project — that is
  an owner action by design (the repo never holds credentials).
- The auto-sync is one-shot per readiness transition; it does not observe
  `visibilitychange` or network reconnection (a future candidate).
- The deauthorize revoke targets **this device only**; revoking a lost device
  from another browser remains the recovery flow's job (a recovery code
  rotates everything at once).
- UI behavior is guarded by source guards + module tests per house style;
  there is no React render harness in this repo.
