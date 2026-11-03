import { KeyValueStore } from '../storage/KeyValueStore.js';
import { isCryptoPrivateKey, isValidPublicDeviceJwk, type PublicDeviceJwk } from './deviceKeys.js';

/**
 * DeviceKeyStore port (Phase 4C).
 *
 * Persists the enrolled device record so the challenge/sign/verify flow can
 * repeat after every page reload and Supabase Auth login without re-enrolling.
 *
 * The private key itself is a non-extractable `CryptoKey`. IndexedDB persists
 * it via structured clone (its non-extractability survives the round trip),
 * so no secret material is ever serialized to a string. Tests and non-browser
 * runtimes use `InMemoryDeviceKeyStore`.
 */

export interface StoredDeviceRecord {
  /** Server id from `authorized_devices`; null for an orphan (enroll failed mid-flight). */
  device_id: string | null;
  label: string;
  public_jwk: PublicDeviceJwk;
  private_key: CryptoKey;
  /** ISO timestamp of when the record (key pair) was first created locally. */
  created_at: string;
}

export interface DeviceKeyStore {
  load(): Promise<StoredDeviceRecord | null>;
  save(record: StoredDeviceRecord): Promise<void>;
  clear(): Promise<void>;
}

// ── in-memory implementation (tests / SSR fallback) ────────────────────────

export class InMemoryDeviceKeyStore implements DeviceKeyStore {
  private record: StoredDeviceRecord | null = null;

  async load(): Promise<StoredDeviceRecord | null> {
    return this.record;
  }

  async save(record: StoredDeviceRecord): Promise<void> {
    this.record = record;
  }

  async clear(): Promise<void> {
    this.record = null;
  }
}

// ── IndexedDB implementation (browser) ─────────────────────────────────────

const DEVICE_RECORD_KEY = 'hfos.device.record';

/** Defensive rehydration of a stored record (mirrors syncTransport's row guard). */
export function storedDeviceRecordFromUnknown(value: unknown): StoredDeviceRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Record<string, unknown>;

  const deviceId = typeof r['device_id'] === 'string' && r['device_id'].length > 0
    ? r['device_id']
    : null;
  const label = typeof r['label'] === 'string' && r['label'].length > 0 ? r['label'] : null;
  const createdAt = typeof r['created_at'] === 'string' && r['created_at'].length > 0
    ? r['created_at']
    : null;

  if (!isValidPublicDeviceJwk(r['public_jwk'])) return null;
  if (!isCryptoPrivateKey(r['private_key'])) return null;
  if (label === null || createdAt === null) return null;

  return {
    device_id: deviceId,
    label,
    public_jwk: r['public_jwk'],
    private_key: r['private_key'],
    created_at: createdAt,
  };
}

/** DeviceKeyStore backed by the app's existing KeyValueStore (IndexedDB `kv`). */
export class KeyValueDeviceKeyStore implements DeviceKeyStore {
  private readonly kv: Pick<KeyValueStore, 'get' | 'set' | 'delete'>;

  constructor(kv: Pick<KeyValueStore, 'get' | 'set' | 'delete'>) {
    this.kv = kv;
  }

  async load(): Promise<StoredDeviceRecord | null> {
    const raw = await this.kv.get<unknown>(DEVICE_RECORD_KEY);
    return storedDeviceRecordFromUnknown(raw);
  }

  async save(record: StoredDeviceRecord): Promise<void> {
    await this.kv.set(DEVICE_RECORD_KEY, record);
  }

  async clear(): Promise<void> {
    await this.kv.delete(DEVICE_RECORD_KEY);
  }
}
