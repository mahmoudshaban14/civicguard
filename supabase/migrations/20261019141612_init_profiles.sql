create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'citizen' check (role in ('citizen','admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can only read their own profile
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Auto-create a profile when someone signs up
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();