import React from 'react';

interface ClayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  accentColor?: string;
  className?: string;
  children: React.ReactNode;
}

export const ClayButton: React.FC<ClayButtonProps> = ({
  variant = 'primary',
  accentColor,
  className = '',
  onClick,
  children,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(10);
      } catch {
        // Safe fallback if permission denied or unsupported
      }
    }
    if (onClick) onClick(e);
  };

  let variantClass = '';
  const customStyle: React.CSSProperties = {};

  if (variant === 'primary') {
    variantClass = 'clay-accent';
    if (accentColor) {
      (customStyle as unknown as Record<string, string>)['--c'] = accentColor;
    }
  } else if (variant === 'secondary') {
    variantClass = 'clay-sm text-[var(--text)] font-semibold';
  } else {
    variantClass = 'bg-transparent text-[var(--muted)] hover:text-white font-medium';
  }

  return (
    <button
      onClick={handleClick}
      style={customStyle}
      className={`touch-target clay-interactive px-5 py-3 rounded-[var(--radius-chip)] flex items-center justify-center gap-2 cursor-pointer select-none transition-motion ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
