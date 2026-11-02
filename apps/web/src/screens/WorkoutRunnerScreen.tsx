import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { PlanDay, PrescriptionSnapshot, Exercise } from '@hfos/contracts';
import { t, type I18nKey } from '../i18n/index.js';
import { ClayCard } from '../components/ClayCard.js';
import { ClayButton } from '../components/ClayButton.js';
import { Chip } from '../components/Chip.js';
import { Ring } from '../components/Ring.js';
import { Icon } from '../components/IconSet.js';
import { INITIAL_EXERCISE_LIBRARY } from '@hfos/library';
import { getEffectiveConfig, requireNumber } from '@hfos/config';
import { KeyValueStore, IndexedDbEventLog } from '../storage/index.js';
import {
  type AppearanceSettings,
  DEFAULT_APPEARANCE,
  KV_KEY_APPEARANCE,
} from '../appearance.js';
import { SystemClock, SystemIdGenerator } from '../engine/engineContext.js';
import {
  type SessionRunnerState,
  createInitialRunnerState,
  sessionReducer,
  generateSessionEvents,
  saveSessionRunner,
  loadSessionRunner,
  clearSessionRunner,
  type SessionRunnerDeps,
} from '../engine/sessionRunner.js';

export interface WorkoutRunnerScreenProps {
  planDay: PlanDay;
  onClose: () => void;
  onSessionComplete?: () => void;
}

// ==========================================
// WebAudio & Haptics Helpers (Zero Assets)
// ==========================================

function playRestEndTone(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Degrade gracefully if blocked by autoplay policy
  }
}

function triggerHaptics(appearance: AppearanceSettings, pattern: number | number[]): void {
  if (appearance.haptics === 'on' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Degrade silently where unsupported
    }
  }
}

// ==========================================
// RPE Selector Scale (config-driven, Phase 2C)
// ==========================================

function buildRpeOptions(): number[] {
  const cfg = getEffectiveConfig();
  const min = requireNumber(cfg, 'rpe_min');
  const max = requireNumber(cfg, 'rpe_max');
  const step = requireNumber(cfg, 'rpe_step');
  if (!(step > 0) || max < min) {
    throw new Error(
      `Invalid RPE scale config: rpe_min=${min}, rpe_max=${max}, rpe_step=${step}`
    );
  }
  const steps = Math.round((max - min) / step);
  const options: number[] = [];
  for (let i = 0; i <= steps; i++) {
    // Round to 1 decimal to avoid binary float drift (e.g. 6.600000000000001)
    options.push(Math.round((min + i * step) * 10) / 10);
  }
  return options;
}

const RPE_OPTIONS: number[] = buildRpeOptions();
const DEFAULT_TARGET_RPE: number = requireNumber(getEffectiveConfig(), 'target_rpe_default');

// ==========================================
// Isolated Timer Component (Directive 4)
// ==========================================

interface RestCountdownDisplayProps {
  deadlineIso: string | null;
  totalSeconds: number;
  isPaused: boolean;
  onExpire: () => void;
  phaseLabel: string;
}

const RestCountdownDisplay: React.FC<RestCountdownDisplayProps> = ({
  deadlineIso,
  totalSeconds,
  isPaused,
  onExpire,
  phaseLabel,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (!deadlineIso) return totalSeconds;
    const rem = Math.max(0, Math.ceil((Date.parse(deadlineIso) - Date.now()) / 1000));
    return rem;
  });

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
  }, [deadlineIso]);

  useEffect(() => {
    if (!deadlineIso || isPaused) return;

    const tick = () => {
      const now = Date.now();
      const target = Date.parse(deadlineIso);
      const rem = Math.max(0, Math.ceil((target - now) / 1000));
      setSecondsRemaining(rem);

      if (rem <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };

    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [deadlineIso, isPaused]);

  const progress = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsRemaining / totalSeconds)) : 0;

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-6"
      role="timer"
      aria-live="polite"
      aria-label={`${phaseLabel}: ${secondsRemaining} ${t('runner.seconds_unit')}`}
    >
      <div className="relative flex items-center justify-center">
        <Ring
          progress={progress}
          size={160}
          strokeWidth={12}
          color="var(--accent)"
        >
          <div className="text-center font-mono ltr-num flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-white">{secondsRemaining}</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('runner.seconds_unit')}
            </span>
          </div>
        </Ring>
      </div>

      {/* Accessible Text Fallback alongside Ring */}
      <div className="text-xs font-semibold text-[var(--muted)] flex items-center gap-1.5 ltr-num">
        <span>⏱️</span>
        <span>
          {t('runner.rest_remaining')}: {secondsRemaining} {t('runner.seconds_unit')}
        </span>
      </div>
    </div>
  );
};

// ==========================================
// Main WorkoutRunnerScreen Component
// ==========================================

export const WorkoutRunnerScreen: React.FC<WorkoutRunnerScreenProps> = ({
  planDay,
  onClose,
  onSessionComplete,
}) => {
  const clock = useMemo(() => new SystemClock(), []);
  const idGen = useMemo(() => new SystemIdGenerator(), []);
  const kvStore = useMemo(() => new KeyValueStore(), []);
  const eventLog = useMemo(() => new IndexedDbEventLog(), []);

  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [showPauseModal, setShowPauseModal] = useState<boolean>(false);
  const [showAbandonModal, setShowAbandonModal] = useState<boolean>(false);
  const [abandonReason, setAbandonReason] = useState<string>('');
  const [isReady, setIsReady] = useState<boolean>(false);

  // Degraded storage mode (Phase 2C): session continues in-memory if persistence fails
  const [storageDegraded, setStorageDegraded] = useState<boolean>(false);
  const [degradedDismissed, setDegradedDismissed] = useState<boolean>(false);

  // Per-set inputs
  const [currentReps, setCurrentReps] = useState<number>(10);
  const [selectedRpe, setSelectedRpe] = useState<number>(DEFAULT_TARGET_RPE);
  const [hasPain, setHasPain] = useState<boolean>(false);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const pauseTriggerRef = useRef<HTMLButtonElement | null>(null);
  const abandonTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pauseDialogRef = useRef<HTMLDivElement | null>(null);
  const abandonInputRef = useRef<HTMLInputElement | null>(null);

  // Fallback prescription snapshot if planDay has none
  const prescription: PrescriptionSnapshot = useMemo(() => {
    if (planDay.session_snapshot) return planDay.session_snapshot;
    return {
      schema_version: 1,
      id: idGen.generateId(),
      session_id: idGen.generateId(),
      engine_version: '1.0.0',
      config_version: '1.0.0',
      created_at: clock.nowIso(),
      rules: [],
      exercises: [
        {
          exercise_id: 'pushup_standard',
          sets: [
            { schema_version: 1, set_number: 1, target_reps: 10, target_rpe: 7.5, rest_seconds: 60 },
            { schema_version: 1, set_number: 2, target_reps: 10, target_rpe: 8.0, rest_seconds: 60 },
          ],
          rest_seconds: 90,
        },
      ],
    };
  }, [planDay, idGen, clock]);

  const deps: SessionRunnerDeps = useMemo(
    () => ({
      clock,
      idGenerator: idGen,
      library: INITIAL_EXERCISE_LIBRARY,
      deviceId: 'device-redmi12-local',
    }),
    [clock, idGen]
  );

  const [runnerState, setRunnerState] = useState<SessionRunnerState>(() =>
    createInitialRunnerState(prescription, planDay.unit, deps)
  );

  // Ref mirror for event listeners that must not re-subscribe on every state change
  const runnerStateRef = useRef<SessionRunnerState>(runnerState);
  runnerStateRef.current = runnerState;

  // Hydrate from KV store on mount (restores mid-session state on reload)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const savedAppearance = await kvStore.get<AppearanceSettings>(KV_KEY_APPEARANCE);
      if (savedAppearance && isMounted) {
        setAppearance(savedAppearance);
      }

      const savedState = await loadSessionRunner(kvStore);
      if (savedState && isMounted && !savedState.is_abandoned && savedState.phase !== 'done') {
        setRunnerState(savedState);
      }
      if (isMounted) setIsReady(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [kvStore]);

  // Persist runner state changes to KeyValueStore
  useEffect(() => {
    if (!isReady) return;
    if (runnerState.phase === 'done' || runnerState.is_abandoned) {
      clearSessionRunner(kvStore).catch(() => setStorageDegraded(true));
    } else {
      saveSessionRunner(kvStore, runnerState).catch(() => setStorageDegraded(true));
    }
  }, [runnerState, isReady, kvStore]);

  // Screen Wake Lock API management
  useEffect(() => {
    const isRunning =
      !runnerState.is_paused &&
      !runnerState.is_abandoned &&
      runnerState.phase !== 'done';

    if (isRunning && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          wakeLockRef.current = lock;
        })
        .catch(() => {
          // Degrade silently where unsupported
        });
    } else {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [runnerState.is_paused, runnerState.is_abandoned, runnerState.phase]);

  // Visibility change resilience (Phase 2C): when the device returns from
  // sleep or an app switch, re-acquire the Wake Lock if the session is still
  // running and push a stale-deadline re-sync through the reducer.
  // AUTO_ADVANCE is idempotent: it advances exactly one phase when the
  // deadline has passed and is a no-op otherwise (fresh deadline or already
  // advanced by the countdown ticker).
  useEffect(() => {
    const handleVisibility = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
      const prev = runnerStateRef.current;
      const isRunning = !prev.is_paused && !prev.is_abandoned && prev.phase !== 'done';
      if (isRunning && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        navigator.wakeLock
          .request('screen')
          .then((lock) => {
            wakeLockRef.current = lock;
          })
          .catch(() => {
            // Degrade silently where unsupported
          });
      }
      setRunnerState((state) => sessionReducer(state, { type: 'AUTO_ADVANCE' }, deps));
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [deps]);

  // Current Exercise & Set references
  const currentExPrescription = runnerState.snapshot.exercises[runnerState.current_exercise_index];
  const currentSetPrescription = currentExPrescription?.sets[runnerState.current_set_index];

  const currentExerciseDef: Exercise | undefined = useMemo(() => {
    if (runnerState.phase === 'warmup') {
      const firstExId = runnerState.snapshot.exercises[0]?.exercise_id;
      return INITIAL_EXERCISE_LIBRARY.find((e) => e.id === firstExId);
    }
    if (!currentExPrescription) return undefined;
    return INITIAL_EXERCISE_LIBRARY.find((e) => e.id === currentExPrescription.exercise_id);
  }, [runnerState.phase, runnerState.snapshot, currentExPrescription]);

  // Synchronize set inputs when exercise or set changes
  useEffect(() => {
    if (runnerState.phase === 'warmup') {
      setCurrentReps(10);
      setSelectedRpe(RPE_OPTIONS[0] ?? DEFAULT_TARGET_RPE);
      setHasPain(false);
      return;
    }

    if (currentSetPrescription) {
      const target =
        currentSetPrescription.target_reps ??
        currentSetPrescription.max_reps ??
        currentSetPrescription.min_reps ??
        10;
      setCurrentReps(target);
      setSelectedRpe(currentSetPrescription.target_rpe ?? DEFAULT_TARGET_RPE);
      setHasPain(false);
    }
  }, [runnerState.phase, runnerState.current_exercise_index, runnerState.current_set_index, currentSetPrescription]);

  // Actions
  const handleCompleteSet = useCallback(() => {
    triggerHaptics(appearance, 50);
    setRunnerState((prev) =>
      sessionReducer(
        prev,
        {
          type: 'COMPLETE_SET',
          done_reps: currentReps,
          rpe: selectedRpe,
          pain: hasPain,
        },
        deps
      )
    );
  }, [appearance, currentReps, selectedRpe, hasPain, deps]);

  const handleSkipSet = useCallback(() => {
    setRunnerState((prev) => sessionReducer(prev, { type: 'SKIP_SET' }, deps));
  }, [deps]);

  const handleAutoAdvance = useCallback(() => {
    if (soundEnabled) {
      playRestEndTone();
    }
    triggerHaptics(appearance, [100, 50, 100]);
    setRunnerState((prev) => sessionReducer(prev, { type: 'AUTO_ADVANCE' }, deps));
  }, [soundEnabled, appearance, deps]);

  const handleExtendRest = useCallback(() => {
    setRunnerState((prev) => sessionReducer(prev, { type: 'EXTEND_REST', seconds: 20 }, deps));
  }, [deps]);

  const handleSkipRest = useCallback(() => {
    setRunnerState((prev) => sessionReducer(prev, { type: 'SKIP_REST' }, deps));
  }, [deps]);

  const handlePause = useCallback(() => {
    setRunnerState((prev) => sessionReducer(prev, { type: 'PAUSE' }, deps));
    setShowPauseModal(true);
  }, [deps]);

  const handleResume = useCallback(() => {
    setShowPauseModal(false);
    setRunnerState((prev) => sessionReducer(prev, { type: 'RESUME' }, deps));
    requestAnimationFrame(() => pauseTriggerRef.current?.focus());
  }, [deps]);

  const handleConfirmAbandon = useCallback(() => {
    setShowAbandonModal(false);
    const reason = abandonReason.trim() || 'user_abandoned';
    setRunnerState((prev) => sessionReducer(prev, { type: 'ABANDON', reason }, deps));
  }, [abandonReason, deps]);

  const handleFinishEarly = useCallback(() => {
    setRunnerState((prev) => sessionReducer(prev, { type: 'FINISH' }, deps));
  }, [deps]);

  // Committing events on summary close
  const handleReturnHome = useCallback(async () => {
    try {
      const events = generateSessionEvents(runnerState, deps);
      for (const ev of events) {
        await eventLog.append(ev);
      }
      await clearSessionRunner(kvStore);
    } catch {
      setStorageDegraded(true);
    }
    if (onSessionComplete) {
      onSessionComplete();
    } else {
      onClose();
    }
  }, [runnerState, deps, eventLog, kvStore, onSessionComplete, onClose]);

  // Modal accessibility (Phase 2C): focus management + Escape handling
  useEffect(() => {
    if (!showPauseModal) return;
    pauseDialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleResume();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showPauseModal, handleResume]);

  useEffect(() => {
    if (!showAbandonModal) return;
    abandonInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAbandonModal(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showAbandonModal]);

  // Phase badge display
  const phaseLabelKey: I18nKey = useMemo(() => {
    switch (runnerState.phase) {
      case 'warmup':
        return 'runner.phase_warmup';
      case 'exercise':
        return 'runner.phase_exercise';
      case 'rest':
        return 'runner.phase_rest';
      case 'cooldown':
        return 'runner.phase_cooldown';
      case 'done':
        return 'runner.phase_done';
    }
  }, [runnerState.phase]);

  // Summary metrics calculation
  const summaryMetrics = useMemo(() => {
    const workingSets = runnerState.set_records.filter((r) => !r.is_warmup);
    const partialSets = workingSets.filter((r) => {
      const target = r.target_reps;
      const done = r.done_reps ?? target;
      return done < target;
    });
    const painSets = workingSets.filter((r) => r.pain);
    const rpeValues = workingSets.map((r) => r.rpe).filter((v): v is number => v !== undefined);
    const avgRpe =
      rpeValues.length > 0
        ? (rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length).toFixed(1)
        : DEFAULT_TARGET_RPE.toFixed(1);

    const endMs = runnerState.completed_at
      ? Date.parse(runnerState.completed_at)
      : Date.now();
    const durationSec = Math.max(
      0,
      Math.round((endMs - Date.parse(runnerState.session_started_at)) / 1000)
    );
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;

    return {
      durationStr: `${minutes}m ${seconds}s`,
      totalSets: workingSets.length,
      partialSetsCount: partialSets.length,
      painSetsCount: painSets.length,
      avgRpe,
    };
  }, [runnerState]);

  // ==========================================
  // Render: Final Summary Screen
  // ==========================================
  if (runnerState.phase === 'done') {
    return (
      <div className="flex-1 flex flex-col justify-between p-4 max-w-lg mx-auto w-full min-h-[90vh] animate-screen-enter">
        <div className="flex flex-col gap-4">
          <ClayCard variant="hero" className="p-6 text-center flex flex-col items-center gap-3 border border-white/10">
            <div className="w-16 h-16 rounded-full clay-sm flex items-center justify-center text-[var(--accent)] mb-1">
              <Icon name="target" size={32} color="var(--accent)" />
            </div>
            <h2 className="text-2xl font-black text-white">
              {runnerState.is_abandoned ? t('runner.abandon_title') : t('runner.summary_title')}
            </h2>
            <p className="text-xs text-[var(--muted)] leading-relaxed max-w-xs">
              {runnerState.is_abandoned
                ? `${t('runner.abandon_warning')} (${runnerState.abandon_reason || 'user_abandoned'})`
                : t('runner.summary_desc')}
            </p>
          </ClayCard>

          {/* Metrics Bento Grid */}
          <div className="grid grid-cols-2 gap-3">
            <ClayCard variant="small" className="p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {t('runner.duration')}
              </span>
              <span className="text-xl font-black text-white font-mono ltr-num mt-1">
                {summaryMetrics.durationStr}
              </span>
            </ClayCard>

            <ClayCard variant="small" className="p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {t('runner.total_sets')}
              </span>
              <span className="text-xl font-black text-white font-mono ltr-num mt-1">
                {summaryMetrics.totalSets}
              </span>
            </ClayCard>

            <ClayCard variant="small" className="p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {t('runner.avg_rpe')}
              </span>
              <span className="text-xl font-black text-[var(--yellow)] font-mono ltr-num mt-1">
                {summaryMetrics.avgRpe}
              </span>
            </ClayCard>

            <ClayCard variant="small" className="p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {t('runner.partial_sets')}
              </span>
              <span className="text-xl font-black text-white font-mono ltr-num mt-1">
                {summaryMetrics.partialSetsCount}
              </span>
            </ClayCard>
          </div>

          {/* Pain Sets Notice */}
          {summaryMetrics.painSetsCount > 0 && (
            <div className="clay-sm p-3.5 border border-amber-600/50 bg-amber-950/30 text-amber-200 text-xs flex items-center gap-2.5">
              <span className="text-base">⚠️</span>
              <div className="flex-1">
                <span className="font-bold">{t('runner.pain_flagged_sets')}: {summaryMetrics.painSetsCount} </span>
                <span>{t('runner.pain_summary_notice')}</span>
              </div>
            </div>
          )}

          {/* Movement Patterns Trained */}
          <ClayCard variant="small" className="p-4 flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              {t('runner.patterns_trained')}
            </span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {runnerState.patterns.map((p) => (
                <Chip key={p} label={p.replace('_', ' ')} pattern={p} />
              ))}
            </div>
          </ClayCard>
        </div>

        {/* Primary Return Button */}
        <div className="pt-6">
          <ClayButton
            variant="primary"
            onClick={handleReturnHome}
            aria-label={t('runner.return_home')}
            className="w-full py-4 text-sm font-black uppercase text-black cursor-pointer active:scale-95 transition-motion touch-target"
          >
            {t('runner.return_home')}
          </ClayButton>
        </div>
      </div>
    );
  }

  // ==========================================
  // Render: Active Workout Runner UX (Redmi 12 360dp)
  // ==========================================
  const totalSetsCount = currentExPrescription?.sets.length ?? 1;
  const currentSetNum = runnerState.current_set_index + 1;
  const targetRepsPrescription =
    currentSetPrescription?.target_reps ??
    currentSetPrescription?.max_reps ??
    currentSetPrescription?.min_reps ??
    10;
  const targetRpePrescription = currentSetPrescription?.target_rpe ?? DEFAULT_TARGET_RPE;

  return (
    <div className="flex-1 flex flex-col justify-between max-w-lg mx-auto w-full min-h-[92vh] pb-6 px-3">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div aria-live="polite">
            <Chip
              label={t(phaseLabelKey)}
              color={
                runnerState.phase === 'warmup'
                  ? 'var(--coral)'
                  : runnerState.phase === 'rest'
                  ? 'var(--blue)'
                  : runnerState.phase === 'cooldown'
                  ? 'var(--violet)'
                  : 'var(--accent)'
              }
            />
          </div>
          {currentExerciseDef && (
            <Chip
              label={currentExerciseDef.pattern.replace('_', ' ')}
              pattern={currentExerciseDef.pattern}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            ref={pauseTriggerRef}
            onClick={handlePause}
            aria-label={t('runner.pause')}
            className="touch-target px-3 py-1.5 rounded-lg clay-sm text-xs font-bold text-[var(--muted)] hover:text-white transition-motion cursor-pointer active:scale-95 flex items-center gap-1"
          >
            <span>⏸️</span>
            <span>{t('runner.pause')}</span>
          </button>
          <button
            ref={abandonTriggerRef}
            onClick={() => setShowAbandonModal(true)}
            aria-label={t('runner.abandon')}
            className="touch-target px-2.5 py-1.5 rounded-lg clay-sm text-xs font-bold text-red-400/80 hover:text-red-300 transition-motion cursor-pointer active:scale-95"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 2. Middle Phase Content */}
      <div className="flex-1 flex flex-col justify-center py-4">
        {/* PHASE: REST OR COOLDOWN */}
        {(runnerState.phase === 'rest' || runnerState.phase === 'cooldown') && (
          <div className="flex flex-col items-center justify-center gap-4 animate-screen-enter">
            <RestCountdownDisplay
              deadlineIso={runnerState.rest_deadline}
              totalSeconds={runnerState.rest_duration_seconds}
              isPaused={runnerState.is_paused}
              onExpire={handleAutoAdvance}
              phaseLabel={t(phaseLabelKey)}
            />

            {/* Rest Actions */}
            <div className="flex items-center gap-3 w-full max-w-xs justify-center pt-2">
              {runnerState.phase === 'rest' && (
                <>
                  <ClayButton
                    variant="secondary"
                    onClick={handleExtendRest}
                    aria-label={t('runner.extend_rest')}
                    className="flex-1 py-3 text-xs font-bold touch-target active:scale-95 transition-motion"
                  >
                    {t('runner.extend_rest')}
                  </ClayButton>
                  <ClayButton
                    variant="primary"
                    onClick={handleSkipRest}
                    aria-label={t('runner.skip_rest')}
                    className="flex-1 py-3 text-xs font-bold touch-target active:scale-95 transition-motion text-black"
                  >
                    {t('runner.skip_rest')}
                  </ClayButton>
                </>
              )}

              {runnerState.phase === 'cooldown' && (
                <ClayButton
                  variant="secondary"
                  onClick={handleFinishEarly}
                  aria-label={t('runner.finish_early')}
                  className="w-full py-3 text-xs font-bold touch-target active:scale-95 transition-motion"
                >
                  {t('runner.finish_early')}
                </ClayButton>
              )}
            </div>

            {/* Sound Chime Toggle */}
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              aria-label={t('runner.audio_cue_toggle')}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full clay-sm text-[11px] font-medium text-[var(--muted)] hover:text-white cursor-pointer touch-target transition-motion"
            >
              <span>{soundEnabled ? '🔔' : '🔕'}</span>
              <span>{soundEnabled ? t('runner.sound_enabled') : t('runner.sound_disabled')}</span>
            </button>
          </div>
        )}

        {/* PHASE: WARMUP OR WORKING EXERCISE */}
        {(runnerState.phase === 'warmup' || runnerState.phase === 'exercise') && (
          <div className="flex flex-col gap-4 animate-screen-enter">
            {/* Exercise Card */}
            <ClayCard variant="hero" className="p-5 flex flex-col gap-2 border border-white/10">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                <span>
                  {runnerState.phase === 'warmup'
                    ? t('runner.set_progress')
                        .replace('{current}', String(runnerState.warmup_set_index + 1))
                        .replace('{total}', String(runnerState.total_warmup_sets))
                    : t('runner.set_progress')
                        .replace('{current}', String(currentSetNum))
                        .replace('{total}', String(totalSetsCount))}
                </span>
                <span className="font-mono ltr-num">
                  {t('runner.target_reps').replace('{reps}', String(targetRepsPrescription))}
                </span>
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight mt-1">
                {currentExerciseDef?.name ?? ''}
              </h2>

              {currentExerciseDef?.description && (
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {currentExerciseDef.description}
                </p>
              )}
            </ClayCard>

            {/* Reps Stepper */}
            <ClayCard variant="small" className="p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] block">
                  {t('runner.reps_done')}
                </span>
                <span className="text-[10px] text-[var(--muted)]">
                  {currentReps < targetRepsPrescription ? t('runner.partial_reps') : t('runner.target_hint')}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentReps((r) => Math.max(1, r - 1))}
                  aria-label="Decrease reps"
                  className="w-11 h-11 rounded-xl clay-sm flex items-center justify-center text-lg font-black text-white hover:text-[var(--accent)] active:scale-90 transition-motion touch-target"
                >
                  -
                </button>
                <span className="text-2xl font-black font-mono text-white min-w-[36px] text-center ltr-num">
                  {currentReps}
                </span>
                <button
                  onClick={() => setCurrentReps((r) => r + 1)}
                  aria-label="Increase reps"
                  className="w-11 h-11 rounded-xl clay-sm flex items-center justify-center text-lg font-black text-white hover:text-[var(--accent)] active:scale-90 transition-motion touch-target"
                >
                  +
                </button>
              </div>
            </ClayCard>

            {/* RPE Selector */}
            <ClayCard variant="small" className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  {t('runner.rpe_label')}
                </span>
                <span className="text-xs font-black font-mono text-[var(--yellow)] ltr-num">
                  RPE {selectedRpe.toFixed(1)}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-1">
                {RPE_OPTIONS.map((val) => {
                  const isSelected = selectedRpe === val;
                  const isPrescribed = targetRpePrescription === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setSelectedRpe(val)}
                      aria-label={`RPE ${val}`}
                      className={`touch-target py-2.5 px-1 rounded-xl text-xs font-mono font-bold transition-motion active:scale-95 ltr-num ${
                        isSelected
                          ? 'clay-btn-primary bg-[var(--yellow)] text-black font-black'
                          : isPrescribed
                          ? 'clay-sm border border-[var(--yellow)]/60 text-white'
                          : 'clay-sm text-[var(--muted)] hover:text-white'
                      }`}
                    >
                      {val.toFixed(1)}
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-[var(--muted)] pt-0.5">
                {t('runner.rpe_explainer')}
              </span>
            </ClayCard>

            {/* Honest Pain Toggle */}
            <div
              onClick={() => setHasPain((p) => !p)}
              className={`p-3.5 rounded-[var(--radius-card)] cursor-pointer transition-motion active:scale-[0.98] border ${
                hasPain
                  ? 'bg-rose-950/40 border-rose-500/80 text-rose-200'
                  : 'clay-sm border-white/5 text-[var(--muted)] hover:text-white'
              }`}
              role="checkbox"
              aria-checked={hasPain}
              aria-label={t('runner.pain_toggle')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{hasPain ? '⚠️' : '🛡️'}</span>
                  <span className="text-xs font-bold text-white">
                    {t('runner.pain_toggle')}
                  </span>
                </div>
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black ${
                    hasPain ? 'bg-rose-500 text-white' : 'border border-white/20'
                  }`}
                >
                  {hasPain ? '✓' : ''}
                </div>
              </div>
              <p className="text-[10px] mt-1.5 leading-relaxed text-[var(--muted)]">
                {t('runner.pain_consequence')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Degraded Storage Banner (Phase 2C) */}
      {storageDegraded && !degradedDismissed && (
        <div
          role="status"
          className="clay-sm p-3 border border-amber-600/50 bg-amber-950/30 text-amber-200 text-xs flex items-start gap-2.5 mt-2"
        >
          <span className="text-base">⚠️</span>
          <span className="flex-1 leading-relaxed">{t('runner.degraded_banner')}</span>
          <button
            onClick={() => setDegradedDismissed(true)}
            aria-label={t('runner.degraded_dismiss')}
            className="text-amber-200 hover:text-white cursor-pointer touch-target transition-motion"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Bottom Primary Actions */}
      {(runnerState.phase === 'warmup' || runnerState.phase === 'exercise') && (
        <div className="flex flex-col gap-2 pt-2">
          <ClayButton
            variant="primary"
            onClick={handleCompleteSet}
            aria-label={t('runner.done_set')}
            className="w-full py-4 text-base font-black uppercase text-black cursor-pointer active:scale-95 transition-motion touch-target"
          >
            {t('runner.done_set')}
          </ClayButton>

          <button
            onClick={handleSkipSet}
            aria-label={t('runner.skip_set')}
            className="touch-target py-2.5 text-xs font-bold text-[var(--muted)] hover:text-white transition-motion cursor-pointer active:scale-95 text-center"
          >
            {t('runner.skip_set')}
          </button>
        </div>
      )}

      {/* ========================================== */}
      {/* Modals: Pause & Abandon Confirm Dialogs   */}
      {/* ========================================== */}

      {/* Pause Dialog */}
      {showPauseModal && (
        <div
          ref={pauseDialogRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 outline-none"
          role="dialog"
          aria-modal="true"
          aria-label={t('runner.pause_title')}
        >
          <ClayCard variant="hero" className="w-full max-w-sm flex flex-col gap-4 p-6 border border-white/10 text-center animate-screen-enter">
            <div className="w-12 h-12 rounded-full clay-sm flex items-center justify-center text-[var(--accent)] mx-auto mb-1">
              <span>⏸️</span>
            </div>
            <h3 className="text-lg font-black text-white">{t('runner.pause_title')}</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {t('runner.pause_desc')}
            </p>
            <ClayButton
              variant="primary"
              onClick={handleResume}
              aria-label={t('runner.resume_workout')}
              className="w-full mt-2 py-3.5 text-xs font-black uppercase text-black touch-target"
            >
              {t('runner.resume_workout')}
            </ClayButton>
          </ClayCard>
        </div>
      )}

      {/* Abandon Dialog */}
      {showAbandonModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('runner.abandon_title')}
        >
          <ClayCard variant="hero" className="w-full max-w-sm flex flex-col gap-4 p-6 border border-white/10 animate-screen-enter">
            <div className="w-12 h-12 rounded-full clay-sm flex items-center justify-center text-rose-400 mx-auto mb-1">
              <span>⚠️</span>
            </div>
            <h3 className="text-lg font-black text-white text-center">
              {t('runner.abandon_title')}
            </h3>
            <p className="text-xs text-rose-300 leading-relaxed text-center">
              {t('runner.abandon_warning')}
            </p>

            <input
              ref={abandonInputRef}
              type="text"
              value={abandonReason}
              onChange={(e) => setAbandonReason(e.target.value)}
              placeholder={t('runner.abandon_reason_placeholder')}
              aria-label={t('runner.abandon_reason_placeholder')}
              className="w-full clay-input p-3 text-xs text-white rounded-xl border border-white/10 bg-black/30 placeholder:text-neutral-500"
            />

            <div className="flex items-center gap-2 pt-2">
              <ClayButton
                variant="secondary"
                onClick={() => {
                  setShowAbandonModal(false);
                  requestAnimationFrame(() => abandonTriggerRef.current?.focus());
                }}
                aria-label={t('common.cancel')}
                className="flex-1 py-3 text-xs font-bold touch-target"
              >
                {t('common.cancel')}
              </ClayButton>
              <button
                onClick={handleConfirmAbandon}
                aria-label={t('runner.confirm_abandon')}
                className="flex-1 py-3 rounded-[var(--radius-button)] bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider cursor-pointer active:scale-95 transition-motion touch-target"
              >
                {t('runner.confirm_abandon')}
              </button>
            </div>
          </ClayCard>
        </div>
      )}
    </div>
  );
};
