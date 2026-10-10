import React from 'react';
import { t } from '../i18n/index.js';
import { Icon, type IconName } from './IconSet.js';

export type TabKey = 'home' | 'train' | 'progress' | 'more';

interface BottomNavProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

interface TabDef {
  key: TabKey;
  icon: IconName;
  labelKey: 'nav.home' | 'nav.train' | 'nav.progress' | 'nav.more';
}

const TABS: TabDef[] = [
  { key: 'home', icon: 'home', labelKey: 'nav.home' },
  { key: 'train', icon: 'dumbbell', labelKey: 'nav.train' },
  { key: 'progress', icon: 'chart', labelKey: 'nav.progress' },
  { key: 'more', icon: 'more', labelKey: 'nav.more' },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const activeIndex = TABS.findIndex((t) => t.key === activeTab);

  return (
    <nav
      role="navigation"
      aria-label="Bottom Navigation"
      className="fixed bottom-3 inset-x-0 z-40 px-4 pointer-events-none safe-bottom"
    >
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="clay-sm px-2 py-2 relative flex items-center justify-between border border-white/10 shadow-2xl bg-[var(--clay-2)]/95">
          {/* Sliding active pill indicator */}
          <div
            className="absolute top-2 bottom-2 w-[calc(25%-6px)] rounded-[var(--radius-chip)] bg-white/10 border border-white/10 transition-transform pointer-events-none"
            style={{
              transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 4}px))`,
              transitionDuration: '180ms',
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />

          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`touch-target z-10 flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer transition-motion select-none ${
                  isActive ? 'text-[var(--accent)] font-bold' : 'text-[var(--muted)] hover:text-white'
                }`}
              >
                <div className={`transition-transform duration-150 ${isActive ? 'scale-110 -translate-y-0.5' : ''}`}>
                  <Icon
                    name={tab.icon}
                    size={20}
                    color={isActive ? 'var(--accent)' : 'var(--muted)'}
                  />
                </div>
                <span className="text-[10px] tracking-wider uppercase font-semibold">
                  {t(tab.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
