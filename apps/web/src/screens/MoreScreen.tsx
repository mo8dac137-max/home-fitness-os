import React, { useEffect, useState } from 'react';
import { t, type Language } from '../i18n/index.js';
import { KeyValueStore, isStoragePersisted, IndexedDbEventLog } from '../storage/index.js';
import {
  resetMockData,
  KV_KEY_LANGUAGE,
  type MockEnvironmentState,
} from '../bootstrap.js';
import { getEffectiveConfig } from '@hfos/config';
import type { MockUserProfile } from '@hfos/sim';
import { UpdateBanner } from '../components/UpdateBanner.js';

interface MoreScreenProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  mockProfile: MockUserProfile | null;
  onProfileUpdated: () => void;
}

type MoreSubView = 'menu' | 'settings' | 'data' | 'about';

export const MoreScreen: React.FC<MoreScreenProps> = ({
  currentLang,
  onLanguageChange,
  mockProfile,
  onProfileUpdated,
}) => {
  const [subView, setSubView] = useState<MoreSubView>('menu');

  // Diagnostics state for About screen
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [swState, setSwState] = useState<string>('checking');
  const [persisted, setPersisted] = useState<boolean>(false);
  const [eventCount, setEventCount] = useState<number>(0);
  const [configKeyCount, setConfigKeyCount] = useState<number>(0);

  // Data reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Environment state for Data screen
  const [envState, setEnvState] = useState<MockEnvironmentState | null>(null);

  useEffect(() => {
    // Check standalone
    if (typeof window !== 'undefined') {
      const isStandalonePwa =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandalonePwa);

      // Online/offline listeners
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    if (subView === 'about') {
      // Refresh diagnostics
      isStoragePersisted().then(setPersisted);
      new IndexedDbEventLog().count().then(setEventCount);

      try {
        const config = getEffectiveConfig();
        setConfigKeyCount(Object.keys(config).length);
      } catch {
        setConfigKeyCount(0);
      }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (!reg) setSwState('unregistered');
          else if (reg.active) setSwState('active');
          else if (reg.installing) setSwState('installing');
          else if (reg.waiting) setSwState('waiting');
          else setSwState('installed');
        });
      } else {
        setSwState('unsupported');
      }
    }

    if (subView === 'data') {
      const kv = new KeyValueStore();
      kv.get<MockEnvironmentState>('mock_athlete_environment').then((res: MockEnvironmentState | null) => {
        if (res) setEnvState(res);
      });
    }
  }, [subView]);

  const handleLanguageSelect = async (lang: Language) => {
    onLanguageChange(lang);
    const kv = new KeyValueStore();
    await kv.set(KV_KEY_LANGUAGE, lang);
  };

  const handleExportJson = async () => {
    const eventLog = new IndexedDbEventLog();
    const kv = new KeyValueStore();
    const events = await eventLog.getAll();
    const keys = await kv.getAllKeys();
    const kvData: Record<string, unknown> = {};
    for (const k of keys) {
      kvData[k] = await kv.get(k);
    }

    const payload = {
      exported_at: new Date().toISOString(),
      athlete_profile: mockProfile,
      environment: envState,
      kv: kvData,
      events,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hfos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmReset = async () => {
    await resetMockData();
    setShowResetConfirm(false);
    setResetMessage(t('data.reset_success'));
    onProfileUpdated();
    setTimeout(() => setResetMessage(null), 3000);
  };

  // 1. Settings sub-view
  if (subView === 'settings') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSubView('menu')}
            className="touch-target p-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text)] transition-motion active:scale-95 cursor-pointer"
          >
            ← {t('common.close')}
          </button>
          <h2 className="text-xl font-bold">{t('settings.title')}</h2>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-[var(--radius-lg)] border border-neutral-800/80 flex flex-col gap-4">
          <div>
            <h3 className="font-semibold text-base">{t('settings.language_label')}</h3>
            <p className="text-xs text-[var(--muted)] mt-1">{t('settings.language_desc')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleLanguageSelect('en')}
              className={`touch-target px-4 py-3 rounded-[var(--radius-md)] border text-sm font-medium transition-motion cursor-pointer ${
                currentLang === 'en'
                  ? 'border-[var(--accent)] bg-[var(--surface-2)] text-white font-bold'
                  : 'border-neutral-800 bg-[#0b0b0b] text-[var(--muted)]'
              }`}
            >
              {t('settings.en')}
            </button>
            <button
              onClick={() => handleLanguageSelect('ar')}
              className={`touch-target px-4 py-3 rounded-[var(--radius-md)] border text-sm font-medium transition-motion cursor-pointer ${
                currentLang === 'ar'
                  ? 'border-[var(--accent)] bg-[var(--surface-2)] text-white font-bold'
                  : 'border-neutral-800 bg-[#0b0b0b] text-[var(--muted)]'
              }`}
            >
              {t('settings.ar')}
            </button>
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-[var(--radius-lg)] border border-neutral-800/80 flex flex-col gap-2">
          <h3 className="font-semibold text-base">{t('settings.theme_label')}</h3>
          <p className="text-xs text-[var(--muted)]">{t('settings.theme_value')}</p>
        </div>
      </div>
    );
  }

  // 2. Data management sub-view
  if (subView === 'data') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSubView('menu')}
            className="touch-target p-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text)] transition-motion active:scale-95 cursor-pointer"
          >
            ← {t('common.close')}
          </button>
          <h2 className="text-xl font-bold">{t('data.title')}</h2>
        </div>

        {resetMessage && (
          <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-300 p-3 rounded-[var(--radius-md)] text-xs">
            {resetMessage}
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-[var(--surface)] p-5 rounded-[var(--radius-lg)] border border-neutral-800/80 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--accent)] uppercase tracking-wider">
            {t('data.user_profile')}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className="text-[var(--muted)]">{t('data.user_id')}:</span>
            <span className="font-mono truncate">{mockProfile?.id ?? 'N/A'}</span>

            <span className="text-[var(--muted)]">{t('data.codename')}:</span>
            <span className="font-mono font-medium">{mockProfile?.codename ?? 'N/A'}</span>

            <span className="text-[var(--muted)]">{t('data.fitness_level')}:</span>
            <span className="font-mono">{mockProfile?.fitness_level ?? 'N/A'}</span>

            <span className="text-[var(--muted)]">{t('data.equipment')}:</span>
            <span>{mockProfile?.available_equipment.join(', ') || 'bodyweight'}</span>

            <span className="text-[var(--muted)]">{t('data.priorities')}:</span>
            <span>{mockProfile?.physique_priorities.join(', ') || 'chest, back'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleExportJson}
            className="touch-target w-full py-3 px-4 rounded-[var(--radius-md)] bg-[var(--surface-2)] text-[var(--text)] font-semibold text-sm border border-neutral-800 transition-motion active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>📥</span> {t('data.export_btn')}
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="touch-target w-full py-3 px-4 rounded-[var(--radius-md)] bg-rose-950/60 text-[var(--danger)] font-semibold text-sm border border-rose-900 transition-motion active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>⚠️</span> {t('data.reset_btn')}
          </button>
        </div>

        {/* Reset Confirmation Dialog */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[var(--surface)] border border-neutral-800 p-6 rounded-[var(--radius-lg)] max-w-sm w-full flex flex-col gap-4">
              <h3 className="font-bold text-lg text-white">{t('data.reset_confirm_title')}</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t('data.reset_confirm_desc')}
              </p>
              <div className="flex gap-3 justify-end mt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="touch-target px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--muted)] text-sm cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="touch-target px-4 py-2 rounded-[var(--radius-sm)] bg-[var(--danger)] text-black font-bold text-sm cursor-pointer"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. About & Diagnostics sub-view
  if (subView === 'about') {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSubView('menu')}
            className="touch-target p-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text)] transition-motion active:scale-95 cursor-pointer"
          >
            ← {t('common.close')}
          </button>
          <h2 className="text-xl font-bold">{t('about.title')}</h2>
        </div>

        {/* Update Banner */}
        <UpdateBanner />

        <div className="bg-[var(--surface)] p-5 rounded-[var(--radius-lg)] border border-neutral-800/80 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--accent)] uppercase tracking-wider mb-1">
            System Status
          </h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
            <span className="text-[var(--muted)]">{t('about.version')}:</span>
            <span className="font-mono font-medium">0.1.0 (Milestone 1-A)</span>

            <span className="text-[var(--muted)]">{t('about.commit')}:</span>
            <span className="font-mono text-neutral-300">
              {import.meta.env.CF_PAGES_COMMIT_SHA || 'dev'}
            </span>

            <span className="text-[var(--muted)]">{t('about.online')}:</span>
            <span className={isOnline ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}>
              {isOnline ? t('about.online_true') : t('about.online_false')}
            </span>

            <span className="text-[var(--muted)]">{t('about.standalone')}:</span>
            <span>{isStandalone ? t('about.standalone_true') : t('about.standalone_false')}</span>

            <span className="text-[var(--muted)]">{t('about.sw_state')}:</span>
            <span className="font-mono">{swState}</span>

            <span className="text-[var(--muted)]">{t('about.storage_persisted')}:</span>
            <span className={persisted ? 'text-[var(--ok)]' : 'text-[var(--muted)]'}>
              {persisted ? t('common.yes') : t('common.no')}
            </span>

            <span className="text-[var(--muted)]">{t('about.events_count')}:</span>
            <span className="font-mono">{eventCount}</span>

            <span className="text-[var(--muted)]">{t('about.config_keys')}:</span>
            <span className="font-mono">{configKeyCount} keys</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Default Menu view
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{t('more.title')}</h2>
        {/* Permanent small MOCK USER badge */}
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-widest bg-amber-950/80 text-amber-400 border border-amber-800/80 uppercase">
          {t('common.mock_user_badge')}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => setSubView('settings')}
          className="touch-target w-full bg-[var(--surface)] hover:bg-[var(--surface-2)] p-4 rounded-[var(--radius-md)] border border-neutral-800 text-left flex items-center justify-between transition-motion active:scale-98 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">⚙️</span>
            <span className="font-medium text-sm">{t('more.item_settings')}</span>
          </div>
          <span className="text-[var(--muted)]">›</span>
        </button>

        <button
          onClick={() => setSubView('data')}
          className="touch-target w-full bg-[var(--surface)] hover:bg-[var(--surface-2)] p-4 rounded-[var(--radius-md)] border border-neutral-800 text-left flex items-center justify-between transition-motion active:scale-98 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">💾</span>
            <span className="font-medium text-sm">{t('more.item_data')}</span>
          </div>
          <span className="text-[var(--muted)]">›</span>
        </button>

        <button
          onClick={() => setSubView('about')}
          className="touch-target w-full bg-[var(--surface)] hover:bg-[var(--surface-2)] p-4 rounded-[var(--radius-md)] border border-neutral-800 text-left flex items-center justify-between transition-motion active:scale-98 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">ℹ️</span>
            <span className="font-medium text-sm">{t('more.item_about')}</span>
          </div>
          <span className="text-[var(--muted)]">›</span>
        </button>
      </div>
    </div>
  );
};
