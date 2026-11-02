import React from 'react';
import { t, type I18nKey } from '../i18n/index.js';
import { ClayCard } from '../components/ClayCard.js';
import { Ring } from '../components/Ring.js';
import { Bar } from '../components/Bar.js';
import { SectionHeader } from '../components/SectionHeader.js';
import { Icon } from '../components/IconSet.js';
import type { TrainingHistorySummary } from '../engine/historyService.js';

interface ProgressScreenProps {
  history?: TrainingHistorySummary | null;
}

const BAR_COLORS: string[] = [
  'var(--coral)',
  'var(--orange)',
  'var(--cyan)',
  'var(--blue)',
  'var(--violet)',
  'var(--pink)',
];

// Every movement pattern emitted by @hfos/library has a pattern.* i18n key;
// unknown ids degrade to a readable fallback instead of a raw key.
const PATTERN_LABEL_KEYS: ReadonlySet<string> = new Set<string>([
  'pattern.horizontal_push',
  'pattern.vertical_push',
  'pattern.horizontal_pull',
  'pattern.vertical_pull',
  'pattern.squat',
  'pattern.hinge',
  'pattern.lunge',
  'pattern.core',
  'pattern.mobility',
  'pattern.conditioning',
]);

function patternLabel(pattern: string): string {
  const key = `pattern.${pattern}`;
  return PATTERN_LABEL_KEYS.has(key) ? t(key as I18nKey) : pattern.replace(/_/g, ' ');
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({ history }) => {
  const hasData = history?.has_session_data ?? false;
  const hitRate = hasData ? (history?.rep_target_hit_rate ?? null) : null;
  const ringProgress = hitRate ?? 0;

  const patternEntries: Array<[string, number]> = hasData
    ? Object.entries(history?.pattern_exposure ?? {})
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
    : [];
  const maxPatternCount =
    patternEntries.length > 0 ? Math.max(...patternEntries.map(([, c]) => c)) : 0;

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

      {/* 2. Hero Progress Overview — derived from the local event log */}
      <ClayCard variant="hero" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              {t('progress.mastery_score')}
            </span>
            {hasData ? (
              <h3 className="text-sm font-bold text-[var(--muted)] mt-1 max-w-[16rem] leading-snug">
                {t('progress.tracked_locally')}
              </h3>
            ) : (
              <h3 className="text-xl font-black text-white mt-0.5">
                {t('progress.empty_title')}
              </h3>
            )}
          </div>
          <Ring progress={ringProgress} size={64} strokeWidth={6} color="var(--accent)">
            <span className="text-xs font-black font-mono text-white ltr-num">
              {hasData ? `${Math.round(ringProgress * 100)}%` : '--'}
            </span>
          </Ring>
        </div>

        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {t('progress.mastery_desc')}
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
          <div className="clay-sm p-3 flex flex-col gap-1 border border-white/5">
            <span className="text-[var(--muted)] font-medium">{t('progress.rep_targets_hit')}</span>
            <span className="text-base font-bold text-white font-mono ltr-num">
              {hasData ? `${history?.sets_hit ?? 0} / ${history?.sets_total ?? 0}` : '--'}
            </span>
          </div>
          <div className="clay-sm p-3 flex flex-col gap-1 border border-white/5">
            <span className="text-[var(--muted)] font-medium">{t('progress.avg_effort_rpe')}</span>
            <span className="text-base font-bold text-[var(--accent)] font-mono ltr-num">
              {hasData && history?.avg_rpe !== null && history?.avg_rpe !== undefined
                ? history.avg_rpe.toFixed(1)
                : '--'}
            </span>
          </div>
        </div>
      </ClayCard>

      {/* 3. Trailing Exposure Window — real pattern counts from set events */}
      <ClayCard variant="hero" className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <SectionHeader title={t('progress.exposure_14d')} className="mb-0 px-0" />
          {hasData ? (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-[var(--muted)] border border-white/5 ltr-num">
              {history?.exposure_window_days}d
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-[var(--muted)] border border-white/5">
              {t('progress.collecting_data')}
            </span>
          )}
        </div>

        {hasData && patternEntries.length > 0 ? (
          <div className="flex flex-col gap-3 pt-1">
            {patternEntries.map(([pattern, count], idx) => (
              <Bar
                key={pattern}
                value={maxPatternCount > 0 ? Math.round((count / maxPatternCount) * 100) : 0}
                color={BAR_COLORS[idx % BAR_COLORS.length] ?? 'var(--accent)'}
                label={patternLabel(pattern)}
                sublabel={`${count} ${t('progress.exposures_count')}`}
                estimate={false}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-[var(--muted)] flex flex-col items-center gap-1">
            <span className="text-white font-bold">{t('progress.collecting_data')}</span>
            <span>{t('progress.empty_desc')}</span>
          </div>
        )}
      </ClayCard>

      {/* 4. Honest "Collecting Data" Empty State (only before any session data) */}
      {!hasData && (
        <ClayCard variant="hero" className="p-5 flex flex-col items-center justify-center text-center gap-3 py-8">
          <div className="w-12 h-12 rounded-full clay-sm flex items-center justify-center text-[var(--accent)] mb-1">
            <Icon name="chart" size={22} color="var(--accent)" />
          </div>
          <h4 className="font-bold text-base text-white">{t('progress.empty_title')}</h4>
          <p className="text-xs text-[var(--muted)] max-w-xs leading-relaxed">
            {t('progress.empty_desc')}
          </p>
        </ClayCard>
      )}
    </div>
  );
};
