-- P4-06 — the daily log: a per-gym timeline of handover, note and issue
-- entries (spec §2.2), with tags. "Write daily log" is the same rule as
-- ticking a checklist — the gyms you belong to, plus the company-wide roles —
-- so the policies reuse `can_complete_in()` (spec §2.1).
--
-- Tested by supabase/tests/100-daily-log.test.sql.

-- ============================================================== profiles ==

-- A handover log without an author is a note from nobody. Until now a staff
-- member could read only their own profile (P3 left this for P6, "if the chat
-- member list needs it"); the daily log needs it first, and it also brings
-- back the names on "who ticked this item" (P4-04). Colleagues are people you
-- share a gym with.
-- `gym_memberships` has RLS of its own and a staff member cannot read a
-- colleague's row, so the overlap has to be asked in a definer function.
create function public.shares_gym_with(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user()
    and exists (
      select 1 from public.gym_memberships m
      where m.user_id = target_user and m.gym_id in (select public.member_gym_ids())
    );
$$;

grant execute on function public.shares_gym_with(uuid) to authenticated;

comment on function public.shares_gym_with(uuid) is
  'True when the signed-in user and target_user are members of the same gym.';

drop policy profiles_select on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.gym_memberships m
      where m.user_id = profiles.id and m.gym_id in (select public.managed_gym_ids())
    )
    -- Colleagues: somebody you share a gym with.
    or public.shares_gym_with(profiles.id)
  );

-- ============================================================== daily log ==

create type public.daily_log_kind as enum ('handover', 'note', 'issue');

-- Always a gym's: there is no company-wide shift to hand over.
create table public.daily_log_entries (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms on delete cascade,
  kind public.daily_log_kind not null default 'note',
  body text not null,
  -- Free-form and lower-cased by trigger, so "#Broken" and "broken" are one
  -- tag. Ten is more than any shift note needs.
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- References `profiles`, not `auth.users` like the content tables, so the
  -- timeline can ask for the author's name in the same query — the same reason
  -- `checklist_run_items.done_by` does (P4-01).
  created_by uuid references public.profiles on delete set null,
  updated_by uuid references public.profiles on delete set null,
  deleted_at timestamptz,
  constraint daily_log_entries_body_check check (btrim(body) <> ''),
  constraint daily_log_entries_tags_check check (cardinality(tags) <= 10)
);

comment on table public.daily_log_entries is
  'Per-gym shift timeline: handover, note and issue entries. Soft-deleted.';

create index daily_log_entries_gym_idx
  on public.daily_log_entries (gym_id, created_at desc)
  where deleted_at is null;

create index daily_log_entries_tags_idx on public.daily_log_entries using gin (tags);

-- ============================================================== triggers ==

create trigger daily_log_entries_set_updated_at before update on public.daily_log_entries
  for each row execute function public.set_updated_at();
create trigger daily_log_entries_set_created_by before insert on public.daily_log_entries
  for each row execute function public.set_created_by();

create function public.normalize_daily_log_tags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.tags := coalesce(
    (
      select array_agg(distinct tag order by tag)
      from unnest(new.tags) as raw(value)
      cross join lateral (select nullif(btrim(lower(raw.value)), '')) as cleaned(tag)
      where cleaned.tag is not null
    ),
    '{}'
  );

  return new;
end;
$$;

create trigger daily_log_entries_normalize_tags
  before insert or update on public.daily_log_entries
  for each row execute function public.normalize_daily_log_tags();

-- A manager may take an entry off the timeline, but not rewrite what somebody
-- else said on their shift: for anyone other than the author, `deleted_at` is
-- the only column that may move.
create function public.guard_daily_log_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.gym_id := old.gym_id;

  if auth.uid() is distinct from old.created_by then
    new.body := old.body;
    new.kind := old.kind;
    new.tags := old.tags;
  end if;

  return new;
end;
$$;

create trigger daily_log_entries_guard_edit
  before update on public.daily_log_entries
  for each row execute function public.guard_daily_log_edit();

-- ================================================================== RLS ==

alter table public.daily_log_entries enable row level security;

-- Everyone who may read the gym's content reads its log. A deleted entry
-- stays visible to the author and the gym's managers — Postgres refuses an
-- update that would hide the row from the writer, which is how soft delete was
-- broken everywhere else (20260902171000) — and the timeline filters it out.
create policy daily_log_entries_select on public.daily_log_entries
  for select to authenticated
  using (
    public.can_read_content(gym_id)
    and (
      deleted_at is null
      or created_by = auth.uid()
      or public.can_publish_content(gym_id)
    )
  );

create policy daily_log_entries_insert on public.daily_log_entries
  for insert to authenticated with check (public.can_complete_in(gym_id));

-- The author edits their own entry; a manager of that gym (or an admin) can
-- only remove one, which the trigger above enforces column by column.
create policy daily_log_entries_update on public.daily_log_entries
  for update to authenticated
  using (
    public.can_complete_in(gym_id)
    and (created_by = auth.uid() or public.can_publish_content(gym_id))
  )
  with check (
    public.can_complete_in(gym_id)
    and (created_by = auth.uid() or public.can_publish_content(gym_id))
  );
