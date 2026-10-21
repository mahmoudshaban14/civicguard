-- ============================================================================
-- Phase 0 Database Security & RLS Tests
-- Proves:
--   1. Citizen cannot change report status (insert forced to 'submitted', update raises exception)
--   2. Citizen cannot change profile role (insert forced to 'citizen', update raises exception)
--   3. Citizen cannot read another user's report (RLS isolation)
--   4. Admin can read all reports and change report status
--   5. Automatic report_events and notifications are generated
-- ============================================================================

begin;

-- Create test fixtures in auth.users
do $$
declare
  citizen1_id uuid := '11111111-1111-1111-1111-111111111111';
  citizen2_id uuid := '22222222-2222-2222-2222-222222222222';
  admin_id    uuid := '99999999-9999-9999-9999-999999999999';
  report1_id  uuid := 'a1111111-1111-1111-1111-111111111111';
  caught_error boolean;
  selected_count int;
  rec record;
begin
  -- Setup test users
  delete from public.reports where id = report1_id;
  delete from public.profiles where id in (citizen1_id, citizen2_id, admin_id);
  delete from auth.users where id in (citizen1_id, citizen2_id, admin_id);

  insert into auth.users (id, email, raw_user_meta_data)
  values
    (citizen1_id, 'citizen1@test.com', '{"full_name": "Citizen One"}'::jsonb),
    (citizen2_id, 'citizen2@test.com', '{"full_name": "Citizen Two"}'::jsonb),
    (admin_id,    'admin@test.com',    '{"full_name": "Admin User"}'::jsonb);

  -- Admin profile setup
  update public.profiles set role = 'admin' where id = admin_id;

  -- Verify Profile Creation & Name Extraction
  select * into rec from public.profiles where id = citizen1_id;
  if rec.full_name != 'Citizen One' or rec.role != 'citizen' then
    raise exception 'TEST FAILED: Citizen 1 profile name or default role incorrect';
  end if;

  -- ==========================================================================
  -- TEST 1: Citizen cannot change profile role
  -- ==========================================================================
  caught_error := false;
  -- Simulate Citizen 1 session
  perform set_config('request.jwt.claim.sub', citizen1_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    update public.profiles set role = 'admin' where id = citizen1_id;
  exception when others then
    caught_error := true;
  end;

  if not caught_error then
    raise exception 'TEST FAILED: Citizen was able to update their role to admin';
  end if;

  -- ==========================================================================
  -- TEST 2: Citizen cannot forge status on insert
  -- ==========================================================================
  -- Citizen 1 inserts report with forged status 'resolved'
  insert into public.reports (id, user_id, description, status)
  values (report1_id, citizen1_id, 'Pothole test', 'resolved');

  select status into rec from public.reports where id = report1_id;
  if rec.status != 'submitted' then
    raise exception 'TEST FAILED: Citizen was able to forge status to %', rec.status;
  end if;

  -- ==========================================================================
  -- TEST 3: Citizen cannot modify status on update
  -- ==========================================================================
  caught_error := false;
  begin
    update public.reports set status = 'in_progress' where id = report1_id;
  exception when others then
    caught_error := true;
  end;

  if not caught_error then
    raise exception 'TEST FAILED: Citizen was able to update report status';
  end if;

  -- ==========================================================================
  -- TEST 4: Citizen 2 cannot read Citizen 1's report (RLS)
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', citizen2_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*) into selected_count from public.reports where id = report1_id;
  if selected_count != 0 then
    raise exception 'TEST FAILED: Citizen 2 was able to read Citizen 1 report';
  end if;

  -- ==========================================================================
  -- TEST 5: Admin CAN read Citizen 1's report and CAN update status
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*) into selected_count from public.reports where id = report1_id;
  if selected_count != 1 then
    raise exception 'TEST FAILED: Admin was unable to read report';
  end if;

  update public.reports set status = 'in_progress' where id = report1_id;
  select status into rec from public.reports where id = report1_id;
  if rec.status != 'in_progress' then
    raise exception 'TEST FAILED: Admin was unable to update report status';
  end if;

  -- ==========================================================================
  -- TEST 6: Automatic history & notification generation
  -- ==========================================================================
  select count(*) into selected_count from public.report_events where report_id = report1_id;
  if selected_count < 2 then
    raise exception 'TEST FAILED: report_events not logged automatically (found %)', selected_count;
  end if;

  select count(*) into selected_count from public.notifications where report_id = report1_id;
  if selected_count < 2 then
    raise exception 'TEST FAILED: notifications not generated automatically (found %)', selected_count;
  end if;

  -- ==========================================================================
  -- TEST 7: Authority user cannot change own department_id or role
  -- ==========================================================================
  declare
    authority_id uuid := '33333333-3333-3333-3333-333333333333';
  begin
    insert into auth.users (id, email) values (authority_id, 'authority@test.com');
    update public.profiles set role = 'authority' where id = authority_id;

    perform set_config('request.jwt.claim.sub', authority_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);

    caught_error := false;
    begin
      update public.profiles set department_id = gen_random_uuid() where id = authority_id;
    exception when others then
      caught_error := true;
    end;

    if not caught_error then
      raise exception 'TEST FAILED: Authority user was able to modify department_id';
    end if;

    caught_error := false;
    begin
      update public.profiles set role = 'admin' where id = authority_id;
    exception when others then
      caught_error := true;
    end;

    if not caught_error then
      raise exception 'TEST FAILED: Authority user was able to elevate role to admin';
    end if;

    -- Clean up authority fixture
    delete from public.profiles where id = authority_id;
    delete from auth.users where id = authority_id;
  end;

  -- ==========================================================================
  -- TEST 8: Citizen cannot modify severity, department, or status on update
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', citizen1_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  caught_error := false;
  begin
    update public.reports set severity = 'Critical' where id = report1_id;
  exception when others then
    caught_error := true;
  end;
  if not caught_error then
    raise exception 'TEST FAILED: Citizen was able to modify severity';
  end if;

  caught_error := false;
  begin
    update public.reports set department = 'Unauthorized Department' where id = report1_id;
  exception when others then
    caught_error := true;
  end;
  if not caught_error then
    raise exception 'TEST FAILED: Citizen was able to modify department';
  end if;

  raise notice 'ALL PHASE 0 & REVIEW DATABASE SECURITY TESTS PASSED SUCCESSFULLY!';
end;
$$;

rollback;
