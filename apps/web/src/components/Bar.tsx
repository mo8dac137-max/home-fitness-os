import React from 'react';

interface BarProps {
  value: number; // 0 to 100
  color?: string;
  label?: string;
  sublabel?: string;
  estimate?: boolean;
}

export const Bar: React.FC<BarProps> = ({
  value,
  color = 'var(--accent)',
  label,
  sublabel,
  estimate = true,
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {(label || sublabel) && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-medium text-[var(--text)]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span>{label}</span>
            {estimate && (
              <span className="text-[10px] text-[var(--muted)] px-1 rounded bg-white/5 border border-white/5 uppercase">
                est.
              </span>
            )}
          </div>
          {sublabel && (
            <span className="font-mono text-xs text-[var(--muted)]">{sublabel}</span>
          )}
        </div>
      )}
      <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden border border-white/5 p-0.5">
        <div
          className="h-full rounded-full transition-motion"
          style={{
            width: `${clamped}%`,
            backgroundColor: color,
            transitionDuration: '700ms',
          }}
        />
      </div>
    </div>
  );
};
