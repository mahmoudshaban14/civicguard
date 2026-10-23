-- Fix Problem 3: Prevent non-privileged users from modifying department_id or role in profiles

-- ============================================================================
-- 1. GUARD PROFILE INSERT
-- ============================================================================
create or replace function public.guard_profile_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Privileged callers: admin, service_role, or postgres
  if public.is_admin() or (auth.role() = 'service_role') or (session_user = 'postgres') then
    new.role := coalesce(new.role, 'citizen');
  else
    new.role := 'citizen';
    new.department_id := null;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 2. GUARD PROFILE UPDATE
-- ============================================================================
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;

  -- Raise exception when department_id OR role changes unless caller is admin, service_role, or postgres
  if (new.role is distinct from old.role) or (new.department_id is distinct from old.department_id) then
    if not (public.is_admin() or (auth.role() = 'service_role') or (session_user = 'postgres')) then
      raise exception 'Users cannot modify account role or department_id';
    end if;
  end if;

  return new;
end;
$$;
