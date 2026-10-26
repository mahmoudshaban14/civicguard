-- Table-level UPDATE on reports was granted by hand. All writes go through the API;
-- keep only action_status as a temporary exception for the dashboard (admin only, via RLS).
revoke update on public.reports from anon, authenticated, public;
grant update (action_status) on public.reports to authenticated;