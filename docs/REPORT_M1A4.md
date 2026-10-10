# Milestone 1-A4 Completion Report: RTL Fixes

**Project:** Home Fitness OS  
**Status:** M1-A4 completed and verified.  
**Verification:** `npm run lint && npm run typecheck && npm test && npm run build && node scripts/check-bundle-size.mjs` passed with 0 errors across 16 test files and 131 tests.

---

## 1. Files Created & Modified

### 1. Direction Variable in Design Tokens
- `apps/web/src/styles/tokens.css`:
  - Added `:root { --dir: 1 }` and `[dir="rtl"] { --dir: -1 }`.

### 2. Bottom Navigation Indicator Rebuild
- `apps/web/src/components/indicatorOffset.ts`:
  - Pure helper functions `indicatorOffset(index, isRtl)` and `indicatorCssVarTransform(index)` calculating precise translation without pixel drift.
- `apps/web/src/components/BottomNav.tsx`:
  - Rebuilt tab layout with `relative grid grid-cols-4`.
  - Positioned sliding pill indicator as `absolute`, logically anchored with `inset-block-0` and `inset-inline-start-0`, width `w-1/4` (25%), containing an inner pill with padding.
  - Indicator transform set to `translateX(calc(var(--dir) * <index> * 100%))` with 180ms ease transition.

### 3. Directional Icon Mirroring & Logical Directional Styling
- `apps/web/src/index.css`:
  - Added `[dir="rtl"] .icon-directional { transform: scaleX(-1); }` for chevrons and back arrows.
  - Added `.ltr-num { direction: ltr; unicode-bidi: isolate; display: inline-block; }`.
  - Added `.content-scroll-area { padding-block-end: calc(72px + env(safe-area-inset-bottom, 0px) + 16px); }`.
- `apps/web/src/screens/MoreScreen.tsx` & `AppearanceLab.tsx`:
  - Wrapped back arrows and menu chevron navigation icons in `.icon-directional` to automatically mirror in RTL.

### 4. Numbers, Durations, and Units Isolation
- `apps/web/src/screens/HomeScreen.tsx`:
  - Applied `.ltr-num` to duration (`38 min`), sets (`18 working sets`), exercises count (`6 exercises`), RPE target (`RPE 7-8`), week counter, and 3/4 consistency ratio.
- `apps/web/src/screens/TrainScreen.tsx`:
  - Applied `.ltr-num` to duration, set counts ("3 x 10", "3 x 35s"), and level indicators.
- `apps/web/src/screens/ProgressScreen.tsx`:
  - Applied `.ltr-num` to score percentage (`65%`), rep targets hit (`10 / 10 reps`), and average effort (`7.5 RPE`).
- `apps/web/src/components/DayChip.tsx`:
  - Applied `.ltr-num` to the day numbers.

### 5. Content Accessibility & Scroll Padding
- `apps/web/src/App.tsx`:
  - Applied `content-scroll-area` to the main scroll container, ensuring bottom navigation and system navigation gesture bar never obscure the last action button (Start workout) on a 360x640 viewport.

### 6. Immediate Document Direction and Language Persistence
- `apps/web/src/i18n/index.ts`:
  - Confirmed `setLanguage` updates `document.documentElement.lang` and `document.documentElement.dir` (`'rtl'` for Arabic, `'ltr'` for English) immediately and notifies subscribers.
  - Persisted in IndexedDB KV store under `"hfos_language"`.

### 7. Unit Tests
- `apps/web/src/__tests__/rtl.test.ts`:
  - Tested `indicatorOffset` in LTR and RTL for all tab indexes (0 through 3).
  - Tested `indicatorCssVarTransform` output format.
  - Tested that `.ltr-num` is actively applied across components and screens.
  - Tested that `tokens.css` defines `--dir` for both `:root` and `[dir="rtl"]`.
  - Tested that `index.css` defines `.ltr-num`, `icon-directional`, and `content-scroll-area`.

---

## 2. Verification Results

- `npm run lint`: **0 errors**.
- `npm run typecheck`: **0 errors**.
- `npm test`: **16 test files, 131 tests passed**.
- `npm run build`: Production build succeeded. CSS is **7.08 KB gzipped** (well under 30 KB budget).
- `node scripts/check-bundle-size.mjs`: **169.44 KB gzipped JS** (Passed, budget: 300 KB).

---

## 3. Decisions Made
1. **CSS `--dir` Property:** By using `--dir: 1` in `:root` and `--dir: -1` in `[dir="rtl"]`, hardware-accelerated transforms automatically respect RTL mirroring without requiring JavaScript conditional inline branches.
2. **Strict LTR Number Isolation:** Embedded numbers and units within `.ltr-num` with `unicode-bidi: isolate` ensure that Latin numbers and math symbols (e.g. "3 x 10") never get flipped into illogical right-to-left order when viewed in Arabic.

---

## 4. Deviations
- None.

---

## 5. Open Issues
- Ready for Milestone 1-B.
