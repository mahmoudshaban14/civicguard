-- Who is calling? The backend API (service_role) or a direct admin DB session
create or replace function public.is_trusted_caller()
returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or session_user in ('postgres', 'supabase_admin');
$$;

-- The API passes the acting user here, so history keeps the real actor
alter table public.reports
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create or replace function public.guard_profile_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_trusted_caller() or public.is_admin() then
    new.role := coalesce(new.role, 'citizen');
  else
    new.role := 'citizen';
  end if;
  return new;
end;
$$;

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  if not (public.is_trusted_caller() or public.is_admin()) then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change an account role';
    end if;
    if new.department_id is distinct from old.department_id then
      raise exception 'Only admins can change a department assignment';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_report_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_trusted_caller() or public.is_authority() then
    new.user_id := coalesce(new.user_id, auth.uid());
    new.status := coalesce(new.status, 'submitted');
  else
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

create or replace function public.guard_report_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.id := old.id;
  new.user_id := old.user_id;
  new.report_code := old.report_code;
  new.created_at := old.created_at;
  new.updated_at := now();

  if not (public.is_trusted_caller() or public.is_authority()) then
    if new.status is distinct from old.status then
      raise exception 'Citizens cannot modify report status';
    end if;
    if new.severity is distinct from old.severity then
      raise exception 'Citizens cannot modify report severity';
    end if;
    if new.department is distinct from old.department
       or new.assigned_department_id is distinct from old.assigned_department_id then
      raise exception 'Citizens cannot modify report department';
    end if;
    if new.confidence is distinct from old.confidence
       or new.explanation is distinct from old.explanation then
      raise exception 'Citizens cannot modify AI analysis fields';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_report_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  role_name text;
  code_text text;
begin
  actor := coalesce(auth.uid(), new.updated_by, new.user_id);

  select role into role_name from public.profiles where id = actor;
  if role_name is null then
    role_name := 'system';
  end if;

  code_text := coalesce(new.report_code, 'CG-' || substring(new.id::text, 1, 8));

  if tg_op = 'INSERT' then
    insert into public.report_events (report_id, changed_by, actor_id, actor_role, old_status, new_status, note, created_at)
    values (new.id, actor, actor, role_name, null, new.status, 'Report submitted', now());

    insert into public.notifications (user_id, report_id, type, title, body, read, created_at)
    values (new.user_id, new.id, 'report_submitted', 'Report Submitted',
            'Report ' || code_text || ' was submitted successfully.', false, now());
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.report_events (report_id, changed_by, actor_id, actor_role, old_status, new_status, note, created_at)
      values (new.id, actor, actor, role_name, old.status, new.status, 'Status changed to ' || new.status, now());

      insert into public.notifications (user_id, report_id, type, title, body, read, created_at)
      values (new.user_id, new.id, 'status_updated', 'Status Update',
              'Your report ' || code_text || ' is now ' || new.status || '.', false, now());
    end if;
  end if;

  return new;
end;
$$;

-- New SECURITY DEFINER functions must not be callable through the API
revoke execute on function public.is_authority() from public, anon, authenticated;
revoke execute on function public.guard_profile_insert() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;
revoke execute on function public.guard_report_insert() from public, anon, authenticated;
revoke execute on function public.handle_report_status_change() from public, anon, authenticated;

-- Clients may only edit their own display name, and only mark notifications as read
revoke update on public.profiles from authenticated;
grant update (full_name, display_name) on public.profiles to authenticated;
revoke update on public.notifications from authenticated;
grant update (read, read_at) on public.notifications to authenticated;