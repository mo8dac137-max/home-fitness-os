import React from 'react';
import { t } from '../i18n/index.js';

interface LogoIntroProps {
  onComplete: () => void;
  isFirstEver: boolean;
}

export const LogoIntro: React.FC<LogoIntroProps> = ({ onComplete, isFirstEver }) => {
  return (
    <div
      onClick={onComplete}
      className="fixed inset-0 z-50 bg-[#0b0b0b] flex flex-col items-center justify-center p-6 cursor-pointer select-none transition-motion"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        {/* SVG Logo: Minimalist geometric barbell / kinetic hexagon */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-motion animate-pulse"
        >
          <circle cx="50" cy="50" r="44" stroke="#c6f432" strokeWidth="4" strokeDasharray="6 4" />
          <path
            d="M30 50H70M24 38V62M76 38V62M36 32V68M64 32V68"
            stroke="#ececec"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>

        <h1 className="text-2xl font-bold tracking-tight text-white mt-2">
          HOME FITNESS OS
        </h1>
        <p className="text-xs text-[var(--muted)] tracking-widest uppercase">
          {t('intro.tagline')}
        </p>

        {isFirstEver && (
          <span className="mt-8 text-[11px] text-[var(--muted)] bg-[var(--surface-2)] px-3 py-1.5 rounded-full border border-neutral-800">
            {t('intro.skip')}
          </span>
        )}
      </div>
    </div>
  );
};
