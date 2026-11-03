import { describe, it, expect } from 'vitest';
import {
  generateDeviceKeyPair,
  exportPublicJwk,
  signNonce,
  verifyNonceSignature,
  isValidPublicDeviceJwk,
  bytesToB64u,
  b64uToBytes,
  isCryptoPrivateKey,
} from '../supabase/deviceKeys.js';

/**
 * The verification half below is a byte-for-byte replica of the deployed
 * Edge Function's `verifySignature` (supabase/functions/device-auth/index.ts):
 * importKey(jwk) + ECDSA/SHA-256 over the raw UTF-8 nonce bytes. When the
 * signatures produced by `signNonce` pass THIS function, they satisfy the
 * real server path by construction.
 */
async function serverVerifySignature(
  jwk: JsonWebKey,
  nonce: string,
  sigB64u: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    b64uToBytes(sigB64u),
    new TextEncoder().encode(nonce),
  );
}

const hexNonce = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');

describe('device key generation', () => {
  it('creates an ECDSA P-256 pair with a non-extractable private key', async () => {
    const { privateKey, publicJwk } = await generateDeviceKeyPair();

    expect(privateKey.type).toBe('private');
    expect(privateKey.extractable).toBe(false);
    expect(privateKey.usages).toContain('sign');
    expect(privateKey.algorithm.name).toBe('ECDSA');

    expect(isValidPublicDeviceJwk(publicJwk)).toBe(true);
    expect(publicJwk.crv).toBe('P-256');
    expect('d' in publicJwk).toBe(false);
    expect(isCryptoPrivateKey(privateKey)).toBe(true);
  });

  it('exports a minimal public JWK: exactly kty/crv/x/y, no private material', async () => {
    const { publicKey } = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const jwk = await exportPublicJwk(publicKey);

    expect(Object.keys(jwk).sort()).toEqual(['crv', 'kty', 'x', 'y']);
    expect(jwk.kty).toBe('EC');
    expect(jwk.x.length).toBeGreaterThan(0);
    expect(jwk.y.length).toBeGreaterThan(0);
  });

  it('two generated pairs are independent (different public keys)', async () => {
    const a = await generateDeviceKeyPair();
    const b = await generateDeviceKeyPair();
    expect(a.publicJwk.x).not.toBe(b.publicJwk.x);
  });
});

describe('challenge signing vs the server verification algorithm', () => {
  it('signs a nonce so the server replica verifies it (contract round-trip)', async () => {
    const { privateKey, publicJwk } = await generateDeviceKeyPair();
    const nonce = hexNonce(32); // server: randomHex(32) → 64 hex chars

    const signature = await signNonce(privateKey, nonce);

    // no padding, URL-safe alphabet only
    expect(signature).not.toContain('=');
    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await serverVerifySignature(publicJwk as unknown as JsonWebKey, nonce, signature)).toBe(true);
    expect(await verifyNonceSignature(publicJwk, nonce, signature)).toBe(true);
  });

  it('fails verification when the nonce or signature is tampered with', async () => {
    const { privateKey, publicJwk } = await generateDeviceKeyPair();
    const nonce = hexNonce(32);
    const signature = await signNonce(privateKey, nonce);

    expect(await serverVerifySignature(publicJwk as unknown as JsonWebKey, nonce + '0', signature)).toBe(false);
    expect(await serverVerifySignature(publicJwk as unknown as JsonWebKey, hexNonce(32), signature)).toBe(false);

    // flip one character of the signature
    const flipped = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
    expect(await serverVerifySignature(publicJwk as unknown as JsonWebKey, nonce, flipped)).toBe(false);
  });

  it('signs non-hex nonces too (bytes are the UTF-8 encoding of the string)', async () => {
    const { privateKey, publicJwk } = await generateDeviceKeyPair();
    const nonce = 'nonce with spaces & ünïcode ✓';
    const signature = await signNonce(privateKey, nonce);
    expect(await verifyNonceSignature(publicJwk, nonce, signature)).toBe(true);
  });
});

describe('base64url transport encoding', () => {
  it('matches RFC 4648 vectors and round-trips', () => {
    expect(bytesToB64u(new Uint8Array([0xf1, 0xff]))).toBe('8f8');
    expect(Array.from(b64uToBytes('8f8'))).toEqual([0xf1, 0xff]);
    expect(bytesToB64u(new Uint8Array([0xfb, 0xef, 0xbe]))).toBe('----');
    expect(Array.from(b64uToBytes('----'))).toEqual([0xfb, 0xef, 0xbe]);
    expect(bytesToB64u(new Uint8Array([]))).toBe('');
    expect(b64uToBytes('')).toEqual(new Uint8Array([]));

    const random = crypto.getRandomValues(new Uint8Array(70)); // ECDSA raw sig size range
    const encoded = bytesToB64u(random);
    expect(encoded).not.toContain('=');
    expect(Array.from(b64uToBytes(encoded))).toEqual(Array.from(random));
  });
});

describe('isValidPublicDeviceJwk', () => {
  it('accepts a well-formed public JWK', () => {
    expect(isValidPublicDeviceJwk({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b' })).toBe(true);
  });

  it('rejects malformed, foreign-curve, and private-bearing JWKs', () => {
    expect(isValidPublicDeviceJwk(null)).toBe(false);
    expect(isValidPublicDeviceJwk('jwk')).toBe(false);
    expect(isValidPublicDeviceJwk({})).toBe(false);
    expect(isValidPublicDeviceJwk({ kty: 'EC', crv: 'P-256', x: 'a' })).toBe(false);
    expect(isValidPublicDeviceJwk({ kty: 'EC', crv: 'P-384', x: 'a', y: 'b' })).toBe(false);
    expect(isValidPublicDeviceJwk({ kty: 'OKP', crv: 'P-256', x: 'a', y: 'b' })).toBe(false);
    expect(isValidPublicDeviceJwk({ kty: 'EC', crv: 'P-256', x: '', y: 'b' })).toBe(false);
    expect(isValidPublicDeviceJwk({ kty: 'EC', crv: 'P-256', x: 'a', y: 5 })).toBe(false);
    // private component present → not a public JWK
    expect(isValidPublicDeviceJwk({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b', d: 'secret' })).toBe(false);
  });
});

describe('public JWK import stability', () => {
  it('imports and re-exports to identical coordinates', async () => {
    const { publicJwk } = await generateDeviceKeyPair();
    // import with extractable=true here so the re-export below is possible;
    // importPublicJwk() intentionally mirrors the server's extractable=false.
    const key = await crypto.subtle.importKey(
      'jwk',
      publicJwk as unknown as JsonWebKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['verify'],
    );
    const again = await exportPublicJwk(key);
    expect(again).toEqual(publicJwk);
  });
});
