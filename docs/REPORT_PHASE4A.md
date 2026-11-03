# Phase 4A Report — Supabase Foundation Wiring

Executed directly on the repository, on top of `main` @ `f611c60` (history wiring).
Scope: first slice of Phase 4 — env-driven Supabase configuration, a truthful
connectivity probe, and an honest cloud status card. Auth (4C) and event sync
(4D) intentionally not started. All outputs below are from actual terminal runs
in this session.

## 1. Summary
- `.env` (gitignored, verified via `git check-ignore`) now holds the real
  project URL and publishable key; `.env.example` carries empty placeholders
  with usage comments. No credential was committed — `git status` shows only
  the five intended source files plus docs.
- `apps/web/src/supabase/env.ts`: `readSupabaseEnv()` reads
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, trims, origin-normalizes
  the URL, requires https except on loopback hosts, and returns a typed result
  (`missing` / `invalid_url`) instead of throwing.
- `apps/web/src/supabase/probe.ts`: `probeCloudConnection()` fetches the
  project's `/auth/v1/health` with the publishable key as `apikey`, with
  injected fetch/clock/timeout (8 s default) and honest
  `{online, latency_ms, http_status}` output.
- `apps/web/src/components/CloudSyncCard.tsx` + `MoreScreen` (About view):
  status card with five states — not configured / invalid configuration /
  checking / connected (+ latency) / unreachable. All copy via i18n (`sync.*`,
  8 keys × 2 dictionaries; dictionaries now 284/284). RTL-safe logical classes.
- No `@supabase/supabase-js` dependency added yet: Phase 4A needs connectivity
  truth only (plain fetch). The client library lands with device auth in 4B/4C,
  keeping this slice minimal and the bundle untouched.

## 2. Configuration Cited
- Supabase project referenced by the user: `https://tbyqtmgxomznpemkkaee.supabase.co`.
- Publishable key: stored only in the gitignored `.env` (value not reproduced
  in this report; it is public-by-design but kept out of version control).
- Live-state verification performed before implementation:
  - DNS: previously NXDOMAIN (project paused); during this session the project
    came back online.
  - `GET /auth/v1/health` → **HTTP 200**.
  - `GET /rest/v1/spike_data` → **404 PGRST205** (`Could not find the table
    'public.spike_data'`) — the M0-15 migration has **never been applied** to
    this project's database.
- CSP already allows the endpoint: `connect-src 'self' https://*.supabase.co`.

## 3. Raw DoD Outputs (actual runs)
- `npm run typecheck` → `tsc --noEmit && tsc --noEmit -p packages/engine-core/tsconfig.json` — exit 0, no output.
- `npm run lint` → `eslint .` — exit 0, no output.
- `npx vitest run` → `Test Files 27 passed (27)` / `Tests 208 passed (208)`.
  New in this phase: `supabaseEnv.test.ts` (4), `supabaseProbe.test.ts` (5),
  `supabaseWiring.test.ts` (3).
- `npm run build` → PWA `precache 14 entries (601.40 KiB)`; build-time env
  inlining verified: the project URL is present in `dist/assets/index-*.js`.
- `npm run check:bundle` → `Total gzipped JS: 130.83 KB (budget: 300 KB)` —
  `✅ PASSED: Within performance budget.` (+1.18 KB vs 129.65 KB at history
  wiring).
- `git status` → clean after commit; `.env` never listed (ignored).
- Secret scan of `dist/` for `service_role|SUPABASE_SERVICE|secret` → no match.

## 4. Failures / Skipped
- None. One iteration: the wiring guard initially expected a literal
  `t('sync.status_online')` call, but the card resolves status labels through
  the typed `STATUS_LABEL_KEY` record; the guard was corrected to assert the
  record and key literal (architecture unchanged, test matched reality).

## 5. Deviations / Notes
- The publishable key is intentionally embedded in the production bundle by
  Vite env inlining — that is its design (RLS-protected public key). The
  secret/service_role key must never appear in `.env*` files used by the app.
- The card probes once per mount (each visit to More › About), which gives a
  fresh truth without background polling; polling/sync scheduling is a 4D
  concern.
- The live database is empty of the M0-15 schema (`PGRST205`), so 4B must
  apply `supabase/migrations/20261009000000_m0_15_device_auth.sql` before any
  auth or sync code can talk to real tables.
