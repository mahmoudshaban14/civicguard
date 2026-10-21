-- Phase 3 Security Hardening: Revoke direct client write privileges on reports and report_events
-- Now that the Expo mobile app and the admin dashboard write only through the Node.js API,
-- client-facing roles (anon, authenticated, PUBLIC) must not have direct insert or update privileges.
-- This ensures a leaked publishable anon key cannot write or tamper with any report or event.

-- Revoke direct writes on reports from client-facing roles
revoke insert, update, delete on table public.reports from anon, authenticated, PUBLIC;

-- Revoke direct writes on report_events from client-facing roles
revoke insert, update, delete on table public.report_events from anon, authenticated, PUBLIC;

-- Maintain SELECT so Supabase Auth / Realtime read subscriptions work as governed by RLS
grant select on table public.reports to authenticated;
grant select on table public.report_events to authenticated;

-- Ensure service_role (used by the backend API) retains full access
grant all on table public.reports to service_role;
grant all on table public.report_events to service_role;
