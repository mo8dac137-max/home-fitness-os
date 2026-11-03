import React, { useState } from 'react';
import { t } from '../i18n/index.js';
import { ClayCard } from './ClayCard.js';
import { ClayButton } from './ClayButton.js';
import type { CloudSessionHandle } from '../cloud/useCloudSession.js';

/**
 * Cloud account card (Phase 4D2, shown under More › About).
 *
 * The honest account surface: sign in, device verification/recovery, and
 * one-tap sync — all inline, never blocking the rest of the app. Every state
 * (including failures) is reported through i18n with real server codes.
 */

const INPUT_CLASS =
  'w-full clay-input p-3 text-xs text-white rounded-xl border border-white/10 bg-black/30 placeholder:text-neutral-500 outline-none';

function authErrorCopy(code: string): string {
  switch (code) {
    case 'invalid_credentials':
      return t('account.error_invalid_credentials');
    case 'network_error':
      return t('account.error_network');
    case 'timeout':
      return t('account.error_timeout');
    case 'signed_out':
      return t('account.error_session_expired');
    default:
      return t('account.error_default').replace('{code}', code);
  }
}

/** Phase 4D4: wall-clock label for the last finished sync round (HH:mm). */
function formatClock(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

/** Phase 4D5: short local timestamp for a device's last_seen_at. */
function formatSeen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '--';
  }
}

/** Phase 4D6: local date for a device's created_at (no invented values). */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleDateString([], { dateStyle: 'medium' });
  } catch {
    return '--';
  }
}

export const CloudAccountCard: React.FC<{ cloud: CloudSessionHandle }> = ({ cloud }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [confirmDeauth, setConfirmDeauth] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  // Phase 4D9: the revoked-device history is collapsed by default — it is
  // an audit trail, not a primary control.
  const [showRevoked, setShowRevoked] = useState(false);

  const handleSignIn = (e: React.FormEvent): void => {
    e.preventDefault();
    if (email.trim() === '' || password === '' || cloud.busy) return;
    void cloud.signIn(email, password);
  };

  const handleRecovery = (e: React.FormEvent): void => {
    e.preventDefault();
    if (recoveryCode.trim() === '' || cloud.busy) return;
    void cloud.submitRecoveryCode(recoveryCode);
    setRecoveryCode('');
  };

  // Phase 4D3: two-step confirm — the first tap only shows the honest hint.
  const handleDeauthorize = (): void => {
    if (cloud.busy) return;
    void cloud.deauthorize().finally(() => setConfirmDeauth(false));
  };

  return (
    <ClayCard variant="hero" className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-[var(--accent)] uppercase tracking-wider mb-1">
        {t('account.title')}
      </h3>

      {/* ── not configured / restoring ─────────────────────────────────── */}
      {cloud.stage === 'checking' && (
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {t('sync.status_checking')}
        </p>
      )}

      {cloud.stage !== 'checking' && !cloud.configured && (
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {t('account.cloud_not_configured')}
        </p>
      )}

      {/* ── signed out: inline sign-in form ────────────────────────────── */}
      {cloud.configured && cloud.stage === 'signed_out' && (
        <form onSubmit={handleSignIn} className="flex flex-col gap-2.5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('account.email_label')}
            aria-label={t('account.email_label')}
            autoComplete="email"
            className={INPUT_CLASS}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('account.password_label')}
            aria-label={t('account.password_label')}
            autoComplete="current-password"
            className={INPUT_CLASS}
          />
          {cloud.authError !== null && (
            <p className="text-xs text-[var(--danger)] font-bold" role="alert">
              {authErrorCopy(cloud.authError)}
            </p>
          )}
          <ClayButton type="submit" disabled={cloud.busy} className="w-full">
            {cloud.busy ? t('account.signing_in') : t('account.sign_in')}
          </ClayButton>
        </form>
      )}

      {/* ── device flow in progress / failed ───────────────────────────── */}
      {cloud.configured && cloud.stage === 'device_flow' && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {t('account.device_checking')}
          </p>
          {cloud.deviceError !== null && (
            <>
              <p className="text-xs text-[var(--danger)] font-bold" role="alert">
                {t('account.device_error').replace('{code}', cloud.deviceError)}
              </p>
              <ClayButton
                variant="secondary"
                disabled={cloud.busy}
                onClick={() => void cloud.retryDeviceFlow()}
                className="w-full"
              >
                {t('account.device_retry')}
              </ClayButton>
            </>
          )}
        </div>
      )}

      {/* ── recovery required ──────────────────────────────────────────── */}
      {cloud.configured && cloud.stage === 'recovery' && (
        <form onSubmit={handleRecovery} className="flex flex-col gap-2.5">
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {t('account.recovery_required_hint')}
          </p>
          <input
            type="text"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder={t('account.recovery_code_label')}
            aria-label={t('account.recovery_code_label')}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`${INPUT_CLASS} ltr-num text-start font-mono`}
          />
          {cloud.deviceError !== null && (
            <p className="text-xs text-[var(--danger)] font-bold" role="alert">
              {t('account.device_error').replace('{code}', cloud.deviceError)}
            </p>
          )}
          <ClayButton type="submit" disabled={cloud.busy} className="w-full">
            {t('account.recovery_submit')}
          </ClayButton>
        </form>
      )}

      {/* ── ready: verified device + sync ──────────────────────────────── */}
      {cloud.configured && cloud.stage === 'ready' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--ok)] shrink-0" />
              <span className="text-xs text-[var(--ok)] font-bold">
                {t('account.device_verified')}
              </span>
            </div>
            {cloud.email !== null && cloud.email !== '' && (
              <span className="text-xs text-[var(--muted)] truncate" dir="ltr">
                {cloud.email}
              </span>
            )}
          </div>

          {/* Phase 4D4/4D5/4D6: honest device/sync facts. With contract v2
              the server's per-device rows lead (label + added when + last
              seen + this-device chip + per-row revoke); without them the
              card falls back to the bare count and the local short id.
              Each line renders only when its fact is actually known. */}
          {cloud.deviceRows !== null && cloud.deviceRows.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {cloud.deviceRows.map((row) => {
                const isCurrent = cloud.deviceId !== null && row.device_id === cloud.deviceId;
                const facts: string[] = [];
                if (row.created_at !== null) {
                  facts.push(t('account.device_added').replace('{date}', formatDate(row.created_at)));
                }
                facts.push(
                  row.last_seen_at !== null
                    ? t('account.device_last_seen').replace('{time}', formatSeen(row.last_seen_at))
                    : t('account.device_never_seen'),
                );
                return (
                  <li
                    key={row.device_id}
                    className="flex flex-col gap-1 min-w-0 border-b border-white/5 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-[10px] text-white/90 truncate" dir="ltr">
                        {row.label}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {isCurrent && (
                          <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-wide">
                            {t('account.device_row_current')}
                          </span>
                        )}
                        <button
                          type="button"
                          disabled={cloud.busy}
                          onClick={() => {
                            if (isCurrent) {
                              setConfirmDeauth(true); // full local break (4D3 flow)
                            } else {
                              setConfirmRevokeId(row.device_id);
                            }
                          }}
                          className="text-[9px] font-bold uppercase tracking-wide text-[var(--muted)] hover:text-[var(--danger)] disabled:opacity-50 cursor-pointer"
                        >
                          {t('account.device_revoke')}
                        </button>
                      </span>
                    </div>
                    <span className="text-[9px] text-[var(--muted)] ltr-num truncate">
                      {facts.join(' · ')}
                    </span>
                    {confirmRevokeId === row.device_id && (
                      <div className="flex flex-col gap-1.5 pt-0.5">
                        <p className="text-[10px] text-[var(--yellow)] leading-relaxed">
                          {t('account.device_revoke_hint')}
                        </p>
                        <div className="flex gap-2">
                          <ClayButton
                            variant="secondary"
                            disabled={cloud.busy}
                            onClick={() => {
                              void cloud.revokeDevice(row.device_id).finally(() => setConfirmRevokeId(null));
                            }}
                            className="flex-1"
                          >
                            {t('account.device_revoke_confirm')}
                          </ClayButton>
                          <ClayButton
                            variant="ghost"
                            disabled={cloud.busy}
                            onClick={() => setConfirmRevokeId(null)}
                            className="flex-1"
                          >
                            {t('account.cancel')}
                          </ClayButton>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            (cloud.activeDevices !== null || cloud.deviceId !== null) && (
              <div className="flex flex-col gap-1">
                {cloud.activeDevices !== null && (
                  <p className="text-[10px] text-[var(--muted)] ltr-num">
                    {t('account.active_devices').replace('{count}', String(cloud.activeDevices))}
                  </p>
                )}
                {cloud.deviceId !== null && (
                  <p
                    className="text-[10px] text-[var(--muted)] ltr-num font-mono truncate"
                    dir="ltr"
                    title={cloud.deviceId}
                  >
                    {t('account.this_device').replace('{id}', cloud.deviceId.slice(0, 8))}
                  </p>
                )}
              </div>
            )
          )}
          {/* Phase 4D9: revoked-device history — a collapsed audit trail under
              the live rows. Renders only when the server actually reported
              revoked devices (older function -> null -> nothing shows), and
              every line renders only when its fact is actually known. */}
          {cloud.revokedRows !== null && cloud.revokedRows.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowRevoked((v) => !v)}
                className="flex items-center justify-between gap-2 w-full cursor-pointer"
                aria-expanded={showRevoked}
              >
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wide">
                  {t('account.revoked_devices_title').replace('{count}', String(cloud.revokedRows.length))}
                </span>
                <span className="text-[10px] text-[var(--muted)]" aria-hidden>
                  {showRevoked ? '−' : '+'}
                </span>
              </button>
              {showRevoked && (
                <ul className="flex flex-col gap-1">
                  {cloud.revokedRows.map((row) => (
                    <li
                      key={row.device_id}
                      className="flex items-center justify-between gap-2 min-w-0"
                    >
                      <span className="text-[10px] text-[var(--muted)] truncate" dir="ltr">
                        {row.label}
                      </span>
                      <span className="text-[9px] text-[var(--muted)] ltr-num shrink-0">
                        {row.revoked_at !== null
                          ? t('account.device_revoked_when').replace('{date}', formatDate(row.revoked_at))
                          : '--'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {cloud.lastSyncAt !== null && (
            <p className="text-[10px] text-[var(--muted)] ltr-num">
              {t('account.last_sync').replace('{time}', formatClock(cloud.lastSyncAt))}
            </p>
          )}

          {cloud.revokeError !== null && (
            <p className="text-[10px] text-[var(--danger)] font-bold" role="alert">
              {t('account.device_revoke_failed').replace('{code}', cloud.revokeError)}
            </p>
          )}

          <ClayButton
            variant="secondary"
            disabled={cloud.syncBusy}
            onClick={() => void cloud.sync()}
            className="w-full"
          >
            {cloud.syncBusy ? t('account.syncing') : t('account.sync_now')}
          </ClayButton>

          {cloud.lastSync !== null &&
            (cloud.lastSync.ok ? (
              <p className="text-[10px] text-[var(--muted)] ltr-num">
                {t('account.sync_result')
                  .replace('{pushed}', String(cloud.lastSync.pushed))
                  .replace('{merged}', String(cloud.lastSync.merged))}
              </p>
            ) : (
              <p className="text-[10px] text-[var(--danger)]">
                {t('account.sync_failed')}
              </p>
            ))}

          <button
            onClick={() => void cloud.signOut()}
            className="text-xs text-[var(--muted)] hover:text-white cursor-pointer text-start"
          >
            {t('account.sign_out')}
          </button>

          {cloud.deviceError !== null && (
            <p className="text-xs text-[var(--danger)] font-bold" role="alert">
              {t('account.deauthorize_failed').replace('{code}', cloud.deviceError)}
            </p>
          )}

          {confirmDeauth ? (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
              <p className="text-xs text-[var(--yellow)] leading-relaxed">
                {t('account.deauthorize_hint')}
              </p>
              <div className="flex gap-2">
                <ClayButton
                  variant="secondary"
                  disabled={cloud.busy}
                  onClick={handleDeauthorize}
                  className="flex-1"
                >
                  {t('account.deauthorize_confirm')}
                </ClayButton>
                <ClayButton
                  variant="ghost"
                  disabled={cloud.busy}
                  onClick={() => setConfirmDeauth(false)}
                  className="flex-1"
                >
                  {t('account.cancel')}
                </ClayButton>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeauth(true)}
              disabled={cloud.busy}
              className="text-xs text-[var(--muted)] hover:text-white cursor-pointer text-start"
            >
              {t('account.deauthorize')}
            </button>
          )}
        </div>
      )}

      {/* ── one-time recovery codes (overlay section inside the card) ──── */}
      {cloud.recoveryCodes !== null && (
        <div className="mt-1 pt-3 border-t border-white/10 flex flex-col gap-2">
          <p className="text-xs font-bold text-[var(--yellow)]">
            {t('account.recovery_codes_title')}
          </p>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            {t('account.recovery_codes_hint')}
          </p>
          <ul className="flex flex-col gap-1" dir="ltr">
            {cloud.recoveryCodes.map((code) => (
              <li key={code} className="text-xs font-mono ltr-num text-white text-start">
                {code}
              </li>
            ))}
          </ul>
          <ClayButton
            variant="secondary"
            onClick={cloud.dismissRecoveryCodes}
            className="w-full"
          >
            {t('account.recovery_codes_done')}
          </ClayButton>
        </div>
      )}
    </ClayCard>
  );
};
