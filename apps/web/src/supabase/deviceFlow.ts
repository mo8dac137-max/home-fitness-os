import {
  enrollCurrentDevice,
  fetchDeviceStatus,
  recoverDevice,
  verifyCurrentDevice,
  type DeviceAuthOptions,
  type EnrollOutcome,
} from './deviceAuthClient.js';
import type { SupabaseEnvConfig } from './env.js';
import type { DeviceKeyStore } from './deviceKeyStore.js';

/**
 * Device flow orchestrator (Phase 4D2).
 *
 * Turns the Phase 4C primitives (enroll / challenge→sign→verify / recover)
 * into one idempotent state machine the UI can drive with a single call:
 *
 *   verified            → device session is live, RLS gate open
 *   enrolled            → a NEW device was just enrolled; recovery codes must
 *                         be shown once, then verified immediately after
 *   recovery_required   → a device exists server-side that this browser does
 *                         not control (or whose local key pair no longer
 *                         matches) — the user must supply a recovery code
 *
 * Every outcome is data, never an exception. Server error codes pass through
 * verbatim on the `error` variants.
 */

export type DeviceFlowState =
  | { kind: 'verified'; device_id: string }
  | { kind: 'enrolled'; outcome: EnrollOutcome }
  | { kind: 'recovery_required'; reason: string }
  | { kind: 'error'; code: string; message: string };

export interface DeviceFlowOptions extends DeviceAuthOptions {
  /** Label stored with the enrolled device (device model / browser hint). */
  label?: string;
}

/**
 * Runs the device flow for a signed-in user:
 * 1. `status` — already verified? done.
 * 2. no active device → enroll (reusing any orphaned local key pair) and
 *    immediately verify; the one-time recovery codes ride on the result.
 * 3. active device present → verify with the local key pair; if the server
 *    rejects (revoked device, signature mismatch, or this browser simply has
 *    no record), recovery is required.
 */
export async function runDeviceFlow(
  config: SupabaseEnvConfig,
  accessToken: string,
  deviceStore: DeviceKeyStore,
  options: DeviceFlowOptions = {},
): Promise<DeviceFlowState> {
  const status = await fetchDeviceStatus(config, accessToken, options);
  if (!status.ok) {
    return { kind: 'error', code: status.code, message: status.message };
  }

  if (status.data.session_verified) {
    const deviceId = await deviceStore.load().then((r) => r?.device_id ?? null);
    if (deviceId !== null) {
      return { kind: 'verified', device_id: deviceId };
    }
    // Server says verified but this browser lost its record: re-verify below
    // will fail honestly; treat as recovery.
    return { kind: 'recovery_required', reason: 'local_record_missing' };
  }

  if (status.data.active_devices === 0) {
    const enroll = await enrollCurrentDevice(
      config,
      accessToken,
      deviceStore,
      options.label ?? 'device',
      options,
    );
    if (!enroll.ok) {
      return { kind: 'error', code: enroll.code, message: enroll.message };
    }
    if (enroll.data.status === 'already') {
      // Raced with another tab; verify to converge.
      return verifyOrRecovery(config, accessToken, deviceStore, options, 'raced_enroll');
    }

    const verify = await verifyCurrentDevice(config, accessToken, deviceStore, options);
    if (!verify.ok) {
      return { kind: 'error', code: verify.code, message: verify.message };
    }
    return { kind: 'enrolled', outcome: enroll.data };
  }

  return verifyOrRecovery(config, accessToken, deviceStore, options, 'device_exists');
}

/**
 * Consumes a one-time recovery code: revokes everything server-side, enrolls
 * a fresh key pair, verifies, and returns the NEW one-time recovery codes.
 */
export async function submitDeviceRecovery(
  config: SupabaseEnvConfig,
  accessToken: string,
  deviceStore: DeviceKeyStore,
  recoveryCode: string,
  options: DeviceFlowOptions = {},
): Promise<DeviceFlowState> {
  const recover = await recoverDevice(
    config,
    accessToken,
    deviceStore,
    recoveryCode,
    options.label ?? 'device',
    options,
  );
  if (!recover.ok) {
    return { kind: 'error', code: recover.code, message: recover.message };
  }
  const verify = await verifyCurrentDevice(config, accessToken, deviceStore, options);
  if (!verify.ok) {
    return { kind: 'error', code: verify.code, message: verify.message };
  }
  return { kind: 'enrolled', outcome: recover.data };
}

async function verifyOrRecovery(
  config: SupabaseEnvConfig,
  accessToken: string,
  deviceStore: DeviceKeyStore,
  options: DeviceFlowOptions,
  missingRecordReason: string,
): Promise<DeviceFlowState> {
  const record = await deviceStore.load();
  if (!record || record.device_id === null) {
    return { kind: 'recovery_required', reason: missingRecordReason };
  }

  const verify = await verifyCurrentDevice(config, accessToken, deviceStore, options);
  if (verify.ok) {
    return { kind: 'verified', device_id: verify.data.device_id };
  }

  // The device exists server-side but this browser cannot prove possession:
  // revoked device, corrupted local key, stale challenge, bad signature…
  return { kind: 'recovery_required', reason: verify.code };
}
