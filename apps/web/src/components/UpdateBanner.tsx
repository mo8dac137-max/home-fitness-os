import React, { useEffect, useState } from 'react';
import { t } from '../i18n/index.js';

interface UpdateBannerProps {
  onDismiss?: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({ onDismiss }) => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    // Check if virtual:pwa-register is available or serviceWorker registered
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      import('virtual:pwa-register')
        .then(({ registerSW }) => {
          const update = registerSW({
            onNeedRefresh() {
              setNeedRefresh(true);
            },
            onOfflineReady() {
              // App ready to work offline
            },
          });
          setUpdateSW(() => update);
        })
        .catch(() => {
          // In dev or non-pwa context, pwa-register may not be present
        });
    }
  }, []);

  if (!needRefresh) {
    return null;
  }

  const handleApply = async () => {
    if (updateSW) {
      await updateSW();
    }
    setNeedRefresh(false);
    if (onDismiss) onDismiss();
  };

  return (
    <div
      role="alert"
      className="w-full bg-[var(--surface-2)] border border-[var(--accent)] text-[var(--text)] px-4 py-3 rounded-[var(--radius-md)] flex items-center justify-between gap-3 shadow-lg"
    >
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="text-sm font-medium">{t('update.banner_title')}</span>
      </div>
      <button
        onClick={handleApply}
        className="touch-target px-4 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--accent-ink)] font-semibold text-xs tracking-wider uppercase transition-motion active:scale-95 cursor-pointer"
      >
        {t('update.apply_btn')}
      </button>
    </div>
  );
};
