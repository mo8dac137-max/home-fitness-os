import React from 'react';
import { Icon, type IconName } from './IconSet.js';

export type DayStatus = 'locked' | 'protected' | 'adaptive';
export type DayKind = 'main' | 'micro' | 'flex' | 'active_recovery' | 'rest';

interface DayChipProps {
  dayName: string;
  dayNumber: number;
  kind: DayKind;
  status: DayStatus;
  isToday?: boolean;
  onClick?: () => void;
}

const KIND_CONFIG: Record<
  DayKind,
  { icon: IconName; color: string; label: string }
> = {
  main: { icon: 'bolt', color: 'var(--coral)', label: 'Main' },
  micro: { icon: 'target', color: 'var(--orange)', label: 'Micro' },
  flex: { icon: 'flame', color: 'var(--yellow)', label: 'Flex' },
  active_recovery: { icon: 'shield', color: 'var(--teal)', label: 'Recovery' },
  rest: { icon: 'moon', color: 'var(--muted)', label: 'Rest' },
};

export const DayChip: React.FC<DayChipProps> = ({
  dayName,
  dayNumber,
  kind,
  status,
  isToday = false,
  onClick,
}) => {
  const conf = KIND_CONFIG[kind];

  let borderStyle = 'border-white/10';
  let badgeIcon: IconName | null = null;

  if (isToday || status === 'locked') {
    borderStyle = 'border-2 border-[var(--accent)]';
    badgeIcon = 'lock';
  } else if (status === 'protected') {
    borderStyle = 'border border-[var(--blue)]';
    badgeIcon = 'lock';
  } else {
    // Adaptive: dashed outline
    borderStyle = 'border border-dashed border-white/20';
  }

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`clay-sm shrink-0 flex flex-col items-center justify-between p-2.5 w-[56px] h-[78px] text-center select-none ${borderStyle} ${
        isToday ? 'bg-white/5' : ''
      } ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
    >
      <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
        {dayName}
      </span>
      <span className="text-sm font-black text-white font-mono ltr-num">
        {dayNumber}
      </span>
      <div className="flex items-center justify-center gap-0.5">
        <Icon name={conf.icon} size={13} color={conf.color} />
        {badgeIcon && status !== 'adaptive' && (
          <span className="text-[9px] text-[var(--muted)]" title={status}>
            <Icon name="lock" size={9} color={isToday ? 'var(--accent)' : 'var(--blue)'} />
          </span>
        )}
      </div>
    </div>
  );
};
