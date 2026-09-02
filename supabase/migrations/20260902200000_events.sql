-- P4-11 — events: the calendar. What is happening, where, and on which day.
--
-- Spec §2.2: title, description, type, an optional link and either a single
-- date or a range, with times when the time matters.
--
-- Scope is not the usual nullable `gym_id`. An event runs at any number of
-- gyms — two of the three during a campaign, all of them for an offer — so the
-- gyms are rows in `event_gyms` and an event with none of them is
-- company-wide. That keeps one event to edit rather than a copy per gym, and
-- `on delete cascade` cleans the rows up when a gym goes.
--
-- Writing is the exception to the content rules. Every other content table
-- uses `can_publish_content()`, which lets a manager publish in their own gym;
-- the calendar is run centrally, so adding and editing events is `is_admin()`
-- — admins and superadmins, anywhere, and nobody else.
--
-- Dates are stored as a date plus an optional time rather than a timestamptz:
-- a league night at 19:00 is 19:00 at the gym for everyone reading about it,
-- and a company-wide event has no gym timezone to render an instant in.
--
-- Tested by supabase/tests/130-event-permissions.test.sql.

create type public.event_type as enum
  ('community', 'campaign', 'groups', 'offer', 'other');

-- ================================================================ tables ==

create table public.events (
  id uuid primary key default gen_random_uuid(),
  event_type public.event_type not null default 'other',
  title text not null,
  description text not null default '',
  link text,
  starts_on date not null,
  start_time time,
  -- Null means it is over on the day it starts.
  ends_on date,
  end_time time,
  -- The last day it runs, so "is it over yet" and the month window are one
  -- indexable column rather than a coalesce repeated in every query.
  last_on date generated always as (coalesce(ends_on, starts_on)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles on delete set null,
  updated_by uuid references public.profiles on delete set null,
  deleted_at timestamptz,
  constraint events_title_check check (btrim(title) <> ''),
  -- Rendered as a link a member clicks, so the scheme is not the client's to
  -- choose: javascript: and data: never reach the page.
  constraint events_link_check check (link is null or link ~* '^https?://'),
  constraint events_range_check check (ends_on is null or ends_on >= starts_on),
  -- An end time needs a start time to be an end of anything. On a single day
  -- it must be later; across days it may be earlier, which is what the second
  -- day is for.
  constraint events_time_order_check check (
    end_time is null
    or (start_time is not null
        and (coalesce(ends_on, starts_on) > starts_on or end_time > start_time))
  )
);

comment on table public.events is
  'The calendar. Written by admins, read by everyone at the gyms in event_gyms.';

create index events_window_idx on public.events (last_on, starts_on)
  where deleted_at is null;

-- Which gyms an event runs at. No rows is company-wide, so "everyone" is the
-- absence of a restriction rather than a row per gym that has to be kept in
-- step as gyms open and close.
create table public.event_gyms (
  event_id uuid not null references public.events on delete cascade,
  gym_id uuid not null references public.gyms on delete cascade,
  primary key (event_id, gym_id)
);

comment on table public.event_gyms is
  'The gyms an event runs at. No rows for an event means company-wide.';

create index event_gyms_gym_idx on public.event_gyms (gym_id);

-- ============================================================== triggers ==

create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger events_set_created_by before insert on public.events
  for each row execute function public.set_created_by();

-- =================================================================== rls ==

-- `can_read_content()` takes one gym; an event has a set of them. Security
-- definer because it reads `event_gyms`, whose own policy calls back into
-- this: without it the two policies would evaluate each other.
create function public.can_read_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user()
    and (
      public.is_admin()
      -- No gyms at all: company-wide.
      or not exists (
        select 1 from public.event_gyms g where g.event_id = target_event_id
      )
      or exists (
        select 1 from public.event_gyms g
        where g.event_id = target_event_id
          and g.gym_id in (select public.member_gym_ids())
      )
    );
$$;

grant execute on function public.can_read_event(uuid) to authenticated;

alter table public.events enable row level security;
alter table public.event_gyms enable row level security;

-- Admins see everything, soft-deleted rows included: a row an editor cannot
-- read is a row they can never edit again, which is what 20260902171000 fixed
-- for posts and guides.
create policy events_select on public.events
  for select to authenticated using (
    public.is_admin() or (deleted_at is null and public.can_read_event(id))
  );

create policy events_insert on public.events
  for insert to authenticated with check (public.is_admin());

create policy events_update on public.events
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- No delete policy on events: deleting is setting deleted_at (spec §2.5).

-- The scope rows follow the event they belong to. Which other gyms an event
-- also runs at is not a secret — every signed-in user may read the gym list
-- already (`gyms_select`).
create policy event_gyms_select on public.event_gyms
  for select to authenticated using (
    public.is_admin() or public.can_read_event(event_id)
  );

-- Editing an event's gyms is deleting the rows and writing the new ones, so
-- unlike the event itself this table does have a delete policy.
create policy event_gyms_insert on public.event_gyms
  for insert to authenticated with check (public.is_admin());

create policy event_gyms_delete on public.event_gyms
  for delete to authenticated using (public.is_admin());
