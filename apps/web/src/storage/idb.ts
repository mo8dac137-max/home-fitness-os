/**
 * Lightweight promise wrapper over raw IndexedDB.
 * Database: "hfos", version: 1
 * Stores:
 *   - "events" (keyPath: "event_id", indexes: "idempotency_key" (unique), "occurred_at")
 *   - "kv" (key-value store, out-of-line keys or keyPath: "key")
 */

export const DB_NAME = 'hfos';
export const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (_event) => {
      const db = request.result;

      // ObjectStore: events
      if (!db.objectStoreNames.contains('events')) {
        const eventStore = db.createObjectStore('events', { keyPath: 'event_id' });
        eventStore.createIndex('idempotency_key', 'idempotency_key', { unique: true });
        eventStore.createIndex('occurred_at', 'occurred_at', { unique: false });
      }

      // ObjectStore: kv
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

export function closeDatabase(): void {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => {});
    dbPromise = null;
  }
}
