# Appearance Skins Report — Style Picker + 4 New Skins (aurora, brutal, paper, oled)

Executed directly on the repository, on top of `main` @ `c8d5e97` (Phase 4D3,
pushed, CI green). Scope: the owner asked for "more theme options such as
glassmorphism and others". Investigation showed the repo already contained a
**half-landed, unreachable** skin system: four skin stylesheets plus the
`appearance.ts` plumbing sat **uncommitted in the working tree** from a prior
session, with no UI to switch styles and with the committed appearance tests
already failing against that plumbing (4/5 failing locally). This task
finished the feature honestly: landed the inherited plumbing, fixed the stale
tests, built the missing switcher, and added four new skins. All outputs below
are from actual terminal runs in this session.

## 1. What was inherited vs. added
- **Inherited (uncommitted, now committed)**: `styles/skins/{glass,neu,mono,neon}.css`,
  the `StyleVariant`/`STYLE_VARIANTS`/`applyAppearanceToDOM` plumbing in
  `appearance.ts`, and the four `@import` lines in `index.css`.
- **Added**: four new skins (`aurora`, `brutal`, `paper`, `oled`), the
  **Visual style picker** in `AppearanceLab` (the actual gap — no UI could
  reach any skin before), per-skin ink-safe accent mixing for light skins,
  the `--accent-ink` token, the tokenized app shell, `STYLE_PRESETS` swatch
  metadata, 10 i18n keys in both dictionaries (+1 updated), and a rewritten
  appearance test file.

## 2. The nine skins
| id | Look | Base | Notes |
| --- | --- | --- | --- |
| `clay` | Original Dark Clay | dark | default; base `tokens.css` + `clay.css` |
| `glass` | Frosted panels over ambient blobs | dark | backdrop-filter budget: `.clay`/`.clay-accent` only |
| `neu` | Light neumorphism | light | dual-source extruded shadows; accent ink-mixed |
| `mono` | Swiss flat graphite | dark | zero shadows, hairlines only |
| `neon` | Near-black + accent glow | dark | accent-tinted rims/bloom via color-mix |
| `aurora` | Midnight + teal/indigo curtains | dark | cool fixed glow rim, independent of accent |
| `brutal` | Cream neubrutalism | light | 2px ink borders, blur-free offset shadows; radius scaled ×0.22 (hard corners are the identity) |
| `paper` | Warm editorial paper | light | hairlines + whisper shadows, reading-friendly |
| `oled` | True black minimalism | dark | `#000` base, hairline separation, zero bloom (battery invariant) |

Every skin overrides the same five recipe classes (`.clay`, `.clay-sm`,
`.clay-pressed`, `.clay-accent`, `.clay-flat`) under `html[data-style=…]` —
no component branches on the active style. Each file documents its own
performance budget (no animated box-shadow anywhere; press states stay
transform-only via the shared `.clay-interactive`).

## 3. Style picker (`AppearanceLab` Control 1)
Nine two-ring swatch tiles (outer ring = page background, inner ring = card
surface — the values mirror each skin's tokens), same selected-state language
as the other controls. Selecting a tile flows through the existing path:
`update({ style })` → `saveAppearance` → `applyAppearanceToDOM` →
`data-style` on `<html>` → the matching stylesheet activates. No new state,
no new persistence keys — `style` was already part of `AppearanceSettings`
and of the KV payload.

## 4. Ink-safe accents on light skins
Raw bright accent presets (lime, cyan, amber) fail contrast as **text** on
light surfaces. The single neu-specific mix became `INK_SAFE_ACCENT_MIX`
with a per-skin ink target: `neu → #2a3050`, `paper → #3d3229`,
`brutal → #26251c` — applied as `color-mix(in srgb, accent 70%, target)`
inside `accentValueForStyle`. Dark skins keep the raw preset hex. Like neu,
`brutal`/`paper` remap Tailwind's `--color-white` to their dark ink so the
hardcoded `text-white` utilities stay readable on their light surfaces.

A second token, `--accent-ink`, defines the ink to place **on top of**
accent fills: `#08080c` by default (bright accent on dark skins), `#ffffff`
on neu/brutal/paper (their accent arrives pre-darkened). Consumers updated:
`UpdateBanner`'s apply button (`text-[#0b0b0b]` → `text-[var(--accent-ink)]`)
and the lab preview button, which stopped forcing `text-black` over the
skin's `.clay-accent` ink.

## 5. i18n
10 new keys in **both** dictionaries: `appearance.style_label` and the nine
skin names (`appearance.style_clay` … `appearance.style_oled`), plus an
updated `more.item_appearance_desc` that mentions visual styles. Arabic
parity is compile-enforced (`arDict: Record<keyof typeof enDict, string>`),
and the existing `i18n-compliance` / `i18nArabicCoverage` guards pass
unchanged.

## 6. The shell bug the rehearsal caught (App.tsx)
`App.tsx` hardcoded the clay palette on the app shell:
`bg-[#0a0a10] text-[#f1f1f4]` — a layer ON TOP of the token-driven body.
The first browser screenshot of `brutal` showed cream cards floating on a
**black page**; `LogoIntro` had the same hardcoded splash background. Both
now paint `bg-[var(--bg)] text-[var(--text)]` — byte-identical rendering
for the default clay skin (same hexes), correct for every other skin. A
source-guard test blocks a reintroduction.

## 7. Verification
- **Tests**: 301 passing (35 files) — appearance file rewritten 5 → 12 tests:
  defaults assert `style: 'clay'`; every registered variant survives
  `sanitizeAppearance` and a bogus style falls back to clay; raw accent on
  the six dark skins vs. the exact `color-mix` string on neu/paper/brutal;
  `STYLE_PRESETS` covers all variants and every label key resolves in
  `enDict`; shell + light skins stay token-driven (source guard);
  `applyAppearanceToDOM` asserts `data-style` with an attribute-capturing
  fake root (the committed test crashed against the inherited `setAttribute`
  call — it mocked a root without it).
- `npm run typecheck` + `npm run lint` clean (one iteration: the
  `noUncheckedIndexedAccess` complaint on the dictionary lookup in my own
  new test).
- **Build**: `vite build` clean; all 8 skin selectors verified present in the
  emitted CSS (`data-style='aurora'` etc. — one grep per skin).
- **Bundle**: 139.84 / 300 KB gzipped (+0.75 KB for the picker + presets;
  skins are pure CSS and are not counted by the JS budget).

## 8. Live browser rehearsal (`vite preview` + headless browser)
- All nine picker tiles clicked through the production path:
  `data-style` switched to `brutal`, `aurora`, `glass`, `oled`, back to
  `clay` — every click verified via the DOM attribute.
- The chosen skin **survived a full page reload** (KV persistence +
  pre-paint application).
- Corner-pixel checks on the light skins after the shell fix: `neu` →
  `rgb(227, 232, 240)` = `#e3e8f0` ✔, `paper` → `rgb(247, 243, 234)` =
  `#f7f3ea` ✔, `brutal` → `rgb(245, 241, 230)` = `#f5f1e6` ✔.
- Screenshot review: aurora's cool glow rim, brutal's hard offset shadows
  with the olive ink-mixed accent button (white ink), paper's hairline
  cards — all render as designed.

## 9. Honest Non-Goals
- No per-skin motion personality: every skin shares the global motion tokens;
  a `prefers-reduced-motion` user gets the same reduction in all skins.
- `brutal` intentionally scales the user's radius preference down (×0.22)
  instead of honoring it literally — hard corners are the skin's identity;
  documented in the skin header.
- No dark/light toggle beyond picking a light or dark skin, and no
  auto-switching by `prefers-color-scheme` (a future candidate).
- UI behavior is guarded by logic/source tests per house style; there is no
  React render harness in this repo, so the picker tiles are exercised
  through the settings path they drive, not through DOM rendering.
