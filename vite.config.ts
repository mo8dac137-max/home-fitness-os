import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    define: {
      'import.meta.env.CF_PAGES_COMMIT_SHA': JSON.stringify(
        process.env.CF_PAGES_COMMIT_SHA || process.env.VITE_COMMIT_SHA || 'dev'
      ),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: 'Home Fitness OS',
          short_name: 'Fitness OS',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0b0b0b',
          theme_color: '#0b0b0b',
          lang: 'en',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'apps/web/src'),
        '@hfos/contracts': path.resolve(__dirname, 'packages/contracts/src'),
        '@hfos/config': path.resolve(__dirname, 'packages/config/src'),
        '@hfos/events': path.resolve(__dirname, 'packages/events/src'),
        '@hfos/engine-core': path.resolve(__dirname, 'packages/engine-core/src'),
        '@hfos/library': path.resolve(__dirname, 'packages/library/src'),
        '@hfos/sim': path.resolve(__dirname, 'packages/sim/src'),
        '@hfos/ports': path.resolve(__dirname, 'packages/ports/src'),
      },
    },
    build: {
      outDir: 'dist',
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
