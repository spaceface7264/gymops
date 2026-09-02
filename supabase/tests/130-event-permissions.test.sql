-- P4-11 — events: what is happening, at which gyms, and on which day.
--
-- Events are the one content table whose writing is *not* `can_publish_content()`.
-- A gym manager publishes their own gym's news and guides, but the calendar is
-- run centrally: only a superadmin or an admin adds an event, anywhere. Reading
-- follows `event_gyms` — an event with no rows there is company-wide, one with
-- rows is read by the members of those gyms.
--
-- So the assertions that matter most are the manager ones: a manager must read
-- everything they always could and write nothing here. If `events_insert` ever
-- drifts to `can_publish_content()`, those are what fail.
--
-- Tested against supabase/migrations/20260902200000_events.sql.
begin;
select plan(38);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('super');
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('staff_b');
select tests.create_user('staff_c');

update public.profiles set is_superadmin = true where id = tests.get_user_id('super');
update public.profiles set is_admin = true where id = tests.get_user_id('admin');

insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b'),
  ('33333333-3333-3333-3333-333333333333', 'Gym C', 'gym-c');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff'),
  (tests.get_user_id('staff_c'), '33333333-3333-3333-3333-333333333333', 'staff');

-- --------------------------------------------------------------- structure --
select has_table('public', 'events', 'events exists');
select has_table('public', 'event_gyms', 'event_gyms exists');
select is(
  (select count(*)::int from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('events', 'event_gyms') and relrowsecurity),
  2,
  'RLS is enabled on both event tables'
);
select enum_has_labels(
  'public', 'event_type',
  array['community', 'campaign', 'groups', 'offer', 'other'],
  'the event types are the five the calendar offers'
);
select has_column('public', 'events', 'last_on', 'events carry the generated end day');

-- ----------------------------------------------------------------- writing --
select tests.authenticate_as('admin');
select lives_ok(
  $$ insert into public.events (id, event_type, title, description, starts_on)
     values ('eeeeeeee-0000-0000-0000-000000000001', 'campaign',
             'Summer membership offer', 'Half price for the first month.',
             '2026-06-01') $$,
  'an admin adds an event with no gyms, which is company-wide'
);
select is(
  (select created_by from public.events
   where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  tests.get_user_id('admin'),
  'the author is the session, not the request'
);
select is(
  (select last_on from public.events
   where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  '2026-06-01'::date,
  'a single-date event ends on the day it starts'
);

-- The point of `event_gyms`: two of the three gyms, one event to edit.
select lives_ok(
  $$ insert into public.events (id, event_type, title, starts_on, ends_on,
                                start_time, end_time, link)
     values ('eeeeeeee-0000-0000-0000-000000000002', 'community',
             'Bouldering league', '2026-03-12', '2026-03-14', '19:00', '21:00',
             'https://example.com/league') $$,
  'and a dated range with times and a link'
);
select lives_ok(
  $$ insert into public.event_gyms (event_id, gym_id) values
       ('eeeeeeee-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111'),
       ('eeeeeeee-0000-0000-0000-000000000002',
        '22222222-2222-2222-2222-222222222222') $$,
  'running it at two of the three gyms'
);
select is(
  (select last_on from public.events
   where id = 'eeeeeeee-0000-0000-0000-000000000002'),
  '2026-03-14'::date,
  'a range ends on its last day'
);

select tests.authenticate_as('super');
select lives_ok(
  $$ insert into public.events (id, event_type, title, starts_on)
     values ('eeeeeeee-0000-0000-0000-000000000003', 'groups',
             'Youth club taster', '2026-04-02') $$,
  'a superadmin adds one too'
);
select lives_ok(
  $$ insert into public.event_gyms (event_id, gym_id)
     values ('eeeeeeee-0000-0000-0000-000000000003',
             '33333333-3333-3333-3333-333333333333') $$,
  'at a gym they are not a member of'
);

-- Managing a gym is not running the calendar.
select tests.authenticate_as('manager_a');
select throws_ok(
  $$ insert into public.events (title, starts_on)
     values ('Manager''s own event', '2026-05-01') $$,
  '42501',
  null,
  'a manager cannot add an event'
);
select throws_ok(
  $$ insert into public.event_gyms (event_id, gym_id)
     values ('eeeeeeee-0000-0000-0000-000000000001',
             '11111111-1111-1111-1111-111111111111') $$,
  '42501',
  null,
  'nor pull a company-wide one into the gym they manage'
);
with changed as (
  update public.events set title = 'Renamed by a manager'
  where id = 'eeeeeeee-0000-0000-0000-000000000002' returning 1
)
select is(
  (select count(*)::int from changed), 0, 'nor edit one'
);
with removed as (
  delete from public.event_gyms
  where event_id = 'eeeeeeee-0000-0000-0000-000000000002'
    and gym_id = '11111111-1111-1111-1111-111111111111' returning 1
)
select is(
  (select count(*)::int from removed), 0, 'nor take their gym off one'
);

select tests.authenticate_as('staff_a');
select throws_ok(
  $$ insert into public.events (title, starts_on)
     values ('Staff event', '2026-05-01') $$,
  '42501',
  null,
  'and staff certainly cannot'
);
with removed as (
  delete from public.events
  where id = 'eeeeeeee-0000-0000-0000-000000000002' returning 1
)
select is(
  (select count(*)::int from removed),
  0,
  'nobody deletes an event outright — removing one is setting deleted_at'
);

-- --------------------------------------------------------------- the dates --
select tests.authenticate_as('admin');
select throws_ok(
  $$ insert into public.events (title, starts_on, ends_on)
     values ('Backwards', '2026-06-10', '2026-06-09') $$,
  '23514',
  null,
  'an event cannot end before it starts'
);
select throws_ok(
  $$ insert into public.events (title, starts_on, end_time)
     values ('Ends but never starts', '2026-06-10', '21:00') $$,
  '23514',
  null,
  'an end time with no start time is refused'
);
select throws_ok(
  $$ insert into public.events (title, starts_on, start_time, end_time)
     values ('Backwards in a day', '2026-06-10', '21:00', '19:00') $$,
  '23514',
  null,
  'and on a single day the end time must be after the start'
);
select lives_ok(
  $$ insert into public.events (id, title, starts_on, ends_on, start_time, end_time)
     values ('eeeeeeee-0000-0000-0000-000000000004', 'Overnight',
             '2026-06-10', '2026-06-11', '21:00', '02:00') $$,
  'but across days it may be earlier — that is what the second day is for'
);
-- Kept out of the company-wide pile so the reading counts below stay readable.
insert into public.event_gyms (event_id, gym_id)
values ('eeeeeeee-0000-0000-0000-000000000004',
        '11111111-1111-1111-1111-111111111111');
select throws_ok(
  $$ insert into public.events (title, starts_on, link)
     values ('Dodgy link', '2026-06-10', 'javascript:alert(1)') $$,
  '23514',
  null,
  'a link that is not http(s) is refused'
);
select throws_ok(
  $$ insert into public.events (title, starts_on) values ('  ', '2026-06-10') $$,
  '23514',
  null,
  'an event with no title is refused'
);

-- ----------------------------------------------------------------- reading --
-- The league runs at A and B; the taster only at C; the offer everywhere.
select tests.authenticate_as('staff_a');
select results_eq(
  $$ select title from public.events order by title $$,
  $$ values ('Bouldering league'), ('Overnight'), ('Summer membership offer') $$,
  'gym A reads the events at its own gym and the company-wide one'
);
select tests.authenticate_as('staff_b');
select results_eq(
  $$ select title from public.events order by title $$,
  $$ values ('Bouldering league'), ('Summer membership offer') $$,
  'gym B reads the same league — one event, not a copy — and the company one'
);
select is(
  (select id from public.events where title = 'Bouldering league'),
  'eeeeeeee-0000-0000-0000-000000000002'::uuid,
  'and it really is the same row both gyms are reading'
);
select tests.authenticate_as('staff_c');
select results_eq(
  $$ select title from public.events order by title $$,
  $$ values ('Summer membership offer'), ('Youth club taster') $$,
  'gym C reads its own and the company one, and not the league'
);
select is(
  (select count(*)::int from public.event_gyms
   where event_id = 'eeeeeeee-0000-0000-0000-000000000002'),
  0,
  'the league''s scope rows are invisible to a gym it does not run at'
);
select tests.authenticate_as('staff_b');
select is(
  (select count(*)::int from public.event_gyms
   where event_id = 'eeeeeeee-0000-0000-0000-000000000002'),
  2,
  'while a gym it does run at sees both, so the card can name them'
);
select tests.authenticate_as('manager_a');
select is(
  (select count(*)::int from public.events where title = 'Bouldering league'),
  1,
  'a manager reads their gym''s events even though they cannot write them'
);

-- ------------------------------------------------------------ soft delete --
select tests.authenticate_as('admin');
select lives_ok(
  $$ update public.events set deleted_at = now()
     where id = 'eeeeeeee-0000-0000-0000-000000000002' $$,
  'an admin removes an event by stamping deleted_at'
);
select is(
  (select updated_by from public.events
   where id = 'eeeeeeee-0000-0000-0000-000000000002'),
  tests.get_user_id('admin'),
  'and the edit is stamped with who made it'
);
select is(
  (select count(*)::int from public.events
   where id = 'eeeeeeee-0000-0000-0000-000000000002'),
  1,
  'the admin still sees it, or the row could never be edited again'
);
select tests.authenticate_as('staff_a');
select is(
  (select count(*)::int from public.events
   where id = 'eeeeeeee-0000-0000-0000-000000000002'),
  0,
  'everyone else stops seeing it'
);

-- ------------------------------------------------------- once deactivated --
select tests.become_postgres();
update public.profiles set active = false where id = tests.get_user_id('admin');

select tests.authenticate_as('admin');
select throws_ok(
  $$ insert into public.events (title, starts_on)
     values ('Written while deactivated', '2026-07-01') $$,
  '42501',
  null,
  'a deactivated admin cannot add an event'
);
select is(
  (select count(*)::int from public.events),
  0,
  'and reads none of them either, the company-wide ones included'
);

select * from finish();
rollback;
