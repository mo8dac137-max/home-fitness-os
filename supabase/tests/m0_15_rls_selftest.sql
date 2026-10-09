-- Run after the migration, then: select public.m0_15_rls_selftest();
-- Expected result: ALL RLS TESTS PASSED
create or replace function public.m0_15_rls_selftest()
returns text
language plpgsql
as $$
declare
  uid uuid;
  dev uuid;
  sid uuid;
  n int;
  s_ok uuid := gen_random_uuid();
  s_none uuid := gen_random_uuid();
  s_exp uuid := gen_random_uuid();
  s_rev uuid := gen_random_uuid();
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise exception 'Create a user first (Authentication > Users)';
  end if;

  delete from public.spike_data where note like 'rls-test%';
  insert into public.authorized_devices (user_id, label, public_key_jwk)
    values (uid, 'rls-selftest', '{}'::jsonb) returning id into dev;
  insert into public.device_sessions (session_id, user_id, device_id, expires_at) values
    (s_ok,  uid, dev, now() + interval '1 hour'),
    (s_exp, uid, dev, now() - interval '1 minute'),
    (s_rev, uid, dev, now() + interval '1 hour');
  update public.device_sessions set revoked_at = now() where session_id = s_rev;
  insert into public.spike_data (user_id, note) values (uid, 'rls-test-seed');

  -- 1) valid device session: can write and read
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', s_ok)::text, true);
  set local role authenticated;
  insert into public.spike_data (note) values ('rls-test-ok');
  select count(*) into n from public.spike_data where note like 'rls-test%';
  if n < 2 then raise exception 'FAIL 1: valid device session cannot read/write (n=%)', n; end if;
  reset role;

  -- 2) no session / expired / revoked: cannot read or write
  foreach sid in array array[s_none, s_exp, s_rev] loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
    set local role authenticated;
    select count(*) into n from public.spike_data where note like 'rls-test%';
    if n <> 0 then raise exception 'FAIL 2: rows visible without a valid device session (%)', sid; end if;
    begin
      insert into public.spike_data (note) values ('rls-test-denied');
      raise exception 'FAIL 3: insert allowed without a valid device session (%)', sid;
    exception when insufficient_privilege then
      null;
    end;
    reset role;
  end loop;

  -- 3) valid session id but a different user: nothing visible
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'session_id', s_ok)::text, true);
  set local role authenticated;
  select count(*) into n from public.spike_data where note like 'rls-test%';
  if n <> 0 then raise exception 'FAIL 4: another user can see the rows'; end if;
  reset role;

  -- 4) authenticated cannot touch server-only tables
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', s_ok)::text, true);
  set local role authenticated;
  begin
    perform 1 from public.device_sessions limit 1;
    raise exception 'FAIL 5: authenticated can read device_sessions';
  exception when insufficient_privilege then
    null;
  end;
  reset role;

  -- 5) anon cannot read spike_data
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    perform 1 from public.spike_data limit 1;
    raise exception 'FAIL 6: anon can read spike_data';
  exception when insufficient_privilege then
    null;
  end;
  reset role;

  delete from public.spike_data where note like 'rls-test%';
  delete from public.authorized_devices where id = dev;
  return 'ALL RLS TESTS PASSED';
end;
$$;
