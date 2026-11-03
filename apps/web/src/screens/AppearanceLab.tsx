import React from 'react';
import {
  type AppearanceSettings,
  ACCENT_PRESETS,
  DEFAULT_APPEARANCE,
  STYLE_PRESETS,
  STYLE_VARIANTS,
  type AccentPreset,
  type ClayDepth,
  type CornerRadius,
  type Density,
  type MotionMode,
  type HapticsMode,
} from '../appearance.js';
import { t, type I18nKey } from '../i18n/index.js';
import { ClayCard } from '../components/ClayCard.js';
import { ClayButton } from '../components/ClayButton.js';
import { Chip } from '../components/Chip.js';
import { Ring } from '../components/Ring.js';
import { Bar } from '../components/Bar.js';
import { SectionHeader } from '../components/SectionHeader.js';

interface AppearanceLabProps {
  settings: AppearanceSettings;
  onChange: (newSettings: AppearanceSettings) => void;
  onClose: () => void;
}

export const AppearanceLab: React.FC<AppearanceLabProps> = ({
  settings,
  onChange,
  onClose,
}) => {
  const update = (partial: Partial<AppearanceSettings>) => {
    onChange({ ...settings, ...partial });
  };

  const handleResetDefaults = () => {
    onChange({ ...DEFAULT_APPEARANCE });
  };

  return (
    <div className="flex flex-col gap-6 animate-screen-enter pb-12">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="touch-target p-2 rounded-[var(--radius-chip)] clay-sm text-white cursor-pointer active:scale-95"
          >
            <span className="icon-directional">←</span> {t('common.close')}
          </button>
          <h2 className="text-xl font-black text-white">{t('appearance.title')}</h2>
        </div>
        <button
          onClick={handleResetDefaults}
          className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer py-2 px-1"
        >
          {t('appearance.reset_defaults')}
        </button>
      </div>

      {/* Live Preview Card */}
      <div className="flex flex-col gap-2">
        <SectionHeader title={t('appearance.preview_title')} />
        <ClayCard variant="hero" className="flex flex-col gap-4 border border-white/10">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-mono text-[var(--accent)] font-semibold uppercase">
                {t('train.session_blueprint')}
              </span>
              <h3 className="text-lg font-black text-white mt-0.5">
                {t('appearance.preview_card_title')}
              </h3>
            </div>
            <Ring progress={0.75} size={54} strokeWidth={6} color="var(--accent)">
              <span className="text-[10px] font-bold font-mono text-white">75%</span>
            </Ring>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip pattern="horizontal_push" label={t('home.muscle_chest')} active />
            <Chip pattern="vertical_push" label={t('home.muscle_shoulders')} />
            <Chip pattern="core" label={t('home.muscle_core')} />
          </div>

          <Bar
            value={75}
            color="var(--accent)"
            label={t('appearance.preview_bar_label')}
            sublabel="12 sets"
          />

          <ClayButton
            variant="primary"
            accentColor="var(--accent)"
            className="w-full text-sm font-bold"
          >
            {t('appearance.preview_button')}
          </ClayButton>
        </ClayCard>
      </div>

      {/* Control 1: Visual Style Variant (skins) */}
      <div className="flex flex-col gap-2">
        <SectionHeader title={t('appearance.style_label')} />
        <div className="grid grid-cols-3 gap-2">
          {STYLE_VARIANTS.map((variant) => {
            const preset = STYLE_PRESETS[variant];
            const isSelected = settings.style === variant;
            return (
              <button
                key={variant}
                onClick={() => update({ style: variant })}
                className={`touch-target p-3 rounded-[var(--radius-chip)] border flex flex-col items-center justify-center gap-2 transition-motion cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'border-[var(--accent)] bg-white/10 text-[var(--accent)]'
                    : 'border-white/5 bg-[var(--surface-flat)] text-[var(--muted)]'
                }`}
              >
                <span
                  aria-hidden
                  className="w-8 h-8 rounded-full border border-white/20 shrink-0"
                  style={{
                    background: preset.bg,
                    boxShadow: `inset 0 0 0 4px ${preset.surface}`,
                  }}
                />
                <span className="text-[11px] font-bold text-center leading-tight">
                  {t(preset.labelKey as I18nKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control 2: Accent Color Presets */}
      <div className="flex flex-col gap-2">
        <SectionHeader title={t('appearance.accent_label')} />
        <div className="grid grid-cols-3 gap-2.5">
          {(Object.keys(ACCENT_PRESETS) as AccentPreset[]).map((key) => {
            const p = ACCENT_PRESETS[key];
            const isSelected = settings.accent === key;
            return (
              <button
                key={key}
                onClick={() => update({ accent: key })}
                style={{
                  borderColor: isSelected ? p.hex : 'rgba(255, 255, 255, 0.08)',
                  backgroundColor: isSelected
                    ? `color-mix(in srgb, ${p.hex} 22%, var(--clay-2))`
                    : 'var(--surface-flat)',
                }}
                className="touch-target p-3 rounded-[var(--radius-chip)] border flex items-center gap-2.5 transition-motion cursor-pointer active:scale-95 select-none"
              >
                <span
                  className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: p.hex }}
                />
                <span className="text-xs font-bold text-white capitalize">{key}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control 3: Clay Depth */}
      <div className="flex flex-col gap-2">
        <SectionHeader title={t('appearance.depth_label')} />
        <div className="grid grid-cols-3 gap-2">
          {(['soft', 'medium', 'strong'] as ClayDepth[]).map((d) => {
            const isSelected = settings.depth === d;
            return (
              <button
                key={d}
                onClick={() => update({ depth: d })}
                className={`touch-target p-3 rounded-[var(--radius-chip)] border text-xs font-bold capitalize transition-motion cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'border-[var(--accent)] bg-white/10 text-[var(--accent)]'
                    : 'border-white/5 bg-[var(--surface-flat)] text-[var(--muted)]'
                }`}
              >
                {t(`appearance.depth_${d}` as I18nKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Control 4: Corner Radius */}
      <div className="flex flex-col gap-2">
        <SectionHeader title={t('appearance.radius_label')} />
        <div className="grid grid-cols-3 gap-2">
          {(['compact', 'round', 'extra_round'] as CornerRadius[]).map((r) => {
            const isSelected = settings.radius === r;
            return (
              <button
                key={r}
                onClick={() => update({ radius: r })}
                className={`touch-target p-3 rounded-[var(--radius-chip)] border text-xs font-bold capitalize transition-motion cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'border-[var(--accent)] bg-white/10 text-[var(--accent)]'
                    : 'border-white/5 bg-[var(--surface-flat)] text-[var(--muted)]'
                }`}
              >
                {t(`appearance.radius_${r}` as I18nKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Control 5: Layout Density */}
      <div className="flex flex-col gap-2">
        <SectionHeader title={t('appearance.density_label')} />
        <div className="grid grid-cols-2 gap-2">
          {(['comfortable', 'compact'] as Density[]).map((den) => {
            const isSelected = settings.density === den;
            return (
              <button
                key={den}
                onClick={() => update({ density: den })}
                className={`touch-target p-3 rounded-[var(--radius-chip)] border text-xs font-bold capitalize transition-motion cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'border-[var(--accent)] bg-white/10 text-[var(--accent)]'
                    : 'border-white/5 bg-[var(--surface-flat)] text-[var(--muted)]'
                }`}
              >
                {t(`appearance.density_${den}` as I18nKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Control 6: Motion & Haptics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <SectionHeader title={t('appearance.motion_label')} />
          <div className="flex flex-col gap-2">
            {(['full', 'reduced'] as MotionMode[]).map((m) => (
              <button
                key={m}
                onClick={() => update({ motion: m })}
                className={`touch-target p-3 rounded-[var(--radius-chip)] border text-xs font-bold capitalize transition-motion cursor-pointer active:scale-95 ${
                  settings.motion === m
                    ? 'border-[var(--accent)] bg-white/10 text-[var(--accent)]'
                    : 'border-white/5 bg-[var(--surface-flat)] text-[var(--muted)]'
                }`}
              >
                {t(`appearance.motion_${m}` as I18nKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <SectionHeader title={t('appearance.haptics_label')} />
          <div className="flex flex-col gap-2">
            {(['on', 'off'] as HapticsMode[]).map((h) => (
              <button
                key={h}
                onClick={() => update({ haptics: h })}
                className={`touch-target p-3 rounded-[var(--radius-chip)] border text-xs font-bold capitalize transition-motion cursor-pointer active:scale-95 ${
                  settings.haptics === h
                    ? 'border-[var(--accent)] bg-white/10 text-[var(--accent)]'
                    : 'border-white/5 bg-[var(--surface-flat)] text-[var(--muted)]'
                }`}
              >
                {t(`appearance.haptics_${h}` as I18nKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
