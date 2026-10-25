create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  status text not null check (status in ('success','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

-- Makes the rate-limit count fast
create index ai_requests_user_time_idx
  on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;

-- Users see their own requests, admins see all
create policy "user read own ai requests" on public.ai_requests
  for select using (auth.uid() = user_id);

create policy "admin read all ai requests" on public.ai_requests
  for select using (public.is_admin());

-- Clients can only read. No insert policy: only the Edge Function writes.
grant select on public.ai_requests to authenticated;

-- The Edge Function uses service_role (server side only)
grant select, insert on public.ai_requests to service_role;
grant select, update on public.reports to service_role;