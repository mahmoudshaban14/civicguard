-- A policy was created by hand in the Dashboard. All report writes go through the backend API.
drop policy if exists "Enable insert for authenticated users" on public.reports;
revoke insert on public.reports from anon, authenticated, public;