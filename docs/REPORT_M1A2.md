# Milestone 1-A2 Completion Report: Dark Clay Visual System

**Project:** Home Fitness OS  
**Status:** M1-A2 completed and verified.  
**Verification:** `npm run lint && npm run typecheck && npm test && npm run build && node scripts/check-bundle-size.mjs` passed with 0 errors across 13 test files and 120 tests.

---

## 1. Files Created & Modified

### Design Tokens & Clay Recipes
- `apps/web/src/styles/tokens.css`:
  - Updated base palette: `--bg: #0a0a10`, `--clay-1: #1e202b`, `--clay-2: #151721`, `--text: #f1f1f4`, `--muted: #9a9cab`, `--accent: #c6f432` (lime primary action).
  - Added vibrant accent palette: `coral: #ff6b57`, `orange: #ff9f43`, `cyan: #38d6ff`, `blue: #4c8dff`, `violet: #8b7cff`, `pink: #ff7ac6`, `mint: #5be3b1`, `yellow: #ffd23f`, `teal: #2ec4b6`.
  - Defined single source of truth for movement pattern colors (`--pattern-horizontal_push`, `--pattern-vertical_push`, `--pattern-horizontal_pull`, `--pattern-vertical_pull`, `--pattern-squat`, `--pattern-hinge`, `--pattern-lunge`, `--pattern-core`, `--pattern-mobility`, `--pattern-conditioning`).
- `apps/web/src/styles/clay.css`:
  - `.clay`: Hero cards (max 6 per screen) with dual highlights and debossed shadows.
  - `.clay-sm`: List items, chips, and tiles.
  - `.clay-pressed`: Inset shadow state for pressed feedback.
  - `.clay-accent`: Primary button with variable `--c` for customized color glow.
  - `.clay-interactive`: Scale to 0.96 in 90ms with hardware-accelerated transform only.
  - Strictly followed performance rules: no box-shadow animation, no `backdrop-filter`, no `filter: blur()`, max 6 `.clay` elements per screen.
- `apps/web/src/index.css`:
  - Added ambient static radial background gradients (violet glow at top-left `#1b1633`, teal glow at top-right `#10252b` over `#0a0a10`, no `background-attachment: fixed`).
  - Implemented CSS logical properties (`margin-inline`, `padding-inline`, `inset-inline`, `padding-block-start/end`).
  - Added keyframe animations (`animate-screen-enter`, `animate-card-stagger`, `animate-draw-ring`) respecting `prefers-reduced-motion`.
- `src/index.css`: Linked tokens, clay recipes, and web styles for dev server shim.

### Components (`apps/web/src/components`)
- `IconSet.tsx`: Lightweight inline SVG icons with zero external icon dependencies: `home`, `dumbbell`, `chart`, `more`, `moon`, `lock`, `bolt`, `play`, `check`, `clock`, `flame`, `target`, `shield`.
- `ClayCard.tsx`: Reusable clay card component supporting `'hero'` (`.clay`), `'small'` (`.clay-sm`), and `'flat'` (`.clay-flat`).
- `ClayButton.tsx`: Clay buttons supporting `'primary'` (`.clay-accent`), `'secondary'` (`.clay-sm`), and `'ghost'` with 90ms scale transition and haptic feedback via `navigator.vibrate?.(10)`.
- `Chip.tsx`: Pattern-colored chips mapped to the movement pattern color palette with live active/inactive styling.
- `Ring.tsx`: SVG circular progress gauge with 700ms `stroke-dashoffset` transition.
- `Bar.tsx`: Colored horizontal progress and volume exposure bars labeled "estimate".
- `DayChip.tsx`: 7-day strip chips with day abbreviation, date number, kind icons (`main`, `micro`, `flex`, `active_recovery`, `rest=moon`), status indicators (Day 0 locked ring, Day 1 protected lock, Days 2–6 dashed adaptive outline).
- `StatTile.tsx`: Clay data tiles for metrics.
- `SectionHeader.tsx`: Typographic headers with optional action triggers.
- `EmptyState.tsx`: Structured empty states with clay icons and descriptions.
- `BottomNav.tsx`: Floating clay pill navigation bar (safe-area aware) with sliding active indicator (180ms cubic-bezier transform) and icon bounce on selection.
- `LogoIntro.tsx`: Kinetic launch splash with self-drawing accent ring (900ms SVG dashoffset), monogram "HF" scaling/fading in, and rising wordmark, supporting tap-to-skip and instant reduced motion.

### Screens with Rich Mock Content (`apps/web/src/screens`)
- `HomeScreen.tsx`:
  - Header with greeting, date, and "MOCK" tag.
  - HERO Clay Card "Today - Upper Push (Unit A)": 38 min, 6 exercises, Day 0 locked badge, colored muscle chips, large lime "START WORKOUT" action button.
  - 7-day horizontal strip of `DayChip`s with status and kind styling.
  - Bento row with weekly consistency `Ring` (3/4) and readiness tile with check-in action.
  - Trailing muscle exposure card with 6 colored `Bar`s labeled "estimate" and collecting data state.
  - Coach inbox card with empty state.
- `TrainScreen.tsx`:
  - Segmented control toggling between **Plan** and **Library**.
  - Plan view with prescribed exercise flow and working set breakdowns.
  - Library view listing all exercises from `@hfos/library` as `.clay-sm` rows with pattern color dots, exercise names, level dots (1–7), equipment tags, and safety/equipment locked badges. Search filter and pattern filter chips.
- `ProgressScreen.tsx`:
  - Mastery score ring, rep target mastery tiles, mean execution RPE gauge.
  - 14-day movement pattern exposure bars.
  - Honest "collecting data" empty state explaining data requirements.
- `MoreScreen.tsx`:
  - Grouped clay list rows for Settings (language selector), Equipment & Environment, Data Management (export JSON and reset mock data with modal confirmation), and System Diagnostics (version, commit SHA, online state, standalone PWA mode, service worker status, storage persistence, event count, and config key count).
  - Permanent "MOCK USER" badge.

---

## 2. Verification Results

- `npm run lint`: **0 errors**.
- `npm run typecheck`: **0 errors**.
- `npm test`: **13 test files, 120 tests passed**.
- `npm run build`: Production build succeeded with service worker generation.
  - CSS output: **28.90 KB** uncompressed, **6.66 KB gzipped** (well under the 30 KB gzipped budget).
- `node scripts/check-bundle-size.mjs`: **166.75 KB gzipped JS** (Passed, budget: 300 KB).

---

## 3. Decisions Made
1. **Performance Discipline:** Replaced heavy CSS drop-shadow filters and backdrop blur with layered linear gradients and inset box shadows (`.clay` and `.clay-sm`). Animation strictly touches `transform` and `opacity`.
2. **CSS Logical Properties:** Applied `margin-inline`, `padding-inline`, and `inset-inline` to ensure future RTL support operates seamlessly without layout shifts.
3. **No External Icon / Font Libraries:** All icons implemented as lightweight, vectorized inline SVG components to maintain small bundle footprints.

---

## 4. Deviations
- None. All requirements of Milestone 1-A2 completed strictly following the constitution and hard rules.

---

## 5. Open Items
- Milestone 1-B will wire `@hfos/engine-core` directly to the plan generator and workout execution flow, replacing the static mock numbers.
