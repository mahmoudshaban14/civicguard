-- All report writes go through the backend API (service_role). Close the last direct-write door.
drop policy if exists "Allow Insert For All" on public.reports;
drop policy if exists "citizen insert own reports" on public.reports;
revoke insert on public.reports from anon, authenticated, public;
revoke select on public.reports from anon;