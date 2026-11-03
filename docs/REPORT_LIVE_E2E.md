# Live E2E Rehearsal — Device Auth + Sync RLS (Tooling Landed)

Executed directly on the repository, on top of `main` @ `46f2f20`.
Scope: land the operator tool for the live end-to-end rehearsal of the deployed
`device-auth` Edge Function and the `session_events` RLS, document exactly what
the rehearsal covers, and name the single remaining gate. All terminal outputs
below are from actual runs in this session.

## 1. Why a Live Rehearsal at All
The 287 unit tests exercise the clients against contract-faithful mocks; they
cannot prove that the *deployed* Supabase project answers the same way. The
rehearsal runs the real wire once, end to end: a real GoTrue session, the real
`device-auth` Edge Function, real PostgREST + row-level security — the same
requests the app will make on a phone.

## 2. The Tool
- `scripts/e2e_device_auth.mjs` (403 lines), run as `npm run e2e:live` from the
  repo root (or `node scripts/e2e_device_auth.mjs`). Reads the gitignored repo
  `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`); both can be
  overridden via `process.env`. Zero dependencies — Node 18+ built-ins only
  (`fetch`, WebCrypto, `AbortSignal.timeout`).
- **Security posture**: never prints access tokens, refresh tokens, nonces, or
  recovery codes (all masked); creates a fresh disposable user per run; exits
  0 = every step passed, 1 = at least one failed, 2 = env misconfigured. It is
  a manual operator tool — never part of `npm test` or CI. `eslint.config.js`
  declares the Node 18+ globals it uses for the `scripts/` block (`no-undef`
  is disabled for TS files but applies to `.mjs`).
- The transport mirrors the shipped clients byte-for-byte: the raw UTF-8 nonce
  is signed with ECDSA P-256 / SHA-256 into unpadded base64url, requests carry
  `apikey` + `Bearer` headers, and PostgREST inserts use
  `Prefer: resolution=ignore-duplicates,return=representation`.

## 3. What the Rehearsal Proves (station ledger)
23 stations with an anonymous user (one SKIPPED) / 26 with a
dashboard-created email+password user:

| # | Section | Stations | Expected contract |
|---|---------|----------|-------------------|
| 1 | User acquisition | password grant → anonymous → signup (first that works) | JWT carrying `sub` + `session_id` |
| 2 | Pre-enroll status | `status(initial)` | `200:0:false` |
| 3 | RLS before verification | insert denied; pull empty | `403 42501`; `200 / []` |
| 4 | Enroll | `enroll(A)`; second device refused | 200 + `device_id` + 8 recovery codes; `409 device_exists_use_recover` |
| 5 | Verify | challenge → sign → verify | 200 `ok:true` + 12 h `expires_at` |
| 6 | Verify negatives | re-verify on fresh challenge; replayed challenge; wrong signature | 200; `401 bad_or_used_challenge`; `401 bad_signature` |
| 7 | Sync after verification | insert accepted; pull shows the row; duplicate idempotent | 201 returning the key; 200/1 row; 201/0 new, table still 1 row |
| 8 | Per-session binding | fresh sign-in NOT verified; pull blocked; re-verify; pull shows row | 4 stations (SKIPPED as one for anonymous users) |
| 9 | Recovery | bad code; code[0] + new key; code reuse; challenge on revoked device; verify(C); pull | `403 bad_recovery_code`; 200 + 8 fresh codes; `403`; `403 unknown_or_revoked_device`; 200 ok; 200/1 row |
| 10 | Revoke | revoke(C); status; pull | 200; `200:0:false`; `200 / []` |

## 4. Live Evidence Banked So Far
- `device-auth` Edge Function live since Phase 4C: `401 {"error":"missing_token"}`
  — its own contract error, not "Function not found".
- `session_events` live since Phase 4D1: anon `GET` answers `401 42501
  permission denied` (table present, revoked-privilege posture).
- This session (repo-landed copy, run via `npm run e2e:live`): the script
  resolved the portable `.env` path, reached the live project, and re-confirmed
  the auth posture verbatim:

```text
== Live E2E rehearsal — device auth + sync RLS ==
project: https:…e.co<len 40>
FAIL  user session — could not obtain any session — anonymous: [422 anonymous_provider_disabled], signup: [422 signup_disabled]. …
== Summary: 0/1 steps passed ==
```

That failure is the **correct** posture (no public way in), not a defect — the
rehearsal stops at station 1 until a test user exists.

## 5. The One Remaining Gate: Test-User Acquisition
The project deliberately ships locked: open signups **disabled** + anonymous
provider **disabled**. That is the right production posture and this task does
not ask to loosen it permanently. Any one of:
- **(A, recommended)** Dashboard → Authentication → Users → Add user with
  **Auto Confirm ✔**, then run with `E2E_EMAIL`/`E2E_PASSWORD` → the full
  26 stations, including the fresh-sign-in per-session-binding section.
- **(B)** temporarily enable *Anonymous sign-ins* → 23 stations (the binding
  section is skipped — an anonymous user cannot re-authenticate), then disable
  it again afterwards.

Either way the disposable rehearsal user and its single `session_events` row
can be deleted afterwards; it owns nothing else.

## 6. Running It

```bash
# option A — dashboard-created test user (recommended, full coverage)
E2E_EMAIL=you@example.com E2E_PASSWORD='…' npm run e2e:live

# option B — anonymous provider temporarily enabled
npm run e2e:live
```

Exit code 0 and `== Summary: 26/26 steps passed ==` (or 23/23) is the green
signal for the live deployment.

## 7. Honest Non-Goals
- The rehearsal is wire-level; it does not click through the React UI
  (`CloudAccountCard`) — that surface is covered by the 287 unit tests.
- It does not cover scheduled cleanup of expired challenges/sessions (a 4D3
  candidate).
- Under option B the fresh-sign-in per-session binding is skipped live (it is
  enforced by the `device_sessions` upsert keyed on the JWT `session_id`
  claim and covered by unit tests).
- A green run is a point-in-time proof, not a monitor — re-run after any
  server-side change.
