import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME, INITIAL_EXERCISE_LIBRARY } from '../index.js';

describe('@hfos/library smoke test', () => {
  it('exports correct PACKAGE_NAME', () => {
    expect(PACKAGE_NAME).toBe('@hfos/library');
  });

  it('provides initial exercise library fixtures', () => {
    expect(INITIAL_EXERCISE_LIBRARY.length).toBeGreaterThan(0);
  });
});
