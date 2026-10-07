import React, { useMemo } from 'react';
import { getEffectiveConfig } from '@hfos/config';

export default function App() {
  const isEngineReady = useMemo(() => {
    try {
      const config = getEffectiveConfig();
      return Boolean(config && typeof config === 'object');
    } catch {
      return false;
    }
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 text-center font-mono">
      <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
        Home Fitness OS
      </h1>
      <p className="text-neutral-400 text-sm mb-4">
        Milestone 0 - engine foundation
      </p>
      {isEngineReady && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Engine ready
        </span>
      )}
    </main>
  );
}
