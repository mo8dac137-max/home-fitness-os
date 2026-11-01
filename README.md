# Home Fitness OS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A personal, single-user, installable Android PWA (target phone: Redmi 12), offline-first, for HOME workouts only. Bodyweight first; equipment may be added later. Dark, data-rich UI with editable settings.

See [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) for the project brief and [AGENTS.md](AGENTS.md) for the hard rules.

## Install as PWA (Android / Redmi 12)

Home Fitness OS is architected as an offline-first Progressive Web App targeted for mobile devices, specifically tested and tuned for standard Android devices such as the Xiaomi Redmi 12:

1. **Installation Steps**:
   - Open the app URL in Google Chrome on your Android device.
   - Tap the browser menu (three dots in top right) and select **"Add to Home screen"** or tap the install prompt banner if displayed.
   - Confirm by tapping **"Install"**. The app will be placed on your home screen and run in standalone window mode without browser navigation chrome.

2. **Offline Guarantees**:
   - **Local-First Storage**: All workout plans, exercise catalogs, user settings, and session event logs are stored strictly on-device in IndexedDB (`KeyValueStore` and `IndexedDbEventLog`).
   - **Full Offline Execution**: The deterministic training engine (`@hfos/engine-core`) runs in pure client TypeScript with zero network calls, zero external runtime dependencies, and zero reliance on cloud servers.
   - **ServiceWorker Caching**: Application shell, JavaScript bundles, stylesheets, fonts, and assets are pre-cached by Workbox via `vite-plugin-pwa` so the app launches instantly and operates reliably with airplane mode or no cellular connectivity.

## Screenshots

<!-- Screenshots will be added here as UI features are captured on the target Redmi 12 viewport -->

## Monorepo Packages

- `packages/contracts`: Core domain contracts, Zod schemas, enums, and inferred TypeScript types.
- `packages/config`: Versioned settings registry, defaults, bounds validation, and effective configuration.
- `packages/events`: Append-only event envelopes, reducer, in-memory event log, and replay engine.
- `packages/engine-core`: Deterministic pure TypeScript training engine (no DOM, no Node-only APIs, no network).
- `packages/library`: Exercise and template definitions.
- `packages/sim`: Simulation and test harness.
- `packages/ports`: Abstraction ports (Clock, IdGenerator, ScheduleProvider, AiProvider).
- `apps/web`: React + Vite + TypeScript PWA application shell, offline storage, and UI screens.

## Single Vite Configuration (M1-A)

A single root `vite.config.ts` handles development, production build, and preview for both local development and Cloudflare Pages. Output directory is `dist/`. PWA service worker and Web App Manifest generation are managed via `vite-plugin-pwa`.

## Verification & Commands

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run check:bundle
```
