# Home Fitness OS — Project State Map

> Source of truth for repo structure, package exports, test coverage, and active settings keys.
>
> Test totals in §4 include the Phase 4D5 task: 37 files / 338 tests.

---

## 1. File Tree of `apps/` and `packages/`

```text
apps/web/
├── package.json (32 lines)
├── tsconfig.json (8 lines)
└── src/
    ├── App.tsx (245 lines)
    ├── appearance.ts (277 lines)
    ├── bootstrap.ts (108 lines)
    ├── index.css (159 lines)
    ├── main.tsx (14 lines)
    ├── __tests__/
    │   ├── appearance.test.ts (254 lines)
    │   ├── authClient.test.ts (309 lines)
    │   ├── cloudPhase4D3.test.ts (100 lines)
    │   ├── cloudPhase4D4.test.ts (162 lines)
    │   ├── cloudPhase4D5.test.ts (271 lines)
    │   ├── cloudWiring.test.ts (64 lines)
    │   ├── deviceAuthClient.test.ts (483 lines)
    │   ├── deviceFlow.test.ts (229 lines)
    │   ├── deviceKeys.test.ts (166 lines)
    │   ├── syncService.test.ts (158 lines)
    │   ├── i18n-compliance.test.ts (120 lines)
    │   ├── historyService.test.ts (249 lines)
    │   ├── historyWiring.test.ts (48 lines)
    │   ├── i18nArabicCoverage.test.ts (65 lines)
    │   ├── planService.test.ts (273 lines)
    │   ├── rtl.test.ts (129 lines)
    │   ├── sessionRunner.test.ts (330 lines)
    │   ├── sessionRunnerHardening.test.ts (433 lines)
    │   ├── supabaseEnv.test.ts (54 lines)
    │   ├── supabaseProbe.test.ts (91 lines)
    │   ├── supabaseWiring.test.ts (43 lines)
    │   ├── syncTransport.test.ts (173 lines)
    │   └── workoutRunnerScreen.test.ts (84 lines)
    ├── components/
    │   ├── Bar.tsx (54 lines)
    │   ├── BottomNav.tsx (86 lines)
    │   ├── Chip.tsx (59 lines)
    │   ├── ClayButton.tsx (54 lines)
    │   ├── ClayCard.tsx (27 lines)
    │   ├── CloudAccountCard.tsx (355 lines)
    │   ├── CloudSyncCard.tsx (94 lines)
    │   ├── DayChip.tsx (77 lines)
    │   ├── EmptyState.tsx (48 lines)
    │   ├── IconSet.tsx (133 lines)
    │   ├── indicatorOffset.ts (23 lines)
    │   ├── LogoIntro.tsx (97 lines)
    │   ├── Ring.tsx (68 lines)
    │   ├── SectionHeader.tsx (34 lines)
    │   ├── StatTile.tsx (42 lines)
    │   └── UpdateBanner.tsx (63 lines)
    ├── engine/
    │   ├── engineContext.ts (86 lines)
    │   ├── historyService.ts (184 lines)
    │   ├── planService.ts (305 lines)
    │   └── sessionRunner.ts (669 lines)
    ├── i18n/
    │   └── index.ts (809 lines)
    ├── screens/
    │   ├── AppearanceLab.tsx (315 lines)
    │   ├── HomeScreen.tsx (429 lines)
    │   ├── MoreScreen.tsx (531 lines)
    │   ├── ProgressScreen.tsx (174 lines)
    │   ├── TrainScreen.tsx (428 lines)
    │   └── WorkoutRunnerScreen.tsx (1039 lines)
    ├── storage/
    │   ├── idb.ts (59 lines)
    │   ├── index.ts (4 lines)
    │   ├── IndexedDbEventLog.ts (111 lines)
    │   ├── KeyValueStore.ts (107 lines)
    │   └── __tests__/storage.test.ts (153 lines)
    ├── supabase/
    │   ├── authClient.ts (368 lines)
    │   ├── deviceAuthClient.ts (424 lines)
    │   ├── deviceFlow.ts (145 lines)
    │   ├── deviceKeyStore.ts (100 lines)
    │   ├── deviceKeys.ts (159 lines)
    │   ├── env.ts (61 lines)
    │   ├── probe.ts (56 lines)
    │   └── syncTransport.ts (280 lines)
    ├── sync/
    │   ├── syncService.ts (99 lines)
    │   └── syncTriggers.ts (60 lines)
    ├── cloud/
    │   └── useCloudSession.ts (443 lines)
    └── styles/
        ├── clay.css (73 lines)
        ├── tokens.css (93 lines)
        └── skins/
            ├── aurora.css (85 lines)
            ├── brutal.css (83 lines)
            ├── glass.css (100 lines)
            ├── mono.css (66 lines)
            ├── neon.css (81 lines)
            ├── neu.css (91 lines)
            ├── oled.css (74 lines)
            └── paper.css (89 lines)

packages/
├── config/src/
│   ├── index.ts (1261 lines)
│   └── __tests__/config.test.ts (235 lines)
├── contracts/src/
│   ├── index.ts (422 lines)
│   └── __tests__/contracts.test.ts (205 lines)
├── engine-core/src/
│   ├── ai-contract.ts (227 lines)
│   ├── environment.ts (222 lines)
│   ├── exposure.ts (140 lines)
│   ├── horizon.ts (840 lines)
│   ├── index.ts (26 lines)
│   ├── knowledge.ts (192 lines)
│   ├── progression.ts (304 lines)
│   ├── ranking.ts (278 lines)
│   ├── session.ts (320 lines)
│   ├── validator.ts (403 lines)
│   └── __tests__/
│       ├── engine-core.test.ts (1422 lines)
│       ├── engine-guard.test.ts (28 lines)
│       ├── engine-honesty-e1a.test.ts (350 lines)
│       ├── numeric-literals-guard.test.ts (121 lines)
│       └── smoke.test.ts (12 lines)
├── events/src/
│   ├── index.ts (431 lines)
│   └── __tests__/events.test.ts (180 lines)
├── library/src/
│   ├── index.ts (1039 lines)
│   └── __tests__/library.test.ts (120 lines)
├── ports/src/
│   ├── index.ts (75 lines)
│   └── __tests__/smoke.test.ts (15 lines)
└── sim/src/
    ├── index.ts (90 lines)
    └── __tests__/simulation.test.ts (85 lines)
```

---

## 2. Exported Functions & Components per Package / Screen

### Packages
- **`@hfos/contracts`**: Zod schemas & types for UUIDv7, events, movements, exercises, units, sessions, athlete states.
- **`@hfos/config`**: `getEffectiveConfig`, `requireNumber`, `requireBoolean`, `requireRange`, `requireArray`, `requireObject`, `validateSettingValue`, `DEFAULT_SETTINGS`.
- **`@hfos/events`**: `EventLog` interface, event type guards, schemas, event factory helpers, `reduce`, `replay`.
- **`@hfos/library`**: `INITIAL_EXERCISE_LIBRARY`, progression links, equipment requirements.
- **`@hfos/ports`**: Storage, analytics, clock, id-generator, schedule-provider, and service port interfaces.
- **`@hfos/sim`**: `MOCK_USER`, simulation athlete generator, deterministic mock runners.
- **`@hfos/engine-core`**: Deterministic pure-TS training engine: `buildHorizon`, `slideHorizon`, `deriveTrainingState`, `generateSession`, `evaluateProgression`, `validateWorkoutPlan`, `rankCandidates`.

### Web App (`apps/web`)
- **`App`**: Root orchestrator managing navigation, splash launch, engine plan bootstrap, active workout routing, and IndexedDB hydration.
- **`HomeScreen`**: 7-day horizon strip, Day 0 locked hero workout card, consistency ring, and "Why this session?" rationale sheet.
- **`WorkoutRunnerScreen`**: Full-screen active workout execution UI: phase tracking, isolated Rest countdown Ring, config-driven RPE selector, reps stepper, honest pain toggle, pause/abandon modal dialogs with focus management + Escape, wake lock with visibility re-acquisition, degraded-storage banner, haptics, WebAudio rest chime.
- **`TrainScreen`**: Segmented control switching between active 7-day plan blueprint with day inspector and searchable exercise library.
- **`ProgressScreen`**: Mastery score ring, rep target mastery, RPE effort tracking, and movement exposure window.
- **`MoreScreen`**: Grouped navigation for Settings, Appearance Lab, Equipment, Data, and System Diagnostics.
- **`AppearanceLab`**: Live preview with controls for the visual style variant (9 skins — clay/glass/neu/mono/neon/aurora/brutal/paper/oled — each a two-ring swatch tile), accent presets, clay depth, corner radius, density, and haptics.
- **`CloudSyncCard`**: Honest cloud status card (More › About) — validates env config, probes the project's auth health endpoint once per mount, reports connected/unreachable/not-configured via i18n only.
- **`CloudAccountCard`** (Phase 4D2/4D3): the account surface (More › About) — inline sign-in form, device verification/recovery states, one-time recovery-codes display, Sync now / Sign out, a two-step **Deauthorize this device** confirm with an honest failure line carrying the real server code, and honest sync-result/sync-failure lines; i18n-only copy, logical (RTL-safe) classes only.
- **`supabase/authClient`** (Phase 4D2): Supabase Auth REST client without supabase-js — `signInWithPassword`, `refreshSession`, `getValidSession` (pre-emptive refresh within a 60 s TTL margin; 4xx refresh rejections clear the session while transient network/5xx failures deliberately keep it), `signOut` (best-effort global logout, never blocks local sign-out); `AuthSessionStore` port with `InMemory` + `KeyValue` implementations and defensive rehydration.
- **`supabase/deviceFlow`** (Phase 4D2): one idempotent state machine over the 4C primitives — `runDeviceFlow` (status → verified / enroll+verify with one-time codes / recovery_required with reasons) and `submitDeviceRecovery`; every outcome is data, server codes pass through verbatim.
- **`sync/syncService`** (Phase 4D2): `syncNow` — push all local envelopes (idempotent by primary key) then pull remote rows and merge only genuinely new ones into the local `EventLog`, with honest pushed/duplicates/pulled/merged accounting.
- **`sync/syncTriggers`** (Phase 4D4): the opportunistic auto-sync policy — `shouldSync({ ready, busy })` + `markStarted()`, gated on readiness and in-flight rounds, rate-limited to one round per `MIN_AUTO_SYNC_INTERVAL_MS` (30 s); pure and dependency-injected (fake clock in tests).
- **`cloud/useCloudSession`** (Phase 4D2/4D3/4D4): thin React glue — stages (checking/signed_out/device_flow/recovery/ready), mount-time restore + device-flow convergence, sign-in/recovery/sign-out actions, `sync()` with one re-verify retry when a 12 h device session lapsed, one **auto-sync per readiness transition** (re-arms only after `signed_out`) plus **opportunistic rounds on `visibilitychange`/`online` through the trigger policy**, a once-per-readiness-epoch **device-info refresh** (local enrolled device id + server `active_devices` count), `lastSyncAt` stamping on every completed round, and `deauthorize()` (server revoke → local key clear → sign-out; a failed revoke never pretends success); the app stays fully usable signed out.
- **`supabase/env` + `supabase/probe`**: env-driven config plumbing (`readSupabaseEnv`, degrades to typed `missing`/`invalid_url`, never throws) and injected-I/O liveness probe (`probeCloudConnection`); no supabase-js dependency yet (lands with auth in 4B/4C).
- **`supabase/deviceKeys`**: WebCrypto ECDSA P-256 device key core (Phase 4C) — `generateDeviceKeyPair` (private key non-extractable), `signNonce` (SHA-256 over the raw UTF-8 nonce, base64url out), `exportPublicJwk` (minimal `kty/crv/x/y` JWK), `isValidPublicDeviceJwk` (mirror of the server's `validPublicJwk`), and `verifyNonceSignature` (server-algorithm replica for tests).
- **`supabase/deviceKeyStore`**: `DeviceKeyStore` port persisting the enrolled-device record (`device_id`, `label`, `public_jwk`, non-extractable `private_key` as a structured-cloned `CryptoKey` — never serialized to a string). `InMemoryDeviceKeyStore` for tests, `KeyValueDeviceKeyStore` over the app's IndexedDB `kv` store for the browser, with defensive rehydration (`storedDeviceRecordFromUnknown`).
- **`supabase/deviceAuthClient`**: `device-auth` Edge Function client (Phase 4C) — `enrollCurrentDevice` (reuses orphaned key pairs; 409 passes through), `verifyCurrentDevice` (challenge → sign → verify, binding the auth `session_id` to a 12 h device session), `revokeCurrentDevice` (clears the local record on success), `recoverDevice` (fresh key pair + one-time recovery code), `fetchDeviceStatus`; plain fetch with injected I/O, discriminated results, server error codes surfaced verbatim (client-synthesized codes: `missing_token`, `bad_response`, `network_error`, `timeout`, `not_enrolled`, `signing_failed`).
- **`PlanService`**: Manages `getOrCreatePlan`, horizon sliding, day decision summaries, generation benchmarking, and event logging.
- **`sessionRunner`**: Session runner state, `sessionReducer`, event emission (`session.started`, `session.set_logged`, `session.completed`, `session.abandoned`), dynamic rest computation with ceiling-clamped extensions, in-flight persistence.

---

## 3. Files Changed in this Task (Phase 4D5 — system theme mode + per-device rows)
- `apps/web/src/appearance.ts` (+65 lines: `ThemeMode` (`manual`/`system`) + `style_light`/`style_dark` in `AppearanceSettings`; `isDarkStyle` classification; `resolveEffectiveStyle(settings, systemDark)`; `systemPrefersDark()` (dark outside a browser); `effectiveAppearance()`; sanitize now migrates legacy payloads — mode stays `manual` and the stored valid style joins the scheme it belongs to; `saveAppearance` persists raw and applies the resolved appearance).
- `apps/web/src/screens/AppearanceLab.tsx` (+36 lines: a two-option theme-mode segmented control at the top of Control 1, an honest hint while system mode is active, and WYSIWYG swatch semantics — the highlight and the click target follow the skin currently painted, i.e. the active scheme's `style_light`/`style_dark` in system mode).
- `apps/web/src/bootstrap.ts` + `apps/web/src/App.tsx`: pre-paint now applies the theme-mode-resolved appearance (no flash of the wrong scheme's skin), and while `theme_mode = system` a `matchMedia('(prefers-color-scheme: dark)')` change listener re-applies live when the OS scheme flips with the app open (removed on cleanup).
- `supabase/migrations/20261105000000_p4d5_device_last_seen.sql` (new: `alter table public.authorized_devices add column if not exists last_seen_at timestamptz` — nullable, owner-applied via SQL editor; deployment order with the function redeploy is safe either way).
- `supabase/functions/device-auth/index.ts` (contract v2): `verify` stamps `last_seen_at` on the device (best-effort try/catch — a pre-migration database never fails a verification); `status` selects `id, label, created_at, last_seen_at` for non-revoked devices ordered by creation and spreads a `devices` array only when the query survives — an unknown column degrades to the exact v1 payload.
- `apps/web/src/supabase/deviceAuthClient.ts` (+47 lines: `DeviceStatusRow`; `DeviceStatus.devices: rows | null`; `parseDeviceRows` — non-array → null, malformed entries dropped individually, non-string timestamps → null; `fetchDeviceStatus` parses defensively so a v1 server still works).
- `apps/web/src/cloud/useCloudSession.ts` (`deviceRows` in state/INITIAL/`SIGNED_OUT_RESET`/sign-out reset; the readiness-epoch status probe now patches rows alongside the count).
- `apps/web/src/components/CloudAccountCard.tsx` (ready section: when server rows exist they lead — label + `Last seen {time}`/`Not seen yet` + a `This device` chip matched against the local enrolled id; without rows the 4D4 count + short-id fallback stays; `formatSeen` with an honest `--` for garbage timestamps).
- `apps/web/src/i18n/index.ts` (6 new keys in both dicts: `appearance.theme_mode_manual/system/hint` + `account.device_row_current/device_last_seen/device_never_seen`; now 277/277 parity).
- `apps/web/src/__tests__/cloudPhase4D5.test.ts` (new, 21 tests) + `appearance.test.ts` (literals moved to the 10-field contract) + `deviceAuthClient.test.ts` (v1 payload expectation gains `devices: null`) + `cloudPhase4D4.test.ts` (pinned probe/reset strings follow the widened contract).
- `docs/REPORT_PHASE4D5.md`, `docs/STATE.md`.

### Previous: Files Changed in this Task (Phase 4D4 — opportunistic auto-sync + honest device facts)
- `apps/web/src/sync/syncTriggers.ts` (new, 60 lines: the pure trigger policy — `shouldSync({ ready, busy })` + `markStarted()`, never fires while not ready or a round is in flight, rate-limited to one round per `MIN_AUTO_SYNC_INTERVAL_MS` (30 s); injectable clock + interval for tests; deliberately trigger-agnostic with the extension point documented).
- `apps/web/src/cloud/useCloudSession.ts` (+149 lines: one mount-scoped effect listening to `window online` + `document visibilitychange` (visible-only), routed through the policy via a `stateRef` snapshot and reusing the existing `sync()`; the Phase 4D3 cold-start round now feeds the same limiter (`markStarted()`) so a quick background/foreground cannot double-fire; a once-per-readiness-epoch device-info refresh — `loadEnrolledDeviceId` from the local key store + `fetchDeviceStatus` for the server's `active_devices` count, failed probes stay informational (count unknown, no error noise), facts reset + epoch re-arms on `signed_out`; `lastSyncAt: Date.now()` stamped on every completed round; `activeDevices`/`deviceId`/`lastSyncAt` added to state, `INITIAL`, `SIGNED_OUT_RESET`, and every sign-out path).
- `apps/web/src/components/CloudAccountCard.tsx` (ready section: three null-guarded fact lines — `Active devices: {count}` (server truth), `This device · {id}` (8-char mono/LTR, full id as `title`), `Last sync {time}` (HH:mm via `formatClock`); each renders only when its fact is actually known).
- `apps/web/src/i18n/index.ts` (3 new keys in both dicts: `account.active_devices`, `account.this_device`, `account.last_sync`; now 271/271 parity).
- `apps/web/src/__tests__/cloudPhase4D4.test.ts` (new, 16 tests: 6 policy unit tests on an injected fake clock — readiness/busy gates, rate-limit window open/close, busy gate beyond the window, 30 s default; 6 hook wiring guards — both listeners + cleanup + visible-only, policy routing with exactly two `markStarted()` sites, epoch-scoped device-info refresh, silent status-probe failure, 3 `lastSyncAt` stamps, signed-out resets; 2 card guards — all three facts null-guarded + short id with full title; 2 i18n guards — both dicts non-empty + placeholder parity).
- `docs/REPORT_PHASE4D4.md`, `docs/STATE.md`.

### Previous: Files Changed in this Task (Appearance Skins Lab — style picker + 4 new skins)
- `apps/web/src/styles/skins/` (8 files): the four inherited skins (`glass`, `neu`, `mono`, `neon` — landed uncommitted by a prior session, now committed) plus four new skins `aurora`, `brutal`, `paper`, `oled`. Every skin overrides the same five recipe classes (`.clay`, `.clay-sm`, `.clay-pressed`, `.clay-accent`, `.clay-flat`) under `html[data-style=…]` — no component branches on the active style; each file carries its own performance budget (no backdrop-filter outside the glass budget, no animated box-shadow, blur-free hard shadows on brutal, zero-bloom hairlines on oled).
- `apps/web/src/appearance.ts`: `StyleVariant` + `STYLE_VARIANTS` grew to 9 variants; the single neu ink-safe mix became `INK_SAFE_ACCENT_MIX` (per-skin targets: neu `#2a3050`, paper `#3d3229`, brutal `#26251c`) consumed by `accentValueForStyle`; new `STYLE_PRESETS` (label key + two-ring swatch colors per skin).
- `apps/web/src/index.css`: imports all 8 skin stylesheets (activated by `data-style`, always shipped, zero JS cost).
- `apps/web/src/screens/AppearanceLab.tsx` (the feature this task actually completes — the skins existed with no UI to reach them): new Control 1 “Visual style” — 9 two-ring swatch tiles (page bg + card surface per skin), same selected-state language as the other controls; control comments renumbered.
- `apps/web/src/i18n/index.ts`: 10 new keys in both dicts (`appearance.style_label` + 9 skin names) plus an updated `more.item_appearance_desc`; arDict parity enforced by `Record<keyof typeof enDict, string>`.
- `apps/web/src/__tests__/appearance.test.ts` (rewritten, 5 → 12 tests: defaults now assert `style`; every registered variant survives sanitize; bogus style falls back to clay; raw accent on dark skins vs ink-mixed on neu/paper/brutal; `STYLE_PRESETS` covers all variants with labels that resolve in enDict; shell/skins token-driven source guard; `applyAppearanceToDOM` now asserts `data-style` with an attribute-capturing fake root — the old test crashed on the inherited setAttribute plumbing; dark-skin switch keeps the raw accent).
- `apps/web/src/styles/tokens.css` + `apps/web/src/App.tsx` + `apps/web/src/components/{LogoIntro,UpdateBanner}.tsx` (the bug the live browser rehearsal caught: the app shell hardcoded the clay palette `bg-[#0a0a10] text-[#f1f1f4]` ON TOP of the token-driven body, so every light skin floated cream cards on a black page): shell + splash now paint `bg-[var(--bg)] text-[var(--text)]` (byte-identical for clay), and a new `--accent-ink` token (default `#08080c`, `#ffffff` on neu/brutal/paper) drives ink placed on top of accent fills — `UpdateBanner`'s apply button uses it and the lab preview button stopped forcing `text-black` over the skin's ink. A source-guard test locks both in.
- `docs/REPORT_APPEARANCE_SKINS.md`, `docs/STATE.md`.

### Previous: Files Changed in this Task (Phase 4D3 — auto-sync, honest deauthorize, server housekeeping)
- `apps/web/src/cloud/useCloudSession.ts` (auto-sync effect — one `sync()` per readiness transition, ref-guarded, re-armed after `signed_out`; `deauthorize` action — `revokeCurrentDevice` then local sign-out, with the honest failure posture: any revoke failure surfaces the real code and keeps the user verified; only `not_enrolled` falls through to the local break; `SIGNED_OUT_RESET` hoisted to module scope).
- `apps/web/src/components/CloudAccountCard.tsx` (two-step deauthorize confirm — hint + confirm/cancel pair, disabled while busy; `account.deauthorize_failed` alert with the real code inside the ready section).
- `apps/web/src/i18n/index.ts` (5 new keys in both dicts: `account.deauthorize`, `account.deauthorize_hint`, `account.deauthorize_confirm`, `account.cancel`, `account.deauthorize_failed`).
- `supabase/migrations/20261104000000_p4d3_cleanup_expired_device_auth.sql` (new: deletes only expired `device_challenges` + lapsed `device_sessions` with row counts; never touches `authorized_devices`/`recovery_codes`; two `expires_at` indexes; owner-applied via SQL editor, optional pg_cron schedule included as a comment).
- `apps/web/src/__tests__/cloudPhase4D3.test.ts` (new, 7 tests: auto-sync fires exactly once per readiness and re-arms only after `signed_out`; sync() early-return posture; revoke-then-sign-out ordering; failed revoke never pretends success — failure branch returns before any local sign-out; card two-step confirm + all 5 keys in BOTH dicts; migration has exactly two deletes and never touches authoritative rows).
- `docs/REPORT_PHASE4D3.md`, `docs/STATE.md`.

### Previous: Files Changed in this Task (Live E2E rehearsal tooling)
- `scripts/e2e_device_auth.mjs` (new, 403 lines: zero-dependency Node 18+ operator script — real-wire rehearsal of device auth + `session_events` RLS; 23 stations, 26 with an email+password test user; signs the server nonce as raw UTF-8 ECDSA P-256/SHA-256 → unpadded base64url; never prints tokens/nonces/recovery codes; fresh disposable user per run; exit 0/1/2; manual only, never part of `npm test`/CI).
- `package.json` (new script: `e2e:live` → `node scripts/e2e_device_auth.mjs`).
- `eslint.config.js` (scripts-block globals extended with the Node 18+ built-ins the rehearsal uses — `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `atob`, `btoa`, `fetch`, `AbortSignal`, `crypto` — `no-undef` is disabled for TS files but applies to `.mjs`).
- `docs/REPORT_LIVE_E2E.md` (new: station ledger, live evidence banked so far, the single remaining gate — test-user acquisition — and honest non-goals).
- `docs/STATE.md`.

### Previous: Files Changed in this Task (E1b Residuals — honest UI + persistent device id)
- `apps/web/src/bootstrap.ts` (new helper: `getPersistentDeviceId` — one UUIDv7 per installation in kv `hfos.device_id`, corrupt values regenerated).
- `apps/web/src/engine/planService.ts` (plan events carry the persistent device id; `DayDecisionSummary` honest: unit from `PlanDay.unit`, reasons = typed i18n keys + REAL top-3 term contributions from the day's DecisionRecord, `revision_reason` passthrough, `inputs_defaulted` surfaced).
- `apps/web/src/screens/WorkoutRunnerScreen.tsx` (session events carry the persistent device id; hard-coded `device-redmi12-local` removed).
- `apps/web/src/screens/HomeScreen.tsx` (why-sheet renders typed reasons + numeric contribution chips; legacy string summaries labeled as estimates; defaulted-inputs honesty banner).
- `apps/web/src/engine/engineContext.ts` (**bug fix**: `SystemIdGenerator` produced malformed UUIDv7s — 10-char final group; now 18 random hex chars, true 8-4-4-4-12).
- `apps/web/src/i18n/index.ts` (20 new keys in both dicts; dead mock keys `train.session_unit`/`train.session_duration` removed).
- `apps/web/src/__tests__/planService.test.ts` (3 new tests: device id persistence/format, summary honesty vs DecisionRecord, revision passthrough).
- `docs/REPORT_E1B_RESIDUAL.md`, `docs/STATE.md`.

### Previous: Files Changed in this Task (Phase 4C — Device Auth Client)
- `apps/web/src/supabase/deviceKeys.ts` (new, 159 lines: WebCrypto ECDSA P-256 core — `generateDeviceKeyPair` with a non-extractable private key, `signNonce` = ECDSA/SHA-256 over the raw UTF-8 nonce bytes → unpadded base64url, `exportPublicJwk` minimal `kty/crv/x/y`, `isValidPublicDeviceJwk` mirroring the server's `validPublicJwk`, `verifyNonceSignature` replicating the Edge Function's verification byte-for-byte, base64url codecs, `isCryptoPrivateKey` duck-type guard).
- `apps/web/src/supabase/deviceKeyStore.ts` (new, 100 lines: `DeviceKeyStore` port + `StoredDeviceRecord` (`device_id` nullable for orphans, `public_jwk`, non-extractable `private_key` persisted via IndexedDB structured clone — no secret ever stringified); `InMemoryDeviceKeyStore`, `KeyValueDeviceKeyStore` over the existing `kv` store, defensive `storedDeviceRecordFromUnknown` rehydration).
- `apps/web/src/supabase/deviceAuthClient.ts` (new, 377 lines: `device-auth` Edge Function client — `callDeviceAuth` POST transport with apikey/Bearer headers, abortable timeout, honest result objects; `enrollCurrentDevice` with orphan-key reuse, `verifyCurrentDevice` challenge→sign→verify, `revokeCurrentDevice` with local clear-on-success, `recoverDevice` with fresh keys + normalized code, `fetchDeviceStatus`; server error codes verbatim, client-synthesized codes documented).
- `apps/web/src/__tests__/deviceKeys.test.ts` (new, 10 tests: key shape incl. `extractable === false`, minimal-JWK export, signature round-trip against a byte-for-byte replica of the server's `verifySignature`, tamper rejection, RFC 4648 base64url vectors, JWK validation matrix, import/re-export stability).
- `apps/web/src/__tests__/deviceAuthClient.test.ts` (new, 25 tests: transport headers/URL, verbatim error passthrough, missing-token short-circuit, network/timeout/`bad_response` paths; enroll happy path + orphan reuse + 409 refusal + malformed bodies; verify flow with the mock server actually verifying the signature via the deployed algorithm, `not_enrolled` short-circuit, challenge/verify failure surfacing; revoke clear/keep semantics; recover fresh-key replacement + code normalization; status passthrough/coercion; corrupt-record rehydration; source guards against hard-coded URLs/secrets and contract drift).
- `docs/REPORT_PHASE4C.md`, `docs/STATE.md`.

### Previous: Files Changed in this Task (Phase 4B/4D1 — Live Schema + Sync Data Layer)
- `supabase/migrations/20261103000000_p4d1_session_events_sync.sql` (new, 45 lines: append-only `session_events` cloud mirror of the EventEnvelope log — `idempotency_key` PK, user FK, payload jsonb, occurred_at indexes; RLS authoritative with user scoping **and** `device_session_valid()` gate; select+insert only for authenticated — no update/delete policies).
- `apps/web/src/supabase/syncTransport.ts` (new, 280 lines: `toSyncRow`/`envelopeFromSyncRow` mapping with defensive rehydration; `pushEvents` — batched POST with `resolution=ignore-duplicates,return=representation` for honest pushed/duplicates accounting; `pullEvents` — cursor pagination by `occurred_at`; injected fetch/clock/timeout, no supabase-js).
- `apps/web/src/__tests__/syncTransport.test.ts` (new, 7 tests: mapping round-trip incl. `supersedes_event_id`, malformed-row tolerance, batch chunking 25→3 chunks, duplicate accounting 3/22, auth+Prefer headers, pull pagination via short page, HTTP failure paths).
- `docs/REPORT_PHASE4D1.md`, `docs/STATE.md`.

### Previous: Files Changed in this Task (Phase 4A — Supabase Foundation Wiring)
- `.env.example` (placeholders for `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`; real values live only in the gitignored `.env` — publishable key is public by design, never the secret/service_role).
- `apps/web/src/supabase/env.ts` (new, 61 lines: `readSupabaseEnv` validates and origin-normalizes config from `import.meta.env`; degrades to typed `missing`/`invalid_url` results, never throws; plain http accepted on loopback only).
- `apps/web/src/supabase/probe.ts` (new, 56 lines: `probeCloudConnection` against the project's `/auth/v1/health` with injected fetch/clock/timeout; honest `online`/`latency_ms`/`http_status`).
- `apps/web/src/components/CloudSyncCard.tsx` (new, 94 lines: honest cloud status card — not configured / invalid config / checking / connected / unreachable; i18n-only copy; RTL-safe logical classes).
- `apps/web/src/screens/MoreScreen.tsx` (renders `<CloudSyncCard />` in the About diagnostics view).
- `apps/web/src/i18n/index.ts` (added 8 `sync.*` keys in both dicts; now 284/284 parity).
- `apps/web/src/__tests__/supabaseEnv.test.ts` (new, 4 tests), `supabaseProbe.test.ts` (new, 5 tests: success latency, trailing-slash normalization, 521 paused-project, network failure, timeout abort), `supabaseWiring.test.ts` (new, 3 source guards incl. `.env` gitignored and no hard-coded copy).
- `docs/REPORT_PHASE4A.md`, `docs/STATE.md`.

### Previous: Files Changed in (History Wiring — deferred item)
- `apps/web/src/engine/historyService.ts` (new, 184 lines: pure `buildHistorySummary` over injected envelopes + `loadHistorySummary` EventLog loader; window sizes from `@hfos/config`; pattern fallback via `@hfos/library`; defensive idempotency dedupe).
- `apps/web/src/__tests__/historyService.test.ts` (new, 9 behavioral tests: empty-log honesty, 7-day completion window, rep-target hits + average RPE, 14d pattern vs 7d muscle exposure, library pattern fallback, planned main sessions, idempotency dedupe, abandoned semantics, InMemoryEventLog round-trip).
- `apps/web/src/__tests__/historyWiring.test.ts` (new, 3 source guards: App wiring, non-estimate bars, i18n-only labels).
- `apps/web/src/screens/ProgressScreen.tsx` (real mastery ring = rep-target hit rate, real sets/RPE tiles, real pattern exposure bars with `estimate={false}`, conditional honest empty state; static mock values removed).
- `apps/web/src/screens/HomeScreen.tsx` (consistency ring fed by real counts with overflow clamp, i18n interpolation for consistency line, unit labels via i18n keys, mock session title removed).
- `apps/web/src/App.tsx` (loads history after plan, refreshes after session completion, passes summary to both screens).
- `packages/config/src/index.ts` (added `history_consistency_window_days` (7), `history_exposure_window_days` (14); consumer `history_service`).
- `packages/config/src/__tests__/config.test.ts` (history window settings test).
- `apps/web/src/i18n/index.ts` (added 10 `pattern.*` labels + `progress.tracked_locally` + `home.consistency_progress` + 4 unit keys, both dicts; now 268/268 parity).
- `docs/REPORT_HISTORY_WIRING.md`, `docs/STATE.md`.

### Previous: Files Changed in Phase 3
- `apps/web/src/i18n/index.ts` (added the 146 missing Arabic translations — arDict now covers all 252 enDict keys; declaration tightened from `Partial<typeof enDict>` to `Record<keyof typeof enDict, string>` so missing keys are a compile error).
- `apps/web/src/__tests__/i18nArabicCoverage.test.ts` (new, 65 lines: key parity, Arabic-script presence, `{placeholder}` parity, and `t()` resolving every key from arDict in Arabic mode).
- `apps/web/src/__tests__/rtl.test.ts` (added the permanent RTL audit guard: physical direction classes (`ml-/mr-/pl-/pr-/text-left/text-right/rounded-l/rounded-r/border-l/border-r/left-N/right-N`) and physical CSS box properties fail the suite).
- `apps/web/src/screens/HomeScreen.tsx` (`ml-1` → `ms-1`).
- `apps/web/src/screens/MoreScreen.tsx` (`text-left` → `text-start`, 5 occurrences).
- `apps/web/src/screens/TrainScreen.tsx` (`text-right` → `text-end`).
- `docs/REPORT_PHASE3.md`, `docs/STATE.md`.

### Previous: Files Changed in Phase 2C
- `packages/config/src/index.ts` (added `rpe_min`, `rpe_max`, `rpe_step` settings).
- `packages/config/src/__tests__/config.test.ts` (Phase 2C RPE scale settings test).
- `apps/web/src/engine/sessionRunner.ts` (EXTEND_REST ceiling clamp + no backward motion; `target_reps` added to `session.set_logged` payload; SKIP_SET-out-of-warmup fix so rest advances to the working exercise).
- `apps/web/src/screens/WorkoutRunnerScreen.tsx` (config-driven RPE scale via `buildRpeOptions`; visibilitychange wake-lock re-acquisition + stale-deadline re-sync; degraded-storage banner; modal focus management + Escape; aria-live phase chip).
- `apps/web/src/i18n/index.ts` (added `runner.degraded_banner`, `runner.degraded_dismiss` in both dicts).
- `apps/web/src/__tests__/sessionRunnerHardening.test.ts` (12 behavioral reducer tests).
- `apps/web/src/__tests__/workoutRunnerScreen.test.ts` (guard test 4 updated for config-driven RPE).
- `docs/REPORT_PHASE2C.md`, `docs/STATE.md`.

### Previous: Files Changed in Phase 2B
- `apps/web/src/screens/WorkoutRunnerScreen.tsx` (UI for workout session execution).
- `apps/web/src/screens/HomeScreen.tsx` (connected Day-0 card Start Workout to `onStartWorkout`).
- `apps/web/src/App.tsx` (wired `activeWorkoutDay`, restored in-flight workout, hidden navigation during session).
- `apps/web/src/i18n/index.ts` (added all `runner.*` keys in English and real Arabic).
- `apps/web/src/__tests__/workoutRunnerScreen.test.ts` (10 unit/guard tests verifying component contracts and props).
- `docs/REPORT_PHASE2B.md` (completion report for Phase 2B).
- `docs/STATE.md` (updated project state map, test totals, and file tree).

---

## 4. Test Counts per Package

Total: **37 test files, 338 tests passing**.
- `packages/engine-core`: 71 tests (engine-core: 59, engine-honesty-e1a: 9, engine-guard: 1, numeric-literals: 1, smoke: 1)
- `packages/contracts`: 21 tests
- `packages/config`: 16 tests
- `packages/events`: 7 tests
- `packages/library`: 9 tests (library: 7, smoke: 2)
- `packages/sim`: 4 tests (simulation: 1, smoke: 3)
- `packages/ports`: 1 test
- `apps/web`: 209 tests (deviceAuthClient: 25, sessionRunnerHardening: 12, authClient: 14, deviceFlow: 9, deviceKeys: 10, historyService: 9, workoutRunnerScreen: 10, planService: 9, syncTransport: 7, syncService: 6, supabaseProbe: 5, cloudWiring: 5, cloudPhase4D3: 7, cloudPhase4D4: 16, cloudPhase4D5: 21, sessionRunner: 6, storage: 4, appearance: 12, supabaseEnv: 4, rtl: 7, i18nArabicCoverage: 4, historyWiring: 3, supabaseWiring: 3, i18n-compliance: 1)

---

## 5. Known Issues and TODOs
- **Done (Phase 3)**: Arabic dictionary is at 100% coverage (now 268/268 keys in both dicts) and a permanent RTL audit guard blocks physical direction classes/CSS.
- **Done (History Wiring)**: the deferred item is complete — ProgressScreen and HomeScreen now derive mastery, consistency, and exposure from the append-only session event log via `historyService`; static mock metrics were removed.
- **Done (Phase 4A)**: Supabase foundation wiring — env-driven config (`.env` gitignored; `.env.example` placeholders), `readSupabaseEnv` validation, `probeCloudConnection` auth-health probe, `CloudSyncCard` honest status (More › About).
- **Done (Phase 4B)**: M0-15 schema applied live by the owner via the SQL editor (`Success. No rows returned`); externally verified — `spike_data` anon access flipped from `404 PGRST205` (table missing) to `401 42501` (permission denied), exactly the revoked-privilege posture.
- **Done (4C verification)**: the `device-auth` edge function survived the pause — it responds `401 {"error":"missing_token"}` (its own contract error, not "Function not found"). No redeploy needed.
- **Done (Phase 4C client-side)**: full device auth client — `deviceKeys` (ECDSA P-256, non-extractable private key, server-mirrored signing/validation), `deviceKeyStore` (port + IndexedDB structured-clone persistence of the `CryptoKey`), `deviceAuthClient` (enroll / challenge→sign→verify / revoke / recover / status against the deployed function contract). 35 new tests (total 250), all green; no app wiring yet — the UI layer is intentionally untouched.
- **Done (Phase 4D2)**: auth integration + sync orchestration — `authClient` (Auth REST + session store), `deviceFlow` (status/enroll/verify/recovery state machine), `syncService` (idempotent push+pull+merge), `useCloudSession` hook, `CloudAccountCard` UI (More › About) with full en/ar i18n (28 new keys), App wiring (`cloud.sync()` after workout completion). 34 new tests (total 284), all green; bundle 137.47/300 KB.
- **Done (Phase 4D1)**: sync data layer — `session_events` migration (append-only, user + device-session RLS) and `syncTransport` (batched idempotent push, cursor pull) with 7 tests. Migration applied live by the owner and externally verified: anon `GET /rest/v1/session_events` answers `401 42501 permission denied` (table present, revoked-privilege posture).
- **Done (E1b residuals)**: honest UI + persistent device id — plan/session events carry a persistent UUIDv7 device id (`hfos.device_id` in kv) instead of `redmi12_client`/`device-redmi12-local`; decision summaries derive unit from `PlanDay.unit`, reasons from the day's DecisionRecord term_values (top-3 real contributions as i18n keys + 0–100 chips) or `reason_code`, real `revision_reason` passthrough, defaulted-inputs honesty banner; fixed `SystemIdGenerator` malformed-UUID bug (10-char final group). 3 new tests (total 287), CI green.
- **Done (Appearance Skins)**: the visual style system is complete and reachable — 9 skins (clay/glass/neu/mono/neon inherited + new aurora/brutal/paper/oled), a swatch style picker in the Appearance Lab (the skins previously shipped with no UI to switch them), per-skin ink-safe accent mixing on light skins, and the tokenized app shell + `--accent-ink` token that the live browser rehearsal proved necessary (the hardcoded clay shell had every light skin floating on black). 12 new tests (total 301; the inherited plumbing had left the old appearance tests failing locally), live-verified in a real browser: all 9 tiles switch `data-style`, the choice survives reload, light skins paint their own page background; bundle 139.84/300 KB.
- **Done (Phase 4D3)**: auto-sync on start (one `sync()` per readiness transition, re-armed after sign-out), honest deauthorize action surfaced in the Account card (server revoke → local key clear → sign-out; a failed revoke keeps the user verified and shows the real code — only `not_enrolled` falls through), and the expired-challenge/session cleanup migration landed (owner-applied). 7 new tests (total 294), bundle 139.09/300 KB.
- **Done (Phase 4D4)**: opportunistic auto-sync + honest device facts — a pure trigger policy (`syncTriggers`, 30 s rate limit, readiness/busy gates) drives `visibilitychange`/`online` rounds through the existing `sync()` path; the 4D3 cold-start round feeds the same limiter; the Account card's ready section now shows the server's `active_devices` count, this browser's short device id, and a `Last sync HH:mm` stamp from `lastSyncAt` (stamped on every completed round, honest failures included); 3 new i18n keys in both dicts. 16 new tests (total 317), bundle 140.51/300 KB.
- **Done (Phase 4D5)**: auto theme mode + per-device rows — `theme_mode: manual/system` with a skin per scheme (`style_light` default paper, `style_dark` default clay), legacy settings migrate honestly, pre-paint + live `matchMedia` re-apply keep the scheme-matching skin, and the lab picker edits the skin the device is currently showing; the account card lists the server's non-revoked devices with label, `Last seen`, and a `This device` chip (edge function v2 stamps `last_seen_at` on verify and degrades to the v1 payload before the migration lands). 21 new tests (total 338), bundle 141.43/300 KB. Owner actions: apply `20261105000000_p4d5_device_last_seen.sql`, then redeploy `device-auth`.
- **Deployment note**: nothing to deploy server-side for 4C/4D2/4D3 beyond two owner actions — (1) apply `supabase/migrations/20261104000000_p4d3_cleanup_expired_device_auth.sql` in the SQL editor (optionally schedule it with the included pg_cron snippet), and (2) provide a test user for the live E2E rehearsal (`npm run e2e:live`, see `docs/REPORT_LIVE_E2E.md`): a dashboard-created user with Auto Confirm ✔ (option A, full 26 stations) or temporarily enabling anonymous sign-ins (option B, 23 stations). The project correctly ships with open signups and the anonymous provider disabled (re-confirmed live: `422 signup_disabled`, `422 anonymous_provider_disabled`).
- **Push note**: `c03acb5` (e2e tooling) + `c8d5e97` (Phase 4D3) were pushed to `origin/main` and CI finished green (run for `c8d5e97`, all steps success, ~38 s — the repo's normal duration).
- **Possible next (4D6 candidates)**: surfacing per-device `created_at`/"added when" in the card rows and a per-device revoke button (needs a verified-session action contract extension); cursor-based pull only if the event log ever grows (currently a deliberate full pull); a motion personality per skin (currently every skin shares the global motion tokens); restricting the spike-only CORS `Access-Control-Allow-Origin: '*'` on `device-auth` to the app origin (M0-15b note).

---

## 6. Current Settings Keys (`@hfos/config`)
1. `execution_horizon_days` (default: 7)
2. `min_main_session_minutes` (default: 30)
3. `transition_seconds` (default: 15)
4. `rest_dynamic` (default: true)
5. `rest_floor_seconds` (default: 30)
6. `rest_ceiling_seconds` (default: 180)
7. `warmup_sets_default` (default: 1)
8. `cooldown_duration_minutes` (default: 5)
9. `target_rpe_default` (default: 7.5)
10. `rpe_min` (default: 6.0)
11. `rpe_max` (default: 9.5)
12. `rpe_step` (default: 0.5)
12a. `history_consistency_window_days` (default: 7)
12b. `history_exposure_window_days` (default: 14)
13. `readiness_checkin_weight` (default: 0.25)
14. `rank_weight_priority_need` (default: 1.0)
15. `rank_weight_stimulus_gap` (default: 1.0)
16. `rank_weight_progression_need` (default: 1.0)
17. `rank_weight_goal_weight` (default: 1.0)
18. `rank_weight_schedule_fit` (default: 1.0)
19. `rank_weight_readiness` (default: 1.0)
20. `stimulus_gap_no_history` (default: 1.0)
21. `progression_need_default` (default: 0.5)
22. `readiness_default` (default: 0.8)
23. `preferred_session_minutes` (default: 45)
24. `min_eligible_patterns_per_unit` (default: 2)
25. `unit_goal_weights` (object: strength/hypertrophy/endurance weights)
