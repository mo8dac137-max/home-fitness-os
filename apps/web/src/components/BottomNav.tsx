import React from 'react';
import { t } from '../i18n/index.js';

export type TabKey = 'home' | 'train' | 'progress' | 'more';

interface BottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

const TABS: Array<{ key: TabKey; icon: string; labelKey: 'nav.home' | 'nav.train' | 'nav.progress' | 'nav.more' }> = [
  { key: 'home', icon: '🏠', labelKey: 'nav.home' },
  { key: 'train', icon: '⚡', labelKey: 'nav.train' },
  { key: 'progress', icon: '📊', labelKey: 'nav.progress' },
  { key: 'more', icon: '⚙️', labelKey: 'nav.more' },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      role="navigation"
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)] border-t border-neutral-800/80 safe-bottom safe-left safe-right"
    >
      <div className="grid grid-cols-4 max-w-lg mx-auto h-[64px] items-center">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`touch-target flex flex-col items-center justify-center gap-1 transition-motion cursor-pointer select-none ${
                isActive
                  ? 'text-[var(--accent)] font-semibold scale-105'
                  : 'text-[var(--muted)] hover:text-white'
              }`}
            >
              <span className="text-lg leading-none" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="text-[11px] tracking-tight">
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
