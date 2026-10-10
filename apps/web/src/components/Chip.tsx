import React from 'react';
import type { MovementPattern } from '@hfos/contracts';

interface ChipProps {
  pattern?: MovementPattern | string;
  label: string;
  color?: string;
  className?: string;
  active?: boolean;
  onClick?: () => void;
}

export const PATTERN_COLOR_MAP: Record<string, string> = {
  horizontal_push: 'var(--coral)',
  vertical_push: 'var(--orange)',
  horizontal_pull: 'var(--cyan)',
  vertical_pull: 'var(--blue)',
  squat: 'var(--violet)',
  hinge: 'var(--pink)',
  lunge: 'var(--mint)',
  core: 'var(--yellow)',
  mobility: 'var(--teal)',
  conditioning: 'var(--lime)',
};

export const Chip: React.FC<ChipProps> = ({
  pattern,
  label,
  color,
  className = '',
  active = false,
  onClick,
}) => {
  const chipColor = color || (pattern ? PATTERN_COLOR_MAP[pattern] : 'var(--accent)') || 'var(--accent)';

  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        borderColor: active ? chipColor : 'rgba(255, 255, 255, 0.08)',
        backgroundColor: active
          ? `color-mix(in srgb, ${chipColor} 20%, var(--clay-2))`
          : 'var(--surface-flat)',
      }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-chip)] text-xs font-semibold text-[var(--text)] border transition-motion ${
        onClick ? 'cursor-pointer active:scale-95' : ''
      } ${className}`}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: chipColor }}
      />
      <span>{label}</span>
    </span>
  );
};
