# Phase 4D6 Report — Per-Device Revoke + "Added When" + CORS Allow-List

Executed on top of `main` @ `48aa5e5` (Phase 4D5 live: migration applied and
`device-auth` redeployed by the owner, contract v2 verified externally).
Scope: the actionable 4D6 candidates from STATE.md — (1) a per-device revoke
button in the Account card with an honest server contract, (2) surfacing each
device's `created_at` as "Added {date}", (3) the M0-15b CORS allow-list. All
outputs below are from actual terminal runs in this session.

## 1. Per-device revoke (client + server)

- **Client** gains `revokeDeviceById(config, token, deviceId)` — revokes ANY
  of the user's devices by id and never touches the local key store (this
  browser stays verified). Empty ids short-circuit with a new synthesized
  `bad_device_id` code before any network call.
- **Hook** exposes `revokeDevice(deviceId)`: valid session → revoke → refresh
  device info (rows re-paint with server truth either way). Failures land in
  a dedicated `revokeError` state (separate from the device-flow `deviceError`)
  so the card can say "Revocation failed ({code})" next to the list.
- **Card**: every device row now carries a small Revoke affordance with the
  4D3-style two-step confirm (hint → confirm/cancel inline under the row).
  The **current** device's button routes to the existing full deauthorize
  flow (server revoke → local key clear → sign out) — no second code path for
  the destructive self-action; **other** devices go through `revokeDevice`.
- **Server honesty** (`device-auth`): `revoke` now pre-checks that the target
  id is a **live** device of this user and answers `404
  unknown_or_revoked_device` otherwise, instead of a fake `ok` over a
  zero-row update. Self-revoke is unaffected (the caller's device is live
  when it calls). Deployment order is safe either way: an older function
  answers bare `ok` for a no-op revoke and the client simply re-paints the
  rows it then receives from `status`.

## 2. "Added when" per device

The v2 `status` payload already carried `created_at` per row; the card now
renders it — `Added {date}` (medium local date, `--` on unparseable input,
omitted entirely when the server sent null) joined with the existing
`Last seen {time}` / `Not seen yet` fact line. No invented values, as always.

## 3. CORS allow-list (M0-15b)

- `device-auth` now builds its CORS headers per request from the optional
  `DEVICE_AUTH_ALLOWED_ORIGINS` env var (comma-separated). A matching
  `Origin` is reflected (with `Vary: Origin`); non-matching origins get no
  `Access-Control-Allow-Origin` at all.
- **Unset keeps the spike's `*`** — an existing deployment can never break on
  upgrade, and the owner can tighten it later by setting the env var in the
  dashboard (Edge Functions → device-auth → Secrets) once the production
  origin URL is pinned down (it is not documented in the repo: the Pages
  deploy runs through a Cloudflare integration, not a workflow file).
- The function is Bearer-token authed (no cookies), so CORS here is
  defense-in-depth, not the primary gate — documented in the source.

## 4. Deliberately NOT done (honest scope)

- **No revoke-confirmation challenge** (e.g. re-entering a recovery code
  before revoking): the server already requires a verified device session,
  which the card's ready stage guarantees; adding a second factor is a
  product decision, not a bug fix.
- **No per-skin motion personalities and no cursor-based pull** — carried
  unchanged to the 4D7 candidates.
- **No `pg_cron` scheduling work** — still blocked on the owner confirming
  pg_cron availability on the project.

## 5. Verification (actual runs)

- `npm run typecheck` clean; `npm run lint` clean.
- **Tests: 38 files / 351 passing** (+13 net): 13 in the new
  `cloudPhase4D6.test.ts` — 4 `revokeDeviceById` unit tests (transport body/
  headers/URL, `bad_device_id` and `missing_token` short-circuits with zero
  network calls, verbatim 404 passthrough), 7 wiring guards (card rows +
  two-step confirm + current-device routing, added-when line, hook action +
  `revokeError` reset shape, revokeDevice-never-signs-out, edge-function
  404 + allow-list + 4D5 behavior survival), 2 i18n guards (both dicts +
  placeholder parity: `{date}` / `{code}`).
- `vite build` clean (PWA precache 14 entries).
- Bundle: **141.96 / 300 KB gzipped** (+0.53 KB for the client fn, card
  affordances, and the five bilingual keys).

## 6. Owner actions to make it live

1. Redeploy the `device-auth` function (same dashboard paste flow as 4D5 —
   the updated single-file source is in
   `supabase/functions/device-auth/index.ts`).
2. Optional hardening: set `DEVICE_AUTH_ALLOWED_ORIGINS` to the production
   origin in the function's secrets once the Pages URL is pinned down.
Until the redeploy lands, per-device revoke still works through the old
server (bare-ok no-ops + row re-paint), and "Added" already renders from the
v2 payload the deployed function serves today.
