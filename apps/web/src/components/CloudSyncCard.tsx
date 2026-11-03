import React, { useEffect, useState } from 'react';
import { t, type I18nKey } from '../i18n/index.js';
import { ClayCard } from './ClayCard.js';
import { readSupabaseEnv } from '../supabase/env.js';
import { probeCloudConnection, type CloudProbeResult } from '../supabase/probe.js';

type CloudSyncStatus =
  | 'not_configured'
  | 'invalid_config'
  | 'checking'
  | 'online'
  | 'unreachable';

const STATUS_LABEL_KEY: Record<CloudSyncStatus, I18nKey> = {
  not_configured: 'sync.status_not_configured',
  invalid_config: 'sync.status_invalid_config',
  checking: 'sync.status_checking',
  online: 'sync.status_online',
  unreachable: 'sync.status_unreachable',
};

const STATUS_DOT_CLASS: Record<CloudSyncStatus, string> = {
  not_configured: 'bg-white/20',
  invalid_config: 'bg-[var(--danger)]',
  checking: 'bg-[var(--yellow)]',
  online: 'bg-[var(--ok)]',
  unreachable: 'bg-[var(--danger)]',
};

const STATUS_TEXT_CLASS: Record<CloudSyncStatus, string> = {
  not_configured: 'text-[var(--muted)]',
  invalid_config: 'text-[var(--danger)] font-bold',
  checking: 'text-[var(--muted)] font-bold',
  online: 'text-[var(--ok)] font-bold',
  unreachable: 'text-[var(--danger)] font-bold',
};

/**
 * Cloud sync status card (Phase 4A, shown under More › About).
 *
 * Honest diagnostics: reports the real configuration state and probes the
 * configured project's auth health endpoint once per mount. The app remains
 * fully usable offline-first in every state shown here.
 */
export const CloudSyncCard: React.FC = () => {
  const [status, setStatus] = useState<CloudSyncStatus>('checking');
  const [probe, setProbe] = useState<CloudProbeResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const env = readSupabaseEnv();
    if (!env.ok) {
      setStatus(env.reason === 'missing' ? 'not_configured' : 'invalid_config');
      return;
    }

    probeCloudConnection(env.config)
      .then((result) => {
        if (cancelled) return;
        setProbe(result);
        setStatus(result.online ? 'online' : 'unreachable');
      })
      .catch(() => {
        if (!cancelled) setStatus('unreachable');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel = t(STATUS_LABEL_KEY[status]);

  return (
    <ClayCard variant="hero" className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-[var(--accent)] uppercase tracking-wider mb-1">
        {t('sync.title')}
      </h3>
      <p className="text-xs text-[var(--muted)] leading-relaxed">{t('sync.subtitle')}</p>
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT_CLASS[status]}`} />
          <span className={`text-xs ${STATUS_TEXT_CLASS[status]}`}>{statusLabel}</span>
        </div>
        {probe?.latency_ms !== null && probe?.latency_ms !== undefined && (
          <span className="text-[10px] font-mono font-bold text-[var(--muted)] ltr-num">
            {t('sync.latency_ms').replace('{ms}', String(probe.latency_ms))}
          </span>
        )}
      </div>
    </ClayCard>
  );
};
