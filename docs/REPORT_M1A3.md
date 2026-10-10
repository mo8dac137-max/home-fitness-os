# Milestone 1-A3 Completion Report: Copy + i18n + Appearance Lab

**Project:** Home Fitness OS  
**Status:** M1-A3 completed and verified.  
**Verification:** `npm run lint && npm run typecheck && npm test && npm run build && node scripts/check-bundle-size.mjs` passed with 0 errors across 15 test files and 126 tests.

---

## 1. Files Created & Modified

### 1. i18n Compliance & Copy Improvements
- `apps/web/src/i18n/index.ts`:
  - Added complete dictionary keys for all user-facing copy across Home, Train, Progress, More, Appearance Lab, Equipment, and common badges.
  - Standardized on sentence case (no uppercase shouts except small tokens like "MOCK" or "HF").
  - Replaced odd copy per requirements:
    - "COMMENCE WORKOUT" / "START WORKOUT" -> "Start workout"
    - "Progression Ledger Initialized" -> "Collecting data"
    - "Inspect home workout surfaces" -> "Check your training setup"
    - "Rep Target Mastery" -> "Rep targets hit"
    - "Mean Execution RPE" -> "Average effort (RPE)"
- `apps/web/src/screens/HomeScreen.tsx`, `TrainScreen.tsx`, `ProgressScreen.tsx`, `MoreScreen.tsx`:
  - Migrated 100% of visible JSX text to `t(key)` calls.
- `apps/web/src/__tests__/i18n-compliance.test.ts`:
  - Vitest guard scanning all `.tsx` screen and component return bodies for raw English sentences in JSX text nodes, failing if un-keyed English text is detected.

### 2. Appearance Lab (`apps/web/src/appearance.ts` & `apps/web/src/screens/AppearanceLab.tsx`)
- `apps/web/src/appearance.ts`:
  - Data model and types for appearance settings:
    - Accent presets: `lime` (`#c6f432`, default), `cyan` (`#38d6ff`), `coral` (`#ff6b57`), `violet` (`#8b7cff`), `amber` (`#ffb020`), `mint` (`#5be3b1`).
    - Clay depth: `soft` (0.6x), `medium` (1.0x, default), `strong` (1.4x).
    - Corner radius: `compact` (20px), `round` (28px, default), `extra_round` (36px).
    - Density: `comfortable` (1.0, default), `compact` (0.85).
    - Motion: `full` (default), `reduced`.
    - Haptics: `on` (default), `off`.
  - Persistence: stored under key `"appearance"` in IndexedDB key-value store.
  - Zero-flash bootstrapping: `applyAppearanceToDOM` sets CSS variables (`--accent`, `--depth`, `--r-lg`, `--density`, `--motion-duration`) on `document.documentElement` during bootstrap before first paint.
  - Sanitization: `sanitizeAppearance` strictly clamps invalid or corrupted saved values to defaults.
- `apps/web/src/screens/AppearanceLab.tsx`:
  - Live preview card on top featuring a mini hero card, primary clay accent button, three colored chips, progress ring, and exposure bar that reflect changes in real time.
  - Interactive grid controls with touch targets >= 48px for all appearance properties.
  - "Reset to defaults" action.

### 3. Clay Styling System Refactoring (`tokens.css` & `clay.css`)
- `apps/web/src/styles/tokens.css`:
  - Introduced CSS variables `--depth: 1`, `--density: 1`, `--r-lg: 28px`.
  - Radius and spacing scales computed dynamically from `--r-lg` and `--density`.
- `apps/web/src/styles/clay.css`:
  - Updated all box-shadow alphas to calculate dynamically using CSS `calc(...)`:
    - `rgb(0 0 0 / calc(0.55 * var(--depth)))`
    - `rgb(255 255 255 / calc(0.03 * var(--depth)))`
    - `rgb(255 255 255 / calc(0.07 * var(--depth)))`
    - `rgb(0 0 0 / calc(0.45 * var(--depth)))`
  - Radii mapped to `var(--radius-clay)` and `var(--radius-clay-sm)` (which derive from `--r-lg`).
  - No box-shadow animation, no `backdrop-filter`, no blur filters.

### 4. Automated Tests (`apps/web/src/__tests__/appearance.test.ts`)
- Verified default appearance structure.
- Verified sanitization and clamping of invalid saved objects.
- Verified persistence across IndexedDB close and reopen.
- Verified CSS variables applied correctly to DOM root.

---

## 2. Verification Results

- `npm run lint`: **0 errors**.
- `npm run typecheck`: **0 errors**.
- `npm test`: **15 test files, 126 tests passed**.
- `npm run build`: Production build succeeded. CSS is **7.01 KB gzipped** (well under 30 KB budget).
- `node scripts/check-bundle-size.mjs`: **169.28 KB gzipped JS** (Passed, budget: 300 KB).

---

## 3. Decisions Made
1. **Zero-Flash CSS Injection:** Injected appearance variables directly into `document.documentElement.style` during the asynchronous app bootstrap sequence before hydrating the main UI view.
2. **Modern CSS Color Alpha:** Used standard modern `rgb(0 0 0 / calc(alpha * var(--depth)))` syntax supported across Chromium and Android WebViews without performance overhead.
3. **i18n Guard AST Scanning:** Built an automated regex scanner that examines JSX return blocks to prevent future regressions where developer text might bypass `t()`.

---

## 4. Deviations
- None. All requirements strictly implemented.

---

## 5. Open Issues
- None. Ready for Milestone 1-B.
