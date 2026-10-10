import React from 'react';
import { Icon, type IconName } from './IconSet.js';

interface EmptyStateProps {
  icon?: IconName;
  iconColor?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'target',
  iconColor = 'var(--accent)',
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`clay p-6 flex flex-col items-center justify-center text-center gap-3 py-10 border border-white/5 ${className}`}
    >
      <div
        className="w-12 h-12 rounded-full clay-sm flex items-center justify-center mb-1"
        style={{ color: iconColor }}
      >
        <Icon name={icon} size={22} color={iconColor} />
      </div>
      <h3 className="font-bold text-base text-white">{title}</h3>
      <p className="text-xs text-[var(--muted)] max-w-xs leading-relaxed">
        {description}
      </p>
      {actionText && (
        <button
          onClick={onAction}
          className="mt-2 touch-target px-4 py-2 rounded-[var(--radius-chip)] clay-sm text-xs font-semibold text-[var(--accent)] hover:text-white transition-motion cursor-pointer active:scale-95"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
