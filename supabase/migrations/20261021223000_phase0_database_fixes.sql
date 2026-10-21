-- Phase 0: Database hardening, role expansion, departments/categories, notifications, and workflow triggers

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
create extension if not exists postgis with schema extensions;

-- ============================================================================
-- 2. DEPARTMENTS
-- ============================================================================
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text unique,
  description text,
  created_at timestamptz not null default now()
);

alter table public.departments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'departments' and policyname = 'anyone read departments') then
    create policy "anyone read departments" on public.departments for select to authenticated, anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'departments' and policyname = 'admin manage departments') then
    create policy "admin manage departments" on public.departments for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

grant select on public.departments to authenticated, anon;
grant all on public.departments to service_role;

-- Seed departments
insert into public.departments (name, slug, description) values
  ('Road Maintenance Department', 'road-maintenance', 'Responsible for potholes, asphalt damage, and roadway repairs'),
  ('Waste Management Department', 'waste-management', 'Handles domestic trash, illegal dumping, and hazardous waste collection'),
  ('Parks / Municipal Services', 'parks-services', 'Manages municipal parks, public greenery, and fallen trees'),
  ('Street Lighting / Electricity Department', 'street-lighting', 'Maintains streetlights, exposed wiring, and electrical utility poles'),
  ('Traffic / Enforcement Authority', 'traffic-enforcement', 'Enforces traffic laws, blocked roads, and illegal parking'),
  ('Water & Utilities Department', 'water-utilities', 'Handles broken water mains, open sewage, and water drainage issues'),
  ('Sanitation Department', 'sanitation', 'Public sanitation, street sweeping, and hygiene services'),
  ('Traffic Management Department', 'traffic-management', 'Manages traffic signals, road signs, and intersections'),
  ('Municipal Enforcement', 'municipal-enforcement', 'Code enforcement, unauthorized vendors, and municipal violations'),
  ('Municipal Services / Public Property Department', 'public-property', 'Repairs damaged public furniture, sidewalks, and municipal structures'),
  ('Civil Protection / Emergency Authority', 'civil-protection', 'Emergency civil protection and rapid hazard response'),
  ('Building Safety / Municipal Engineering', 'building-safety', 'Structural integrity, unsafe facades, and construction hazards'),
  ('Manual Routing', 'manual-routing', 'Fallback routing queue for reports requiring manual administrative review')
on conflict (name) do update set
  slug = excluded.slug,
  description = excluded.description;

-- ============================================================================
-- 3. PROFILES: full_name, display_name, authority role, department_id
-- ============================================================================
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists department_id uuid references public.departments(id) on delete set null;

-- Expand role check constraint to include 'authority'
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('citizen','authority','admin'));

-- Helper: is_authority()
create or replace function public.is_authority()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('authority', 'admin')
  );
$$;

-- Update handle_new_user() trigger to save name from metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  user_full_name text;
begin
  user_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'name',
    ''
  );

  insert into public.profiles (id, role, full_name, display_name)
  values (
    new.id,
    'citizen',
    nullif(trim(user_full_name), ''),
    nullif(trim(user_full_name), '')
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    display_name = coalesce(excluded.display_name, public.profiles.display_name);

  return new;
end;
$$;

-- Backfill existing profiles
update public.profiles p
set
  full_name = nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'name')), ''),
  display_name = nullif(trim(coalesce(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')), '')
from auth.users u
where p.id = u.id
  and (p.full_name is null or p.display_name is null)
  and (u.raw_user_meta_data->>'full_name' is not null or u.raw_user_meta_data->>'display_name' is not null or u.raw_user_meta_data->>'name' is not null);

-- Guard profile inserts: force role to citizen for non-admins
create or replace function public.guard_profile_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    new.role := 'citizen';
  else
    new.role := coalesce(new.role, 'citizen');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_insert on public.profiles;
create trigger profiles_guard_insert
  before insert on public.profiles
  for each row execute function public.guard_profile_insert();

-- Guard profile updates: prevent citizens from altering role
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Citizens cannot modify account role';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Revoke direct insert on profiles
revoke insert on public.profiles from authenticated, anon, public;

-- Allow user to update their own profile name
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'citizen update own profile'
  ) then
    create policy "citizen update own profile" on public.profiles
      for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end $$;

grant select, update on public.profiles to authenticated;

-- ============================================================================
-- 4. CATEGORIES
-- ============================================================================
create table if not exists public.categories (
  id text primary key,
  label text not null,
  department_id uuid references public.departments(id) on delete set null,
  department text not null,
  default_severity text check (default_severity in ('Low','Medium','High','Critical','Requires Review')),
  min_conf numeric(4,3),
  max_conf numeric(4,3),
  active boolean not null default true,
  explanation text,
  severity_reason text,
  keywords text[] default '{}',
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories' and policyname = 'anyone read categories') then
    create policy "anyone read categories" on public.categories for select to authenticated, anon using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories' and policyname = 'admin manage categories') then
    create policy "admin manage categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

grant select on public.categories to authenticated, anon;
grant all on public.categories to service_role;

-- Seed all 29 categories + 'other'
insert into public.categories (id, label, department, default_severity, min_conf, max_conf, explanation, severity_reason, keywords) values
  ('pothole', 'Pothole / Road Damage', 'Road Maintenance Department', 'High', 0.910, 0.970, 'Visual and contextual characteristics are consistent with road surface damage.', 'Road surface damage may affect vehicle safety and requires municipal attention.', array['pothole', 'hole in the road', 'road damage', 'road crack', 'asphalt']),
  ('garbage', 'Garbage / Litter', 'Waste Management Department', 'Medium', 0.870, 0.950, 'The evidence is consistent with accumulated litter or household waste in a public area.', 'Accumulated waste can obstruct public space and create sanitation concerns.', array['garbage', 'litter', 'trash', 'rubbish', 'waste bags']),
  ('illegal-dumping', 'Illegal Dumping', 'Waste Management Department', 'High', 0.850, 0.940, 'The amount and placement of waste suggest unauthorized dumping.', 'Large dumped waste can block access and create environmental or health hazards.', array['illegal dumping', 'dumped waste', 'huge amount of garbage', 'large pile of waste']),
  ('fallen-tree', 'Fallen Tree', 'Parks / Municipal Services', 'High', 0.920, 0.980, 'The evidence is consistent with a fallen tree affecting a public route.', 'A fallen tree can block vehicles or pedestrians and may create an immediate safety risk.', array['fallen tree', 'tree blocking', 'tree across', 'collapsed tree']),
  ('broken-streetlight', 'Broken Streetlight', 'Street Lighting / Electricity Department', 'Medium', 0.840, 0.940, 'The reported fixture appears damaged or not operating as intended.', 'Reduced street lighting can lower visibility and public safety after dark.', array['broken streetlight', 'streetlight off', 'lamp not working', 'light not working']),
  ('fallen-pole', 'Fallen Streetlight / Utility Pole', 'Street Lighting / Electricity Department', 'Critical', 0.880, 0.970, 'The evidence suggests a fallen lighting or utility structure.', 'A fallen utility structure may expose electrical hazards and requires urgent isolation.', array['fallen pole', 'utility pole down', 'streetlight fell', 'exposed electrical']),
  ('dark-street', 'Dark Street / Poor Lighting', 'Street Lighting / Electricity Department', 'Medium', 0.800, 0.910, 'The description indicates inadequate lighting across a public street area.', 'Poor lighting can reduce visibility and increase risk for road users and pedestrians.', array['dark street', 'completely dark', 'poor lighting', 'no lights at night']),
  ('illegal-parking', 'Illegal Parking', 'Traffic / Enforcement Authority', 'Medium', 0.800, 0.930, 'The vehicle position appears inconsistent with safe or permitted parking.', 'Illegal parking can obstruct access and create traffic or pedestrian hazards.', array['illegal parking', 'parked illegally', 'blocking the sidewalk', 'blocking driveway']),
  ('double-row-parking', 'Double-Row Parking', 'Traffic / Enforcement Authority', 'Medium', 0.820, 0.930, 'Vehicle placement is consistent with double-row parking.', 'Double-row parking reduces usable road width and disrupts traffic flow.', array['double parked', 'double-row', 'second row parking']),
  ('abandoned-vehicle', 'Abandoned Vehicle', 'Traffic / Enforcement Authority', 'Medium', 0.740, 0.890, 'The available context suggests a vehicle may have been left unattended long-term.', 'An abandoned vehicle may occupy public space and require ownership verification.', array['abandoned vehicle', 'abandoned car', 'car left for weeks']),
  ('road-obstruction', 'Road Obstruction', 'Road Maintenance Department', 'High', 0.820, 0.940, 'An object or condition appears to restrict normal road access.', 'A blocked lane can force unsafe maneuvers and disrupt emergency access.', array['road obstruction', 'road blocked', 'blocking the road', 'lane blocked']),
  ('sidewalk-damage', 'Sidewalk Damage', 'Road Maintenance Department', 'Low', 0.800, 0.920, 'The evidence is consistent with localized damage to a pedestrian route.', 'Minor sidewalk damage can create a trip hazard and should be scheduled for repair.', array['sidewalk damage', 'sidewalk crack', 'broken sidewalk', 'footpath damage']),
  ('broken-pavement', 'Broken Pavement', 'Road Maintenance Department', 'Medium', 0.820, 0.930, 'The paved public surface appears cracked, displaced, or broken.', 'Broken pavement may impede safe pedestrian movement and worsen without repair.', array['broken pavement', 'pavement cracked', 'paving blocks broken']),
  ('damaged-curb', 'Damaged Curb', 'Road Maintenance Department', 'Low', 0.780, 0.900, 'The curb edge appears chipped, displaced, or structurally damaged.', 'Curb damage is generally localized but can affect drainage and pedestrian access.', array['damaged curb', 'broken curb', 'kerb damage']),
  ('flooded-street', 'Flooded Street / Water Accumulation', 'Water & Utilities Department', 'High', 0.860, 0.960, 'Visible or described standing water is consistent with street flooding.', 'Deep standing water can restrict traffic and conceal road hazards.', array['flooded street', 'street flooded', 'water accumulation', 'standing water']),
  ('sewage-overflow', 'Sewage Overflow', 'Sanitation Department', 'High', 0.860, 0.960, 'The reported discharge is consistent with an overflowing sanitation line.', 'Sewage overflow presents a significant sanitation and public-health concern.', array['sewage overflow', 'sewer overflow', 'raw sewage', 'sewage water']),
  ('water-leakage', 'Water Leakage', 'Water & Utilities Department', 'Medium', 0.830, 0.940, 'The evidence suggests an active leak from public water infrastructure.', 'Ongoing leakage wastes water and may undermine nearby pavement.', array['water leak', 'water leakage', 'burst pipe', 'leaking pipe']),
  ('broken-manhole', 'Broken Manhole Cover', 'Sanitation Department', 'High', 0.880, 0.960, 'The manhole cover appears damaged and may not safely support traffic.', 'A damaged cover can fail under vehicles or create a serious trip hazard.', array['broken manhole cover', 'cracked manhole', 'damaged manhole cover']),
  ('open-manhole', 'Open Manhole', 'Sanitation Department', 'Critical', 0.910, 0.980, 'The evidence is consistent with an uncovered manhole opening.', 'An open manhole presents an immediate fall and traffic hazard requiring urgent securing.', array['open manhole', 'manhole open', 'missing manhole cover', 'uncovered drain']),
  ('damaged-sign', 'Damaged Traffic Sign', 'Traffic Management Department', 'Medium', 0.840, 0.940, 'The traffic sign appears bent, damaged, or difficult to read.', 'Damaged road signage may reduce guidance and should be inspected.', array['damaged traffic sign', 'broken traffic sign', 'bent sign', 'sign damaged']),
  ('missing-sign', 'Missing Traffic Sign', 'Traffic Management Department', 'High', 0.760, 0.900, 'The context suggests required traffic signage is absent.', 'Missing regulatory signage can create uncertainty and increase collision risk.', array['missing traffic sign', 'sign missing', 'no stop sign']),
  ('damaged-signal', 'Damaged Traffic Signal', 'Traffic Management Department', 'High', 0.870, 0.960, 'The traffic control signal appears damaged or non-operational.', 'A failed traffic signal can create immediate conflict at an intersection.', array['damaged traffic signal', 'traffic light broken', 'signal not working']),
  ('construction-debris', 'Construction Debris', 'Waste Management Department', 'Medium', 0.860, 0.950, 'The materials are consistent with construction or demolition waste in public space.', 'Construction debris can obstruct pedestrian or road access and may contain sharp material.', array['construction debris', 'building rubble', 'broken bricks', 'concrete debris']),
  ('illegal-vendor', 'Illegal Street Vendor / Unauthorized Stall', 'Municipal Enforcement', 'Medium', 0.740, 0.880, 'The available context suggests an unauthorized stall occupying public space.', 'Unauthorized stalls may obstruct movement and require permit verification.', array['illegal vendor', 'unauthorized stall', 'street vendor blocking']),
  ('street-encroachment', 'Illegal Cafe / Street Encroachment', 'Municipal Enforcement', 'Medium', 0.750, 0.890, 'Furniture or commercial activity appears to extend into public access space.', 'Street encroachment can restrict pedestrian access and requires permit review.', array['illegal cafe', 'street encroachment', 'tables blocking sidewalk', 'cafe blocking']),
  ('public-property-damage', 'Public Property Damage', 'Municipal Services / Public Property Department', 'Medium', 0.780, 0.910, 'The evidence suggests damage to publicly maintained property.', 'Damaged public assets may be unsafe or unavailable for community use.', array['public property damage', 'broken public bench', 'municipal property damaged']),
  ('graffiti', 'Graffiti / Vandalism', 'Municipal Services / Public Property Department', 'Low', 0.880, 0.960, 'The marked surface is consistent with graffiti or property vandalism.', 'Graffiti primarily affects public property condition and can be scheduled for removal.', array['graffiti', 'vandalism', 'spray paint on wall']),
  ('fire-smoke', 'Fire / Smoke Hazard', 'Civil Protection / Emergency Authority', 'Critical', 0.880, 0.970, 'The evidence suggests visible fire or smoke requiring emergency assessment.', 'Fire or dense smoke may threaten life and property and requires immediate emergency response.', array['fire', 'smoke hazard', 'burning', 'heavy smoke']),
  ('building-debris', 'Dangerous Building Debris', 'Building Safety / Municipal Engineering', 'Critical', 0.840, 0.950, 'Loose or fallen structural material appears to create a public hazard.', 'Unstable building material can fall without warning and requires urgent isolation.', array['falling building debris', 'dangerous building debris', 'facade collapsing']),
  ('other', 'Other / Unrecognized Civic Issue', 'Manual Routing', 'Low', 0.450, 0.690, 'The available image context is not sufficient for a reliable supported classification.', 'Severity requires review because the issue could not be classified reliably.', array[]::text[])
on conflict (id) do update set
  label = excluded.label,
  department = excluded.department,
  default_severity = excluded.default_severity,
  min_conf = excluded.min_conf,
  max_conf = excluded.max_conf,
  explanation = excluded.explanation,
  severity_reason = excluded.severity_reason,
  keywords = excluded.keywords;

-- Link categories to department IDs
update public.categories c
set department_id = d.id
from public.departments d
where c.department = d.name
  and (c.department_id is null or c.department_id != d.id);

-- ============================================================================
-- 5. REPORTS: Schema alignments, location, and immutable guards
-- ============================================================================
alter table public.reports add column if not exists category_id text references public.categories(id);
alter table public.reports add column if not exists assigned_department_id uuid references public.departments(id);
alter table public.reports add column if not exists assigned_to uuid references auth.users(id);
alter table public.reports add column if not exists duplicate_of uuid references public.reports(id);
alter table public.reports add column if not exists area_name text;
alter table public.reports add column if not exists resolved_at timestamptz;
alter table public.reports add column if not exists location extensions.geography(Point, 4326);

create index if not exists reports_location_gist on public.reports using gist (location);
create index if not exists reports_user_created_idx on public.reports (user_id, created_at desc);

-- Align severity check constraint to include 'Requires Review'
alter table public.reports drop constraint if exists reports_severity_check;
alter table public.reports add constraint reports_severity_check
  check (severity is null or severity in ('Low','Medium','High','Critical','Requires Review'));

-- Align status check constraint
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check check (status in (
  'submitted','ai_analyzed','assigned','under_review','in_progress','resolved',
  'rejected','duplicate','invalid','escalated','manual_review_required'
));

-- Sync location geography from lat/long if not provided
create or replace function public.sync_report_geography()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.longitude is not null and new.latitude is not null and new.location is null then
    begin
      new.location := extensions.st_setsrid(extensions.st_makepoint(new.longitude, new.latitude), 4326)::extensions.geography;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists set_reports_location on public.reports;
create trigger set_reports_location
  before insert or update on public.reports
  for each row execute function public.sync_report_geography();

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- Guard report inserts: enforce status = 'submitted' and null out workflow/AI fields for citizens
create or replace function public.guard_report_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() and not public.is_authority() then
    new.user_id := auth.uid();
    new.status := 'submitted';
    new.severity := null;
    new.department := null;
    new.assigned_department_id := null;
    new.confidence := null;
    new.explanation := null;
    new.secondary_issues := '{}';
    new.requires_manual_review := false;
  else
    new.user_id := coalesce(new.user_id, auth.uid());
    new.status := coalesce(new.status, 'submitted');
  end if;
  return new;
end;
$$;

drop trigger if exists reports_guard_insert on public.reports;
create trigger reports_guard_insert
  before insert on public.reports
  for each row execute function public.guard_report_insert();

-- Guard report updates: enforce immutable fields and block status/workflow modification by non-admins
create or replace function public.guard_report_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.id := old.id;
  new.user_id := old.user_id;
  new.report_code := old.report_code;
  new.created_at := old.created_at;
  new.updated_at := now();

  if not public.is_admin() and not public.is_authority() then
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

drop trigger if exists reports_guard_update on public.reports;
create trigger reports_guard_update
  before update on public.reports
  for each row execute function public.guard_report_update();

-- ============================================================================
-- 6. NOTIFICATIONS
-- ============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  report_id uuid references public.reports(id) on delete cascade,
  type text default 'status_update',
  title text not null,
  body text not null,
  read_at timestamptz,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'citizen read own notifications') then
    create policy "citizen read own notifications" on public.notifications
      for select to authenticated using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'citizen update own notifications') then
    create policy "citizen update own notifications" on public.notifications
      for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'admin read all notifications') then
    create policy "admin read all notifications" on public.notifications
      for select to authenticated using (public.is_admin());
  end if;
end $$;

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- ============================================================================
-- 7. REPORT_EVENTS & AUTOMATIC WORKFLOW TRIGGER
-- ============================================================================
alter table public.report_events add column if not exists actor_id uuid references auth.users(id);
alter table public.report_events add column if not exists actor_role text;
alter table public.report_events add column if not exists note text;

create or replace function public.handle_report_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  role_name text;
  code_text text;
begin
  actor := coalesce(auth.uid(), new.user_id);

  select role into role_name from public.profiles where id = actor;
  if role_name is null then
    role_name := 'system';
  end if;

  code_text := coalesce(new.report_code, 'CG-' || substring(new.id::text, 1, 8));

  if tg_op = 'INSERT' then
    insert into public.report_events (report_id, changed_by, actor_id, actor_role, old_status, new_status, note, created_at)
    values (new.id, actor, actor, role_name, null, new.status, 'Report submitted', now());

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
    if new.status is distinct from old.status then
      if new.status = 'resolved' and (old.status is null or old.status != 'resolved') then
        new.resolved_at := now();
      end if;

      insert into public.report_events (report_id, changed_by, actor_id, actor_role, old_status, new_status, note, created_at)
      values (new.id, actor, actor, role_name, old.status, new.status, 'Status changed to ' || new.status, now());

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
  end if;

  return new;
end;
$$;

drop trigger if exists reports_status_history_trigger on public.reports;
create trigger reports_status_history_trigger
  after insert or update on public.reports
  for each row execute function public.handle_report_status_change();
