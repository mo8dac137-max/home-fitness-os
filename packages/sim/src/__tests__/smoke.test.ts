import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME, MOCK_USER, MockClock, MockIdGenerator } from '../index.js';

describe('@hfos/sim smoke test', () => {
  it('exports correct PACKAGE_NAME', () => {
    expect(PACKAGE_NAME).toBe('@hfos/sim');
  });

  it('provides a deterministic MockUser profile', () => {
    expect(MOCK_USER.codename).toBe('mock_athlete_redmi12');
    expect(MOCK_USER.physique_priorities).toHaveLength(2);
  });

  it('implements MockClock and MockIdGenerator', () => {
    const clock = new MockClock('2026-10-06T04:00:00Z');
    expect(clock.nowIso()).toBe('2026-10-06T04:00:00.000Z');
    clock.advanceMinutes(30);
    expect(clock.nowIso()).toBe('2026-10-06T04:30:00.000Z');

    const idGen = new MockIdGenerator();
    const id1 = idGen.generateId();
    const id2 = idGen.generateId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
