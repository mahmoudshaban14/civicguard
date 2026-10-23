-- Trigger functions: not meant to be called through the API
revoke execute on function public.guard_report_update() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- is_admin() is used inside RLS policies, so signed-in users must keep it
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Not ours (likely Supabase's auto-RLS helper); only if it exists
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;