# Phase 4C Report — Device Auth Client (Keys, Challenge Signing, Sessions)

Executed directly on the repository, on top of `main` @ `c0216b3`
(Phase 4B/4D1). Scope: implement the full client half of the M0-15 device
authorization flow — ECDSA P-256 key generation, nonce signing, key
persistence, and the enroll/verify/revoke/recover/status calls against the
already-deployed `device-auth` Edge Function — plus the test battery. All
outputs below are from actual terminal runs in this session.

## 1. Contract Source of Truth
- The deployed Edge Function (`supabase/functions/device-auth/index.ts`) was
  read line by line and matched, not approximated:
  - Public JWK gate: `kty=EC, crv=P-256`, string `x`/`y`, **no `d`**
    (`validPublicJwk`).
  - Signature check: `ECDSA / SHA-256` over `new TextEncoder().encode(nonce)`
    (raw UTF-8 bytes of the nonce string), signature transported as
    base64url (`b64uToBytes` on the server).
  - Nonce: `randomHex(32)` → 64 hex chars, 120 s TTL, single use (atomic
    `used_at` consume).
  - Device session: 12 h, bound to the Supabase Auth JWT `session_id`; RLS
    (`device_session_valid()`) is the authoritative gate afterwards.

## 2. Summary
- `apps/web/src/supabase/deviceKeys.ts` — WebCrypto core:
  - `generateDeviceKeyPair`: ECDSA P-256; the private half is created
    **non-extractable** (per the M0-15 design), the public half exports to the
    minimal JWK (`kty/crv/x/y`) the server accepts.
  - `signNonce`: signs the raw UTF-8 nonce bytes with SHA-256 → unpadded
    base64url — byte-compatible with the server's verification path.
  - `isValidPublicDeviceJwk` mirrors the server's validation; `isCryptoPrivateKey`
    duck-types persisted keys; `verifyNonceSignature` replicates the server
    algorithm for cross-implementation tests.
- `apps/web/src/supabase/deviceKeyStore.ts` — the `DeviceKeyStore` port the
  M0-15 report called for: `StoredDeviceRecord` (`device_id` nullable for
  orphaned enroll attempts, `label`, `public_jwk`, `private_key`,
  `created_at`). The private `CryptoKey` is persisted via **IndexedDB
  structured clone** — its non-extractability survives the round trip and no
  secret is ever serialized to a string. `InMemoryDeviceKeyStore` (tests) and
  `KeyValueDeviceKeyStore` (browser, over the existing `kv` store) ship
  together; rehydration drops corrupt records defensively.
- `apps/web/src/supabase/deviceAuthClient.ts` — the Edge Function client,
  plain fetch with injected I/O and abortable timeout (no supabase-js, same
  minimal-bundle decision as 4A/4D1):
  - `enrollCurrentDevice`: short-circuits if already enrolled, reuses an
    orphaned key pair from a failed attempt, persists the record only on
    server success; one-time recovery codes are returned to the caller once.
  - `verifyCurrentDevice`: challenge → sign → verify; on success the server
    binds the JWT `session_id` to a 12 h device session, which is what unlocks
    `device_session_valid()`-gated tables (incl. `session_events` from 4D1).
  - `revokeCurrentDevice` (clears the local record on success only),
    `recoverDevice` (fresh key pair, code normalized to the server's hashing
    form), `fetchDeviceStatus`.
  - Every call returns a discriminated result: server error bodies pass
    through **verbatim** (`device_exists_use_recover`, `bad_signature`,
    `bad_or_used_challenge`, `unknown_or_revoked_device`,
    `device_session_required`, `bad_recovery_code`, …); client-synthesized
    codes are documented (`missing_token`, `bad_response`, `network_error`,
    `timeout`, `not_enrolled`, `signing_failed`).
- App wiring is intentionally untouched: with no sign-in UI yet (4D2) there is
  no real access token to authenticate with, so the modules are pure
  additions behind tests. Bundle unchanged.

## 3. Raw DoD Outputs (actual runs)
- `npm run typecheck` — exit 0. (Two iterations documented: a TS 5.7
  `Uint8Array<ArrayBufferLike>` → `BufferSource` narrowing fixed by giving
  `b64uToBytes` an `ArrayBuffer`-backed return, and one test needing
  discriminant narrowing before `res.data` access. No `any`/`as any`.)
- `npm run lint` — exit 0, no output.
- `npx vitest run` — `Test Files 30 passed (30)` / `Tests 250 passed (250)`.
  New: `deviceKeys.test.ts` (10), `deviceAuthClient.test.ts` (25).
  - Key test: the verify-flow test's mock server validates the client's
    signature using a byte-for-byte replica of the deployed
    `verifySignature` — the client contract is proven against the server
    algorithm, not against itself.
  - One test-side vector bug caught and fixed before commit (hand-computed
    RFC 4648 group was wrong; `btoa` ground truth used instead).
- `npm run build` — exit 0; bundle total unchanged `130.83 KB / 300 KB`
  (modules tree-shaken until 4D2 imports them).
- `npm run check:bundle` — `✅ PASSED: Within performance budget.`
- `git status` — clean after commit; no `.env` in history.

## 4. Failures / Skipped
- None skipped. The two typecheck iterations and the test-vector fix are
  documented above; both were resolved before commit.
- Not executed (out of scope, needs a real browser session + a signed-in
  user): a live enroll/verify round trip against the running function. The
  server contract is already covered three ways — the deployed function is
  unchanged, the source is matched 1:1, and the test replica verifies
  signatures with the same primitives.

## 5. Handoff (owner steps — none new for 4C)
- **Nothing to deploy for Phase 4C**: client modules are pure additions; the
  `device-auth` function and the M0-15 schema are already live and verified
  (401 `missing_token` contract response; M0-15 tables present).
- Verified live during this session: the owner applied the 4D1 migration —
  anon `GET /rest/v1/session_events` now answers **401 `42501` permission
  denied** (table exists, `revoke all from anon` active). The database side
  is fully ready for 4D2.
- Live end-to-end rehearsal (recommended, 5 minutes, once 4D2 lands):
  sign in → enroll (save the 8 recovery codes shown once) → verify →
  `GET /rest/v1/session_events` with the verified token must return rows `[]`
  (not 401) — proving the device session unlocks RLS.

## 6. Deviations / Notes
- The M0-15 spike hinted at a `DeviceKeyStore` "port (Milestone 1)" —
  delivered as specified, with the browser implementation riding the existing
  `KeyValueStore`/IndexedDB plumbing instead of a new database.
- `enrollCurrentDevice` reports `{ status: 'already' }` (HTTP-free
  short-circuit) instead of surfacing the server's 409 when the local record
  already carries a `device_id`; the 409 path remains fully reachable for the
  real failure case (device enrolled from another browser) and 4D2 maps it to
  the recovery UI.
- Private-key persistence relies on IndexedDB structured-clone of
  non-extractable `CryptoKey`s (supported by all evergreen browsers). If a
  record ever fails rehydration, `storedDeviceRecordFromUnknown` returns null
  and the flow degrades to "not enrolled" → re-enroll/recover, never a crash.
