import React from 'react';

export type IconName =
  | 'home'
  | 'dumbbell'
  | 'chart'
  | 'more'
  | 'moon'
  | 'lock'
  | 'bolt'
  | 'play'
  | 'check'
  | 'clock'
  | 'flame'
  | 'target'
  | 'shield';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  color?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  className = '',
  color = 'currentColor',
}) => {
  const iconProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...iconProps}>
          <path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V10z" />
        </svg>
      );
    case 'dumbbell':
      return (
        <svg {...iconProps}>
          <path d="M6 5v14M18 5v14M2 8v8M22 8v8M6 12h12M4 7h4M16 7h4M4 17h4M16 17h4" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...iconProps}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case 'more':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="1.5" fill={color} />
          <circle cx="19" cy="12" r="1.5" fill={color} />
          <circle cx="5" cy="12" r="1.5" fill={color} />
        </svg>
      );
    case 'moon':
      return (
        <svg {...iconProps}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...iconProps}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...iconProps}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'play':
      return (
        <svg {...iconProps} fill={color}>
          <polygon points="6 4 20 12 6 20 6 4" stroke="none" />
        </svg>
      );
    case 'check':
      return (
        <svg {...iconProps}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'flame':
      return (
        <svg {...iconProps}>
          <path d="M8.5 14.5A4.5 4.5 0 0 0 13 19a4.5 4.5 0 0 0 4.5-4.5c0-3-2-4.5-3.5-7-1.5 2.5-3 4-4 7z" />
          <path d="M12 2c2 3.5 6 6.5 6 11.5A6 6 0 1 1 6 13.5C6 9 10 6 12 2z" />
        </svg>
      );
    case 'target':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...iconProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
  }
};
