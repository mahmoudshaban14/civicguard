
-- Remove unnecessary table privileges from client-facing roles.
-- RLS does not protect against TRUNCATE.
REVOKE TRUNCATE, TRIGGER, REFERENCES
ON TABLE public.reports, public.report_events
FROM anon, authenticated, PUBLIC;
