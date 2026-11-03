-- Phase 4D3: housekeeping for the M0-15 device-auth tables.
-- Expired challenges and lapsed device sessions would otherwise accumulate
-- forever; this job removes only rows that are already invisible to the
-- engine:
--   * device_challenges with expires_at in the past — verify() refuses them;
--   * device_sessions with expires_at in the past — device_session_valid()
--     already treats them as invalid.
-- Authoritative rows are never touched:
--   * authorized_devices — explicit revocation is user-owned state;
--   * recovery_codes — used codes must keep existing so reuse attempts keep
--     failing, and they are the audit trail for every recovery.
--
-- Owner action: run in the Supabase SQL editor (same as M0-15 and 4D1),
-- then optionally schedule it daily with pg_cron (see the bottom).

create index if not exists device_challenges_expires_at_idx
  on public.device_challenges (expires_at);
create index if not exists device_sessions_expires_at_idx
  on public.device_sessions (expires_at);

create or replace function public.p4d3_cleanup_expired_device_auth()
returns table (challenges_deleted bigint, sessions_deleted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  challenges bigint;
  sessions bigint;
begin
  delete from public.device_challenges where expires_at < now();
  get diagnostics challenges = row_count;

  delete from public.device_sessions where expires_at < now();
  get diagnostics sessions = row_count;

  return query select challenges, sessions;
end;
$$;

-- the cleanup function is for the owner / scheduler, not for API roles
revoke all on function public.p4d3_cleanup_expired_device_auth()
  from public, anon, authenticated;

-- Manual one-off:
--   select * from public.p4d3_cleanup_expired_device_auth();
--
-- Optional daily schedule (only if pg_cron is enabled on the project):
--   select cron.schedule(
--     'p4d3-cleanup-expired-device-auth',
--     '23 3 * * *',
--     $$ select public.p4d3_cleanup_expired_device_auth(); $$
--   );
