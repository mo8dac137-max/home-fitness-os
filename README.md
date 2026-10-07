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
- `packages/ports`: Abstraction ports (Clock, IdGenerator).
- `apps/web`: React + Vite + TypeScript PWA. Canonical Vite configuration lives at `apps/web/vite.config.ts`; the root `vite.config.ts` serves as an environment entry shim for the platform dev server.

## Canonical Vite Configuration

The canonical application Vite configuration is located at `apps/web/vite.config.ts`. The root `vite.config.ts` and root entry files (`index.html`, `src/`) act as development shims ensuring compatibility with single-directory container runners while preserving monorepo architecture.

## Verification & Commands

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```
