import React from 'react';
import { t } from '../i18n/index.js';
import { ClayCard } from '../components/ClayCard.js';
import { Ring } from '../components/Ring.js';
import { Bar } from '../components/Bar.js';
import { SectionHeader } from '../components/SectionHeader.js';
import { Icon } from '../components/IconSet.js';

export const ProgressScreen: React.FC = () => {
  return (
    <div className="flex flex-col gap-5 animate-screen-enter pb-10">
      {/* 1. Top Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
              Progression Engine
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800/80">
              MOCK
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white mt-0.5">
            {t('progress.title')}
          </h2>
        </div>
        <span className="clay-sm px-2.5 py-1 text-xs font-mono font-bold text-[var(--muted)] border border-white/5">
          {t('progress.reviews_due')}
        </span>
      </div>

      {/* 2. Hero Progress Overview (Card 1 of max 6 .clay) */}
      <ClayCard variant="hero" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              Mastery Score
            </span>
            <h3 className="text-xl font-black text-white mt-0.5">
              Level 3 Baseline
            </h3>
          </div>
          <Ring progress={0.65} size={64} strokeWidth={6} color="var(--accent)">
            <span className="text-xs font-black font-mono text-white">65%</span>
          </Ring>
        </div>

        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Standard Push-up and Plank progression criteria tracked across your last 6 sessions.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <div className="clay-sm p-3 flex flex-col gap-1 border border-white/5">
            <span className="text-[var(--muted)] font-medium">Rep Target Mastery</span>
            <span className="text-base font-bold text-white font-mono">10 / 10 reps</span>
          </div>
          <div className="clay-sm p-3 flex flex-col gap-1 border border-white/5">
            <span className="text-[var(--muted)] font-medium">Mean Execution RPE</span>
            <span className="text-base font-bold text-[var(--accent)] font-mono">7.5 RPE</span>
          </div>
        </div>
      </ClayCard>

      {/* 3. Trailing Exposure Window (Card 2 of max 6 .clay) */}
      <ClayCard variant="hero" className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <SectionHeader title="Movement Exposure (14d)" className="mb-0 px-0" />
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-[var(--muted)] border border-white/5">
            Collecting Data
          </span>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <Bar value={85} color="var(--coral)" label="Horizontal Push" sublabel="5 exposures" />
          <Bar value={60} color="var(--orange)" label="Vertical Push" sublabel="3 exposures" />
          <Bar value={70} color="var(--cyan)" label="Horizontal Pull" sublabel="4 exposures" />
          <Bar value={20} color="var(--blue)" label="Vertical Pull" sublabel="1 exposure" />
          <Bar value={50} color="var(--violet)" label="Squat" sublabel="3 exposures" />
          <Bar value={40} color="var(--pink)" label="Hinge" sublabel="2 exposures" />
        </div>
      </ClayCard>

      {/* 4. Honest "Collecting Data" Empty State (Card 3 of max 6 .clay) */}
      <ClayCard variant="hero" className="p-5 flex flex-col items-center justify-center text-center gap-3 py-8">
        <div className="w-12 h-12 rounded-full clay-sm flex items-center justify-center text-[var(--accent)] mb-1">
          <Icon name="chart" size={22} color="var(--accent)" />
        </div>
        <h4 className="font-bold text-base text-white">Progression Ledger Initialized</h4>
        <p className="text-xs text-[var(--muted)] max-w-xs leading-relaxed">
          {t('progress.empty_desc')} The engine requires at least 3 completed workouts before offering progression recommendations.
        </p>
      </ClayCard>
    </div>
  );
};
