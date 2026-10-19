-- 1) is_admin(): helper used by all admin policies
create function public.is_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2) Report code generator: CG-2026-00001
create sequence public.report_code_seq;

create function public.set_report_code()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.report_code := 'CG-' || to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('public.report_code_seq')::text, 5, '0');
  return new;
end;
$$;

-- 3) reports table
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  report_code text unique,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  image_path text,
  latitude double precision,
  longitude double precision,
  description text,
  category text,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  severity text check (severity in ('Low','Medium','High','Critical')),
  explanation text,
  department text,
  secondary_issues text[] default '{}',
  requires_manual_review boolean not null default false,
  status text not null default 'submitted' check (status in (
    'submitted','ai_analyzed','assigned','under_review','in_progress','resolved',
    'rejected','duplicate','invalid','escalated','manual_review_required'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reports_set_code
  before insert on public.reports
  for each row execute function public.set_report_code();

-- 4) report_events table (history)
create table public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  changed_by uuid references auth.users(id),
  old_status text,
  new_status text not null,
  created_at timestamptz not null default now()
);

-- 5) RLS
alter table public.reports enable row level security;
alter table public.report_events enable row level security;

-- Admin can read all profiles (needed by the dashboard)
create policy "admin read all profiles" on public.profiles
  for select using (public.is_admin());

-- Citizens: see and create only their own reports
create policy "citizen read own reports" on public.reports
  for select using (auth.uid() = user_id);

create policy "citizen insert own reports" on public.reports
  for insert with check (auth.uid() = user_id);

-- Admins: read and update everything
create policy "admin read all reports" on public.reports
  for select using (public.is_admin());

create policy "admin update reports" on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

-- History: owner reads own report history, admin reads/inserts all
create policy "citizen read own events" on public.report_events
  for select using (
    exists (select 1 from public.reports r
            where r.id = report_id and r.user_id = auth.uid())
  );

create policy "admin read events" on public.report_events
  for select using (public.is_admin());

create policy "admin insert events" on public.report_events
  for insert with check (public.is_admin());