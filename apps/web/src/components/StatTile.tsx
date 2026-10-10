import React from 'react';
import { Icon, type IconName } from './IconSet.js';

interface StatTileProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: IconName;
  iconColor?: string;
  className?: string;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  sublabel,
  icon,
  iconColor = 'var(--accent)',
  className = '',
}) => {
  return (
    <div
      className={`clay-sm p-4 flex flex-col justify-between gap-2 border border-white/5 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
          {label}
        </span>
        {icon && <Icon name={icon} size={16} color={iconColor} />}
      </div>
      <div>
        <div className="text-2xl font-black text-white font-mono tracking-tight">
          {value}
        </div>
        {sublabel && (
          <div className="text-[11px] text-[var(--muted)] mt-0.5">{sublabel}</div>
        )}
      </div>
    </div>
  );
};
