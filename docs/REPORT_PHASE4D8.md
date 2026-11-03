# Phase 4D8 Report — Motion Personality Hint in the Style Picker

Executed on top of `main` @ `eef82b9` (Phase 4D7: per-skin motion
personality — JS duration scales + CSS timing curves and signature keyframes,
all CI-green). Scope: the first 4D8 candidate from STATE.md — the motion
personality was implicit (documented in code/tests only); the lab's style
picker now says it out loud. Pure client phase; nothing to deploy
server-side.

## 1. What the user sees

Every tile in the Appearance Lab's style picker (Control 1) carries a small
caption under the skin name: **`Motion: {character}`** (en) /
**`الحركة: {character}`** (ar):

| skin  | en                 | ar             |
| ----- | ------------------ | -------------- |
| clay  | Soft settle        | استقرار ناعم    |
| glass | Unhurried glide    | انزلاق متأنٍ    |
| neu   | Cushioned          | وسائد مطاطية    |
| mono  | Crisp              | حاسم           |
| neon  | Electric snap      | خاطف كهربائي    |
| aurora | Slow drift        | انسياب بطيء     |
| brutal | Hard stamps       | ختم صارم        |
| paper | Steady press       | ضغط مطّرد       |
| oled  | Sharp & quick      | حاد وسريع       |

The caption renders at 9px, semibold, 80% opacity — present for every tile,
quiet enough not to compete with the skin names. Because the picker is
WYSIWYG (4D5), the caption describes the tile's own skin; choosing it applies
both the look and the motion feel it advertises.

## 2. Implementation

- `appearance.ts`: `MotionPersonality` gains `labelKey: string` (one per
  skin, `appearance.motion_<id>`). Plain string — `appearance.ts` never
  imports i18n; the call site casts through `I18nKey` exactly like the
  existing `STYLE_PRESETS.labelKey` pattern.
- `i18n/index.ts`: 10 new keys per dictionary — the
  `appearance.motion_hint` template with the `{character}` placeholder plus
  the nine character labels. Both dicts get identical key sets (compile-time
  `Record<keyof enDict, string>` + the Phase 3 runtime guards) and the
  global placeholder-parity test now covers `{character}` too.
- `AppearanceLab.tsx`: the tile renders
  `t('appearance.motion_hint').replace('{character}', t(labelKey))` — the
  same manual placeholder pattern 4D6 established for `{date}` / `{code}`.
- No new components, no branching on the active style, no persistence
  changes (the hint is derived from the skin, never stored).

## 3. Deliberately NOT done (honest scope)

- **No live motion preview inside the tile**: the whole app already repaints
  in the chosen skin (WYSIWYG), so the motion is one navigation away; an
  in-tile animation would spend bundle for little signal.
- **No scale numbers in the UI**: "1.15×" is developer truth, not user
  language — the character words carry the meaning; the numbers stay in
  tests/docs.
- The remaining 4D8 candidates are unchanged: revoked-device history
  (needs a query surface), revoke second factor (product decision),
  cursor-based pull (deliberately full pull today), pg_cron (owner-blocked).

## 4. Verification (actual runs)

- `npm run typecheck` clean; `npm run lint` clean.
- **Tests: 40 files / 366 passing** (+5 net), all in the new
  `motion4D8.test.ts`: labelKeys resolve in both dicts (with the Arabic
  script invariant), nine-distinct-labels guard per dict, hint-template
  placeholder guard, picker wiring guard, labelKey churn guard. The 4D7
  churn guard was adjusted to pin `durationScale` values only (labelKey
  churn is now owned by the 4D8 guard) — no behavior change.
- `vite build` clean (PWA precache 14 entries).
- Bundle: **142.43 / 300 KB gzipped** (+0.33 KB for the ten bilingual keys,
  the labelKey field and the tile caption).

## 5. Owner actions

**None.** Client-only phase; ships with the regular Pages deploy. The open
owner actions remain 4D6's: redeploy the `device-auth` function and
optionally set `DEVICE_AUTH_ALLOWED_ORIGINS`.
