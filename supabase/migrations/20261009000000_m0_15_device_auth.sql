-- M0-15 device authorization spike (staging project only)
-- Applied manually in the Supabase SQL editor on fitness-staging.
create table if not exists public.authorized_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'device',
  public_key_jwk jsonb not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create table if not exists public.device_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nonce text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
create table if not exists public.device_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.authorized_devices(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create table if not exists public.recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create table if not exists public.spike_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.authorized_devices enable row level security;
alter table public.device_challenges enable row level security;
alter table public.device_sessions enable row level security;
alter table public.recovery_codes enable row level security;
alter table public.spike_data enable row level security;

-- server-only tables: no policies and no grants for API roles
revoke all on public.authorized_devices, public.device_challenges,
  public.device_sessions, public.recovery_codes from anon, authenticated;
revoke all on public.spike_data from anon;
grant select, insert, update, delete on public.spike_data to authenticated;

create or replace function public.device_session_valid()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.device_sessions s
    join public.authorized_devices d on d.id = s.device_id
    where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.user_id = auth.uid()
      and d.user_id = s.user_id
      and s.revoked_at is null
      and s.expires_at > now()
      and d.revoked_at is null
  );
$$;
revoke all on function public.device_session_valid() from public, anon;
grant execute on function public.device_session_valid() to authenticated;

drop policy if exists spike_select on public.spike_data;
create policy spike_select on public.spike_data for select to authenticated
  using (user_id = (select auth.uid()) and (select public.device_session_valid()));
drop policy if exists spike_insert on public.spike_data;
create policy spike_insert on public.spike_data for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.device_session_valid()));
drop policy if exists spike_update on public.spike_data;
create policy spike_update on public.spike_data for update to authenticated
  using (user_id = (select auth.uid()) and (select public.device_session_valid()))
  with check (user_id = (select auth.uid()) and (select public.device_session_valid()));
drop policy if exists spike_delete on public.spike_data;
create policy spike_delete on public.spike_data for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.device_session_valid()));
