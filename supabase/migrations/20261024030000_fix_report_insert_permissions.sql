-- 1. Grant INSERT on reports to authenticated users
GRANT INSERT ON TABLE public.reports TO authenticated;

-- 2. Grant USAGE, SELECT on sequences in schema public
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 3. Grant execute safely on trigger functions
DO $$
BEGIN
  IF to_regprocedure('public.guard_report_insert()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.guard_report_insert() TO authenticated;
  END IF;
  IF to_regprocedure('public.sync_report_geography()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.sync_report_geography() TO authenticated;
  END IF;
  IF to_regprocedure('public.set_report_code()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.set_report_code() TO authenticated;
  END IF;
END $$;

-- 4. Ensure RLS insert policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'reports' AND policyname = 'citizen insert own reports'
  ) THEN
    CREATE POLICY "citizen insert own reports" ON public.reports
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
