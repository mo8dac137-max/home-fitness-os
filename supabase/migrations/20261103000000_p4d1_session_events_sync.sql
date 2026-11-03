-- P4D1 session event sync (Phase 4D1)
-- Append-only, user-scoped cloud mirror of the local event log
-- (EventEnvelope), following the M0-15 security model: RLS is
-- authoritative and a valid device session is required.

create table if not exists public.session_events (
  idempotency_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  type text not null,
  occurred_at timestamptz not null,
  device_id text not null,
  schema_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  supersedes_event_id text,
  synced_at timestamptz not null default now()
);

create index if not exists session_events_user_occurred_idx
  on public.session_events (user_id, occurred_at asc);
create index if not exists session_events_user_type_idx
  on public.session_events (user_id, type);

alter table public.session_events enable row level security;

-- anonymous callers get nothing at all
revoke all on public.session_events from anon;

-- authenticated callers may only insert and select their own rows;
-- there are NO update/delete policies: the table is append-only.
grant select, insert on public.session_events to authenticated;

drop policy if exists session_events_select on public.session_events;
create policy session_events_select on public.session_events for select to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.device_session_valid())
  );

drop policy if exists session_events_insert on public.session_events;
create policy session_events_insert on public.session_events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.device_session_valid())
  );
