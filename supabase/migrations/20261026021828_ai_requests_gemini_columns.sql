-- Gemini analysis details, written by the backend only (service_role)
alter table public.ai_requests
  add column if not exists image_path text,
  add column if not exists model text,
  add column if not exists latency_ms integer,
  add column if not exists result jsonb;

-- The backend links an analysis to the report created from it (marks it as consumed)
grant update (report_id) on public.ai_requests to service_role;