import { openDatabase } from './idb.js';

/**
 * KeyValueStore for persistent settings, environment, and user state.
 */
export class KeyValueStore {
  public async get<T>(key: string): Promise<T | null> {
    const db = await openDatabase();

    return new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const req = store.get(key);

      req.onsuccess = () => {
        resolve(req.result !== undefined ? (req.result as T) : null);
      };

      req.onerror = () => reject(req.error);
    });
  }

  public async set<T>(key: string, value: T): Promise<void> {
    const db = await openDatabase();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      const req = store.put(value, key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async delete(key: string): Promise<void> {
    const db = await openDatabase();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllKeys(): Promise<string[]> {
    const db = await openDatabase();

    return new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const req = store.getAllKeys();

      req.onsuccess = () => {
        resolve((req.result as string[]) || []);
      };

      req.onerror = () => reject(req.error);
    });
  }

  public async clear(): Promise<void> {
    const db = await openDatabase();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

/**
 * Requests persistent storage on launch and returns whether persistence is granted.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Checks if storage is currently persisted.
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
  return false;
}
