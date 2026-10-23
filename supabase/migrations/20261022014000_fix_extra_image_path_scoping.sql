-- Fix Extra: Enforce image_path folder scoping to prevent referencing another user's uploads

-- ============================================================================
-- CHECK CONSTRAINT ON REPORTS.IMAGE_PATH
-- ============================================================================
-- Allows NULL, or path beginning with <user_id>/
alter table public.reports drop constraint if exists reports_image_path_user_scoping_check;

alter table public.reports add constraint reports_image_path_user_scoping_check
  check (
    image_path is null or
    image_path ~ ('^' || user_id::text || '/.*$')
  );
