# M0-15 Identity & Authorized Device Spike - Report

Status: PASSED on the staging project `fitness-staging` (desktop Chrome + Edge InPrivate).
Not yet validated on the target phone (Redmi 12, installed PWA) - see Open items.

## Decision
Design (A) from the plan is accepted:
- A WebCrypto ECDSA P-256 key pair (private key non-extractable) is created on the device and
  stored in IndexedDB. Only the public key (JWK) is registered on the server.
- Login = Supabase Auth (email + password, public sign-ups disabled) + a device proof:
  one-time server nonce -> signed on the device -> verified by the Edge Function `device-auth`
  -> the Auth `session_id` is recorded in `device_sessions` (12 h).
- Supabase RLS is authoritative: a table policy requires `public.device_session_valid()`, which
  looks up the JWT `session_id` in `device_sessions` (not revoked, not expired, device not revoked).
- Recovery: one-time recovery codes (stored hashed). Recover revokes all devices and sessions
  and enrolls the new device. First enrollment is only allowed when no active device exists.
- Option (B) (Custom Access Token Hook adding a `device_id` claim) is not used: the hook runs when
  the token is issued and cannot see the signed challenge.

## Test results
SQL self-test (`select public.m0_15_rls_selftest();`): ALL RLS TESTS PASSED
(valid session reads/writes; no session, expired, revoked, other user, anon, and server-only
tables are all denied).

Manual test with `spike/device-spike.html`:
| Scenario | Expected | Result |
|---|---|---|
| Valid user, device not enrolled: write / read | denied / 0 rows | pass |
| Enroll, verify, write, read | ok | pass |
| Other browser (InPrivate), same account: verify | no local key | pass |
| Other browser: write / read / enroll | denied / 0 rows / 409 | pass |
| Recover with a code in the other browser | new device + new codes | pass |
| New device: verify, write, read | ok | pass |
| Old device: challenge / write | 403 revoked / denied | pass |

## Setup (staging)
1. Authentication: create the user; disable "Allow new users to sign up".
2. Run `supabase/migrations/20261009000000_m0_15_device_auth.sql`.
3. Run `supabase/tests/m0_15_rls_selftest.sql`, then `select public.m0_15_rls_selftest();`.
4. Deploy `supabase/functions/device-auth/index.ts` as Edge Function `device-auth`.
   Turn OFF "Verify JWT with legacy secret" (the code verifies the token itself).
5. Never commit keys. The spike page asks for the publishable/anon key at runtime.

## Known gaps (to fix in M0-15b, before any real data)
1. Recovery codes are 48 bits and stored as plain SHA-256: use longer codes (>= 80 bits) and a
   keyed hash (HMAC with a secret kept in Supabase), plus an attempt limit (rate limiting).
2. Recover/revoke do not end the other Supabase Auth sessions (data is blocked by RLS, but the
   sessions should also be signed out).
3. CORS is `*`: restrict to the app origin.
4. No cleanup of expired challenges and sessions (add a scheduled job).
5. Recovery codes are only displayed once: the product UI must force the user to store them.
6. Tests are manual + SQL; add automated checks in CI later (Supabase CLI + pgTAP) if free-tier
   runner limits allow.

## Open items
- Validate IndexedDB CryptoKey persistence and the whole flow on the Redmi 12 as an installed
  PWA (Milestone 1 dry run). Chrome clearing site data deletes the key (recover with a code).
- The final client module belongs in `apps/web` behind a `DeviceKeyStore` port (Milestone 1).
- `spike_data` and `spike/` are throwaway and must be removed before production.
