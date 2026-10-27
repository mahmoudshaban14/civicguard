-- Duplicate-detection candidates. Admin-only data: citizens must never read it.
-- Only the backend (service_role) reads and writes it; the dashboard goes through the API.
create table if not exists public.report_duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  -- the NEWER report that was just submitted
  report_id uuid not null references public.reports(id) on delete cascade,
  -- the EARLIER open report found nearby
  candidate_report_id uuid not null references public.reports(id) on delete cascade,
  distance_m numeric(8,1) not null check (distance_m >= 0),
  -- Gemini photo comparison (null / false when not compared)
  ai_checked boolean not null default false,
  ai_same_issue boolean,
  ai_confidence numeric(4,3) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  ai_reason text,
  ai_model text,
  created_at timestamptz not null default now(),
  constraint report_duplicate_candidates_pair_unique unique (report_id, candidate_report_id),
  constraint report_duplicate_candidates_not_self check (report_id <> candidate_report_id)
);

create index if not exists report_duplicate_candidates_candidate_idx
  on public.report_duplicate_candidates (candidate_report_id);

alter table public.report_duplicate_candidates enable row level security;

-- No policy for anon/authenticated and no grants.
revoke all on table public.report_duplicate_candidates from anon, authenticated, public;
grant select, insert on table public.report_duplicate_candidates to service_role;

-- Speeds up the nearby-reports search by category
create index if not exists reports_category_created_idx
  on public.reports (category_id, created_at desc);