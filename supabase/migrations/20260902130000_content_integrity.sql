-- Hardening after the phase-3 audit (2026-09-02).
--
-- Two holes, both found by driving the real API rather than by reading:
--
--   1. Deactivating a user removed nothing. `is_admin()`/`is_superadmin()`
--      checked `profiles.active`, but `member_gym_ids()`, `managed_gym_ids()`
--      and `can_read_content()` did not, and GoTrue never knew the column
--      existed — a deactivated member kept reading their gym and could still
--      sign in.
--   2. Acknowledgements were whatever the client posted. A reader could confirm
--      a guide as version 9999 (so they would never be asked again), backdate
--      the confirmation by years, and confirm content they were not allowed to
--      read at all.
--
-- Tested by supabase/tests/060-content-integrity.test.sql.

-- ==================================================== 1. deactivated users ==

create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.active from public.profiles p where p.id = auth.uid()), false);
$$;

grant execute on function public.is_active_user() to authenticated;

comment on function public.is_active_user() is
  'False for a deactivated account. Every read of gym content goes through it.';

-- A membership only counts while the account is active, which is what makes
-- deactivation take effect everywhere these two are used — including the
-- phases that are not written yet.
create or replace function public.member_gym_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.gym_id
  from public.gym_memberships m
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid() and p.active;
$$;

create or replace function public.managed_gym_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.gym_id
  from public.gym_memberships m
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid() and m.role = 'manager' and p.active;
$$;

-- Company-wide content was readable by anyone signed in, deactivated or not.
create or replace function public.can_read_content(target_gym_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_active_user()
    and (
      target_gym_id is null
      or public.is_admin()
      or target_gym_id in (select public.member_gym_ids())
    );
$$;

-- Reading the gym list is how the switcher and every scope label work, so it
-- follows the same rule.
drop policy gyms_select on public.gyms;

create policy gyms_select on public.gyms
  for select to authenticated using (public.is_active_user());

-- RLS cannot reach a session that already holds a valid access token, so the
-- auth user is banned as well: GoTrue then refuses both sign-in and refresh,
-- and the open session dies at the next refresh instead of at nothing.
--
-- The ban is a far-future date rather than `infinity`, which GoTrue cannot
-- parse — it answered a sign-in with a 500 "Database error querying schema"
-- until this was a real timestamp.
create function public.sync_auth_ban()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active is distinct from old.active then
    update auth.users
    set banned_until = case
      when new.active then null
      else '9999-12-31 23:59:59+00'::timestamptz
    end
    where id = new.id;
  end if;

  return new;
end;
$$;

create trigger profiles_sync_auth_ban
  after update on public.profiles
  for each row execute function public.sync_auth_ban();

-- ===================================================== 2. acknowledgements ==

-- `read_at` is the first time the post was opened and `acknowledged_at` the
-- first time it was confirmed; both are the database's clock, not the client's.
-- The existence check runs under the caller's own RLS, so "you may confirm what
-- you may read" needs no second copy of the rules.
create function public.guard_post_read()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Seeds and service-role calls behave as they do under RLS.
  if current_user <> 'authenticated' then
    return new;
  end if;

  if not exists (
    select 1 from public.posts p where p.id = new.post_id and p.status = 'published'
  ) then
    raise exception 'Cannot record a read of a post you cannot see';
  end if;

  if tg_op = 'INSERT' then
    new.read_at := now();
    new.acknowledged_at := case when new.acknowledged_at is null then null else now() end;
  else
    new.read_at := old.read_at;
    new.acknowledged_at := coalesce(
      old.acknowledged_at,
      case when new.acknowledged_at is null then null else now() end
    );
  end if;

  return new;
end;
$$;

create trigger post_reads_guard
  before insert or update on public.post_reads
  for each row execute function public.guard_post_read();

-- A confirmation is always for the version the guide is on at that moment. The
-- client sending a version is how "never ask me again" was one request away.
create function public.guard_guide_ack()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  published_version integer;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  select g.version into published_version
  from public.guides g
  where g.id = new.guide_id and g.status = 'published';

  if published_version is null then
    raise exception 'Cannot confirm a guide you cannot see';
  end if;

  new.version := published_version;
  new.acknowledged_at := now();

  return new;
end;
$$;

create trigger guide_acks_guard
  before insert or update on public.guide_acks
  for each row execute function public.guard_guide_ack();
