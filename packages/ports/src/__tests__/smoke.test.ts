import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME } from '../index.js';

describe('@hfos/ports smoke test', () => {
  it('exports correct PACKAGE_NAME', () => {
    expect(PACKAGE_NAME).toBe('@hfos/ports');
  });
});
