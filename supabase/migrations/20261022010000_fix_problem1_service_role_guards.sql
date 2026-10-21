-- Fix Problem 1: Allow service_role and postgres session_user in report and profile guard triggers
-- Timestamp later than newest migration (20261021234000)

-- ============================================================================
-- 1. GUARD REPORT INSERT
-- ============================================================================
create or replace function public.guard_report_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Privileged callers: admin, authority, service_role, or postgres session
  if public.is_admin() or public.is_authority() or (auth.role() = 'service_role') or (session_user = 'postgres') then
    new.user_id := coalesce(new.user_id, auth.uid());
    new.status := coalesce(new.status, 'submitted');
  else
    -- Non-privileged callers (citizens writing directly)
    new.user_id := auth.uid();
    new.status := 'submitted';
    new.severity := null;
    new.department := null;
    new.assigned_department_id := null;
    new.confidence := null;
    new.explanation := null;
    new.secondary_issues := '{}';
    new.requires_manual_review := false;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 2. GUARD REPORT UPDATE
-- ============================================================================
create or replace function public.guard_report_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Immutable fields for everyone
  new.id := old.id;
  new.user_id := old.user_id;
  new.report_code := old.report_code;
  new.created_at := old.created_at;
  new.updated_at := now();

  -- Enforce workflow restrictions unless caller is admin, authority, service_role, or postgres
  if not (public.is_admin() or public.is_authority() or (auth.role() = 'service_role') or (session_user = 'postgres')) then
    if new.status is distinct from old.status then
      raise exception 'Citizens cannot modify report status';
    end if;
    if new.severity is distinct from old.severity then
      raise exception 'Citizens cannot modify report severity';
    end if;
    if new.department is distinct from old.department or new.assigned_department_id is distinct from old.assigned_department_id then
      raise exception 'Citizens cannot modify report department';
    end if;
    if new.confidence is distinct from old.confidence or new.explanation is distinct from old.explanation then
      raise exception 'Citizens cannot modify AI analysis fields';
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 3. GUARD PROFILE INSERT
-- ============================================================================
create or replace function public.guard_profile_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Allow service_role, postgres, or admin to specify role
  if public.is_admin() or (auth.role() = 'service_role') or (session_user = 'postgres') then
    new.role := coalesce(new.role, 'citizen');
  else
    new.role := 'citizen';
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 4. GUARD PROFILE UPDATE
-- ============================================================================
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;

  -- Allow role modification only by admin, service_role, or postgres
  if new.role is distinct from old.role then
    if not (public.is_admin() or (auth.role() = 'service_role') or (session_user = 'postgres')) then
      raise exception 'Citizens cannot modify account role';
    end if;
  end if;

  return new;
end;
$$;
