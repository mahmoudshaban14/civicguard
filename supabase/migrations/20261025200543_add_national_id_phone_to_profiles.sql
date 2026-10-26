-- Sign-up data used for login by national ID or phone. Nullable: existing users have none.
alter table public.profiles
  add column if not exists national_id text,
  add column if not exists phone_number text;

alter table public.profiles drop constraint if exists profiles_national_id_key;
alter table public.profiles add constraint profiles_national_id_key unique (national_id);
alter table public.profiles drop constraint if exists profiles_phone_number_key;
alter table public.profiles add constraint profiles_phone_number_key unique (phone_number);

alter table public.profiles drop constraint if exists profiles_national_id_format;
alter table public.profiles add constraint profiles_national_id_format
  check (national_id is null or national_id ~ '^[0-9]{14}$');
alter table public.profiles drop constraint if exists profiles_phone_number_format;
alter table public.profiles add constraint profiles_phone_number_format
  check (phone_number is null or phone_number ~ '^\+201[0125][0-9]{8}$');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  user_full_name text;
  nid text;
  digits text;
  phone text;
begin
  user_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'name',
    ''
  );

  -- National ID: Arabic-Indic digits -> ASCII, keep digits only
  nid := nullif(regexp_replace(
    translate(coalesce(new.raw_user_meta_data->>'national_id', ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'),
    '[^0-9]', '', 'g'), '');
  if nid is not null and nid !~ '^[0-9]{14}$' then
    raise exception 'invalid national_id format';
  end if;

  -- Phone: normalize Egyptian mobile numbers to E.164 (+201XXXXXXXXX)
  digits := regexp_replace(
    translate(coalesce(new.raw_user_meta_data->>'phone_number', new.raw_user_meta_data->>'phone', ''),
              '٠١٢٣٤٥٦٧٨٩', '0123456789'),
    '[^0-9]', '', 'g');
  if digits = '' then
    phone := null;
  elsif digits ~ '^01[0125][0-9]{8}$' then
    phone := '+2' || digits;
  elsif digits ~ '^201[0125][0-9]{8}$' then
    phone := '+' || digits;
  elsif digits ~ '^00201[0125][0-9]{8}$' then
    phone := '+' || substr(digits, 3);
  else
    raise exception 'invalid phone number format';
  end if;

  insert into public.profiles (id, role, full_name, display_name, national_id, phone_number)
  values (
    new.id,
    'citizen',
    nullif(trim(user_full_name), ''),
    nullif(trim(user_full_name), ''),
    nid,
    phone
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    national_id = coalesce(excluded.national_id, public.profiles.national_id),
    phone_number = coalesce(excluded.phone_number, public.profiles.phone_number);

  return new;
end;
$$;