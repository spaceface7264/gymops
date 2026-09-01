-- P1-05: permission matrix (PROJECT_SPEC.md §2.1) for the core tables from P1-04:
-- gyms, profiles, gym_memberships, invites, audit_log.
--
-- Every user acts through RLS via tests.authenticate_as(); fixtures are built as
-- postgres. Run `npm run db:reset` before `npm run db:test`.
begin;
select plan(33);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('super');
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('outsider');

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
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff');

-- --------------------------------------------------------------- structure --
select has_table('public', 'gyms', 'gyms table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'gym_memberships', 'gym_memberships table exists');
select has_table('public', 'invites', 'invites table exists');
select has_table('public', 'audit_log', 'audit_log table exists');

select is(
  (select count(*)::int from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('gyms', 'profiles', 'gym_memberships', 'invites', 'audit_log')
     and relrowsecurity),
  5,
  'RLS is enabled on all five core tables'
);

select is(
  (select count(*)::int from public.profiles where id = tests.get_user_id('staff_a')),
  1,
  'a new auth user gets a profile row'
);

-- -------------------------------------------------------------------- gyms --
select tests.clear_authentication();
select is(
  (select count(*)::int from public.gyms),
  0,
  'anon cannot read gyms'
);

select tests.authenticate_as('staff_a');
select is(
  (select count(*)::int from public.gyms where slug in ('gym-a', 'gym-b')),
  2,
  'any authenticated user can read gyms, including ones they are not a member of'
);
select throws_ok(
  $$ insert into public.gyms (name, slug) values ('Gym C', 'gym-c') $$,
  '42501',
  null,
  'staff cannot create a gym'
);

select tests.authenticate_as('admin');
select throws_ok(
  $$ insert into public.gyms (name, slug) values ('Gym C', 'gym-c') $$,
  '42501',
  null,
  'admin cannot create a gym (superadmin only)'
);
with changed as (
  update public.gyms set name = 'Renamed' where slug = 'gym-a' returning 1
)
select is((select count(*)::int from changed), 0, 'admin cannot rename a gym');

select tests.authenticate_as('super');
select lives_ok(
  $$ insert into public.gyms (name, slug) values ('Gym C', 'gym-c') $$,
  'superadmin can create a gym'
);
with changed as (
  update public.gyms set active = false where slug = 'gym-c' returning 1
)
select is((select count(*)::int from changed), 1, 'superadmin can deactivate a gym');

-- ---------------------------------------------------------------- profiles --
select tests.authenticate_as('staff_a');
select results_eq(
  $$ select id from public.profiles $$,
  $$ select tests.get_user_id('staff_a') $$,
  'staff only sees their own profile'
);
with changed as (
  update public.profiles set full_name = 'Staff A' where id = tests.get_user_id('staff_a') returning 1
)
select is((select count(*)::int from changed), 1, 'a user can edit their own profile');
select throws_ok(
  format(
    $$ update public.profiles set is_admin = true where id = %L $$,
    tests.get_user_id('staff_a')
  ),
  'P0001',
  null,
  'a user cannot promote themselves to admin'
);

select tests.authenticate_as('manager_a');
select is(
  (select count(*)::int from public.profiles where email like '%@example.test'),
  2,
  'manager sees themselves and the members of their gyms'
);

select tests.authenticate_as('admin');
select is(
  (select count(*)::int from public.profiles where email like '%@example.test'),
  5,
  'admin sees every profile'
);
select throws_ok(
  format(
    $$ update public.profiles set is_admin = true where id = %L $$,
    tests.get_user_id('outsider')
  ),
  'P0001',
  null,
  'admin cannot promote another user to admin'
);
with changed as (
  update public.profiles set active = false where id = tests.get_user_id('outsider') returning 1
)
select is((select count(*)::int from changed), 1, 'admin can deactivate a user');

select tests.authenticate_as('super');
with changed as (
  update public.profiles set is_admin = true where id = tests.get_user_id('outsider') returning 1
)
select is((select count(*)::int from changed), 1, 'superadmin can promote a user to admin');

-- -------------------------------------------------------- gym_memberships --
select tests.authenticate_as('staff_a');
select throws_ok(
  format(
    $$ insert into public.gym_memberships (user_id, gym_id, role)
       values (%L, '22222222-2222-2222-2222-222222222222', 'staff') $$,
    tests.get_user_id('outsider')
  ),
  '42501',
  null,
  'staff cannot assign anyone to a gym'
);

select tests.authenticate_as('manager_a');
select lives_ok(
  format(
    $$ insert into public.gym_memberships (user_id, gym_id, role)
       values (%L, '11111111-1111-1111-1111-111111111111', 'staff') $$,
    tests.get_user_id('outsider')
  ),
  'manager can add staff to their own gym'
);
select throws_ok(
  format(
    $$ insert into public.gym_memberships (user_id, gym_id, role)
       values (%L, '11111111-1111-1111-1111-111111111111', 'manager') $$,
    tests.get_user_id('super')
  ),
  '42501',
  null,
  'manager cannot create another manager'
);
select throws_ok(
  format(
    $$ insert into public.gym_memberships (user_id, gym_id, role)
       values (%L, '22222222-2222-2222-2222-222222222222', 'staff') $$,
    tests.get_user_id('outsider')
  ),
  '42501',
  null,
  'manager cannot assign staff to a gym they do not manage'
);

select tests.authenticate_as('admin');
select lives_ok(
  format(
    $$ insert into public.gym_memberships (user_id, gym_id, role)
       values (%L, '22222222-2222-2222-2222-222222222222', 'manager') $$,
    tests.get_user_id('manager_a')
  ),
  'admin can assign any role in any gym'
);

-- ----------------------------------------------------------------- invites --
select tests.authenticate_as('manager_a');
select lives_ok(
  $$ insert into public.invites (email, gym_id, role)
     values ('new-staff@example.test', '11111111-1111-1111-1111-111111111111', 'staff') $$,
  'manager can invite staff to their own gym'
);
select throws_ok(
  $$ insert into public.invites (email, gym_id, role)
     values ('new-manager@example.test', '11111111-1111-1111-1111-111111111111', 'manager') $$,
  '42501',
  null,
  'manager cannot invite a manager'
);
select throws_ok(
  $$ insert into public.invites (email, as_admin) values ('new-admin@example.test', true) $$,
  '42501',
  null,
  'manager cannot invite an admin'
);

select tests.authenticate_as('staff_a');
select is(
  (select count(*)::int from public.invites),
  0,
  'staff cannot read invites'
);

-- --------------------------------------------------------------- audit_log --
select tests.become_postgres();
insert into public.audit_log (actor_id, action, entity_type, entity_id)
values (tests.get_user_id('admin'), 'role.granted', 'profiles', tests.get_user_id('outsider'));

select tests.authenticate_as('admin');
select is(
  (select count(*)::int from public.audit_log),
  0,
  'admin cannot read the audit log'
);

select tests.authenticate_as('super');
select isnt(
  (select count(*)::int from public.audit_log),
  0,
  'superadmin can read the audit log'
);

select * from finish();
rollback;
