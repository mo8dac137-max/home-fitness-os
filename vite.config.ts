import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@hfos/contracts': path.resolve(__dirname, 'packages/contracts/src'),
        '@hfos/config': path.resolve(__dirname, 'packages/config/src'),
        '@hfos/events': path.resolve(__dirname, 'packages/events/src'),
        '@hfos/engine-core': path.resolve(__dirname, 'packages/engine-core/src'),
        '@hfos/library': path.resolve(__dirname, 'packages/library/src'),
        '@hfos/sim': path.resolve(__dirname, 'packages/sim/src'),
        '@hfos/ports': path.resolve(__dirname, 'packages/ports/src'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
