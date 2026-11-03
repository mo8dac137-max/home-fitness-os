# Phase 4D5 Report — System Theme Mode + Per-Device Rows (contract v2)

Executed on top of `main` @ `eec4358` (Phase 4D4, pushed, CI green). Scope:
the two 4D5 candidates that were deliverable end-to-end — (1) auto skin
switching driven by `prefers-color-scheme`, (2) the Account card's per-device
device list, including the server-side contract extension. All outputs below
are from actual terminal runs in this session.

## 1. Auto theme mode (manual / system)

- **Settings contract** gained `theme_mode: 'manual' | 'system'` (default
  `manual` — byte-identical behavior for every existing user) plus
  `style_light` (default `paper`) and `style_dark` (default `clay`).
- **Resolution** is one pure function: `resolveEffectiveStyle(settings,
  systemDark)` — manual paints `style`, system paints the scheme's skin.
  `systemPrefersDark()` reads the browser and defaults to dark outside one
  (tests, SSR). `effectiveAppearance()` returns the DOM-facing settings while
  **persistence always keeps the raw settings**.
- **Legacy migration is honest**: a payload from before this phase keeps
  `manual`, and its valid stored style becomes the per-scheme preference for
  the mode that skin actually belongs to (`isDarkStyle` classification:
  clay/glass/mono/neon/aurora/oled dark, neu/brutal/paper light).
- **No flash, no staleness**: bootstrap applies the resolved appearance
  before first paint; while in system mode, App listens to
  `matchMedia('(prefers-color-scheme: dark)')` change events and re-applies
  live when the OS flips with the app open (listener removed on cleanup).
- **WYSIWYG picker**: in system mode the swatch highlight and the click
  target follow the skin currently painted — the active scheme's preference.
  A hint line says exactly that. The 4D4-era `UpdateBanner`/`--accent-ink`
  ink-safety and the tokenized shell carry over untouched (accent mixing
  runs on the effective style).

## 2. Per-device rows (device-auth contract v2)

- **Migration** (`20261105000000_p4d5_device_last_seen.sql`, owner-applied
  via SQL editor): `authorized_devices` gains a nullable `last_seen_at`.
  Nullable on purpose — pre-migration devices show an honest "not seen yet".
- **Edge function**: `verify` stamps `last_seen_at` (best-effort try/catch —
  a pre-migration database can never fail a verification); `status` selects
  `id, label, created_at, last_seen_at` for non-revoked devices (oldest
  first) and spreads a `devices` array **only when that query survives** —
  before the migration lands the function answers with the exact v1 payload.
  Deployment order is therefore safe either way (migration first recommended).
- **Client parses defensively**: `parseDeviceRows` returns null for absent or
  non-array payloads, drops malformed entries individually, nulls non-string
  timestamps; `fetchDeviceStatus` returns `devices: null` on a v1 server.
- **Card**: with rows, the list leads — label, `Last seen {time}` /
  `Not seen yet`, and a `This device` chip matched against the local enrolled
  device id; without rows, the 4D4 fallback (count + short id) stays. The
  last-sync line is unaffected in both shapes.

## 3. Deliberately NOT done (honest scope)
- **No auto deploy of the function** from here: redeploying `device-auth`
  needs Supabase access the client repo does not have (owner action, two
  minutes: `supabase functions deploy device-auth` or the dashboard flow).
- **No per-device revoke button yet** — that needs a new verified-session
  action contract; logged as a 4D6 candidate rather than smuggled into this
  payload change.
- **pg_cron scheduling** of the 4D3 cleanup is still blocked on confirming
  pg_cron availability on the project (owner-side check).

## 4. Verification (actual runs)
- `npm run typecheck` clean; `npm run lint` clean.
- **Tests: 37 files / 338 passing** (+21 net): 21 in the new
  `cloudPhase4D5.test.ts` — 7 theme-mode unit tests (resolution, scheme
  classification, legacy migration, bogus rejection, browser-fake scheme
  read, raw-vs-effective split), 5 device-row unit tests (parse matrix +
  injected-fetch v1/v2 rounds through `fetchDeviceStatus`), 5 wiring guards
  (bootstrap/App/lab, hook, card, edge function, migration), 2 i18n guards
  (both dicts + placeholder parity). Contract evolution also updated three
  pinned tests honestly: `appearance.test.ts` literals moved to the
  10-field contract, `deviceAuthClient.test.ts`'s v1-payload expectation
  gained `devices: null`, and `cloudPhase4D4.test.ts`'s probe/reset pins
  follow the widened patch calls.
- `vite build` clean (PWA precache 14 entries).
- Bundle: **141.43 / 300 KB gzipped** (+0.92 KB for the mode logic, listener,
  parser, and the two UI surfaces).

## 5. Owner actions to make rows live
1. Apply `supabase/migrations/20261105000000_p4d5_device_last_seen.sql` in
   the SQL editor.
2. Redeploy the `device-auth` function (CLI: `supabase functions deploy
   device-auth`).
Until both land, the app runs exactly as 4D4 shipped it (count + short id) —
by design, not by accident.
