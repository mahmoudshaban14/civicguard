-- Fix Problem 4 & 4b: Revoke execute on public functions from public/anon/authenticated and verify service_role table grants

-- ============================================================================
-- 1. REVOKE EXECUTE ON SECURITY DEFINER / TRIGGER / HELPER FUNCTIONS
-- ============================================================================
revoke execute on function public.guard_report_insert() from public, anon, authenticated;
revoke execute on function public.guard_report_update() from public, anon, authenticated;
revoke execute on function public.guard_profile_insert() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;
revoke execute on function public.handle_report_status_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_authority() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.sync_report_geography() from public, anon, authenticated;

-- Conditional check for rls_auto_enable helper if it exists
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- Keep is_admin() executable for authenticated only (RLS policies rely on it)
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Default privileges: prevent future functions created in schema public from being exposed by default
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ============================================================================
-- 2. PROBLEM 4b: CONFIRM AND GRANT FULL SERVICE_ROLE ACCESS FOR API
-- ============================================================================
grant all on table public.departments to service_role;
grant all on table public.categories to service_role;
grant all on table public.notifications to service_role;
grant all on table public.reports to service_role;
grant all on table public.report_events to service_role;
grant all on table public.ai_requests to service_role;

grant select, update on table public.profiles to service_role;

-- Verification block in migration: ensure only is_admin() is executable by authenticated/anon
do $$
declare
  r record;
  bad_funcs text := '';
begin
  for r in (
    select distinct routine_name
    from information_schema.routine_privileges
    where specific_schema = 'public'
      and grantee in ('anon', 'authenticated', 'PUBLIC')
      and privilege_type = 'EXECUTE'
      and routine_name != 'is_admin'
  ) loop
    bad_funcs := bad_funcs || ' ' || r.routine_name;
  end loop;

  if bad_funcs != '' then
    raise notice 'Warning: found public functions still executable by client roles:%', bad_funcs;
  end if;
end $$;
