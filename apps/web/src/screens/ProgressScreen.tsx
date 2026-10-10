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
              {t('progress.engine_badge')}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800/80">
              {t('common.mock_tag')}
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

      {/* 2. Hero Progress Overview */}
      <ClayCard variant="hero" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              {t('progress.mastery_score')}
            </span>
            <h3 className="text-xl font-black text-white mt-0.5">
              {t('progress.baseline_title')}
            </h3>
          </div>
          <Ring progress={0.65} size={64} strokeWidth={6} color="var(--accent)">
            <span className="text-xs font-black font-mono text-white">65%</span>
          </Ring>
        </div>

        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {t('progress.mastery_desc')}
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <div className="clay-sm p-3 flex flex-col gap-1 border border-white/5">
            <span className="text-[var(--muted)] font-medium">{t('progress.rep_targets_hit')}</span>
            <span className="text-base font-bold text-white font-mono">{t('progress.rep_targets_value')}</span>
          </div>
          <div className="clay-sm p-3 flex flex-col gap-1 border border-white/5">
            <span className="text-[var(--muted)] font-medium">{t('progress.avg_effort_rpe')}</span>
            <span className="text-base font-bold text-[var(--accent)] font-mono">{t('progress.avg_effort_value')}</span>
          </div>
        </div>
      </ClayCard>

      {/* 3. Trailing Exposure Window */}
      <ClayCard variant="hero" className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <SectionHeader title={t('progress.exposure_14d')} className="mb-0 px-0" />
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-[var(--muted)] border border-white/5">
            {t('progress.collecting_data')}
          </span>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <Bar value={85} color="var(--coral)" label="Horizontal push" sublabel={`5 ${t('progress.exposures_count')}`} />
          <Bar value={60} color="var(--orange)" label="Vertical push" sublabel={`3 ${t('progress.exposures_count')}`} />
          <Bar value={70} color="var(--cyan)" label="Horizontal pull" sublabel={`4 ${t('progress.exposures_count')}`} />
          <Bar value={20} color="var(--blue)" label="Vertical pull" sublabel={`1 ${t('progress.exposures_count')}`} />
          <Bar value={50} color="var(--violet)" label="Squat" sublabel={`3 ${t('progress.exposures_count')}`} />
          <Bar value={40} color="var(--pink)" label="Hinge" sublabel={`2 ${t('progress.exposures_count')}`} />
        </div>
      </ClayCard>

      {/* 4. Honest "Collecting Data" Empty State */}
      <ClayCard variant="hero" className="p-5 flex flex-col items-center justify-center text-center gap-3 py-8">
        <div className="w-12 h-12 rounded-full clay-sm flex items-center justify-center text-[var(--accent)] mb-1">
          <Icon name="chart" size={22} color="var(--accent)" />
        </div>
        <h4 className="font-bold text-base text-white">{t('progress.empty_title')}</h4>
        <p className="text-xs text-[var(--muted)] max-w-xs leading-relaxed">
          {t('progress.empty_desc')}
        </p>
      </ClayCard>
    </div>
  );
};
