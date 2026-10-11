import React, { useState, useMemo } from 'react';
import type { Plan, PlanDay } from '@hfos/contracts';
import { t } from '../i18n/index.js';
import { ClayCard } from '../components/ClayCard.js';
import { Chip, PATTERN_COLOR_MAP } from '../components/Chip.js';
import { SectionHeader } from '../components/SectionHeader.js';
import { Icon } from '../components/IconSet.js';
import { INITIAL_EXERCISE_LIBRARY, LIBRARY_LIMITATIONS } from '@hfos/library';

type TrainSegment = 'plan' | 'library';

interface TrainScreenProps {
  plan: Plan | null;
  selectedDayIndex?: number;
  onSelectDayIndex?: (idx: number) => void;
}

export const TrainScreen: React.FC<TrainScreenProps> = ({
  plan,
  selectedDayIndex: externalDayIndex,
  onSelectDayIndex,
}) => {
  const [segment, setSegment] = useState<TrainSegment>('plan');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPattern, setSelectedPattern] = useState<string>('all');
  const [internalDayIndex, setInternalDayIndex] = useState(0);

  const activeDayIndex = externalDayIndex ?? internalDayIndex;
  const setDayIndex = (idx: number) => {
    setInternalDayIndex(idx);
    onSelectDayIndex?.(idx);
  };

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

  const activeDay: PlanDay | undefined = plan?.days?.[activeDayIndex];
  const activeSnapshot = activeDay?.session_snapshot;

  // Resolve exercises for the selected day from library
  const dayExercises = useMemo(() => {
    if (!activeSnapshot?.exercises) return [];
    return activeSnapshot.exercises.map((item) => {
      const ex = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === item.exercise_id);
      return {
        item,
        exercise: ex,
        name: ex?.name ?? item.exercise_id.replace(/_/g, ' '),
        pattern: ex?.pattern ?? 'horizontal_push',
        level: ex?.level ?? 1,
        setsCount: item.sets.length,
        repsDisplay: item.sets[0]?.target_reps
          ? `${item.sets[0].target_reps} reps`
          : item.sets[0]?.min_reps && item.sets[0]?.max_reps
          ? `${item.sets[0].min_reps}-${item.sets[0].max_reps} reps`
          : '10 reps',
        restSeconds: item.rest_seconds ?? item.sets[0]?.rest_seconds ?? 60,
      };
    });
  }, [activeSnapshot]);

  // Distinct target muscles
  const targetMuscles = useMemo(() => {
    const set = new Set<string>();
    dayExercises.forEach(({ exercise }) => {
      exercise?.primary_muscles.forEach((m) => set.add(m));
    });
    return Array.from(set);
  }, [dayExercises]);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
          {/* 7-Chip Day Selector */}
          {plan?.days && (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar px-0.5">
              {plan.days.map((d) => {
                const isSelected = d.day_index === activeDayIndex;
                const dateObj = d.date ? new Date(d.date) : new Date();
                const dName = dayNames[dateObj.getDay()] ?? `Day ${d.day_index}`;
                const dNum = dateObj.getDate();

                return (
                  <button
                    key={d.day_index}
                    onClick={() => setDayIndex(d.day_index)}
                    className={`clay-sm flex-1 min-w-[48px] py-2 px-1 flex flex-col items-center justify-center gap-0.5 border cursor-pointer transition-motion active:scale-95 ${
                      isSelected
                        ? 'border-[var(--accent)] bg-white/10 text-[var(--accent)] font-bold'
                        : 'border-white/5 text-[var(--muted)] hover:text-white'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold">{dName}</span>
                    <span className="text-xs font-mono font-black text-white ltr-num">{dNum}</span>
                    <span className="text-[9px] uppercase tracking-wider">
                      {d.status === 'locked' ? 'L' : d.status === 'protected' ? 'P' : 'A'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Day Detail Card */}
          {activeDay ? (
            <ClayCard variant="hero" className="flex flex-col gap-4 border border-white/10">
              {/* Day Meta Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${
                        activeDay.status === 'locked'
                          ? 'bg-rose-950/70 text-rose-300 border-rose-800/60'
                          : activeDay.status === 'protected'
                          ? 'bg-blue-950/70 text-blue-300 border-blue-800/60'
                          : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                      }`}
                    >
                      <Icon name="lock" size={10} color="currentColor" />
                      Day {activeDay.day_index} •{' '}
                      {activeDay.status === 'locked'
                        ? t('home.status_locked')
                        : activeDay.status === 'protected'
                        ? t('home.status_protected')
                        : t('home.status_adaptive')}
                    </span>
                    <span className="text-xs text-[var(--muted)] font-mono">
                      {activeDay.kind === 'main'
                        ? t('home.kind_main')
                        : activeDay.kind === 'micro'
                        ? t('home.kind_micro')
                        : activeDay.kind === 'flex'
                        ? t('home.kind_flex')
                        : activeDay.kind === 'active_recovery'
                        ? t('home.kind_active_recovery')
                        : t('home.kind_rest')}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white mt-0.5">
                    {activeDay.kind === 'main'
                      ? `Upper push (Unit ${activeDay.day_index % 2 === 0 ? 'A' : 'B'})`
                      : t('home.rest_day_title')}
                  </h3>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="px-2 py-1 rounded text-xs font-mono font-bold bg-white/5 text-white border border-white/10 ltr-num">
                    {activeDay.kind === 'main' ? '38 min' : '0 min'}
                  </span>
                  <span className="text-[10px] text-[var(--accent)] font-semibold">
                    {t('train.confidence_label')}
                  </span>
                </div>
              </div>

              {/* Status Meaning Explainer */}
              <div className="clay-sm p-3 bg-white/5 border border-white/5 text-xs text-[var(--muted)] leading-relaxed">
                {activeDay.status === 'locked'
                  ? t('train.status_meaning_locked')
                  : activeDay.status === 'protected'
                  ? t('train.status_meaning_protected')
                  : t('train.status_meaning_adaptive')}
              </div>

              {/* Target Muscles */}
              {targetMuscles.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                    {t('train.target_muscles')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {targetMuscles.map((muscle) => (
                      <Chip
                        key={muscle}
                        pattern="horizontal_push"
                        label={muscle.charAt(0).toUpperCase() + muscle.slice(1)}
                        active
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Prescribed Exercise Flow List */}
              {dayExercises.length > 0 ? (
                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                    {t('train.prescribed_exercises')} ({dayExercises.length})
                  </span>
                  {dayExercises.map(({ name, pattern, level, setsCount, repsDisplay, restSeconds }, idx) => (
                    <div
                      key={idx}
                      className="clay-sm p-3.5 flex items-center justify-between border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PATTERN_COLOR_MAP[pattern] }}
                        />
                        <div>
                          <div className="font-bold text-sm text-white">{name}</div>
                          <div className="text-[11px] text-[var(--muted)] capitalize">
                            {pattern.replace('_', ' ')} • <span className="ltr-num">{t('train.level_label')} {level}</span>
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5 ltr-num">
                            {t('train.rest_interval')}: {restSeconds}s • {t('train.transition_time')}: 15s
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-neutral-200 ltr-num block">
                          {setsCount} sets
                        </span>
                        <span className="font-mono text-[11px] text-[var(--muted)] ltr-num block">
                          {repsDisplay}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="clay-sm p-6 text-center text-xs text-[var(--muted)]">
                  {t('train.no_session_scheduled')}
                </div>
              )}

              {/* Library Limitation Card (e.g. Vertical Pull) */}
              <div className="clay-sm p-3.5 border border-amber-900/60 bg-amber-950/20 text-xs text-amber-300 flex items-start gap-2.5">
                <Icon name="shield" size={16} color="var(--amber)" />
                <div className="flex-1">
                  <span className="font-bold block text-white">{t('train.library_limitation_title')}</span>
                  <span>{LIBRARY_LIMITATIONS.vertical_pull}</span>
                </div>
              </div>

              {/* Read-Only Status & Last Updated */}
              <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-2 border-t border-white/5">
                <span>{t('train.last_updated')}: {activeDay.date ?? 'today'}</span>
                <span className="font-mono uppercase text-[10px] px-2 py-0.5 rounded bg-white/5">
                  READ ONLY
                </span>
              </div>
            </ClayCard>
          ) : (
            <div className="clay-sm p-8 text-center text-xs text-[var(--muted)]">
              {t('common.loading')}
            </div>
          )}
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
