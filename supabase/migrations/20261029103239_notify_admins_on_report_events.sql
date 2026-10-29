
-- Notify every admin about new reports, status changes and department changes.
-- Citizen notifications, status_changed_by validation and report_events history are unchanged.
-- An admin who owns the report already gets the citizen notification, so the admin copy skips the owner.
create or replace function public.handle_report_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
      report_id, changed_by, actor_id, actor_role, old_status, new_status, note, created_at
    ) values (
      new.id, actor, actor, role_name, null, new.status, event_note, now()
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
 
    -- Admins: new report (skip the owner if the owner is an admin)
    insert into public.notifications (user_id, report_id, type, title, body, read, created_at)
    select p.id, new.id, 'admin_new_report', 'New Report',
           'New report ' || code_text || ' was submitted.', false, now()
    from public.profiles p
    where p.role = 'admin' and p.id <> new.user_id;
 
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
        report_id, changed_by, actor_id, actor_role, old_status, new_status, note, created_at
      ) values (
        new.id, actor, actor, role_name, old.status, new.status, event_note, now()
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
 
      -- Admins: status changed (one notification even if the department changed in the same update)
      insert into public.notifications (user_id, report_id, type, title, body, read, created_at)
      select p.id, new.id, 'admin_status_changed', 'Report Status Changed',
             'Report ' || code_text || ' changed from ' || old.status || ' to ' || new.status
             || case
                  when new.assigned_department_id is distinct from old.assigned_department_id
                  then ' and was routed to ' || coalesce(new.department, 'another department')
                  else ''
                end
             || '.',
             false, now()
      from public.profiles p
      where p.role = 'admin' and p.id <> new.user_id;
    end if;
 
    -- 2. Department change event (when assigned_department_id changes and status did not change)
    if (new.assigned_department_id is distinct from old.assigned_department_id) and (new.status is not distinct from old.status) then
      dept_name := coalesce(new.department, 'another department');
      event_note := coalesce(nullif(trim(new.status_note), ''), 'Department changed to ' || dept_name);
 
      insert into public.report_events (
        report_id, changed_by, actor_id, actor_role, old_status, new_status, note, created_at
      ) values (
        new.id, actor, actor, role_name, old.status, new.status, event_note, now()
      );
 
      -- Admins: department changed
      insert into public.notifications (user_id, report_id, type, title, body, read, created_at)
      select p.id, new.id, 'admin_department_changed', 'Department Changed',
             'Report ' || code_text || ' was routed to ' || dept_name || '.', false, now()
      from public.profiles p
      where p.role = 'admin' and p.id <> new.user_id;
    end if;
  end if;
 
  return new;
end;
$$;
 
