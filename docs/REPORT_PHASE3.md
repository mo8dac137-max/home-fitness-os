# Phase 3 Report — Complete Arabic (100% Dictionary Coverage) + RTL Audit

Executed directly on the repository by the reviewer assistant, on top of `main` @ `794f17a` (Phase 2C). Scope taken from `docs/STATE.md` §5: "Phase 3 (Next): Complete Arabic (100% dictionary coverage) + RTL audit." All outputs below were captured from actual terminal runs in this session.

## 1. Summary of Delivered Work

### `apps/web/src/i18n/index.ts`
- **146 missing Arabic translations added.** Before: `enDict` had 252 keys, `arDict` only 106 (57.9%); in Arabic mode `t()` silently fell back to English (`arDict[key] ?? enDict[key]`) for 146 keys across `home.*` (44), `train.*` (20), `appearance.*` (22), `about.*` (15), `data.*` (12), `progress.*` (11), `equipment.*` (8), `settings.*` (7), `more.*` (7). After: **252/252 — 100% parity**. All values are genuine Arabic in the existing dict's house style (e.g. «درجة الإتقان», «التمارين الموصوفة», «غير متصل (محلي أولًا)»); Latin tokens that are product terms (RPE, PWA, JSON, Redmi 12, OLED/LCD, IndexedDB) remain embedded inside Arabic sentences by design.
- **Compile-time enforcement:** the `arDict` declaration changed from `Partial<typeof enDict>` to `Record<keyof typeof enDict, string>`. A future key added to `enDict` without Arabic, or a stray extra key in `arDict`, is now a TypeScript error, not a silent English fallback.

### `apps/web/src/__tests__/i18nArabicCoverage.test.ts` (new, 65 lines, 4 tests)
1. Key parity both directions (`Object.keys` sorted equality; count > 200 asserted so a dict wipe cannot pass trivially).
2. Every Arabic value contains Arabic script (`/[\u0600-\u06FF]/`) — no all-Latin leftovers.
3. `{placeholder}` tokens (e.g. `{current}`, `{total}`, `{reps}`) match exactly between English and Arabic values.
4. Behavioral: after `setLanguage('ar')`, `t(key)` returns the `arDict` value for **every** one of the 252 keys and never the English fallback; language is restored to `'en'` afterwards.

### RTL audit — `apps/web/src/__tests__/rtl.test.ts` (+1 permanent guard test, 7 total)
New test `RTL audit: no physical direction classes or CSS properties (Phase 3)` scans every `.tsx` in `screens/` and `components/` for physical, direction-dependent Tailwind utilities — `-?[mp][lr]-\d` (ml/mr/pl/pr incl. negative), `text-left/right`, `rounded-l/rounded-r` (side tokens only; `rounded-lg` correctly not matched), `border-l/border-r`, `left-N/right-N` insets — and the three stylesheet files for physical box properties (`padding-left/right:`, `margin-left/right:`, `text-align: left/right`). The intentional `direction: ltr` inside `.ltr-num` is not a box property and remains allowed. Any future physical-class regression fails CI.

### Physical violations fixed (the audit's founding findings)
- `HomeScreen.tsx:358`: `ml-1` → `ms-1`.
- `MoreScreen.tsx` (5 nav/data buttons): `text-left` → `text-start`.
- `TrainScreen.tsx:272`: `text-right` → `text-end` (set-count column).
Everything else was already logical (`insetInlineStart`, `--dir` var, `.ltr-num`, icon mirroring) — the pre-existing M1-A4 RTL tests continue to pass unchanged.

## 2. Configuration Settings Cited (`@hfos/config`)
None added or changed in this phase (translation/audit-only scope). Existing runner keys referenced by the app remain as per Phase 2C list.

## 3. Raw DoD Terminal Outputs

### Check 1+2: TypeScript Typecheck (base + engine-core)
```text
$ npm run typecheck
> tsc --noEmit && tsc --noEmit -p packages/engine-core/tsconfig.json
(exit code 0, no output)
```

### Check 3: ESLint
```text
$ npm run lint
> eslint .
(exit code 0)
```

### Check 4: Vitest
```text
$ npx vitest run

 Test Files  22 passed (22)
      Tests  183 passed (183)
   Start at  22:47:30
   Duration  5.99s (transform 601ms, setup 0ms, collect 1.84s, tests 555ms, environment 3ms, prepare 1.20s)
```
Breakdown: 178 baseline + 4 i18nArabicCoverage + 1 RTL audit = 183.

### Check 5: Vite Production Build
```text
$ npm run build
✓ 88 modules transformed.
(dist assets emitted)
PWA v2.0.0
mode      generateSW
precache  14 entries (592.99 KiB)
✓ built (exit code 0)
```

### Check 6: Bundle Budget Check
```text
$ npm run check:bundle
--- Performance Budget Check (JS gzipped < 300 KB) ---
- index-CgfdwX0r.js: 125.35 KB (gzipped)
- virtual_pwa-register-BqmM78oj.js: 0.55 KB (gzipped)
- workbox-window.prod.es5-BBnX5xw4.js: 2.30 KB (gzipped)
Total gzipped JS: 128.20 KB (budget: 300 KB)
✅ PASSED: Within performance budget.
```
Phase 3 cost: +2.16 KB gzipped vs Phase 2C (126.04 → 128.20) — the 146 Arabic strings now bundled; far under the 300 KB budget.

### Check 7: Git Status
```text
$ git status --short
(clean working tree after commit — see section 5)
```

## 4. Failures / Skipped
- Nothing failed on the integrated run. The insertion was generated from the runtime-extracted key list (`enDict` built via esbuild → `Object.keys`) with translations mapped **by key**, so key typos were structurally impossible; the `Record` annotation plus the new parity test then verified the result independently.
- Nothing skipped.

## 5. Git Status, Remote, & Log Evidence
```text
$ git status --short
(clean working tree after commit)
```
Commit: `feat(i18n): full Arabic dictionary coverage (252/252) + permanent RTL audit (Phase 3)`
(Pushed directly to GitHub `main` by the assistant, using the repository owner's fine-grained token, after re-running every DoD check on this exact commit.)

## 6. Deviations from the STATE.md Scope Note
- None in substance. Two judgment calls, both documented: (a) product-term Latin tokens (RPE, PWA, JSON, Redmi 12, OLED/LCD, IndexedDB, Unit IDs) are kept inside Arabic sentences rather than transliterated — matches the existing dict's precedent (`runner.rpe_explainer` already used "RPE"); (b) the RTL audit guard intentionally does not flag `direction: ltr` inside `.ltr-num` (it exists to render numerals LTR inside RTL text and is itself asserted by the M1-A4 tests).
