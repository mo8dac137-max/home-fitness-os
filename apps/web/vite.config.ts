import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hfos/contracts': path.resolve(__dirname, '../../packages/contracts/src'),
      '@hfos/config': path.resolve(__dirname, '../../packages/config/src'),
      '@hfos/events': path.resolve(__dirname, '../../packages/events/src'),
      '@hfos/engine-core': path.resolve(__dirname, '../../packages/engine-core/src'),
      '@hfos/library': path.resolve(__dirname, '../../packages/library/src'),
      '@hfos/sim': path.resolve(__dirname, '../../packages/sim/src'),
      '@hfos/ports': path.resolve(__dirname, '../../packages/ports/src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
