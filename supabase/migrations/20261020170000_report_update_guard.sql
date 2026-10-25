create function public.guard_report_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Immutable fields
  new.id := old.id;
  new.user_id := old.user_id;
  new.report_code := old.report_code;
  new.created_at := old.created_at;
  new.updated_at := now();

  -- Log every status change automatically
  if new.status is distinct from old.status then
    insert into public.report_events (report_id, changed_by, old_status, new_status)
    values (old.id, auth.uid(), old.status, new.status);
  end if;

  return new;
end;
$$;

create trigger reports_guard_update
  before update on public.reports
  for each row execute function public.guard_report_update();