-- Hardening after the phase-3 audit (2026-09-02):
--   1. a deactivated user keeps no access at all
--   2. an acknowledgement records what the database saw, not what the client
--      claimed, and can only be given for content the person may read
--   3. admins are part of a company-wide acknowledgement audience
--
-- Every assertion here failed before `20260902130000_content_integrity.sql`.
begin;
select plan(19);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('super');
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('staff_b');

update public.profiles set is_superadmin = true, is_admin = true
where id = tests.get_user_id('super');
update public.profiles set is_admin = true where id = tests.get_user_id('admin');

insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

insert into public.posts (id, gym_id, title, status, requires_ack)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', null, 'Company news', 'published', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Gym A news', 'published', false),
  ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
   'Gym B news', 'published', true),
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Gym A draft', 'draft', true);

insert into public.guides (id, gym_id, title, status, requires_ack, version)
values
  ('cccccccc-0000-0000-0000-000000000001', null, 'Opening the gym', 'published', true, 3),
  ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'Gym B routing', 'published', true, 1);

-- ============================================ 1. deactivation removes access ==

select tests.authenticate_as('staff_a');
select isnt(
  (select count(*)::int from public.posts),
  0,
  'an active member reads their gym''s news'
);

select tests.become_postgres();
update public.profiles set active = false where id = tests.get_user_id('staff_a');

select tests.authenticate_as('staff_a');
select is(
  (select count(*)::int from public.posts),
  0,
  'a deactivated member reads no news at all, company-wide included'
);
select is(
  (select count(*)::int from public.guides),
  0,
  'a deactivated member reads no guides'
);
select is(
  (select count(*)::int from public.guide_categories),
  0,
  'a deactivated member reads no guide categories'
);
select is(
  (select count(*)::int from public.gyms),
  0,
  'a deactivated member cannot even list the gyms'
);
select throws_ok(
  format(
    $$ insert into public.post_reads (post_id, user_id)
       values ('aaaaaaaa-0000-0000-0000-000000000001', %L) $$,
    tests.get_user_id('staff_a')
  ),
  null,
  null,
  'a deactivated member cannot record a read'
);
select is(
  (select count(*)::int from public.profiles where id = tests.get_user_id('staff_a')),
  1,
  'a deactivated member still sees their own profile, so the app can say why'
);
select is(
  (select count(*)::int from public.profiles),
  1,
  'a deactivated person sees only themselves, not the admins'
);

select tests.become_postgres();
select is(
  (select banned_until from auth.users where id = tests.get_user_id('staff_a')),
  '9999-12-31 23:59:59+00'::timestamptz,
  'deactivating bans the auth user, so the session cannot be refreshed'
);

update public.profiles set active = true where id = tests.get_user_id('staff_a');
select is(
  (select banned_until from auth.users where id = tests.get_user_id('staff_a')),
  null,
  'reactivating lifts the ban'
);

select tests.authenticate_as('staff_a');
select isnt(
  (select count(*)::int from public.posts),
  0,
  'a reactivated member reads their gym''s news again'
);

-- ======================================= 2. acknowledgements are the server's ==

select tests.authenticate_as('staff_a');
insert into public.post_reads (post_id, user_id, read_at, acknowledged_at)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  tests.get_user_id('staff_a'),
  '2019-01-01T00:00:00Z',
  '2019-01-01T00:00:00Z'
);
select ok(
  (select read_at from public.post_reads
   where post_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and user_id = tests.get_user_id('staff_a')) > '2020-01-01T00:00:00Z'::timestamptz,
  'a backdated read is stamped with the time the database saw it'
);
select ok(
  (select acknowledged_at from public.post_reads
   where post_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     and user_id = tests.get_user_id('staff_a')) > '2020-01-01T00:00:00Z'::timestamptz,
  'a backdated acknowledgement is stamped with the time the database saw it'
);

select throws_ok(
  format(
    $$ insert into public.post_reads (post_id, user_id)
       values ('aaaaaaaa-0000-0000-0000-000000000003', %L) $$,
    tests.get_user_id('staff_a')
  ),
  null,
  null,
  'nobody can acknowledge a post they are not allowed to read'
);
select throws_ok(
  format(
    $$ insert into public.post_reads (post_id, user_id)
       values ('aaaaaaaa-0000-0000-0000-000000000004', %L) $$,
    tests.get_user_id('staff_a')
  ),
  null,
  null,
  'nobody can acknowledge a draft'
);

insert into public.guide_acks (guide_id, user_id, version, acknowledged_at)
values (
  'cccccccc-0000-0000-0000-000000000001',
  tests.get_user_id('staff_a'),
  9999,
  '2019-01-01T00:00:00Z'
);
select is(
  (select version from public.guide_acks
   where guide_id = 'cccccccc-0000-0000-0000-000000000001'
     and user_id = tests.get_user_id('staff_a')),
  3,
  'an acknowledgement records the guide''s real version, not the one claimed'
);
select ok(
  (select acknowledged_at from public.guide_acks
   where guide_id = 'cccccccc-0000-0000-0000-000000000001'
     and user_id = tests.get_user_id('staff_a')) > '2020-01-01T00:00:00Z'::timestamptz,
  'a backdated guide acknowledgement is stamped by the database'
);
select throws_ok(
  format(
    $$ insert into public.guide_acks (guide_id, user_id, version)
       values ('cccccccc-0000-0000-0000-000000000002', %L, 1) $$,
    tests.get_user_id('staff_a')
  ),
  null,
  null,
  'nobody can confirm a guide they are not allowed to read'
);

-- The re-acknowledgement path: the version follows the guide.
select tests.become_postgres();
update public.guides set version = 4 where id = 'cccccccc-0000-0000-0000-000000000001';

select tests.authenticate_as('staff_a');
insert into public.guide_acks (guide_id, user_id, version)
values ('cccccccc-0000-0000-0000-000000000001', tests.get_user_id('staff_a'), 1)
on conflict (guide_id, user_id) do update set version = excluded.version;
select is(
  (select version from public.guide_acks
   where guide_id = 'cccccccc-0000-0000-0000-000000000001'
     and user_id = tests.get_user_id('staff_a')),
  4,
  'confirming again records the version the guide is on now'
);

select * from finish();
rollback;
