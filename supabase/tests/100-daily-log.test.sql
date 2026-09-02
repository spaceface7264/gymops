-- P4-06: the daily log — who may write in it, who may edit what, and the tags.
-- Also the widened `profiles` read: colleagues are people you share a gym with
-- (the daily log is the first screen that needs an author's name).
begin;
select plan(16);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('staff_a2');
select tests.create_user('staff_b');

update public.profiles set is_admin = true where id = tests.get_user_id('admin');

insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_a2'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

-- ------------------------------------------------------- colleague names --
select tests.authenticate_as('staff_a');
select ok(
  exists (select 1 from public.profiles where id = tests.get_user_id('staff_a2')),
  'staff read the profile of somebody they share a gym with'
);
select ok(
  not exists (select 1 from public.profiles where id = tests.get_user_id('staff_b')),
  'and not one from a gym they have nothing to do with'
);

-- ------------------------------------------------------------- structure --
select has_table('public', 'daily_log_entries', 'daily_log_entries exists');
select throws_ok(
  $$ insert into public.daily_log_entries (gym_id, body)
     values ('11111111-1111-1111-1111-111111111111', '   ') $$,
  '23514',
  null,
  'an entry with nothing in it is refused'
);

-- ---------------------------------------------------------------- writing --
select lives_ok(
  $$ insert into public.daily_log_entries (id, gym_id, kind, body, tags)
     values ('aaaaaaaa-0000-0000-0000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'handover',
             'Wall 4 is taped off', '{"  Wall4 ", "wall4", "BROKEN", ""}') $$,
  'staff write in their own gym''s log'
);
select results_eq(
  $$ select tags from public.daily_log_entries
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ values (array['broken', 'wall4']) $$,
  'tags are trimmed, lower-cased, de-duplicated and sorted'
);
select is(
  (select created_by from public.daily_log_entries
   where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  tests.get_user_id('staff_a'),
  'the author is the session, not the request'
);
select throws_ok(
  $$ insert into public.daily_log_entries (gym_id, body)
     values ('22222222-2222-2222-2222-222222222222', 'From the wrong gym') $$,
  '42501',
  null,
  'and not in a gym they do not belong to'
);

-- ---------------------------------------------------------------- reading --
select tests.authenticate_as('staff_b');
select is(
  (select count(*)::int from public.daily_log_entries),
  0,
  'another gym''s log is not theirs to read'
);

select tests.authenticate_as('staff_a2');
select is(
  (select count(*)::int from public.daily_log_entries),
  1,
  'a colleague on the same shift reads it'
);

-- ---------------------------------------------------------------- editing --
with changed as (
  update public.daily_log_entries set body = 'Rewritten by a colleague'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1
)
select is(
  (select count(*)::int from changed),
  0,
  'one staff member cannot touch another''s entry'
);

select tests.authenticate_as('staff_a');
select lives_ok(
  $$ update public.daily_log_entries set body = 'Wall 4 is taped off until Friday'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'the author edits their own entry'
);

select tests.authenticate_as('manager_a');
update public.daily_log_entries set body = 'A manager''s rewrite', kind = 'note'
where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select results_eq(
  $$ select body, kind::text from public.daily_log_entries
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ values ('Wall 4 is taped off until Friday', 'handover') $$,
  'a manager cannot rewrite what somebody said on their shift'
);
select lives_ok(
  $$ update public.daily_log_entries set deleted_at = now()
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'but can take the entry off the timeline'
);

select tests.authenticate_as('staff_a2');
select is(
  (select count(*)::int from public.daily_log_entries),
  0,
  'a removed entry is gone for everybody else'
);

-- The author and the gym's managers keep seeing it, which is what lets them
-- remove it at all: Postgres refuses an update that hides the row from its own
-- writer (20260902171000). The timeline asks for `deleted_at is null`.
select tests.authenticate_as('staff_a');
select is(
  (select count(*)::int from public.daily_log_entries
   where id = 'aaaaaaaa-0000-0000-0000-000000000001' and deleted_at is not null),
  1,
  'the author can still see that their entry was removed'
);

select * from finish();
rollback;
