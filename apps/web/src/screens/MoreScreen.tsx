import React, { useEffect, useState } from 'react';
import { t, type Language, type I18nKey } from '../i18n/index.js';
import { KeyValueStore, isStoragePersisted, IndexedDbEventLog } from '../storage/index.js';
import {
  resetMockData,
  KV_KEY_LANGUAGE,
  type MockEnvironmentState,
} from '../bootstrap.js';
import {
  type AppearanceSettings,
  saveAppearance,
} from '../appearance.js';
import { getEffectiveConfig } from '@hfos/config';
import type { MockUserProfile } from '@hfos/sim';
import { UpdateBanner } from '../components/UpdateBanner.js';
import { CloudSyncCard } from '../components/CloudSyncCard.js';
import { CloudAccountCard } from '../components/CloudAccountCard.js';
import type { CloudSessionHandle } from '../cloud/useCloudSession.js';
import { ClayCard } from '../components/ClayCard.js';
import { ClayButton } from '../components/ClayButton.js';
import { Icon } from '../components/IconSet.js';
import { AppearanceLab } from './AppearanceLab.js';

interface MoreScreenProps {
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  mockProfile: MockUserProfile | null;
  onProfileUpdated: () => void;
  appearance: AppearanceSettings;
  onAppearanceChange: (settings: AppearanceSettings) => void;
  cloud?: CloudSessionHandle | null;
}

type MoreSubView = 'menu' | 'settings' | 'appearance' | 'equipment' | 'data' | 'about';

export const MoreScreen: React.FC<MoreScreenProps> = ({
  currentLang,
  onLanguageChange,
  mockProfile,
  onProfileUpdated,
  appearance,
  onAppearanceChange,
  cloud = null,
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
  const [planGenDuration, setPlanGenDuration] = useState<number | null>(null);

  // Data reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Environment state for Equipment screen
  const [envState, setEnvState] = useState<MockEnvironmentState | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalonePwa =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandalonePwa);

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
      isStoragePersisted().then(setPersisted);
      new IndexedDbEventLog().count().then(setEventCount);

      try {
        const config = getEffectiveConfig();
        setConfigKeyCount(Object.keys(config).length);
      } catch {
        setConfigKeyCount(0);
      }

      new KeyValueStore().get<number>('plan.last_gen_duration_ms').then(setPlanGenDuration);

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

    if (subView === 'data' || subView === 'equipment') {
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

  const handleAppearanceUpdate = async (newSettings: AppearanceSettings) => {
    onAppearanceChange(newSettings);
    await saveAppearance(newSettings);
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
      <div className="flex flex-col gap-5 animate-screen-enter pb-10">
        <div className="flex items-center gap-3 px-1">
          <button
            onClick={() => setSubView('menu')}
            className="touch-target p-2 rounded-[var(--radius-chip)] clay-sm text-white cursor-pointer active:scale-95"
          >
            <span className="icon-directional">←</span> {t('common.close')}
          </button>
          <h2 className="text-xl font-black text-white">{t('settings.title')}</h2>
        </div>

        <ClayCard variant="hero" className="flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-base text-white">{t('settings.language_label')}</h3>
            <p className="text-xs text-[var(--muted)] mt-1">{t('settings.language_desc')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleLanguageSelect('en')}
              className={`touch-target px-4 py-3 rounded-[var(--radius-chip)] border text-sm font-bold transition-motion cursor-pointer ${
                currentLang === 'en'
                  ? 'border-[var(--accent)] bg-white/10 text-[var(--accent)] shadow-md'
                  : 'border-white/5 bg-[var(--surface-flat)] text-[var(--muted)]'
              }`}
            >
              {t('settings.en')}
            </button>
            <button
              onClick={() => handleLanguageSelect('ar')}
              className={`touch-target px-4 py-3 rounded-[var(--radius-chip)] border text-sm font-bold transition-motion cursor-pointer ${
                currentLang === 'ar'
                  ? 'border-[var(--accent)] bg-white/10 text-[var(--accent)] shadow-md'
                  : 'border-white/5 bg-[var(--surface-flat)] text-[var(--muted)]'
              }`}
            >
              {t('settings.ar')}
            </button>
          </div>
        </ClayCard>

        <ClayCard variant="hero" className="flex flex-col gap-2">
          <h3 className="font-bold text-base text-white">{t('settings.theme_label')}</h3>
          <p className="text-xs text-[var(--muted)]">{t('settings.theme_value')}</p>
        </ClayCard>
      </div>
    );
  }

  // 2. Appearance Lab sub-view
  if (subView === 'appearance') {
    return (
      <AppearanceLab
        settings={appearance}
        onChange={handleAppearanceUpdate}
        onClose={() => setSubView('menu')}
      />
    );
  }

  // 3. Equipment sub-view
  if (subView === 'equipment') {
    return (
      <div className="flex flex-col gap-5 animate-screen-enter pb-10">
        <div className="flex items-center gap-3 px-1">
          <button
            onClick={() => setSubView('menu')}
            className="touch-target p-2 rounded-[var(--radius-chip)] clay-sm text-white cursor-pointer active:scale-95"
          >
            <span className="icon-directional">←</span> {t('common.close')}
          </button>
          <h2 className="text-xl font-black text-white">{t('equipment.title')}</h2>
        </div>

        <ClayCard variant="hero" className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {t('equipment.section_title')}
          </h3>
          <p className="text-xs text-[var(--muted)]">
            {t('equipment.desc')}
          </p>

          <div className="flex flex-col gap-2 pt-2">
            {[
              { id: 'floor', labelKey: 'equipment.floor', status: 'validated' },
              { id: 'wall', labelKey: 'equipment.wall', status: 'validated' },
              { id: 'door', labelKey: 'equipment.door', status: 'declared' },
              { id: 'chair', labelKey: 'equipment.chair', status: 'declared' },
              { id: 'table', labelKey: 'equipment.table', status: 'unknown' },
            ].map((item) => (
              <div
                key={item.id}
                className="clay-sm p-3.5 flex items-center justify-between border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      item.status === 'validated'
                        ? 'bg-[var(--ok)]'
                        : item.status === 'declared'
                        ? 'bg-[var(--yellow)]'
                        : 'bg-white/20'
                    }`}
                  />
                  <span className="font-bold text-sm text-white">{t(item.labelKey as I18nKey)}</span>
                </div>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-[var(--muted)]">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </ClayCard>
      </div>
    );
  }

  // 4. Data management sub-view
  if (subView === 'data') {
    return (
      <div className="flex flex-col gap-5 animate-screen-enter pb-10">
        <div className="flex items-center gap-3 px-1">
          <button
            onClick={() => setSubView('menu')}
            className="touch-target p-2 rounded-[var(--radius-chip)] clay-sm text-white cursor-pointer active:scale-95"
          >
            <span className="icon-directional">←</span> {t('common.close')}
          </button>
          <h2 className="text-xl font-black text-white">{t('data.title')}</h2>
        </div>

        {resetMessage && (
          <div className="clay-sm bg-emerald-950/80 border border-emerald-700 text-emerald-300 p-3.5 text-xs font-semibold">
            {resetMessage}
          </div>
        )}

        {/* Profile Card */}
        <ClayCard variant="hero" className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[var(--accent)] uppercase tracking-wider">
            {t('data.user_profile')}
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <span className="text-[var(--muted)]">{t('data.user_id')}:</span>
            <span className="font-mono truncate text-white">{mockProfile?.id ?? 'N/A'}</span>

            <span className="text-[var(--muted)]">{t('data.codename')}:</span>
            <span className="font-mono font-medium text-white">{mockProfile?.codename ?? 'N/A'}</span>

            <span className="text-[var(--muted)]">{t('data.fitness_level')}:</span>
            <span className="font-mono text-white">{mockProfile?.fitness_level ?? 'N/A'}</span>

            <span className="text-[var(--muted)]">{t('data.equipment')}:</span>
            <span className="text-white">{mockProfile?.available_equipment.join(', ') || t('train.bodyweight')}</span>

            <span className="text-[var(--muted)]">{t('data.priorities')}:</span>
            <span className="text-white">{mockProfile?.physique_priorities.join(', ') || 'chest, back'}</span>
          </div>
        </ClayCard>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <ClayButton
            variant="secondary"
            onClick={handleExportJson}
            className="w-full text-sm font-bold"
          >
            <span>📥</span>
            <span>{t('data.export_btn')}</span>
          </ClayButton>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="touch-target w-full py-3.5 px-4 rounded-[var(--radius-chip)] bg-rose-950/60 text-[var(--danger)] font-bold text-sm border border-rose-900 transition-motion active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>⚠️</span>
            <span>{t('data.reset_btn')}</span>
          </button>
        </div>

        {/* Reset Confirmation Dialog */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <ClayCard variant="hero" className="max-w-sm w-full flex flex-col gap-4 border border-white/10">
              <h3 className="font-bold text-lg text-white">{t('data.reset_confirm_title')}</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {t('data.reset_confirm_desc')}
              </p>
              <div className="flex gap-3 justify-end mt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="touch-target px-4 py-2 rounded-[var(--radius-chip)] clay-sm text-[var(--muted)] text-sm cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="touch-target px-4 py-2 rounded-[var(--radius-chip)] bg-[var(--danger)] text-black font-bold text-sm cursor-pointer"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </ClayCard>
          </div>
        )}
      </div>
    );
  }

  // 5. About & Diagnostics sub-view
  if (subView === 'about') {
    return (
      <div className="flex flex-col gap-5 animate-screen-enter pb-10">
        <div className="flex items-center gap-3 px-1">
          <button
            onClick={() => setSubView('menu')}
            className="touch-target p-2 rounded-[var(--radius-chip)] clay-sm text-white cursor-pointer active:scale-95"
          >
            <span className="icon-directional">←</span> {t('common.close')}
          </button>
          <h2 className="text-xl font-black text-white">{t('about.title')}</h2>
        </div>

        {/* Update Banner */}
        <UpdateBanner />

        <ClayCard variant="hero" className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[var(--accent)] uppercase tracking-wider mb-1">
            {t('about.system_status')}
          </h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs">
            <span className="text-[var(--muted)]">{t('about.version')}:</span>
            <span className="font-mono font-medium text-white">0.1.0</span>

            <span className="text-[var(--muted)]">{t('about.commit')}:</span>
            <span className="font-mono text-neutral-300">
              {import.meta.env.CF_PAGES_COMMIT_SHA || 'dev'}
            </span>

            <span className="text-[var(--muted)]">{t('about.online')}:</span>
            <span className={isOnline ? 'text-[var(--ok)] font-bold' : 'text-[var(--danger)] font-bold'}>
              {isOnline ? t('about.online_true') : t('about.online_false')}
            </span>

            <span className="text-[var(--muted)]">{t('about.standalone')}:</span>
            <span className="text-white font-medium">
              {isStandalone ? t('about.standalone_true') : t('about.standalone_false')}
            </span>

            <span className="text-[var(--muted)]">{t('about.sw_state')}:</span>
            <span className="font-mono text-white">{swState}</span>

            <span className="text-[var(--muted)]">{t('about.storage_persisted')}:</span>
            <span className={persisted ? 'text-[var(--ok)] font-bold' : 'text-[var(--muted)]'}>
              {persisted ? t('common.yes') : t('common.no')}
            </span>

            <span className="text-[var(--muted)]">{t('about.events_count')}:</span>
            <span className="font-mono text-white">{eventCount}</span>

            <span className="text-[var(--muted)]">{t('about.config_keys')}:</span>
            <span className="font-mono text-white">{configKeyCount} keys</span>

            <span className="text-[var(--muted)]">{t('about.plan_gen_time')}:</span>
            <span className="font-mono text-[var(--accent)] font-bold ltr-num">{planGenDuration ?? '--'} ms</span>
          </div>
        </ClayCard>

        {/* Cloud account + sync status (Phase 4D2 / 4A) */}
        {cloud && <CloudAccountCard cloud={cloud} />}
        <CloudSyncCard />
      </div>
    );
  }

  // 6. Default Grouped Menu view
  return (
    <div className="flex flex-col gap-5 animate-screen-enter pb-10">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-black tracking-tight text-white">{t('more.title')}</h2>
        {/* Permanent small MOCK USER badge */}
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black tracking-widest bg-amber-950/80 text-amber-400 border border-amber-800/80 uppercase">
          {t('common.mock_user_badge')}
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          onClick={() => setSubView('settings')}
          className="clay-sm p-4 w-full flex items-center justify-between text-start cursor-pointer transition-motion active:scale-98 border border-white/5"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--accent)]">
              <Icon name="target" size={18} color="var(--accent)" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">{t('more.item_settings')}</div>
              <div className="text-xs text-[var(--muted)]">{t('more.item_settings_desc')}</div>
            </div>
          </div>
          <span className="text-[var(--muted)] text-lg icon-directional">›</span>
        </button>

        <button
          onClick={() => setSubView('appearance')}
          className="clay-sm p-4 w-full flex items-center justify-between text-start cursor-pointer transition-motion active:scale-98 border border-white/5"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--accent)]">
              <Icon name="flame" size={18} color="var(--accent)" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">{t('more.item_appearance')}</div>
              <div className="text-xs text-[var(--muted)]">{t('more.item_appearance_desc')}</div>
            </div>
          </div>
          <span className="text-[var(--muted)] text-lg icon-directional">›</span>
        </button>

        <button
          onClick={() => setSubView('equipment')}
          className="clay-sm p-4 w-full flex items-center justify-between text-start cursor-pointer transition-motion active:scale-98 border border-white/5"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--teal)]">
              <Icon name="shield" size={18} color="var(--teal)" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">{t('more.item_equipment')}</div>
              <div className="text-xs text-[var(--muted)]">{t('more.item_equipment_desc')}</div>
            </div>
          </div>
          <span className="text-[var(--muted)] text-lg icon-directional">›</span>
        </button>

        <button
          onClick={() => setSubView('data')}
          className="clay-sm p-4 w-full flex items-center justify-between text-start cursor-pointer transition-motion active:scale-98 border border-white/5"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--coral)]">
              <Icon name="chart" size={18} color="var(--coral)" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">{t('more.item_data')}</div>
              <div className="text-xs text-[var(--muted)]">{t('more.item_data_desc')}</div>
            </div>
          </div>
          <span className="text-[var(--muted)] text-lg icon-directional">›</span>
        </button>

        <button
          onClick={() => setSubView('about')}
          className="clay-sm p-4 w-full flex items-center justify-between text-start cursor-pointer transition-motion active:scale-98 border border-white/5"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--cyan)]">
              <Icon name="bolt" size={18} color="var(--cyan)" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">{t('more.item_about')}</div>
              <div className="text-xs text-[var(--muted)]">{t('more.item_about_desc')}</div>
            </div>
          </div>
          <span className="text-[var(--muted)] text-lg icon-directional">›</span>
        </button>
      </div>
    </div>
  );
};
