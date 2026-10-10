import React, { useState, useMemo } from 'react';
import { t } from '../i18n/index.js';
import { ClayCard } from '../components/ClayCard.js';
import { ClayButton } from '../components/ClayButton.js';
import { PATTERN_COLOR_MAP } from '../components/Chip.js';
import { SectionHeader } from '../components/SectionHeader.js';
import { Icon } from '../components/IconSet.js';
import { INITIAL_EXERCISE_LIBRARY } from '@hfos/library';

type TrainSegment = 'plan' | 'library';

export const TrainScreen: React.FC = () => {
  const [segment, setSegment] = useState<TrainSegment>('plan');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPattern, setSelectedPattern] = useState<string>('all');

  const patterns = useMemo(() => {
    return [
      'all',
      'horizontal_push',
      'vertical_push',
      'horizontal_pull',
      'vertical_pull',
      'squat',
      'hinge',
      'lunge',
      'core',
      'mobility',
      'conditioning',
    ];
  }, []);

  const filteredExercises = useMemo(() => {
    return INITIAL_EXERCISE_LIBRARY.filter((ex) => {
      const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPattern = selectedPattern === 'all' || ex.pattern === selectedPattern;
      return matchesSearch && matchesPattern;
    });
  }, [searchQuery, selectedPattern]);

  return (
    <div className="flex flex-col gap-5 animate-screen-enter pb-10">
      {/* 1. Top Header & Segmented Control */}
      <div className="flex flex-col gap-3 px-1">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tight text-white">
            {t('train.title')}
          </h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-[var(--ok)] border border-emerald-800/80">
            {t('train.ready_badge')}
          </span>
        </div>

        {/* Segmented Control Plan | Library */}
        <div className="clay-sm p-1 flex rounded-[var(--radius-chip)] bg-[var(--clay-2)] border border-white/5">
          <button
            onClick={() => setSegment('plan')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-[var(--radius-chip)] transition-motion cursor-pointer ${
              segment === 'plan'
                ? 'bg-white/10 text-[var(--accent)] shadow-md'
                : 'text-[var(--muted)] hover:text-white'
            }`}
          >
            {t('train.segment_plan')}
          </button>
          <button
            onClick={() => setSegment('library')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-[var(--radius-chip)] transition-motion cursor-pointer ${
              segment === 'library'
                ? 'bg-white/10 text-[var(--accent)] shadow-md'
                : 'text-[var(--muted)] hover:text-white'
            }`}
          >
            {t('train.segment_library')} ({INITIAL_EXERCISE_LIBRARY.length})
          </button>
        </div>
      </div>

      {segment === 'plan' ? (
        /* Plan View */
        <div className="flex flex-col gap-4">
          <ClayCard variant="hero" className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-mono text-[var(--accent)] font-semibold uppercase">
                  {t('train.session_blueprint')}
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">
                  {t('train.session_unit')}
                </h3>
              </div>
              <span className="px-2 py-1 rounded text-xs font-mono font-bold bg-white/5 text-white border border-white/10">
                {t('train.session_duration')}
              </span>
            </div>

            {/* Prescribed Exercise Flow Mock */}
            <div className="flex flex-col gap-2.5 pt-1">
              {[
                { name: 'Standard Push-up', pattern: 'horizontal_push', sets: '3 x 10', level: 3 },
                { name: 'Incline Push-up', pattern: 'horizontal_push', sets: '3 x 12', level: 2 },
                { name: 'Pike Push-up', pattern: 'vertical_push', sets: '3 x 8', level: 3 },
                { name: 'Plank Hold', pattern: 'core', sets: '3 x 35s', level: 2 },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="clay-sm p-3.5 flex items-center justify-between border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PATTERN_COLOR_MAP[item.pattern] }}
                    />
                    <div>
                      <div className="font-bold text-sm text-white">{item.name}</div>
                      <div className="text-[11px] text-[var(--muted)] capitalize">
                        {item.pattern.replace('_', ' ')} • {t('train.level_label')} {item.level}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-neutral-300">
                    {item.sets}
                  </span>
                </div>
              ))}
            </div>

            <ClayButton
              variant="primary"
              accentColor="var(--accent)"
              className="w-full mt-2 py-3.5 text-base font-black tracking-wide text-black"
            >
              <Icon name="play" size={18} color="#08080c" />
              <span>{t('train.start_workout')}</span>
            </ClayButton>
          </ClayCard>
        </div>
      ) : (
        /* Library View */
        <div className="flex flex-col gap-3">
          {/* Search Field */}
          <div className="clay-sm px-3 py-2 flex items-center gap-2 border border-white/5 bg-[var(--clay-2)]">
            <span className="text-[var(--muted)] text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('train.search_placeholder')}
              className="bg-transparent text-sm text-white placeholder-[var(--muted)] outline-none w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-[var(--muted)] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Pattern Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {patterns.map((p) => {
              const isActive = selectedPattern === p;
              const color = p === 'all' ? 'var(--accent)' : PATTERN_COLOR_MAP[p];
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPattern(p)}
                  style={{
                    borderColor: isActive ? color : 'rgba(255, 255, 255, 0.08)',
                    backgroundColor: isActive
                      ? `color-mix(in srgb, ${color} 20%, var(--clay-2))`
                      : 'var(--surface-flat)',
                  }}
                  className="px-3 py-1.5 rounded-[var(--radius-chip)] text-xs font-semibold text-white border whitespace-nowrap cursor-pointer transition-motion active:scale-95 shrink-0"
                >
                  {p === 'all' ? t('train.all_patterns') : p.replace('_', ' ')}
                </button>
              );
            })}
          </div>

          <SectionHeader
            title={`${t('train.exercises_header')} (${filteredExercises.length})`}
            className="mt-2"
          />

          {/* Exercise Rows (.clay-sm) */}
          <div className="flex flex-col gap-2">
            {filteredExercises.map((ex) => {
              const patternColor = PATTERN_COLOR_MAP[ex.pattern] || 'var(--accent)';
              const isLocked =
                ex.safety_flags.length > 0 ||
                (ex.pattern === 'vertical_pull' && !ex.equipment_requirement);

              return (
                <div
                  key={ex.id}
                  className="clay-sm p-3.5 flex items-center justify-between border border-white/5 hover:border-white/10 transition-motion"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: patternColor }}
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white truncate">
                        {ex.name}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--muted)] mt-0.5">
                        <span className="capitalize">{ex.pattern.replace('_', ' ')}</span>
                        <span>•</span>
                        {/* Level Dots (1-7) */}
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 7 }, (_, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                i < ex.level ? 'bg-white' : 'bg-white/10'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Equipment badges */}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[var(--muted)] border border-white/5">
                      {ex.equipment_requirement.all
                        ? ex.equipment_requirement.all.join(', ')
                        : ex.equipment_requirement.any
                        ? ex.equipment_requirement.any.join('/')
                        : t('train.bodyweight')}
                    </span>
                    {isLocked && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-950/60 text-[var(--danger)] border border-rose-900/60 flex items-center gap-1">
                        <Icon name="lock" size={9} color="currentColor" />
                        {t('train.locked')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
