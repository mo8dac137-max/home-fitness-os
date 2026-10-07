import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/__tests__/**/*.test.ts', 'packages/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@hfos/contracts': path.resolve(__dirname, 'packages/contracts/src'),
      '@hfos/config': path.resolve(__dirname, 'packages/config/src'),
      '@hfos/events': path.resolve(__dirname, 'packages/events/src'),
      '@hfos/engine-core': path.resolve(__dirname, 'packages/engine-core/src'),
      '@hfos/library': path.resolve(__dirname, 'packages/library/src'),
      '@hfos/sim': path.resolve(__dirname, 'packages/sim/src'),
      '@hfos/ports': path.resolve(__dirname, 'packages/ports/src'),
    },
  },
});
