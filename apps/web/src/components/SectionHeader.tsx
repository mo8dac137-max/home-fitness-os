import React from 'react';

interface SectionHeaderProps {
  title: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-between mb-2 px-1 ${className}`}
    >
      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h3>
      {actionText && (
        <button
          onClick={onAction}
          className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
