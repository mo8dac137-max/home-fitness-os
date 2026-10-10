import React from 'react';
import { t } from '../i18n/index.js';
import { ClayCard } from '../components/ClayCard.js';
import { ClayButton } from '../components/ClayButton.js';
import { Chip } from '../components/Chip.js';
import { DayChip, type DayKind, type DayStatus } from '../components/DayChip.js';
import { Ring } from '../components/Ring.js';
import { Bar } from '../components/Bar.js';
import { SectionHeader } from '../components/SectionHeader.js';
import { Icon } from '../components/IconSet.js';

interface HomeScreenProps {
  onNavigateTrain?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateTrain }) => {
  // Static mock schedule for 7-day horizon (M1-A2 mock, engine wired in M1-B)
  const mockHorizonDays: Array<{
    dayName: string;
    dayNumber: number;
    kind: DayKind;
    status: DayStatus;
    isToday: boolean;
  }> = [
    { dayName: 'Mon', dayNumber: 12, kind: 'main', status: 'locked', isToday: true },
    { dayName: 'Tue', dayNumber: 13, kind: 'main', status: 'protected', isToday: false },
    { dayName: 'Wed', dayNumber: 14, kind: 'rest', status: 'adaptive', isToday: false },
    { dayName: 'Thu', dayNumber: 15, kind: 'main', status: 'adaptive', isToday: false },
    { dayName: 'Fri', dayNumber: 16, kind: 'micro', status: 'adaptive', isToday: false },
    { dayName: 'Sat', dayNumber: 17, kind: 'active_recovery', status: 'adaptive', isToday: false },
    { dayName: 'Sun', dayNumber: 18, kind: 'rest', status: 'adaptive', isToday: false },
  ];

  return (
    <div className="flex flex-col gap-5 animate-screen-enter pb-10">
      {/* 1. Top Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
              Welcome Athlete
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800/80">
              MOCK
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white mt-0.5">
            {t('home.title')}
          </h2>
        </div>
        <div className="clay-sm px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] font-mono border border-white/5">
          <Icon name="clock" size={13} color="var(--accent)" />
          <span>Week 1</span>
        </div>
      </div>

      {/* 2. HERO Clay Card: Today - Upper Push (Unit A) (Card 1 of max 6 .clay) */}
      <ClayCard variant="hero" className="flex flex-col gap-4 border border-white/10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950/70 text-rose-300 border border-rose-800/60 flex items-center gap-1">
                <Icon name="lock" size={10} color="currentColor" />
                {t('home.stat_today')} (Day 0)
              </span>
              <span className="text-xs text-[var(--muted)] font-mono">38 min</span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">
              Upper Push (Unit A)
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full clay-sm flex items-center justify-center text-[var(--accent)] border border-white/10">
            <Icon name="flame" size={20} color="var(--accent)" />
          </div>
        </div>

        {/* Exercises meta */}
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span className="font-semibold text-white">6 exercises</span>
          <span>•</span>
          <span>18 working sets</span>
          <span>•</span>
          <span className="text-[var(--accent)] font-mono">RPE 7-8</span>
        </div>

        {/* Muscle chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Chip pattern="horizontal_push" label="Chest" active />
          <Chip pattern="vertical_push" label="Shoulders" active />
          <Chip pattern="horizontal_push" label="Triceps" />
          <Chip pattern="core" label="Core" />
        </div>

        {/* Big Lime START Button */}
        <ClayButton
          variant="primary"
          accentColor="var(--accent)"
          onClick={onNavigateTrain}
          className="w-full mt-2 py-3.5 text-base font-black tracking-wide uppercase text-black"
        >
          <Icon name="play" size={18} color="#08080c" />
          <span>START WORKOUT</span>
        </ClayButton>
      </ClayCard>

      {/* 3. 7-Day Horizon Strip */}
      <div className="flex flex-col gap-2">
        <SectionHeader title="7-Day Horizon" />
        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar px-1">
          {mockHorizonDays.map((day, idx) => (
            <DayChip
              key={idx}
              dayName={day.dayName}
              dayNumber={day.dayNumber}
              kind={day.kind}
              status={day.status}
              isToday={day.isToday}
            />
          ))}
        </div>
      </div>

      {/* 4. Bento Row: Consistency Ring & Readiness Gauge (Card 2 & 3 of max 6 .clay) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Weekly Consistency Ring */}
        <ClayCard variant="hero" className="p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Consistency
            </span>
            <Icon name="target" size={15} color="var(--accent)" />
          </div>
          <div className="flex items-center justify-center py-2">
            <Ring progress={0.75} size={72} strokeWidth={7} color="var(--accent)">
              <div className="text-center font-mono">
                <span className="text-lg font-black text-white">3</span>
                <span className="text-xs text-[var(--muted)]">/4</span>
              </div>
            </Ring>
          </div>
          <span className="text-[11px] text-center text-[var(--muted)] font-medium">
            3 of 4 sessions done
          </span>
        </ClayCard>

        {/* Readiness Tile */}
        <ClayCard variant="hero" className="p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Readiness
            </span>
            <Icon name="bolt" size={15} color="var(--yellow)" />
          </div>
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <div className="w-14 h-14 rounded-full border border-dashed border-white/20 flex items-center justify-center mb-1">
              <span className="text-xs text-[var(--muted)] font-mono">--</span>
            </div>
            <span className="text-[11px] text-[var(--muted)]">No check-in yet</span>
          </div>
          <button className="clay-sm py-2 px-3 text-[11px] font-bold text-[var(--yellow)] hover:text-white transition-motion cursor-pointer active:scale-95 text-center">
            + Check-in
          </button>
        </ClayCard>
      </div>

      {/* 5. Muscle Exposure Card (Card 4 of max 6 .clay) */}
      <ClayCard variant="hero" className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Muscle Stimulus Exposure
            </h4>
            <span className="text-[11px] text-[var(--muted)]">
              Trailing 7-day volume • Collecting data
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-[var(--muted)] border border-white/5">
            Estimate
          </span>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <Bar value={78} color="var(--coral)" label="Chest" sublabel="14 sets" />
          <Bar value={65} color="var(--cyan)" label="Back" sublabel="11 sets" />
          <Bar value={50} color="var(--orange)" label="Shoulders" sublabel="8 sets" />
          <Bar value={60} color="var(--violet)" label="Quads" sublabel="10 sets" />
          <Bar value={40} color="var(--pink)" label="Hamstrings" sublabel="6 sets" />
          <Bar value={30} color="var(--yellow)" label="Core" sublabel="4 sets" />
        </div>
      </ClayCard>

      {/* 6. Coach Inbox Card (Card 5 of max 6 .clay) */}
      <ClayCard variant="hero" className="flex items-center gap-3.5 p-4">
        <div className="w-10 h-10 rounded-full clay-sm flex items-center justify-center text-[var(--muted)] shrink-0">
          <Icon name="shield" size={18} color="var(--muted)" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            Coach Inbox
          </h4>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            No suggestions yet. The engine is monitoring execution quality.
          </p>
        </div>
      </ClayCard>
    </div>
  );
};
