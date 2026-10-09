import type { EventEnvelope, EventLog, EventType } from '@hfos/events';
import { openDatabase } from './idb.js';

/**
 * IndexedDB implementation of EventLog interface from @hfos/events:
 * - Append-only
 * - Duplicate idempotency_key ignored
 * - Returned events strictly ordered by occurred_at ascending, then event_id ascending
 */
export class IndexedDbEventLog implements EventLog {
  public async append(event: EventEnvelope): Promise<void> {
    const db = await openDatabase();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');
      const index = store.index('idempotency_key');

      const checkReq = index.get(event.idempotency_key);
      checkReq.onsuccess = () => {
        if (checkReq.result) {
          // Duplicate idempotency_key is silently ignored per specification
          resolve();
          return;
        }

        const putReq = store.put(event);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };

      checkReq.onerror = () => reject(checkReq.error);
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getAll(): Promise<EventEnvelope[]> {
    const db = await openDatabase();

    return new Promise<EventEnvelope[]>((resolve, reject) => {
      const tx = db.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      const req = store.getAll();

      req.onsuccess = () => {
        const events = (req.result as EventEnvelope[]) || [];
        // Sort deterministically: occurred_at ascending, then event_id ascending
        events.sort((a, b) => {
          const timeA = new Date(a.occurred_at).getTime();
          const timeB = new Date(b.occurred_at).getTime();
          if (timeA !== timeB) return timeA - timeB;
          return a.event_id.localeCompare(b.event_id);
        });
        resolve(events);
      };

      req.onerror = () => reject(req.error);
    });
  }

  public async getByType(type: EventType | string): Promise<EventEnvelope[]> {
    const all = await this.getAll();
    return all.filter((e) => e.type === type);
  }

  public async getById(id: string): Promise<EventEnvelope | undefined> {
    const db = await openDatabase();

    return new Promise<EventEnvelope | undefined>((resolve, reject) => {
      const tx = db.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      const req = store.get(id);

      req.onsuccess = () => {
        resolve((req.result as EventEnvelope) || undefined);
      };

      req.onerror = () => reject(req.error);
    });
  }

  public async count(): Promise<number> {
    const db = await openDatabase();

    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction('events', 'readonly');
      const store = tx.objectStore('events');
      const req = store.count();

      req.onsuccess = () => {
        resolve(req.result);
      };

      req.onerror = () => reject(req.error);
    });
  }

  public async clear(): Promise<void> {
    const db = await openDatabase();

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
