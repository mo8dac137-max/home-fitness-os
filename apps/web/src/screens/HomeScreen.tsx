import React from 'react';
import { t } from '../i18n/index.js';

export const HomeScreen: React.FC = () => {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{t('home.title')}</h2>
        <span className="px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--accent)] font-mono text-xs border border-neutral-800 font-semibold">
          {t('home.stat_today')}: {t('home.stat_status')}
        </span>
      </div>

      <div className="bg-[var(--surface)] p-6 rounded-[var(--radius-lg)] border border-neutral-800/80 flex flex-col items-center justify-center text-center gap-3 py-12">
        <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xl mb-1 text-[var(--accent)]">
          🗓️
        </div>
        <h3 className="font-semibold text-lg text-white">{t('home.empty_title')}</h3>
        <p className="text-sm text-[var(--muted)] max-w-xs leading-relaxed">
          {t('home.empty_desc')}
        </p>
      </div>
    </div>
  );
};
