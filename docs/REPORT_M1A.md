# Milestone 1-A Completion Report: PWA Shell + Local Storage + App Skeleton

**Project:** Home Fitness OS  
**Status:** M1-A completed and verified.  
**Verification:** `npm ci && npm run lint && npm run typecheck && npm test && npm run build && npm run check:bundle` passed with 0 errors across 13 test files and 120 tests.

---

## 1. Files Created & Modified

### 1. Single Vite Configuration & Build Tooling
- `vite.config.ts`: Updated root Vite configuration to be the single configuration for dev, production build, and preview. Added `vite-plugin-pwa` with:
  - Web App Manifest: Name "Home Fitness OS", short_name "Fitness OS", start_url "/", scope "/", display "standalone", orientation "portrait", background_color "#0b0b0b", theme_color "#0b0b0b", lang "en", using existing icons in `/icons/` (`icon-192.png`, `icon-512.png`, `maskable-512.png`).
  - Workbox: precaching build output, `navigateFallback: "/index.html"`, `cleanupOutdatedCaches: true`.
  - `registerType: "prompt"` (never auto-reloads).
  - Injected `import.meta.env.CF_PAGES_COMMIT_SHA` from `CF_PAGES_COMMIT_SHA` / `VITE_COMMIT_SHA` / "dev".
- `index.html`: Configured `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`, `<meta name="theme-color" content="#0b0b0b" />`, `<meta name="color-scheme" content="dark" />`, icons (`/icons/favicon-32.png`, `/icons/apple-touch-icon.png`), and inline body background `#0b0b0b` to eliminate white flash.
- `public/_headers`: Created Cloudflare Pages caching rules:
  - `/sw.js` and `/index.html`: `Cache-Control: no-cache`
  - `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`
- Removed unused `apps/web/vite.config.ts` and `apps/web/index.html`.
- Updated `README.md` documenting the unified Vite config, PWA integration, and bundle check script.

### 2. IndexedDB Local Storage Layer (`apps/web/src/storage`)
- `apps/web/src/storage/idb.ts`: Raw IndexedDB promise wrapper for database `"hfos"` v1 with object stores `"events"` (keyPath: `event_id`, unique index: `idempotency_key`, index: `occurred_at`) and `"kv"`.
- `apps/web/src/storage/IndexedDbEventLog.ts`: Implemented `EventLog` interface from `@hfos/events`:
  - Append-only.
  - Silently ignores duplicate `idempotency_key`.
  - Deterministically orders results by `occurred_at` ascending, then `event_id` ascending.
- `apps/web/src/storage/KeyValueStore.ts`: Generic persistent key-value store for user settings, profile, and environment state, plus `requestStoragePersistence()` and `isStoragePersisted()`.
- `apps/web/src/storage/__tests__/storage.test.ts`: Vitest test suite with `fake-indexeddb` verifying event appending, duplicate deduplication, deterministic sorting, and persistence across closing and re-opening the database.

### 3. Design Tokens & Styling
- `apps/web/src/styles/tokens.css`: CSS variables defining `--bg #0b0b0b`, `--surface #141414`, `--surface-2 #1c1c1c`, `--text #ececec`, `--muted #9a9a9a`, `--accent #c6f432`, `--danger #ff5d5d`, `--ok #4cd964`, spacing scale (`--space-1` to `--space-8`), radius scale (`--radius-sm` to `--radius-full`), and `--min-touch-target: 48px`.
- `apps/web/src/index.css`: Mobile rules enforcing `100dvh`, `overflow-x: hidden`, safe-area insets (`env(safe-area-inset-*)`), touch target minimums (48px), and strict transitions (opacity/transform only, <= 200ms, disabled when `prefers-reduced-motion` is active). System font stack only.

### 4. Internationalization (i18n)
- `apps/web/src/i18n/index.ts`: Keyed dictionary system with English (`en`) and Arabic (`ar`, RTL support).
- Automatically updates `document.documentElement.lang` and `document.documentElement.dir` (`rtl` for Arabic, `ltr` for English).
- All user-visible strings go through `t(key)`. Arabic falls back to English when keys are missing.
- Added live language switcher in **More > Settings**.

### 5. Launch Experience & Splash
- `apps/web/src/components/LogoIntro.tsx`: Minimalist kinetic barbell SVG intro (<= 1.8s for first-ever launch, 600ms for subsequent cold launches, tap to skip, respects reduced motion). Does not block user interaction longer than hydration requires.

### 6. Mock User Bootstrap & Data Management
- `apps/web/src/bootstrap.ts`: Automatically seeds `MockUser` from `@hfos/sim` and declared environment items (`floor`, `wall`, `door`, `chair`) on first launch.
- Small permanent "MOCK USER" badge rendered in More tab.
- **More > Data Management**:
  - Displays athlete ID, codename, baseline fitness level, and priorities.
  - "Export JSON": Downloads complete backup of athlete profile, environment, kv store, and all events.
  - "Reset Mock Data": Prompts for confirmation and purges IndexedDB events while re-seeding the baseline mock athlete profile and environment.

### 7. Diagnostics Screen & PWA Update Banner
- `apps/web/src/screens/MoreScreen.tsx` (**More > About & Diagnostics**):
  - Displays App version (0.1.0), build commit (`CF_PAGES_COMMIT_SHA` or "dev"), network state (Online / Offline Local-First), display mode (Standalone PWA / Browser Tab), service worker registration state, storage persistence status (Yes/No), stored event count from IndexedDB, and effective config key count from `@hfos/config`.
- `apps/web/src/components/UpdateBanner.tsx`: Shows "Update available - Apply" when a new service worker is waiting. Triggered on More screen.

### 8. Performance Budget Check
- `scripts/check-bundle-size.mjs`: Script that gzips all JS files in `dist/assets` and enforces that total gzipped JS is under 300 KB.
  - Current total: **141.84 KB gzipped** (well below the 300 KB limit).
- Added `npm run check:bundle` script in `package.json` and added it as a verification step in `.github/workflows/ci.yml`.

---

## 2. Verification Results

- `npm run lint`: **0 errors**.
- `npm run typecheck`: **0 errors**.
- `npm test`: **13 test files, 120 tests passed**.
- `npm run build`: **Built successfully** with Service Worker generation (`dist/sw.js`).
- `npm run check:bundle`: **141.84 KB gzipped** (Passed, budget: 300 KB).

---

## 3. Decisions Made
1. **PWA Registration Type:** Set `registerType: "prompt"` in `VitePWA` so new versions are never auto-reloaded during workout sessions; update is applied via the `UpdateBanner` component.
2. **Persistence Guarantee:** Invoked `navigator.storage.persist()` on launch to request durable IndexedDB storage on Android / Chrome.
3. **Safe Area Insets:** Content container uses `safe-top`, `safe-left`, `safe-right`, and padding-bottom of 88px (`pb-[88px]`) to ensure the fixed 64px bottom nav and system navigation gesture bar never obscure interactive cards or buttons.

---

## 4. Deviations
- None. All requirements of Milestone 1-A were completed with zero hard rule violations. No external UI, router, animation, or state libraries were introduced.

---

## 5. Conflicts with the Brief
- None.

---

## 6. Open Items
- Next milestone will implement the active workout execution flow and plan viewer according to Milestone 1 specifications.
