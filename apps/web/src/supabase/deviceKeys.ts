/**
 * Device key cryptography (Phase 4C).
 *
 * Implements the client half of the M0-15 device authorization contract:
 * a WebCrypto ECDSA P-256 key pair is created on the device, the private key
 * stays non-extractable, and sign-in is proven by signing a one-time server
 * nonce. The verification half is the deployed Edge Function
 * `supabase/functions/device-auth/index.ts`; the helpers below mirror its
 * exact algorithms (SHA-256 hash, UTF-8 nonce bytes, base64url signature
 * transport) so the two sides cannot drift apart silently.
 */

/** Public key JWK shape accepted by the server (`validPublicJwk`). */
export interface PublicDeviceJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
}

export interface GeneratedDeviceKeyPair {
  /** Non-extractable signing key. Persist via the DeviceKeyStore, never export. */
  privateKey: CryptoKey;
  /** Minimal public JWK (`kty, crv, x, y`) sent to the server on enroll. */
  publicJwk: PublicDeviceJwk;
}

// ── base64url (matches the server's b64uToBytes transport encoding) ────────

export function bytesToB64u(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] as number);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uToBytes(value: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (value.length % 4)) % 4);
  const bin = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

// ── JWK validation (mirror of the server's `validPublicJwk`) ───────────────

/**
 * Defensive check that a parsed value is a well-formed *public* EC P-256 JWK:
 * correct `kty`/`crv`, string coordinates, and no private component `d`.
 */
export function isValidPublicDeviceJwk(value: unknown): value is PublicDeviceJwk {
  if (typeof value !== 'object' || value === null) return false;
  const j = value as Record<string, unknown>;
  return (
    j['kty'] === 'EC' &&
    j['crv'] === 'P-256' &&
    typeof j['x'] === 'string' &&
    j['x'].length > 0 &&
    typeof j['y'] === 'string' &&
    j['y'].length > 0 &&
    !('d' in j)
  );
}

// ── key lifecycle ──────────────────────────────────────────────────────────

/**
 * Generates a fresh ECDSA P-256 device key pair.
 * Per the WebCrypto spec the public half is always extractable while the
 * private half inherits `extractable = false` — the private key can sign but
 * can never be read out of the browser's crypto subsystem.
 */
export async function generateDeviceKeyPair(): Promise<GeneratedDeviceKeyPair> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify'],
  )) as CryptoKeyPair;

  const publicJwk = await exportPublicJwk(pair.publicKey);
  return { privateKey: pair.privateKey, publicJwk };
}

/** Exports a public key to the minimal JWK the server expects (no `d`, no extras). */
export async function exportPublicJwk(publicKey: CryptoKey): Promise<PublicDeviceJwk> {
  const raw = (await crypto.subtle.exportKey('jwk', publicKey)) as Record<string, unknown>;
  const jwk: PublicDeviceJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: String(raw['x'] ?? ''),
    y: String(raw['y'] ?? ''),
  };
  if (!isValidPublicDeviceJwk(jwk)) {
    throw new Error('exported public JWK failed validation');
  }
  return jwk;
}

/** Imports a public JWK for verification (mirrors the server's import call). */
export async function importPublicJwk(jwk: PublicDeviceJwk): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk as unknown as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
}

// ── signing (the client half of the challenge protocol) ────────────────────

/**
 * Signs a server nonce exactly the way `device-auth` verifies it:
 * ECDSA P-256 with SHA-256 over the raw UTF-8 bytes of the nonce string,
 * returned unpadded base64url.
 */
export async function signNonce(privateKey: CryptoKey, nonce: string): Promise<string> {
  const data = new TextEncoder().encode(nonce);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data,
  );
  return bytesToB64u(new Uint8Array(signature));
}

/**
 * Verifies a signature with the server's exact algorithm. Used by tests to
 * prove client-side signatures satisfy the deployed verification path, and
 * available for local sanity checks.
 */
export async function verifyNonceSignature(
  publicJwk: PublicDeviceJwk,
  nonce: string,
  signatureB64u: string,
): Promise<boolean> {
  const key = await importPublicJwk(publicJwk);
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    b64uToBytes(signatureB64u),
    new TextEncoder().encode(nonce),
  );
}

/** True when the value duck-types as a persisted private CryptoKey. */
export function isCryptoPrivateKey(value: unknown): value is CryptoKey {
  if (typeof value !== 'object' || value === null) return false;
  const k = value as { type?: unknown; algorithm?: unknown; usages?: unknown };
  return (
    k['type'] === 'private' &&
    typeof k['algorithm'] === 'object' &&
    k['algorithm'] !== null &&
    Array.isArray(k['usages'])
  );
}
