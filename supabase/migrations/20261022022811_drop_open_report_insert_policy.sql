-- The open policy (with_check = true) lets any client write reports directly, bypassing the API
drop policy if exists "Allow Insert For All" on public.reports;
revoke insert, select on public.reports from anon;