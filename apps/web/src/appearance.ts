import { KeyValueStore } from './storage/index.js';

export type StyleVariant =
  | 'clay'
  | 'glass'
  | 'neu'
  | 'mono'
  | 'neon'
  | 'aurora'
  | 'brutal'
  | 'paper'
  | 'oled';
export type AccentPreset = 'lime' | 'cyan' | 'coral' | 'violet' | 'amber' | 'mint';
export type ClayDepth = 'soft' | 'medium' | 'strong';
export type CornerRadius = 'compact' | 'round' | 'extra_round';
export type Density = 'comfortable' | 'compact';
export type MotionMode = 'full' | 'reduced';
export type HapticsMode = 'on' | 'off';
/** Phase 4D5: manual keeps one fixed skin; system follows prefers-color-scheme. */
export type ThemeMode = 'manual' | 'system';

export interface AppearanceSettings {
  style: StyleVariant;
  theme_mode: ThemeMode;
  /** Skin applied while the system is in light mode (theme_mode = system). */
  style_light: StyleVariant;
  /** Skin applied while the system is in dark mode (theme_mode = system). */
  style_dark: StyleVariant;
  accent: AccentPreset;
  depth: ClayDepth;
  radius: CornerRadius;
  density: Density;
  motion: MotionMode;
  haptics: HapticsMode;
}

/**
 * Visual style variants (skins). Each id maps to a CSS file in
 * styles/skins/<id>.css activated by the data-style attribute on <html>.
 * clay = original Dark Clay recipes (base tokens.css + clay.css).
 * Every skin overrides the same five recipe classes (.clay, .clay-sm,
 * .clay-pressed, .clay-accent, .clay-flat) — no component ever branches
 * on the active style.
 */
export const STYLE_VARIANTS: readonly StyleVariant[] = [
  'clay',
  'glass',
  'neu',
  'mono',
  'neon',
  'aurora',
  'brutal',
  'paper',
  'oled',
];

/**
 * Light skins (neu, paper, brutal) need an ink-safe accent: raw bright
 * presets (lime, cyan, amber) fail contrast on a light surface when used
 * as text. We darken via color-mix (valid CSS value) toward a per-skin ink
 * target instead of overriding the user's choice. Dark skins use the raw
 * preset hex.
 */
const INK_SAFE_ACCENT_MIX: Partial<Record<StyleVariant, string>> = {
  neu: '#2a3050',
  paper: '#3d3229',
  brutal: '#26251c',
};

export function accentValueForStyle(style: StyleVariant, accentHex: string): string {
  const target = INK_SAFE_ACCENT_MIX[style];
  return target ? `color-mix(in srgb, ${accentHex} 70%, ${target})` : accentHex;
}

export const ACCENT_PRESETS: Record<AccentPreset, { hex: string; labelKey: string }> = {
  lime: { hex: '#c6f432', labelKey: 'appearance.accent_lime' },
  cyan: { hex: '#38d6ff', labelKey: 'appearance.accent_cyan' },
  coral: { hex: '#ff6b57', labelKey: 'appearance.accent_coral' },
  violet: { hex: '#8b7cff', labelKey: 'appearance.accent_violet' },
  amber: { hex: '#ffb020', labelKey: 'appearance.accent_amber' },
  mint: { hex: '#5be3b1', labelKey: 'appearance.accent_mint' },
};

/**
 * Per-skin metadata for the style picker swatches: i18n label key plus two
 * representative colors (page background and card surface) rendered as a
 * mini two-ring preview. Values mirror each skin's token overrides.
 */
export const STYLE_PRESETS: Record<StyleVariant, { labelKey: string; bg: string; surface: string }> = {
  clay: { labelKey: 'appearance.style_clay', bg: '#0a0a10', surface: '#1e202b' },
  glass: { labelKey: 'appearance.style_glass', bg: '#0c0e1d', surface: 'rgba(255, 255, 255, 0.22)' },
  neu: { labelKey: 'appearance.style_neu', bg: '#e3e8f0', surface: '#e9edf4' },
  mono: { labelKey: 'appearance.style_mono', bg: '#0f1114', surface: '#171a1f' },
  neon: { labelKey: 'appearance.style_neon', bg: '#05060b', surface: '#0c0e1a' },
  aurora: { labelKey: 'appearance.style_aurora', bg: '#07101d', surface: '#12233d' },
  brutal: { labelKey: 'appearance.style_brutal', bg: '#f5f1e6', surface: '#fffdf5' },
  paper: { labelKey: 'appearance.style_paper', bg: '#f7f3ea', surface: '#fffdf8' },
  oled: { labelKey: 'appearance.style_oled', bg: '#000000', surface: '#0b0b0d' },
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  style: 'clay',
  theme_mode: 'manual',
  style_light: 'paper',
  style_dark: 'clay',
  accent: 'lime',
  depth: 'medium',
  radius: 'round',
  density: 'comfortable',
  motion: 'full',
  haptics: 'on',
};

/** Skins that paint a dark page background (everything except neu/paper/brutal). */
const DARK_STYLES: readonly StyleVariant[] = ['clay', 'glass', 'mono', 'neon', 'aurora', 'oled'];

export function isDarkStyle(style: StyleVariant): boolean {
  return DARK_STYLES.includes(style);
}

/**
 * Phase 4D5: the skin actually painted.
 * - manual: exactly `style` (pre-4D5 behavior, byte-identical defaults).
 * - system: `style_dark` while the OS is dark, `style_light` while light.
 */
export function resolveEffectiveStyle(settings: AppearanceSettings, systemDark: boolean): StyleVariant {
  if (settings.theme_mode === 'system') {
    return systemDark ? settings.style_dark : settings.style_light;
  }
  return settings.style;
}

/** Browser read of prefers-color-scheme; defaults to dark outside a browser. */
export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

/**
 * The settings actually applied to the DOM: the same settings with `style`
 * resolved through the theme mode. Persistence always keeps the raw settings.
 */
export function effectiveAppearance(settings: AppearanceSettings): AppearanceSettings {
  return { ...settings, style: resolveEffectiveStyle(settings, systemPrefersDark()) };
}

export const KV_KEY_APPEARANCE = 'appearance';

export function sanitizeAppearance(raw: unknown): AppearanceSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_APPEARANCE };
  }

  const s = raw as Record<string, unknown>;

  const style: StyleVariant = STYLE_VARIANTS.includes(s.style as StyleVariant)
    ? (s.style as StyleVariant)
    : DEFAULT_APPEARANCE.style;
  const storedStyleIsValid = style === s.style;

  // Phase 4D5 theme mode. A payload from before this phase has neither key:
  // it keeps `manual` (zero behavior change), and its valid stored style
  // becomes the preference for the mode that skin actually belongs to.
  const theme_mode: ThemeMode = s.theme_mode === 'system' ? 'system' : 'manual';
  const style_dark: StyleVariant = STYLE_VARIANTS.includes(s.style_dark as StyleVariant)
    ? (s.style_dark as StyleVariant)
    : storedStyleIsValid && isDarkStyle(style)
      ? style
      : DEFAULT_APPEARANCE.style_dark;
  const style_light: StyleVariant = STYLE_VARIANTS.includes(s.style_light as StyleVariant)
    ? (s.style_light as StyleVariant)
    : storedStyleIsValid && !isDarkStyle(style)
      ? style
      : DEFAULT_APPEARANCE.style_light;

  const accent: AccentPreset =
    s.accent === 'lime' ||
    s.accent === 'cyan' ||
    s.accent === 'coral' ||
    s.accent === 'violet' ||
    s.accent === 'amber' ||
    s.accent === 'mint'
      ? s.accent
      : DEFAULT_APPEARANCE.accent;

  const depth: ClayDepth =
    s.depth === 'soft' || s.depth === 'medium' || s.depth === 'strong'
      ? s.depth
      : DEFAULT_APPEARANCE.depth;

  const radius: CornerRadius =
    s.radius === 'compact' || s.radius === 'round' || s.radius === 'extra_round'
      ? s.radius
      : DEFAULT_APPEARANCE.radius;

  const density: Density =
    s.density === 'comfortable' || s.density === 'compact'
      ? s.density
      : DEFAULT_APPEARANCE.density;

  const motion: MotionMode =
    s.motion === 'full' || s.motion === 'reduced'
      ? s.motion
      : DEFAULT_APPEARANCE.motion;

  const haptics: HapticsMode =
    s.haptics === 'on' || s.haptics === 'off'
      ? s.haptics
      : DEFAULT_APPEARANCE.haptics;

  return { style, theme_mode, style_light, style_dark, accent, depth, radius, density, motion, haptics };
}

/**
 * Applies the appearance settings to the document root element directly.
 */
export function applyAppearanceToDOM(settings: AppearanceSettings): void {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const root = document.documentElement;

  // 0. Visual style variant (activates the matching skin stylesheet)
  root.setAttribute('data-style', settings.style);

  // 1. Accent color (ink-safe mix on the light Neumorphism skin)
  const accentHex = ACCENT_PRESETS[settings.accent]?.hex || ACCENT_PRESETS.lime.hex;
  root.style.setProperty('--accent', accentValueForStyle(settings.style, accentHex));

  // 2. Depth multiplier: 0.6 / 1 / 1.4
  const depthMultiplier =
    settings.depth === 'soft' ? '0.6' : settings.depth === 'strong' ? '1.4' : '1';
  root.style.setProperty('--depth', depthMultiplier);

  // 3. Corner radius: 20px / 28px / 36px
  const radiusPx =
    settings.radius === 'compact' ? '20px' : settings.radius === 'extra_round' ? '36px' : '28px';
  root.style.setProperty('--r-lg', radiusPx);

  // 4. Density multiplier: 0.85 / 1
  const densityMultiplier = settings.density === 'compact' ? '0.85' : '1';
  root.style.setProperty('--density', densityMultiplier);

  // 5. Motion override
  if (settings.motion === 'reduced') {
    root.style.setProperty('--motion-duration-fast', '0ms');
    root.style.setProperty('--motion-duration', '0ms');
    root.style.setProperty('--motion-duration-slow', '0ms');
  } else {
    root.style.setProperty('--motion-duration-fast', '90ms');
    root.style.setProperty('--motion-duration', '200ms');
    root.style.setProperty('--motion-duration-slow', '600ms');
  }
}

/**
 * Loads appearance settings from IndexedDB KV store and returns validated settings.
 */
export async function loadAppearance(): Promise<AppearanceSettings> {
  const kv = new KeyValueStore();
  const raw = await kv.get(KV_KEY_APPEARANCE);
  return sanitizeAppearance(raw);
}

/**
 * Persists appearance settings to IndexedDB KV store and applies them immediately.
 * Persistence keeps the raw settings; the DOM receives the theme-mode-resolved
 * effective appearance (Phase 4D5).
 */
export async function saveAppearance(settings: AppearanceSettings): Promise<void> {
  const validated = sanitizeAppearance(settings);
  const kv = new KeyValueStore();
  await kv.set(KV_KEY_APPEARANCE, validated);
  applyAppearanceToDOM(effectiveAppearance(validated));
}
