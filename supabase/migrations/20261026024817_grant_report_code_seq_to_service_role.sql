-- The backend (service_role) inserts reports; the report_code trigger calls nextval() on this sequence
grant usage, select on sequence public.report_code_seq to service_role;