# Phase 4D7 Report — Per-Skin Motion Personality

Executed on top of `main` @ `9a4f009` (Phase 4D6 live client-side; its server
redeploy remains an owner action). Scope: the one 4D6 candidate that stayed
open — a per-skin motion personality (until now every skin shared the same
global motion tokens). Pure client phase: CSS + one duration-scale map;
nothing to deploy server-side.

## 1. Division of ownership

- **JS** (`appearance.ts`): `MOTION_PERSONALITIES: Record<StyleVariant,
  MotionPersonality>` with a single knob, `durationScale`.
  `applyAppearanceToDOM` multiplies the **six** base motion tokens by the
  active skin's scale as inline styles, exactly like before — so the user's
  `motion: 'reduced'` choice keeps winning by construction (it zeroes all
  six unscaled, whatever the skin). Because every caller passes the
  theme-mode-resolved effective appearance (4D5), the scale always follows
  the skin actually painted, including live scheme swaps.
- **CSS** (each `styles/skins/<id>.css`): the character. Every non-clay skin
  declares its own `--motion-timing` inside its existing
  `:root[data-style='…']` token block; clay keeps the tokens.css baseline
  (`cubic-bezier(0.16, 1, 0.3, 1)`, scale 1 — byte-identical behavior).
- The invariant holds: **no component branches on the active style**.
  Components keep using the same `animate-screen-enter` /
  `animate-card-stagger` / `animate-draw-ring` / `transition-motion` classes
  as always; the personality lives entirely under `html[data-style=…]`.

## 2. The personalities

| skin  | scale | timing curve                  | character                    |
| ----- | ----- | ----------------------------- | ---------------------------- |
| clay  | 1.0   | cubic-bezier(0.16, 1, 0.3, 1) | soft settle (baseline)       |
| glass | 1.15  | cubic-bezier(0.33, 0, 0.2, 1) | heavy frosted glide          |
| neu   | 1.0   | cubic-bezier(0.25, .46, .45, .94) | cushioned rubber         |
| mono  | 0.85  | cubic-bezier(0.2, 0, 0, 1)    | Swiss crisp, zero bounce     |
| neon  | 0.8   | cubic-bezier(0.34, 1.3, .64, 1) | electric snap (tiny overshoot) |
| aurora | 1.2  | cubic-bezier(0.45, .05, .15, 1) | slow drifting glow          |
| brutal | 0.7  | cubic-bezier(0.13, .99, .09, 1) | stamps, no ceremony         |
| paper | 1.0   | cubic-bezier(0.4, 0, 0.2, 1)  | steady print press           |
| oled  | 0.85  | cubic-bezier(0.05, 0.7, 0.1, 1) | black-glass sharp           |

Resulting DOM values (`motion: 'full'`), tokens in order
fast/base/slow/enter/draw/stagger: glass → 103/230/690/253/1035/57 ms;
brutal → 63/140/420/154/630/35 ms; clay unchanged at 90/200/600/220/900/50 ms
(float rounding is documented in the tests: `90 × 1.15 → 103.49… → 103`).

## 3. Signature enter animations (glass + brutal)

- **glass** — `@keyframes glassEnter`: the standard rise+fade plus a faint
  `scale(0.985 → 1)` breath, like a pane lifted into place. Opacity +
  transform only (the skin's own performance rules hold).
- **brutal** — `@keyframes brutalStamp`: no fade at all (the element stays
  fully opaque, honest like the rest of the skin); it lands from 6px above
  and stays put, at the fastest scale of all skins.
- Both are wired by overriding `animation-name` under
  `html[data-style='…'] .animate-screen-enter / .animate-card-stagger` —
  duration, timing and stagger still come from the shared tokens. Tests guard
  that no other skin introduces keyframes or `animation-name` overrides.

## 4. Honest reduced motion (pre-existing gap closed)

`index.css` hardcoded `220ms` (screen/card enter), `900ms` (logo ring) and a
`50ms` stagger step — durations that ignored the user's in-app
`motion: 'reduced'` setting (only the token consumers went to 0ms). They now
consume three new tokens — `--motion-duration-enter`,
`--motion-duration-draw`, `--motion-stagger` — which JS scales and zeroes
exactly like the other three; the OS-level `prefers-reduced-motion` block in
tokens.css zeroes all six too. Hardcoded ms survives only as
`var(…, fallback)` safety nets for the pre-bootstrap paint. Clay keeps
220/900/50 ms, so the baseline is pixel-identical — the change is that
"reduced" now genuinely stops everything.

## 5. Deliberately NOT done (honest scope)

- **No new lab UI and no i18n churn**: the personality is an implicit
  property of the chosen skin — the picker already shows what you get.
- **No per-skin logo ring**: `animate-draw-ring` stays a global brand moment
  (only its duration now follows the skin scale).
- **4D6 owner actions unchanged and still open**: redeploy the `device-auth`
  function (honest-404 revoke + CORS allow-list source); optional
  `DEVICE_AUTH_ALLOWED_ORIGINS` once the production origin is pinned down.

## 6. Verification (actual runs)

- `npm run typecheck` clean; `npm run lint` clean.
- **Tests: 39 files / 361 passing** (+10 net), all in the new
  `motion4D7.test.ts`: map completeness + sane range, per-skin churn guard,
  clay byte-identical baseline, glass 1.15x exact DOM values,
  reduced-wins-over-personality (aurora), scale extremes (brutal/aurora),
  per-skin timing-curve CSS contract, signature keyframes wired for
  glass/brutal only (incl. clay.css negative guard), index.css
  fallback-only-ms guard, tokens.css six-token + reduced-media guard.
- `vite build` clean (PWA precache 14 entries).
- Bundle: **142.10 / 300 KB gzipped** (+0.14 KB for the personality map, two
  keyframes and eight timing declarations).

## 7. Owner actions

**None.** 4D7 ships with the regular Pages deploy. The open owner actions
remain 4D6's (function redeploy + optional CORS env var).
