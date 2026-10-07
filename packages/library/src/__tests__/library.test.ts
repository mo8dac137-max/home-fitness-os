import { describe, it, expect } from 'vitest';
import {
  PACKAGE_NAME,
  INITIAL_EXERCISE_LIBRARY,
  LIBRARY_LIMITATIONS,
  validateLibrary,
} from '../index.js';
import type { Exercise } from '@hfos/contracts';

describe('@hfos/library (M0-05)', () => {
  it('exports correct PACKAGE_NAME and LIBRARY_LIMITATIONS', () => {
    expect(PACKAGE_NAME).toBe('@hfos/library');
    expect(LIBRARY_LIMITATIONS.vertical_pull).toBe(
      'no equipment-free vertical pull available'
    );
  });

  it('contains expected 40+ exercises in INITIAL_EXERCISE_LIBRARY', () => {
    expect(INITIAL_EXERCISE_LIBRARY.length).toBeGreaterThanOrEqual(40);
  });

  it('validates the real INITIAL_EXERCISE_LIBRARY cleanly with zero errors', () => {
    const result = validateLibrary(INITIAL_EXERCISE_LIBRARY);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects duplicate exercise IDs', () => {
    const duplicateLib: Exercise[] = [
      ...INITIAL_EXERCISE_LIBRARY,
      {
        ...INITIAL_EXERCISE_LIBRARY[0]!,
      },
    ];
    const result = validateLibrary(duplicateLib);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate exercise id'))).toBe(true);
  });

  it('detects non-existent progression links', () => {
    const brokenLib: Exercise[] = INITIAL_EXERCISE_LIBRARY.map((ex) =>
      ex.id === 'wall_pushup'
        ? {
            ...ex,
            progression_links: { progression_id: 'non_existent_exercise', regression_id: null },
          }
        : ex
    );
    const result = validateLibrary(brokenLib);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('non-existent progression_id'))).toBe(true);
  });

  it('detects progression level <= source level', () => {
    const invertedLevelsLib: Exercise[] = INITIAL_EXERCISE_LIBRARY.map((ex) => {
      if (ex.id === 'wall_pushup') {
        // level 1 pointing to level 1
        return {
          ...ex,
          progression_links: { progression_id: 'incline_pushup', regression_id: null },
        };
      }
      if (ex.id === 'incline_pushup') {
        return {
          ...ex,
          level: 1, // lowered to 1
        };
      }
      return ex;
    });
    const result = validateLibrary(invertedLevelsLib);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('must have higher level'))).toBe(true);
  });

  it('detects cycles in progression links', () => {
    const cycleLib: Exercise[] = INITIAL_EXERCISE_LIBRARY.map((ex) => {
      if (ex.id === 'wall_pushup') {
        return {
          ...ex,
          progression_links: { progression_id: 'incline_pushup', regression_id: null },
        };
      }
      if (ex.id === 'incline_pushup') {
        return {
          ...ex,
          progression_links: { progression_id: 'wall_pushup', regression_id: null },
        };
      }
      return ex;
    });
    const result = validateLibrary(cycleLib);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('cycle detected'))).toBe(true);
  });
});
