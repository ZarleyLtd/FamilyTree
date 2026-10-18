-- FamilyTree schema on the shared Apps project.
-- Qualify every object. Do not touch other apps' schemas.
-- RLS on, no anon/authenticated policies: only the Edge Function (service role) reads/writes.

create extension if not exists pg_trgm with schema extensions;

create schema if not exists familytree;

grant usage on schema familytree to postgres, service_role;
revoke all on schema familytree from anon, authenticated, public;

create or replace function familytree.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- trees
-- ---------------------------------------------------------------------------
create table familytree.trees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  share_code text not null unique,
  admin_code_hash text not null,
  settings jsonb not null default jsonb_build_object(
    'homePersonId', null,
    'livingAgeLimit', 110,
    'defaultChartGenerations', 4
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trees_touch_updated_at
  before update on familytree.trees
  for each row execute function familytree.touch_updated_at();

-- ---------------------------------------------------------------------------
-- contributors / invites / sessions (circular FKs added after both exist)
-- ---------------------------------------------------------------------------
create table familytree.contributors (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references familytree.trees (id) on delete cascade,
  handle text not null,
  display_name text not null,
  password_hash text not null,
  role text not null default 'contributor'
    check (role in ('contributor', 'admin')),
  self_person_id uuid,
  invite_id uuid,
  disabled_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  auth_user_id uuid,
  unique (tree_id, handle)
);

create trigger contributors_touch_updated_at
  before update on familytree.contributors
  for each row execute function familytree.touch_updated_at();

create table familytree.invites (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references familytree.trees (id) on delete cascade,
  purpose text not null check (purpose in ('register', 'reset')),
  code_hash text not null unique,
  label text,
  contributor_id uuid,
  created_by uuid,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_tree_pending_idx
  on familytree.invites (tree_id, used_at);

create table familytree.sessions (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references familytree.contributors (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index sessions_contributor_idx
  on familytree.sessions (contributor_id)
  where revoked_at is null;

alter table familytree.invites
  add constraint invites_contributor_fk
    foreign key (contributor_id) references familytree.contributors (id) on delete set null,
  add constraint invites_created_by_fk
    foreign key (created_by) references familytree.contributors (id) on delete set null;

alter table familytree.contributors
  add constraint contributors_invite_fk
    foreign key (invite_id) references familytree.invites (id) on delete set null;

-- ---------------------------------------------------------------------------
-- persons, families, events, places
-- ---------------------------------------------------------------------------
create table familytree.persons (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references familytree.trees (id) on delete cascade,
  given_names text not null default '',
  surname text not null default '',
  birth_surname text,
  nickname text,
  suffix text,
  sex text not null default 'U' check (sex in ('M', 'F', 'U')),
  is_living boolean,
  privacy text not null default 'normal' check (privacy in ('normal', 'private')),
  profile_media_id uuid,
  bio text,
  birth_year int,
  death_year int,
  birth_place_short text,
  death_place_short text,
  birth_date_text text,
  death_date_text text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index persons_tree_name_idx
  on familytree.persons (tree_id, surname, given_names)
  where deleted_at is null;

create index persons_name_trgm_idx
  on familytree.persons
  using gin ((coalesce(surname, '') || ' ' || coalesce(given_names, '')) extensions.gin_trgm_ops);

create trigger persons_touch_updated_at
  before update on familytree.persons
  for each row execute function familytree.touch_updated_at();

alter table familytree.contributors
  add constraint contributors_self_person_fk
    foreign key (self_person_id) references familytree.persons (id) on delete set null;

create table familytree.families (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references familytree.trees (id) on delete cascade,
  partner1_id uuid references familytree.persons (id) on delete set null,
  partner2_id uuid references familytree.persons (id) on delete set null,
  relationship_type text not null default 'unknown'
    check (relationship_type in ('married', 'partners', 'unknown')),
  status text check (status in ('together', 'divorced', 'separated', 'widowed')),
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index families_partner1_idx on familytree.families (tree_id, partner1_id);
create index families_partner2_idx on familytree.families (tree_id, partner2_id);

create trigger families_touch_updated_at
  before update on familytree.families
  for each row execute function familytree.touch_updated_at();

create table familytree.family_children (
  family_id uuid not null references familytree.families (id) on delete cascade,
  child_id uuid not null references familytree.persons (id) on delete cascade,
  relation_type text not null default 'birth'
    check (relation_type in ('birth', 'adopted', 'step', 'foster', 'unknown')),
  seq int not null default 0,
  primary key (family_id, child_id)
);

create index family_children_child_idx on familytree.family_children (child_id);

create table familytree.places (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references familytree.trees (id) on delete cascade,
  name text not null,
  parent_place_id uuid references familytree.places (id) on delete set null,
  place_type text,
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger places_touch_updated_at
  before update on familytree.places
  for each row execute function familytree.touch_updated_at();

create table familytree.events (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references familytree.trees (id) on delete cascade,
  person_id uuid references familytree.persons (id) on delete cascade,
  family_id uuid references familytree.families (id) on delete cascade,
  type text not null
    check (type in (
      'birth', 'baptism', 'marriage', 'divorce', 'death', 'burial',
      'census', 'residence', 'occupation', 'education',
      'emigration', 'immigration', 'military', 'retirement', 'custom'
    )),
  title text,
  date_text text,
  date_sort date,
  date_end_sort date,
  date_qualifier text not null default 'unknown'
    check (date_qualifier in ('exact', 'about', 'before', 'after', 'between', 'estimated', 'unknown')),
  place_id uuid references familytree.places (id) on delete set null,
  place_text text,
  description text,
  is_private boolean not null default false,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((person_id is not null)::int + (family_id is not null)::int = 1)
);

create index events_person_date_idx on familytree.events (person_id, date_sort);
create index events_family_date_idx on familytree.events (family_id, date_sort);
create index events_tree_type_idx on familytree.events (tree_id, type);

create trigger events_touch_updated_at
  before update on familytree.events
  for each row execute function familytree.touch_updated_at();

-- ---------------------------------------------------------------------------
-- media, notes, change log
-- ---------------------------------------------------------------------------
create table familytree.media (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references familytree.trees (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  mime_type text not null,
  byte_size int not null,
  width int,
  height int,
  kind text not null default 'photo'
    check (kind in (
      'photo', 'portrait', 'document', 'census', 'certificate',
      'grave', 'homestead', 'map', 'other'
    )),
  title text,
  caption text,
  date_text text,
  date_sort date,
  date_qualifier text,
  place_id uuid references familytree.places (id) on delete set null,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger media_touch_updated_at
  before update on familytree.media
  for each row execute function familytree.touch_updated_at();

alter table familytree.persons
  add constraint persons_profile_media_fk
    foreign key (profile_media_id) references familytree.media (id) on delete set null;

create table familytree.media_links (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references familytree.media (id) on delete cascade,
  target_type text not null check (target_type in ('person', 'family', 'event', 'place')),
  target_id uuid not null,
  is_primary boolean not null default false,
  region jsonb,
  seq int not null default 0
);

create index media_links_target_idx on familytree.media_links (target_type, target_id);
create index media_links_media_idx on familytree.media_links (media_id);

create table familytree.notes (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references familytree.trees (id) on delete cascade,
  target_type text not null
    check (target_type in ('person', 'family', 'event', 'media', 'place', 'tree')),
  target_id uuid not null,
  kind text not null default 'note' check (kind in ('note', 'research', 'todo')),
  body text not null,
  done_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index notes_target_idx on familytree.notes (target_type, target_id);

create trigger notes_touch_updated_at
  before update on familytree.notes
  for each row execute function familytree.touch_updated_at();

create table familytree.change_log (
  id bigserial primary key,
  tree_id uuid not null references familytree.trees (id) on delete cascade,
  actor_id uuid references familytree.contributors (id) on delete set null,
  actor_name text,
  action text not null
    check (action in ('create', 'update', 'delete', 'restore', 'merge', 'upload', 'revert')),
  target_type text not null,
  target_id uuid,
  summary text,
  before jsonb,
  after jsonb,
  reverted_by bigint references familytree.change_log (id) on delete set null,
  created_at timestamptz not null default now()
);

create index change_log_tree_created_idx on familytree.change_log (tree_id, created_at desc);
create index change_log_target_idx on familytree.change_log (target_type, target_id);

-- ---------------------------------------------------------------------------
-- RLS: enabled, no policies for anon/authenticated
-- ---------------------------------------------------------------------------
alter table familytree.trees enable row level security;
alter table familytree.contributors enable row level security;
alter table familytree.invites enable row level security;
alter table familytree.sessions enable row level security;
alter table familytree.persons enable row level security;
alter table familytree.families enable row level security;
alter table familytree.family_children enable row level security;
alter table familytree.places enable row level security;
alter table familytree.events enable row level security;
alter table familytree.media enable row level security;
alter table familytree.media_links enable row level security;
alter table familytree.notes enable row level security;
alter table familytree.change_log enable row level security;

grant all on all tables in schema familytree to postgres, service_role;
grant all on all sequences in schema familytree to postgres, service_role;
grant execute on all functions in schema familytree to postgres, service_role;

alter default privileges in schema familytree
  grant all on tables to postgres, service_role;
alter default privileges in schema familytree
  grant all on sequences to postgres, service_role;

revoke all on all tables in schema familytree from anon, authenticated, public;
revoke all on all sequences in schema familytree from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Storage bucket (public read, UUID paths; writes via service role)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'familytree',
  'familytree',
  true,
  153600,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists familytree_public_read on storage.objects;
create policy familytree_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'familytree');
