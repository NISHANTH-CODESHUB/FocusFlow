-- =============================================================================
-- FocusFlow — initial schema
--
-- Design principles
--   * Every table carries user_id and is protected by Row Level Security.
--   * Child rows reference parents through composite (id, user_id) foreign keys,
--     so a row can never point at another user's data, even if a client forges ids.
--   * Planner items are one polymorphic table (category + typed jsonb details)
--     so the planner, calendar, dashboard, career tracker and stats all read
--     the same source of truth.
--   * Timestamps (updated_at / completed_at) are maintained by triggers,
--     never trusted from the client.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.item_category as enum (
  'task', 'test', 'lab', 'assignment', 'project', 'hackathon', 'event',
  'internship', 'dsa', 'aptitude', 'certification', 'custom'
);
create type public.item_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.item_status   as enum ('todo', 'in_progress', 'on_hold', 'completed', 'cancelled');
create type public.concept_status as enum ('not_started', 'learning', 'completed');
create type public.skill_level  as enum ('beginner', 'intermediate', 'advanced', 'expert');
create type public.file_folder  as enum (
  'certificates', 'academic', 'projects', 'resume', 'important', 'study', 'other'
);

-- -----------------------------------------------------------------------------
-- Shared trigger functions
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Keeps completed_at consistent with status for items.
create or replace function public.sync_item_completion()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.progress := 100;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

-- Keeps completed_at consistent with status for concepts.
create or replace function public.sync_concept_completion()
returns trigger language plpgsql as $$
begin
  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 120),
  institution text check (char_length(institution) <= 160),
  program     text check (char_length(program) <= 160),
  graduation_year smallint check (graduation_year between 1990 and 2100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Academic: subjects → units → concepts
-- -----------------------------------------------------------------------------
create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  code        text check (char_length(code) <= 30),
  semester    text check (char_length(semester) <= 40),
  instructor  text check (char_length(instructor) <= 120),
  credits     numeric(4,1) check (credits >= 0 and credits <= 50),
  color       text not null default 'indigo' check (char_length(color) <= 20),
  description text check (char_length(description) <= 4000),
  archived    boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index subjects_user_idx on public.subjects (user_id, archived, position);
create trigger subjects_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

create table public.units (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id  uuid not null,
  title       text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 4000),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);
create index units_subject_idx on public.units (subject_id, position);
create index units_user_idx on public.units (user_id);
create trigger units_updated_at before update on public.units
  for each row execute function public.set_updated_at();

create table public.concepts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unit_id        uuid not null,
  title          text not null check (char_length(title) between 1 and 200),
  status         public.concept_status not null default 'not_started',
  notes          text check (char_length(notes) <= 20000),
  revision_date  date,
  resource_url   text check (char_length(resource_url) <= 2000),
  position       integer not null default 0,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id),
  foreign key (unit_id, user_id) references public.units (id, user_id) on delete cascade
);
create index concepts_unit_idx on public.concepts (unit_id, position);
create index concepts_user_status_idx on public.concepts (user_id, status);
create index concepts_revision_idx on public.concepts (user_id, revision_date) where revision_date is not null;
create trigger concepts_updated_at before update on public.concepts
  for each row execute function public.set_updated_at();
create trigger concepts_completion before insert or update of status on public.concepts
  for each row execute function public.sync_concept_completion();

-- -----------------------------------------------------------------------------
-- Planner items (tasks, tests, labs, projects, internships, DSA, ...)
-- -----------------------------------------------------------------------------
create table public.items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  description  text check (char_length(description) <= 10000),
  category     public.item_category not null default 'task',
  priority     public.item_priority not null default 'medium',
  status       public.item_status not null default 'todo',
  start_at     timestamptz,
  due_at       timestamptz,
  all_day      boolean not null default false,
  progress     smallint not null default 0 check (progress between 0 and 100),
  notes        text check (char_length(notes) <= 20000),
  tags         text[] not null default '{}' check (cardinality(tags) <= 20),
  -- Category specific fields (company, issuer, difficulty, repo url, ...),
  -- validated in the application layer by a per-category schema.
  details      jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  subject_id   uuid,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id),
  check (start_at is null or due_at is null or start_at <= due_at),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id)
);
create index items_user_due_idx      on public.items (user_id, due_at);
create index items_user_category_idx on public.items (user_id, category, status);
create index items_user_completed_idx on public.items (user_id, completed_at) where completed_at is not null;
create index items_subject_idx       on public.items (subject_id) where subject_id is not null;
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();
create trigger items_completion before insert or update of status on public.items
  for each row execute function public.sync_item_completion();

-- -----------------------------------------------------------------------------
-- Career: skills & achievements
-- -----------------------------------------------------------------------------
create table public.skills (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  area        text not null default 'general' check (char_length(area) <= 40),
  level       public.skill_level not null default 'beginner',
  progress    smallint not null default 0 check (progress between 0 and 100),
  target_date date,
  notes       text check (char_length(notes) <= 10000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);
create index skills_user_idx on public.skills (user_id, area);
create trigger skills_updated_at before update on public.skills
  for each row execute function public.set_updated_at();

create table public.achievements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 4000),
  kind        text not null default 'other' check (char_length(kind) <= 40),
  achieved_on date not null default current_date,
  url         text check (char_length(url) <= 2000),
  item_id     uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (item_id, user_id) references public.items (id, user_id) on delete set null (item_id)
);
create index achievements_user_idx on public.achievements (user_id, achieved_on desc);
create trigger achievements_updated_at before update on public.achievements
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Files (metadata; bytes live in Supabase Storage bucket "user-files")
-- -----------------------------------------------------------------------------
create table public.files (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 255),
  storage_path text not null unique check (char_length(storage_path) <= 1024),
  mime_type    text,
  size_bytes   bigint not null default 0 check (size_bytes >= 0),
  folder       public.file_folder not null default 'other',
  description  text check (char_length(description) <= 2000),
  tags         text[] not null default '{}' check (cardinality(tags) <= 20),
  subject_id   uuid,
  unit_id      uuid,
  concept_id   uuid,
  item_id      uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Objects must live under the owner's folder: "<user_id>/..."
  check (split_part(storage_path, '/', 1) = user_id::text),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (unit_id, user_id)    references public.units (id, user_id)    on delete set null (unit_id),
  foreign key (concept_id, user_id) references public.concepts (id, user_id) on delete set null (concept_id),
  foreign key (item_id, user_id)    references public.items (id, user_id)    on delete set null (item_id)
);
create index files_user_folder_idx on public.files (user_id, folder, created_at desc);
create index files_subject_idx on public.files (subject_id) where subject_id is not null;
create index files_unit_idx    on public.files (unit_id)    where unit_id is not null;
create index files_concept_idx on public.files (concept_id) where concept_id is not null;
create index files_item_idx    on public.files (item_id)    where item_id is not null;
create trigger files_updated_at before update on public.files
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security — owner-only access on every table
-- -----------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.subjects     enable row level security;
alter table public.units        enable row level security;
alter table public.concepts     enable row level security;
alter table public.items        enable row level security;
alter table public.skills       enable row level security;
alter table public.achievements enable row level security;
alter table public.files        enable row level security;

create policy "profiles: owner read"   on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: owner update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array['subjects','units','concepts','items','skills','achievements','files'] loop
    execute format('create policy "%1$s: owner select" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: owner insert" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: owner update" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: owner delete" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Anonymous users get nothing; authenticated users get table privileges,
-- which RLS then narrows to their own rows.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: private bucket, objects namespaced by user id
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('user-files', 'user-files', false, 52428800)  -- 50 MB per object
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "user-files: owner select" on storage.objects for select to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user-files: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user-files: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "user-files: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
