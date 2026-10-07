import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  PACKAGE_NAME,
  EVENT_TYPES,
  EventEnvelope,
  InMemoryEventLog,
  reduce,
  replay,
  createInitialState,
  compareEvents,
} from '../index.js';

describe('@hfos/events', () => {
  it('exports correct PACKAGE_NAME and compares events deterministically', () => {
    expect(PACKAGE_NAME).toBe('@hfos/events');
    const a: EventEnvelope = {
      event_id: 'a',
      type: 'session.started',
      occurred_at: '2026-10-06T00:00:00Z',
      device_id: 'd',
      idempotency_key: '1',
      schema_version: 1,
      payload: {},
    };
    const b: EventEnvelope = { ...a, event_id: 'b' };
    expect(compareEvents(a, b)).toBe(-1);
    expect(compareEvents(b, a)).toBe(1);
    expect(compareEvents(a, a)).toBe(0);
  });

  describe('Ordering and Deduplication in InMemoryEventLog', () => {
    it('sorts events by occurred_at, then event_id as tie-breaker', async () => {
      const log = new InMemoryEventLog();
      const ev1: EventEnvelope = {
        event_id: '018f-b',
        type: 'session.started',
        occurred_at: '2026-10-06T10:00:00Z',
        device_id: 'redmi-12',
        idempotency_key: 'k1',
        schema_version: 1,
        payload: { session_id: 's1' },
      };
      const ev2: EventEnvelope = {
        event_id: '018f-a',
        type: 'session.started',
        occurred_at: '2026-10-06T10:00:00Z',
        device_id: 'redmi-12',
        idempotency_key: 'k2',
        schema_version: 1,
        payload: { session_id: 's2' },
      };
      const ev3: EventEnvelope = {
        event_id: '018f-c',
        type: 'session.started',
        occurred_at: '2026-10-06T09:00:00Z',
        device_id: 'redmi-12',
        idempotency_key: 'k3',
        schema_version: 1,
        payload: { session_id: 's3' },
      };

      await log.append(ev1);
      await log.append(ev2);
      await log.append(ev3);

      const all = await log.getAll();
      expect(all).toHaveLength(3);
      // ev3 first (09:00:00Z)
      expect(all[0]?.event_id).toBe('018f-c');
      // then ev2 ('018f-a' < '018f-b' at 10:00:00Z)
      expect(all[1]?.event_id).toBe('018f-a');
      expect(all[2]?.event_id).toBe('018f-b');
    });

    it('ignores duplicate idempotency_key upon append', async () => {
      const log = new InMemoryEventLog();
      const ev: EventEnvelope = {
        event_id: '018f-1',
        type: 'readiness.recorded',
        occurred_at: '2026-10-06T08:00:00Z',
        device_id: 'redmi-12',
        idempotency_key: 'dup-key-1',
        schema_version: 1,
        payload: { score: 85 },
      };

      await log.append(ev);
      await log.append({ ...ev, event_id: '018f-2' }); // same idempotency_key

      const all = await log.getAll();
      expect(all).toHaveLength(1);
      expect(await log.count()).toBe(1);
    });
  });

  describe('Correction Events', () => {
    it('supersedes an earlier event without mutating the append-only history', async () => {
      const log = new InMemoryEventLog();

      const initialEvent: EventEnvelope = {
        event_id: 'event-001',
        type: 'setting.changed',
        occurred_at: '2026-10-06T08:00:00Z',
        device_id: 'redmi-12',
        idempotency_key: 'k-initial',
        schema_version: 1,
        payload: { key: 'transition_seconds', value: 20 },
      };

      const correctionEvent: EventEnvelope = {
        event_id: 'event-002',
        type: 'setting.changed',
        occurred_at: '2026-10-06T08:05:00Z',
        device_id: 'redmi-12',
        idempotency_key: 'k-correction',
        schema_version: 1,
        supersedes_event_id: 'event-001',
        payload: { key: 'transition_seconds', value: 25 },
      };

      await log.append(initialEvent);
      await log.append(correctionEvent);

      // Verify log history is strictly preserved (both events exist)
      const allEvents = await log.getAll();
      expect(allEvents).toHaveLength(2);
      expect(allEvents[0]?.event_id).toBe('event-001');
      expect(allEvents[1]?.event_id).toBe('event-002');

      // Replaying produces state with the correction applied and event-001 superseded
      const state = replay(allEvents);
      expect(state.settings['transition_seconds']).toBe(25);
      expect(state.superseded_event_ids).toContain('event-001');
      expect(state.event_history).toHaveLength(2);
    });
  });

  describe('Property-Based Tests (fast-check)', () => {
    // Arbitrary event generator
    const eventArbitrary = fc.record({
      event_id: fc.uuid(),
      type: fc.constantFrom(...EVENT_TYPES),
      occurred_at: fc
        .date({ min: new Date('2026-01-01'), max: new Date('2026-12-31') })
        .map((d) => d.toISOString()),
      device_id: fc.constant('redmi-12'),
      idempotency_key: fc.uuid(),
      schema_version: fc.constant(1),
      payload: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean())),
    }) as fc.Arbitrary<EventEnvelope>;

    it('Property 1: Replaying any event sequence twice gives identical state (deterministic purity)', () => {
      fc.assert(
        fc.property(fc.array(eventArbitrary, { minLength: 0, maxLength: 20 }), (events) => {
          const state1 = replay(events);
          const state2 = replay(events);
          expect(state1).toEqual(state2);
        })
      );
    });

    it('Property 2: Duplicate events (same idempotency_key) never change state', () => {
      fc.assert(
        fc.property(
          fc.array(eventArbitrary, { minLength: 1, maxLength: 10 }),
          (events) => {
            // Apply sequence once
            let state = createInitialState();
            for (const ev of events) {
              state = reduce(state, ev);
            }

            const stateBeforeDuplicates = JSON.stringify(state);

            // Re-apply the exact same events (duplicates)
            for (const ev of events) {
              state = reduce(state, ev);
            }

            const stateAfterDuplicates = JSON.stringify(state);
            expect(stateAfterDuplicates).toBe(stateBeforeDuplicates);
          }
        )
      );
    });

    it('Property 3: A correction event supersedes target event without editing history', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 10, max: 20 }),
          fc.integer({ min: 21, max: 30 }),
          (id1, id2, val1, val2) => {
            const ev1: EventEnvelope = {
              event_id: id1,
              type: 'setting.changed',
              occurred_at: '2026-10-06T10:00:00Z',
              device_id: 'redmi-12',
              idempotency_key: `key-${id1}`,
              schema_version: 1,
              payload: { key: 'transition_seconds', value: val1 },
            };

            const ev2: EventEnvelope = {
              event_id: id2,
              type: 'setting.changed',
              occurred_at: '2026-10-06T10:01:00Z',
              device_id: 'redmi-12',
              idempotency_key: `key-${id2}`,
              schema_version: 1,
              supersedes_event_id: id1,
              payload: { key: 'transition_seconds', value: val2 },
            };

            const state = replay([ev1, ev2]);
            // Final state reflects correction
            expect(state.settings['transition_seconds']).toBe(val2);
            // Target was recorded as superseded
            expect(state.superseded_event_ids).toContain(id1);
            // Both events remain in append-only history
            expect(state.event_history).toHaveLength(2);
          }
        )
      );
    });
  });
});
