import React, { useEffect, useState } from 'react';

interface RingProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}

export const Ring: React.FC<RingProps> = ({
  progress,
  size = 76,
  strokeWidth = 8,
  color = 'var(--accent)',
  trackColor = 'rgba(255, 255, 255, 0.08)',
  children,
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    // Fill on first view (700ms stroke-dashoffset transition)
    const timeout = setTimeout(() => {
      setAnimatedProgress(Math.min(1, Math.max(0, progress)));
    }, 50);
    return () => clearTimeout(timeout);
  }, [progress]);

  const offset = circumference - animatedProgress * circumference;

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          style={{
            transition: 'stroke-dashoffset 700ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
};
