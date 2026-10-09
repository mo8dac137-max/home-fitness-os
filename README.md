# Home Fitness OS

A personal, single-user, installable Android PWA (target phone: Redmi 12), offline-first, for HOME workouts only. Bodyweight first; equipment may be added later. Dark, data-rich UI with editable settings.

See [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) for the project brief and [AGENTS.md](AGENTS.md) for the hard rules.

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
