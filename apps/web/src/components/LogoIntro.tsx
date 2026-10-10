import React, { useEffect, useState } from 'react';
import { t } from '../i18n/index.js';

interface LogoIntroProps {
  onComplete: () => void;
  isFirstEver: boolean;
}

export const LogoIntro: React.FC<LogoIntroProps> = ({ onComplete, isFirstEver }) => {
  const [showHF, setShowHF] = useState(false);
  const [showWordmark, setShowWordmark] = useState(false);

  useEffect(() => {
    // Stage 1: Ring draws (0 - 900ms)
    // Stage 2: "HF" scales/fades in (300ms)
    const t1 = setTimeout(() => setShowHF(true), 300);
    // Stage 3: Wordmark rises (600ms)
    const t2 = setTimeout(() => setShowWordmark(true), 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      onClick={onComplete}
      className="fixed inset-0 z-50 bg-[#0a0a10] flex flex-col items-center justify-center p-6 cursor-pointer select-none transition-motion"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        {/* Kinetic SVG Logo Ring */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg
            width="104"
            height="104"
            viewBox="0 0 100 100"
            className="rotate-[-90deg]"
          >
            {/* Background subtle ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="6"
              fill="none"
            />
            {/* Self-drawing accent ring */}
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              className="animate-draw-ring"
            />
          </svg>

          {/* "HF" monogram scales/fades in */}
          <div
            className={`absolute inset-0 flex items-center justify-center font-black text-3xl font-mono text-white tracking-tighter transition-motion ${
              showHF ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            }`}
            style={{ transitionDuration: '300ms' }}
          >
            HF
          </div>
        </div>

        {/* Wordmark rises */}
        <div
          className={`flex flex-col items-center gap-1.5 transition-motion ${
            showWordmark ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
          style={{ transitionDuration: '400ms' }}
        >
          <h1 className="text-2xl font-black tracking-tight text-white">
            HOME FITNESS OS
          </h1>
          <p className="text-[11px] text-[var(--muted)] tracking-widest uppercase font-semibold">
            {t('intro.tagline')}
          </p>
        </div>

        {isFirstEver && (
          <span className="mt-8 text-[11px] text-[var(--muted)] clay-sm px-3.5 py-1.5 rounded-full border border-white/5">
            {t('intro.skip')}
          </span>
        )}
      </div>
    </div>
  );
};
