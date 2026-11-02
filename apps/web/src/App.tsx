import React, { useEffect, useState, useCallback } from 'react';
import type { Plan } from '@hfos/contracts';
import {
  type Language,
  getLanguage,
  setLanguage,
  subscribeLanguage,
} from './i18n/index.js';
import { KeyValueStore, requestStoragePersistence } from './storage/index.js';
import {
  bootstrapMockUser,
  KV_KEY_LANGUAGE,
} from './bootstrap.js';
import {
  type AppearanceSettings,
  DEFAULT_APPEARANCE,
} from './appearance.js';
import type { MockUserProfile } from '@hfos/sim';

import { BottomNav, type TabKey } from './components/BottomNav.js';
import { LogoIntro } from './components/LogoIntro.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { TrainScreen } from './screens/TrainScreen.js';
import { ProgressScreen } from './screens/ProgressScreen.js';
import { MoreScreen } from './screens/MoreScreen.js';
import { WorkoutRunnerScreen } from './screens/WorkoutRunnerScreen.js';
import { PlanService, type DayDecisionSummary } from './engine/planService.js';
import { loadSessionRunner } from './engine/sessionRunner.js';
import type { PlanDay } from '@hfos/contracts';

export default function App() {
  const [lang, setLang] = useState<Language>(getLanguage());
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [mockProfile, setMockProfile] = useState<MockUserProfile | null>(null);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  // Plan state
  const [plan, setPlan] = useState<Plan | null>(null);
  const [decisions, setDecisions] = useState<Record<number, DayDecisionSummary> | null>(null);
  const [selectedTrainDayIndex, setSelectedTrainDayIndex] = useState<number>(0);
  const [activeWorkoutDay, setActiveWorkoutDay] = useState<PlanDay | null>(null);

  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [isFirstEver, setIsFirstEver] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const loadPlan = useCallback(async () => {
    try {
      const planService = new PlanService();
      const result = await planService.getOrCreatePlan();
      setPlan(result.plan);
      setDecisions(result.decisions);
    } catch {
      // Fallback silently if storage unavailable
    }
  }, []);

  const initApp = useCallback(async () => {
    // 1. Storage persistence
    requestStoragePersistence().catch(() => {});

    // 2. Saved language preference
    const kv = new KeyValueStore();
    const savedLang = await kv.get<Language>(KV_KEY_LANGUAGE);
    if (savedLang && (savedLang === 'en' || savedLang === 'ar')) {
      setLanguage(savedLang);
      setLang(savedLang);
    }

    // 3. Mock user, environment bootstrap, and appearance setup
    const { profile, isFirstEverLaunch, appearance: loadedAppearance } =
      await bootstrapMockUser();
    setMockProfile(profile);
    setAppearance(loadedAppearance);
    setIsFirstEver(isFirstEverLaunch);
    setIsHydrated(true);

    // 4. Restore in-flight workout if active
    const savedSession = await loadSessionRunner(kv);
    if (savedSession && !savedSession.is_abandoned && savedSession.phase !== 'done') {
      setActiveWorkoutDay({
        schema_version: 1,
        day_index: 0,
        status: 'locked',
        kind: 'main',
        unit: savedSession.training_unit,
        session_snapshot: savedSession.snapshot,
      });
    }

    // 5. Load or generate Plan in background (never blocks first paint)
    loadPlan();

    // 6. Launch intro timer (<= 2000ms for first ever, 600ms for subsequent cold launches)
    const timerDuration = isFirstEverLaunch ? 1800 : 600;
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, timerDuration);

    return () => clearTimeout(timer);
  }, [loadPlan]);

  useEffect(() => {
    const unsubLang = subscribeLanguage((newLang) => {
      setLang(newLang);
    });

    initApp();

    return () => {
      unsubLang();
    };
  }, [initApp]);

  const handleProfileUpdated = async () => {
    const kv = new KeyValueStore();
    const profile = await kv.get<MockUserProfile>('mock_athlete_profile');
    if (profile) setMockProfile(profile);
    loadPlan();
  };

  const handleNavigateTrainDay = (dayIndex: number) => {
    setSelectedTrainDayIndex(dayIndex);
    setActiveTab('train');
  };

  const handleStartWorkout = useCallback(() => {
    const day0 = plan?.days.find((d) => d.day_index === 0) || plan?.days[0];
    if (day0) {
      setActiveWorkoutDay(day0);
    }
  }, [plan]);

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a10] text-[#f1f1f4] w-full min-h-screen relative overflow-x-hidden">
      {/* Launch Splash Screen */}
      {showIntro && (
        <LogoIntro
          isFirstEver={isFirstEver}
          onComplete={() => setShowIntro(false)}
        />
      )}

      {/* Main Content Area */}
      <main
        className="flex-1 w-full max-w-lg mx-auto p-4 safe-top safe-left safe-right content-scroll-area overflow-y-auto"
        style={{ opacity: isHydrated ? 1 : 0 }}
      >
        {activeWorkoutDay ? (
          <WorkoutRunnerScreen
            planDay={activeWorkoutDay}
            onClose={() => setActiveWorkoutDay(null)}
            onSessionComplete={() => {
              setActiveWorkoutDay(null);
              loadPlan();
            }}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeScreen
                plan={plan}
                decisions={decisions}
                onNavigateTrainDay={handleNavigateTrainDay}
                onStartWorkout={handleStartWorkout}
              />
            )}
            {activeTab === 'train' && (
              <TrainScreen
                plan={plan}
                selectedDayIndex={selectedTrainDayIndex}
                onSelectDayIndex={setSelectedTrainDayIndex}
              />
            )}
            {activeTab === 'progress' && <ProgressScreen />}
            {activeTab === 'more' && (
              <MoreScreen
                currentLang={lang}
                onLanguageChange={setLanguage}
                mockProfile={mockProfile}
                onProfileUpdated={handleProfileUpdated}
                appearance={appearance}
                onAppearanceChange={setAppearance}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Bottom Navigation (hidden during active workout) */}
      {!activeWorkoutDay && (
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  );
}
