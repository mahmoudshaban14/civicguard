-- Table-level privileges (RLS still decides which ROWS are visible)
grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant select, insert on public.reports to authenticated;
grant update on public.reports to authenticated;
grant select, insert on public.report_events to authenticated;

grant usage, select on sequence public.report_code_seq to authenticated;