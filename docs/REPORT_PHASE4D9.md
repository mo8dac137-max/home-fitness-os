# Phase 4D9 Report — Revoked-Device History in the Account Card

Executed on top of `main` @ `770a2df` (Phase 4D8: motion personality hint,
CI-green). Scope: the first remaining 4D9 candidate from STATE.md —
revocation has been one tap since 4D6, but the *outcome* vanished from the
UI: a revoked device just disappeared from the rows. The data was never
deleted (revocation is a soft delete — `revoked_at` is stamped, the row
survives), so this phase only had to surface what the server already knew.

## 1. What the user sees

Under the live device rows in the Account card (More › About, ready stage),
a quiet bordered section: **`Revoked devices ({count})`** /
**`الأجهزة المُبطلة ({count})`**, collapsed by default — it is an audit
trail, not a control. Expanding it lists the most recent revoked devices
(server-capped at 10, newest first): the device label on one side,
**`Revoked {date}`** / **`أُبطل في {date}`** on the other. Every line
renders only when its fact is actually known — a missing timestamp shows
`--` rather than an invented date.

The section appears **only when the server actually reported revoked
devices**. Against the currently deployed function (which predates this
phase) the field is absent → `null` → nothing renders. No broken UI, no
empty-state noise: the feature wakes up with the redeploy.

## 2. Implementation

- `supabase/functions/device-auth/index.ts`: `status` gains an additive
  `revoked_devices` array — `id, label, created_at, revoked_at` for rows
  with `revoked_at` set, ordered by `revoked_at` desc, `.limit(10)`. The
  query is wrapped in the exact `activeDeviceRows` degrade pattern: any
  failure (pre-migration database included) answers `null` and the field is
  simply omitted — a status call can never fail because of history. Old
  clients ignore the extra field; the 4D5 `devices` shape is untouched.
- `apps/web/src/supabase/deviceAuthClient.ts`: `RevokedDeviceRow` +
  `DeviceStatus.revoked_devices: RevokedDeviceRow[] | null` +
  `parseRevokedRows` — mirrors `parseDeviceRows` exactly (non-array →
  null, malformed entries dropped individually, non-string timestamps →
  null, empty → null).
- `apps/web/src/cloud/useCloudSession.ts`: `revokedRows` in state, mapped
  from `status.data.revoked_devices` in the readiness-epoch probe, and
  cleared in all four reset paths (`INITIAL`, `SIGNED_OUT_RESET`,
  sign-out, signed-out epoch cleanup) — the exact lifecycle `deviceRows`
  already has.
- `apps/web/src/components/CloudAccountCard.tsx`: the collapsed section
  (border-top separator, `aria-expanded` toggle button, `+`/`−` affordance)
  between the live rows and the last-sync line. Read-only by construction:
  no revoke affordance, no confirm, no actions — pinned by a test.
- `apps/web/src/i18n/index.ts`: 2 new keys per dict
  (`account.revoked_devices_title` with `{count}`,
  `account.device_revoked_when` with `{date}`) — both placeholders already
  existed in the dicts, so global parity stays trivially true. Dicts now
  362/362.

## 3. Deliberately NOT done (honest scope)

- **The revoke second factor** (the other 4D9 candidate): the per-device
  revoke already runs through a two-step inline confirm with an explicit
  yellow warning (4D6), behind a verified device session. A typed-phrase
  step would add friction with marginal benefit in a single-user app — and
  a *server-enforced* second factor would mean function changes for
  protection the UX layer already provides. Product decision, left to the
  owner; not smuggled in here.
- **No way back**: the history is read-only. Un-revoking stays impossible —
  a device regains access only through a recovery code (existing, tested
  flow), which is exactly what the revoke hints already say.
- **No history beyond 10**: the server caps the list; an unlimited trail
  would grow a personal app's status payload forever for no user value.
- The remaining candidates are unchanged: revoke second factor (product
  decision), cursor-based pull (deliberately full pull today), pg_cron
  (owner-blocked).

## 4. Verification (actual runs)

- `npm run typecheck` clean; `npm run lint` clean.
- **Tests: 41 files / 376 passing** (+10 net), all in the new
  `cloudPhase4D9.test.ts`: parser truth table (well-formed rows with
  null-coerced timestamps, individually dropped malformed entries, null
  for absent/garbage/empty), contract tests for `fetchDeviceStatus` (v3
  payload parsed; old function → `revoked_devices: null` while `devices`
  survives), function/hook/card source guards (additive spread + degrade
  pattern; `revokedRows` in ≥4 reset paths; collapsed read-only section
  with `aria-expanded` and no revoke affordance), and the i18n pair
  (both dicts, placeholder parity `{count}`/`{date}`).
  Churn guards updated for the widened contract (the same ceremony 4D5→4D6
  and 4D7→4D8 went through): `deviceAuthClient.test.ts` v1-payload pin now
  includes `revoked_devices: null`; `cloudPhase4D4`/`4D5` reset-path pins
  accept the `revokedRows` line between rows and id.
- `vite build` clean (PWA precache 14 entries).
- Bundle: **142.67 / 300 KB gzipped** (+0.24 KB for the parser, the
  collapsed section and the two bilingual keys).

## 5. Owner actions

**No new action.** The only server-side piece is the `device-auth` source
change, and it rides the redeploy that is already pending from 4D6 (the
honest-404 revoke + CORS allow-list): one dashboard redeploy ships both.
Until then the history section simply stays hidden (old function → no
field → no UI), and everything else — revoke buttons, rows, sync — works
exactly as today. The 4D6 optional `DEVICE_AUTH_ALLOWED_ORIGINS` hardening
is unchanged.
