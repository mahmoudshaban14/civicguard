-- Columns that were added by hand in the live DB: track them so a fresh clone / db reset still works
alter table public.profiles add column if not exists email text;
alter table public.reports add column if not exists image_description text;

-- profiles.email is used by the backend to log in by national ID / phone.
-- Keep it in sync with auth.users for new sign-ups and email changes.
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email
  where id = new.id and email is distinct from new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_sync on auth.users;
create trigger on_auth_user_email_sync
  after insert or update of email on auth.users
  for each row execute function public.sync_profile_email();

revoke execute on function public.sync_profile_email() from public, anon, authenticated;

-- one-time re-sync (safe to repeat)
update public.profiles p set email = u.email
from auth.users u where u.id = p.id and p.email is distinct from u.email;