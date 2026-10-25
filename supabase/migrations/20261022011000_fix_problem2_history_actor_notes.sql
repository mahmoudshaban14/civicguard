-- Fix Problem 2: Audit actor tracking, status notes, department change event logging, and resolved_at timing

-- ============================================================================
-- 1. ADD COLUMNS TO REPORTS
-- ============================================================================
alter table public.reports add column if not exists status_changed_by uuid references auth.users(id);
alter table public.reports add column if not exists status_note text;

-- ============================================================================
-- 2. UPDATE GUARD_REPORT_UPDATE TO SET RESOLVED_AT IN BEFORE TRIGGER
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

  -- Set resolved_at when transitioning to 'resolved'
  if new.status = 'resolved' and (old.status is null or old.status != 'resolved') then
    new.resolved_at := now();
  elsif new.status != 'resolved' then
    new.resolved_at := null;
  end if;

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
-- 3. UPDATE HANDLE_REPORT_STATUS_CHANGE TRIGGER FUNCTION
-- ============================================================================
create or replace function public.handle_report_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  role_name text;
  code_text text;
  dept_name text;
  event_note text;
begin
  code_text := coalesce(new.report_code, 'CG-' || substring(new.id::text, 1, 8));

  if tg_op = 'INSERT' then
    actor := coalesce(auth.uid(), new.user_id);

    select role into role_name from public.profiles where id = actor;
    if role_name is null then
      role_name := 'system';
    end if;

    event_note := coalesce(nullif(trim(new.status_note), ''), 'Report submitted');

    insert into public.report_events (
      report_id,
      changed_by,
      actor_id,
      actor_role,
      old_status,
      new_status,
      note,
      created_at
    ) values (
      new.id,
      actor,
      actor,
      role_name,
      null,
      new.status,
      event_note,
      now()
    );

    insert into public.notifications (user_id, report_id, type, title, body, read, created_at)
    values (
      new.user_id,
      new.id,
      'report_submitted',
      'Report Submitted',
      'Report ' || code_text || ' was submitted successfully.',
      false,
      now()
    );

  elsif tg_op = 'UPDATE' then
    -- On UPDATE: actor MUST be coalesce(auth.uid(), new.status_changed_by)
    actor := coalesce(auth.uid(), new.status_changed_by);

    -- Under service_role (where auth.uid() is null), status_changed_by is required when status or department changes
    if (auth.role() = 'service_role' or auth.uid() is null) and actor is null then
      if (new.status is distinct from old.status) or (new.assigned_department_id is distinct from old.assigned_department_id) then
        raise exception 'status_changed_by is required for workflow updates via service_role';
      end if;
    end if;

    select role into role_name from public.profiles where id = actor;
    if role_name is null then
      role_name := 'system';
    end if;

    -- 1. Status change event
    if new.status is distinct from old.status then
      event_note := coalesce(nullif(trim(new.status_note), ''), 'Status changed to ' || new.status);

      insert into public.report_events (
        report_id,
        changed_by,
        actor_id,
        actor_role,
        old_status,
        new_status,
        note,
        created_at
      ) values (
        new.id,
        actor,
        actor,
        role_name,
        old.status,
        new.status,
        event_note,
        now()
      );

      insert into public.notifications (user_id, report_id, type, title, body, read, created_at)
      values (
        new.user_id,
        new.id,
        'status_updated',
        'Status Update',
        'Your report ' || code_text || ' is now ' || new.status || '.',
        false,
        now()
      );
    end if;

    -- 2. Department change event (when assigned_department_id changes and status did not change)
    if (new.assigned_department_id is distinct from old.assigned_department_id) and (new.status is not distinct from old.status) then
      dept_name := coalesce(new.department, 'another department');
      event_note := coalesce(nullif(trim(new.status_note), ''), 'Department changed to ' || dept_name);

      insert into public.report_events (
        report_id,
        changed_by,
        actor_id,
        actor_role,
        old_status,
        new_status,
        note,
        created_at
      ) values (
        new.id,
        actor,
        actor,
        role_name,
        old.status,
        new.status,
        event_note,
        now()
      );
    end if;
  end if;

  return new;
end;
$$;
