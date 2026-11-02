import React, { useState } from 'react';
import type { Plan, PlanDay } from '@hfos/contracts';
import { t } from '../i18n/index.js';
import { ClayCard } from '../components/ClayCard.js';
import { ClayButton } from '../components/ClayButton.js';
import { Chip } from '../components/Chip.js';
import { DayChip } from '../components/DayChip.js';
import { Ring } from '../components/Ring.js';
import { Bar } from '../components/Bar.js';
import { SectionHeader } from '../components/SectionHeader.js';
import { Icon } from '../components/IconSet.js';
import type { DayDecisionSummary } from '../engine/planService.js';
import { INITIAL_EXERCISE_LIBRARY } from '@hfos/library';

interface HomeScreenProps {
  plan: Plan | null;
  decisions: Record<number, DayDecisionSummary> | null;
  onNavigateTrainDay?: (dayIndex: number) => void;
  onStartWorkout?: () => void;
  completedWorkoutsCount?: number;
  totalPlannedCount?: number;
  muscleExposure?: Record<string, number>;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  plan,
  decisions,
  onNavigateTrainDay,
  onStartWorkout,
  completedWorkoutsCount = 0,
  totalPlannedCount = 4,
  muscleExposure,
}) => {
  const [showWhyModal, setShowWhyModal] = useState(false);

  // If plan is not ready yet, render a skeleton card without blocking
  if (!plan || !plan.days || plan.days.length === 0) {
    return (
      <div className="flex flex-col gap-5 animate-screen-enter pb-10">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
              {t('home.welcome_athlete')}
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white mt-0.5">
              {t('home.title')}
            </h2>
          </div>
        </div>
        <ClayCard variant="hero" className="flex flex-col gap-4 border border-white/10 p-8 text-center">
          <div className="text-sm font-semibold text-[var(--muted)] animate-pulse">
            {t('common.loading')}
          </div>
        </ClayCard>
      </div>
    );
  }

  const day0 = plan.days[0]!;
  const day0Snapshot = day0.session_snapshot;
  const day0Decision = decisions?.[0];

  // Exercises from day 0 snapshot
  const day0Exercises = (day0Snapshot?.exercises ?? []).map((exItem) => {
    const libEx = INITIAL_EXERCISE_LIBRARY.find((e) => e.id === exItem.exercise_id);
    return {
      exercise_id: exItem.exercise_id,
      name: libEx?.name ?? exItem.exercise_id.replace(/_/g, ' '),
      pattern: libEx?.pattern ?? 'horizontal_push',
      primary_muscles: libEx?.primary_muscles ?? ['chest'],
      sets: exItem.sets,
      rest_seconds: exItem.rest_seconds ?? 60,
    };
  });

  // Calculate estimated duration
  const totalSets = day0Exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const estimatedDurationMinutes = day0Snapshot
    ? Math.max(30, Math.round((totalSets * 75) / 60))
    : 0;

  // Distinct primary muscles for chips
  const primaryMusclesSet = new Set<string>();
  day0Exercises.forEach((ex) => {
    ex.primary_muscles.forEach((m) => primaryMusclesSet.add(m));
  });
  const primaryMuscles = Array.from(primaryMusclesSet);

  // Suggested time window for day 0
  const suggestedWindow = '18:00–19:30';

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="flex flex-col gap-5 animate-screen-enter pb-10">
      {/* 1. Top Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
              {t('home.welcome_athlete')}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800/80">
              {t('common.mock_tag')}
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white mt-0.5">
            {t('home.title')}
          </h2>
        </div>
        <div className="clay-sm px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] font-mono border border-white/5">
          <Icon name="clock" size={13} color="var(--accent)" />
          <span className="ltr-num">{t('home.week_1')}</span>
        </div>
      </div>

      {/* 2. HERO Clay Card: Day 0 Session */}
      <ClayCard variant="hero" className="flex flex-col gap-4 border border-white/10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950/70 text-rose-300 border border-rose-800/60 flex items-center gap-1">
                <Icon name="lock" size={10} color="currentColor" />
                {t('home.today_day_0')} ({t('home.status_locked')})
              </span>
              {day0.kind === 'main' && (
                <span className="text-xs text-[var(--muted)] font-mono ltr-num">
                  {estimatedDurationMinutes} {t('home.session_duration').split(' ')[1] ?? 'min'}
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">
              {day0.kind === 'main'
                ? `Upper push (Unit ${plan.days[0]?.day_index !== undefined ? 'A' : 'A'})`
                : t('home.rest_day_title')}
            </h3>
            <div className="text-xs text-[var(--muted)] font-mono mt-0.5 flex items-center gap-1">
              <Icon name="clock" size={11} color="var(--muted)" />
              <span className="ltr-num">{suggestedWindow}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full clay-sm flex items-center justify-center text-[var(--accent)] border border-white/10 shrink-0">
            <Icon name="flame" size={20} color="var(--accent)" />
          </div>
        </div>

        {/* Exercises meta */}
        {day0.kind === 'main' && day0Exercises.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span className="font-semibold text-white ltr-num">
              {day0Exercises.length} exercises
            </span>
            <span>•</span>
            <span className="ltr-num">{totalSets} working sets</span>
            <span>•</span>
            <span className="text-[var(--accent)] font-mono ltr-num">{t('home.rpe_target')}</span>
          </div>
        )}

        {/* Muscle chips */}
        {primaryMuscles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {primaryMuscles.map((muscle) => (
              <Chip
                key={muscle}
                pattern="horizontal_push"
                label={muscle.charAt(0).toUpperCase() + muscle.slice(1)}
                active
              />
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-2">
          {/* Start workout button */}
          <ClayButton
            variant="primary"
            accentColor="var(--accent)"
            onClick={onStartWorkout}
            aria-label={t('home.start_workout')}
            className="flex-1 py-3.5 text-base font-black tracking-wide text-black touch-target cursor-pointer active:scale-95 transition-motion"
          >
            <Icon name="play" size={18} color="#08080c" />
            <span>{t('home.start_workout')}</span>
          </ClayButton>

          {/* Why this session? button */}
          <button
            onClick={() => setShowWhyModal(true)}
            className="touch-target px-3.5 py-3 rounded-[var(--radius-chip)] clay-sm text-xs font-bold text-[var(--muted)] hover:text-white transition-motion cursor-pointer active:scale-95 flex items-center justify-center gap-1"
          >
            <span>ℹ️</span>
            <span>{t('home.why_this_session')}</span>
          </button>
        </div>
      </ClayCard>

      {/* 3. 7-Day Horizon Strip (Real Plan) */}
      <div className="flex flex-col gap-2">
        <SectionHeader title={t('home.horizon_title')} />
        <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar px-1">
          {plan.days.map((day: PlanDay) => {
            const dateObj = day.date ? new Date(day.date) : new Date();
            const dayOfWeek = dateObj.getDay();
            const dayName = dayNames[dayOfWeek] ?? 'Mon';
            const dayNumber = dateObj.getDate();

            return (
              <DayChip
                key={day.day_index}
                dayName={dayName}
                dayNumber={dayNumber}
                kind={day.kind}
                status={day.status}
                isToday={day.day_index === 0}
                onClick={() => onNavigateTrainDay?.(day.day_index)}
              />
            );
          })}
        </div>
      </div>

      {/* 4. Bento Row: Consistency Ring & Readiness Gauge */}
      <div className="grid grid-cols-2 gap-3">
        {/* Weekly Consistency Ring */}
        <ClayCard variant="hero" className="p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('home.consistency_title')}
            </span>
            <Icon name="target" size={15} color="var(--accent)" />
          </div>
          {completedWorkoutsCount > 0 ? (
            <>
              <div className="flex items-center justify-center py-2">
                <Ring
                  progress={completedWorkoutsCount / totalPlannedCount}
                  size={72}
                  strokeWidth={7}
                  color="var(--accent)"
                >
                  <div className="text-center font-mono ltr-num">
                    <span className="text-lg font-black text-white">{completedWorkoutsCount}</span>
                    <span className="text-xs text-[var(--muted)]">/{totalPlannedCount}</span>
                  </div>
                </Ring>
              </div>
              <span className="text-[11px] text-center text-[var(--muted)] font-medium ltr-num">
                {completedWorkoutsCount} of {totalPlannedCount} sessions done
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-3 text-center gap-1">
              <span className="text-xs font-bold text-white">{t('home.consistency_empty_title')}</span>
              <span className="text-[10px] text-[var(--muted)] leading-tight">
                {t('home.consistency_empty_desc')}
              </span>
            </div>
          )}
        </ClayCard>

        {/* Readiness Tile */}
        <ClayCard variant="hero" className="p-4 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('home.readiness_title')}
            </span>
            <Icon name="bolt" size={15} color="var(--yellow)" />
          </div>
          <div className="flex flex-col items-center justify-center py-2 text-center">
            <div className="w-14 h-14 rounded-full border border-dashed border-white/20 flex items-center justify-center mb-1">
              <span className="text-xs text-[var(--muted)] font-mono">--</span>
            </div>
            <span className="text-[11px] text-[var(--muted)]">{t('home.no_checkin_yet')}</span>
          </div>
          <button className="clay-sm py-2 px-3 text-[11px] font-bold text-[var(--yellow)] hover:text-white transition-motion cursor-pointer active:scale-95 text-center">
            + {t('home.add_checkin')}
          </button>
        </ClayCard>
      </div>

      {/* 5. Muscle Exposure Card */}
      <ClayCard variant="hero" className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('home.exposure_title')}
            </h4>
            <span className="text-[11px] text-[var(--muted)]">
              {t('home.exposure_desc')}
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-[var(--muted)] border border-white/5">
            {t('common.estimate')}
          </span>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          {muscleExposure && Object.keys(muscleExposure).length > 0 ? (
            <>
              <Bar value={muscleExposure.chest ?? 0} color="var(--coral)" label={t('home.muscle_chest')} sublabel={`${muscleExposure.chest ?? 0} sets`} />
              <Bar value={muscleExposure.back ?? 0} color="var(--cyan)" label={t('home.muscle_back')} sublabel={`${muscleExposure.back ?? 0} sets`} />
              <Bar value={muscleExposure.shoulders ?? 0} color="var(--orange)" label={t('home.muscle_shoulders')} sublabel={`${muscleExposure.shoulders ?? 0} sets`} />
              <Bar value={muscleExposure.legs ?? 0} color="var(--violet)" label={t('home.muscle_quads')} sublabel={`${muscleExposure.legs ?? 0} sets`} />
              <Bar value={muscleExposure.abs ?? 0} color="var(--yellow)" label={t('home.muscle_core')} sublabel={`${muscleExposure.abs ?? 0} sets`} />
            </>
          ) : (
            <div className="text-center py-6 text-xs text-[var(--muted)] flex flex-col items-center gap-1">
              <span className="text-white font-bold">{t('progress.collecting_data')}</span>
              <span>{t('progress.empty_desc')}</span>
            </div>
          )}
        </div>
      </ClayCard>

      {/* 6. Coach Inbox Card */}
      <ClayCard variant="hero" className="flex items-center gap-3.5 p-4">
        <div className="w-10 h-10 rounded-full clay-sm flex items-center justify-center text-[var(--muted)] shrink-0">
          <Icon name="shield" size={18} color="var(--muted)" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            {t('home.coach_inbox')}
          </h4>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {t('home.coach_inbox_desc')}
          </p>
        </div>
      </ClayCard>

      {/* Bottom Sheet Modal: Why this session? */}
      {showWhyModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-3 sm:items-center">
          <ClayCard variant="hero" className="w-full max-w-md flex flex-col gap-4 border border-white/10 animate-screen-enter">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Icon name="target" size={18} color="var(--accent)" />
                <span>{t('home.decision_rationale')}</span>
              </h3>
              <button
                onClick={() => setShowWhyModal(false)}
                className="text-xs text-[var(--muted)] hover:text-white cursor-pointer px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {(day0Decision?.top_reasons ?? [
                'Priority muscle stimulus gap reached training threshold',
                'Scheduled availability window fits full working set prescription',
                'Compound movement progression criteria satisfied',
              ]).map((reason, idx) => (
                <div key={idx} className="clay-sm p-3 text-xs text-neutral-200 border border-white/5 flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <span>{reason}</span>
                    <span className="ml-1 text-[10px] text-[var(--muted)] uppercase">({t('common.estimate')})</span>
                  </div>
                </div>
              ))}

              {day0Decision?.revision_reason && (
                <div className="clay-sm p-3 bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>
                    {t('home.changed_because')}:{' '}
                    {day0Decision.revision_reason === 'schedule'
                      ? t('home.reason_schedule')
                      : day0Decision.revision_reason === 'readiness'
                      ? t('home.reason_readiness')
                      : day0Decision.revision_reason === 'prior_session'
                      ? t('home.reason_prior_session')
                      : t('home.reason_threshold')}
                  </span>
                </div>
              )}
            </div>

            <ClayButton
              variant="secondary"
              onClick={() => setShowWhyModal(false)}
              className="w-full text-xs font-bold"
            >
              {t('home.modal_close')}
            </ClayButton>
          </ClayCard>
        </div>
      )}
    </div>
  );
};
