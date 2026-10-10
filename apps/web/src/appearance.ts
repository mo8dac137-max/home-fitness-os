import { KeyValueStore } from './storage/index.js';

export type AccentPreset = 'lime' | 'cyan' | 'coral' | 'violet' | 'amber' | 'mint';
export type ClayDepth = 'soft' | 'medium' | 'strong';
export type CornerRadius = 'compact' | 'round' | 'extra_round';
export type Density = 'comfortable' | 'compact';
export type MotionMode = 'full' | 'reduced';
export type HapticsMode = 'on' | 'off';

export interface AppearanceSettings {
  accent: AccentPreset;
  depth: ClayDepth;
  radius: CornerRadius;
  density: Density;
  motion: MotionMode;
  haptics: HapticsMode;
}

export const ACCENT_PRESETS: Record<AccentPreset, { hex: string; labelKey: string }> = {
  lime: { hex: '#c6f432', labelKey: 'appearance.accent_lime' },
  cyan: { hex: '#38d6ff', labelKey: 'appearance.accent_cyan' },
  coral: { hex: '#ff6b57', labelKey: 'appearance.accent_coral' },
  violet: { hex: '#8b7cff', labelKey: 'appearance.accent_violet' },
  amber: { hex: '#ffb020', labelKey: 'appearance.accent_amber' },
  mint: { hex: '#5be3b1', labelKey: 'appearance.accent_mint' },
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  accent: 'lime',
  depth: 'medium',
  radius: 'round',
  density: 'comfortable',
  motion: 'full',
  haptics: 'on',
};

export const KV_KEY_APPEARANCE = 'appearance';

export function sanitizeAppearance(raw: unknown): AppearanceSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_APPEARANCE };
  }

  const s = raw as Record<string, unknown>;

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

  return { accent, depth, radius, density, motion, haptics };
}

/**
 * Applies the appearance settings to the document root element directly.
 */
export function applyAppearanceToDOM(settings: AppearanceSettings): void {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const root = document.documentElement;

  // 1. Accent color
  const accentHex = ACCENT_PRESETS[settings.accent]?.hex || ACCENT_PRESETS.lime.hex;
  root.style.setProperty('--accent', accentHex);

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
 */
export async function saveAppearance(settings: AppearanceSettings): Promise<void> {
  const validated = sanitizeAppearance(settings);
  const kv = new KeyValueStore();
  await kv.set(KV_KEY_APPEARANCE, validated);
  applyAppearanceToDOM(validated);
}
