-- P1-04 — core schema: gyms, profiles, gym_memberships, invites, audit_log,
-- plus the RLS helper functions every later feature builds on.
--
-- Permission matrix: PROJECT_SPEC.md §2.1. Conventions: §5.
-- Tested by supabase/tests/010-core-permissions.test.sql (P1-05).

-- ============================================================ enum types ==

create type public.gym_role as enum ('manager', 'staff');
create type public.invite_status as enum ('pending', 'accepted', 'revoked');

-- ================================================================ tables ==

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  city text,
  -- Checklist runs are generated at 03:00 gym-local (P4-02).
  timezone text not null default 'Europe/Copenhagen',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null
);

comment on table public.gyms is 'One row per physical gym. Deactivated, never deleted.';

-- id = auth user id. is_superadmin/is_admin are company-wide; per-gym roles
-- live in gym_memberships.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  phone text,
  is_superadmin boolean not null default false,
  is_admin boolean not null default false,
  locale text not null default 'da' check (locale in ('en', 'da')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users on delete set null
);

create table public.gym_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  gym_id uuid not null references public.gyms on delete cascade,
  role public.gym_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  unique (user_id, gym_id)
);

create index gym_memberships_gym_id_idx on public.gym_memberships (gym_id);
create index gym_memberships_user_id_idx on public.gym_memberships (user_id);

-- One pending invite per email. The Edge Function `invite` (P2-03) sends the
-- mail; this row records what the person becomes when they accept.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  gym_id uuid references public.gyms on delete cascade,
  role public.gym_role,
  as_admin boolean not null default false,
  status public.invite_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  constraint invites_scope_check check (
    (as_admin and gym_id is null and role is null)
    or (not as_admin and gym_id is not null and role is not null)
  )
);

create unique index invites_pending_email_idx
  on public.invites (lower(email))
  where status = 'pending';

-- Written only by security-definer triggers (P2-06) and Edge Functions.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  gym_id uuid references public.gyms on delete set null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- ====================================================== helper functions ==

-- Read profiles/memberships as owner: policies on those tables would otherwise
-- recurse into themselves.

create function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_superadmin and p.active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- True for superadmins too: they can do everything an admin can (spec §2.1).
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (p.is_admin or p.is_superadmin) and p.active
     from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create function public.member_gym_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.gym_id from public.gym_memberships m where m.user_id = auth.uid();
$$;

create function public.managed_gym_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.gym_id from public.gym_memberships m
  where m.user_id = auth.uid() and m.role = 'manager';
$$;

grant execute on function
  public.is_superadmin(), public.is_admin(),
  public.member_gym_ids(), public.managed_gym_ids()
to authenticated;

-- ============================================================== triggers ==

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create function public.set_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create trigger gyms_set_updated_at before update on public.gyms
  for each row execute function public.set_updated_at();
create trigger gyms_set_created_by before insert on public.gyms
  for each row execute function public.set_created_by();

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger gym_memberships_set_updated_at before update on public.gym_memberships
  for each row execute function public.set_updated_at();
create trigger gym_memberships_set_created_by before insert on public.gym_memberships
  for each row execute function public.set_created_by();

create trigger invites_set_updated_at before update on public.invites
  for each row execute function public.set_updated_at();
create trigger invites_set_created_by before insert on public.invites
  for each row execute function public.set_created_by();

-- Every auth user gets a profile. Invite metadata (locale, name) is carried in
-- raw_user_meta_data by the invite function (P2-03).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, locale)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'locale', 'da')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS cannot restrict which columns an update touches, so the privileged
-- columns are guarded here: only a superadmin grants admin rights, only an
-- admin activates or deactivates a user.
create function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Seeds, migrations and service-role calls bypass this guard, exactly as they
  -- bypass RLS; it exists to constrain end-user requests.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if (new.is_superadmin is distinct from old.is_superadmin
      or new.is_admin is distinct from old.is_admin)
     and not public.is_superadmin() then
    raise exception 'Only a superadmin can change admin rights';
  end if;

  if new.active is distinct from old.active and not public.is_admin() then
    raise exception 'Only an admin can activate or deactivate a user';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ================================================================== RLS ==

alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.gym_memberships enable row level security;
alter table public.invites enable row level security;
alter table public.audit_log enable row level security;

-- gyms: everyone signed in reads them; only a superadmin manages them.
create policy gyms_select on public.gyms
  for select to authenticated using (true);

create policy gyms_insert on public.gyms
  for insert to authenticated with check (public.is_superadmin());

create policy gyms_update on public.gyms
  for update to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- profiles: yourself, anyone in a gym you manage, everyone if you are an admin.
create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.gym_memberships m
      where m.user_id = profiles.id and m.gym_id in (select public.managed_gym_ids())
    )
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- gym_memberships: managers see and staff their own gyms; admins do anything.
create policy gym_memberships_select on public.gym_memberships
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or gym_id in (select public.managed_gym_ids())
  );

create policy gym_memberships_insert on public.gym_memberships
  for insert to authenticated with check (
    public.is_admin()
    or (role = 'staff' and gym_id in (select public.managed_gym_ids()))
  );

create policy gym_memberships_update on public.gym_memberships
  for update to authenticated
  using (public.is_admin() or (role = 'staff' and gym_id in (select public.managed_gym_ids())))
  with check (public.is_admin() or (role = 'staff' and gym_id in (select public.managed_gym_ids())));

create policy gym_memberships_delete on public.gym_memberships
  for delete to authenticated using (
    public.is_admin()
    or (role = 'staff' and gym_id in (select public.managed_gym_ids()))
  );

-- invites: admins invite anyone; managers invite staff to their own gyms.
create policy invites_select on public.invites
  for select to authenticated using (
    public.is_admin() or gym_id in (select public.managed_gym_ids())
  );

create policy invites_insert on public.invites
  for insert to authenticated with check (
    public.is_admin()
    or (not as_admin and role = 'staff' and gym_id in (select public.managed_gym_ids()))
  );

create policy invites_update on public.invites
  for update to authenticated
  using (public.is_admin() or gym_id in (select public.managed_gym_ids()))
  with check (
    public.is_admin()
    or (not as_admin and role = 'staff' and gym_id in (select public.managed_gym_ids()))
  );

-- audit_log: superadmin reads, nobody writes from a client.
create policy audit_log_select on public.audit_log
  for select to authenticated using (public.is_superadmin());
