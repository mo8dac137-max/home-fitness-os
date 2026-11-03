-- Phase 4D5: per-device last-seen tracking for the Account card device list.
-- Applied manually in the Supabase SQL editor (same flow as M0-15).
--
-- The `device-auth` Edge Function (contract v2) reads this column in its
-- `status` action and stamps it in `verify`. The column is nullable on
-- purpose: devices enrolled before this migration simply have no last-seen
-- yet and the UI shows an honest "not seen yet" instead of inventing a time.
--
-- Deployment order is safe either way:
-- - function redeployed BEFORE this SQL: the function's devices query fails
--   (unknown column) and it degrades to the old `{ active_devices,
--   session_verified }` payload;
-- - applied BEFORE redeploy (recommended): rows appear immediately after.
alter table public.authorized_devices
  add column if not exists last_seen_at timestamptz;

-- Optional scheduling note (pg_cron): the 4D3 cleanup migration
-- (20261104000000_p4d3_cleanup_expired_device_auth.sql) already documents
-- how to schedule it once pg_cron availability is confirmed on the project.
