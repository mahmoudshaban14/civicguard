-- Dashboard follow-up action state, separate from reports.status.
-- The column was created by hand in the Dashboard; this makes it reproducible and constrained.
alter table public.reports add column if not exists action_status text;
alter table public.reports alter column action_status set default 'pending_action';
alter table public.reports drop constraint if exists reports_action_status_check;
alter table public.reports add constraint reports_action_status_check
  check (action_status is null or action_status in ('pending_action', 'action_in_progress', 'action_completed'));