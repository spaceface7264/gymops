-- P2-06: the audit triggers on the privileged columns.
--
-- What is recorded, by whom, and that a client still cannot write or read the
-- log unless it is a superadmin.
begin;
select plan(13);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('super');
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');

update public.profiles set is_superadmin = true, is_admin = true
where id = tests.get_user_id('super');
update public.profiles set is_admin = true where id = tests.get_user_id('admin');

insert into public.gyms (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a');

insert into public.gym_memberships (user_id, gym_id, role)
values (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager');

-- The fixtures above already exercise the membership trigger as postgres.
select is(
  (select count(*)::int from public.audit_log
   where action = 'membership.granted'
     and entity_type = 'gym_membership'
     and gym_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'granting a membership writes one audit row'
);

delete from public.audit_log;

-- --------------------------------------------------------------- profiles --
select tests.authenticate_as('super');
update public.profiles set is_admin = true where id = tests.get_user_id('manager_a');

select is(
  (select count(*)::int from public.audit_log where action = 'profile.privileges_changed'),
  1,
  'promoting a user to admin writes one audit row'
);
select is(
  (select actor_id from public.audit_log where action = 'profile.privileges_changed'),
  tests.get_user_id('super'),
  'the audit row records who made the change'
);
select is(
  (select entity_id from public.audit_log where action = 'profile.privileges_changed'),
  tests.get_user_id('manager_a'),
  'the audit row records whose privileges changed'
);
select is(
  (select before ->> 'is_admin' || '->' || (after ->> 'is_admin')
   from public.audit_log where action = 'profile.privileges_changed'),
  'false->true',
  'the audit row records the before and after values'
);

-- The log has no delete policy, so clear it as postgres between sections.
select tests.become_postgres();
delete from public.audit_log;

-- A non-privileged column must not produce noise.
select tests.authenticate_as('staff_a');
update public.profiles set full_name = 'Staff A' where id = tests.get_user_id('staff_a');
select tests.become_postgres();
select is(
  (select count(*)::int from public.audit_log),
  0,
  'editing your own name writes nothing to the audit log'
);

select tests.authenticate_as('admin');
update public.profiles set active = false where id = tests.get_user_id('staff_a');
select tests.become_postgres();
select is(
  (select count(*)::int from public.audit_log
   where action = 'profile.privileges_changed' and (after ->> 'active') = 'false'),
  1,
  'deactivating a user is audited'
);

delete from public.audit_log;

-- ------------------------------------------------------- gym_memberships --
select tests.authenticate_as('admin');
insert into public.gym_memberships (user_id, gym_id, role)
values (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff');
select tests.become_postgres();
select is(
  (select count(*)::int from public.audit_log where action = 'membership.granted'),
  1,
  'an admin granting a membership is audited'
);

select tests.authenticate_as('admin');
update public.gym_memberships set role = 'manager'
where user_id = tests.get_user_id('staff_a');
select tests.become_postgres();
select is(
  (select before ->> 'role' || '->' || (after ->> 'role')
   from public.audit_log where action = 'membership.role_changed'),
  'staff->manager',
  'a role change records both roles'
);

select tests.authenticate_as('admin');
update public.gym_memberships set updated_at = now()
where user_id = tests.get_user_id('staff_a');
select tests.become_postgres();
select is(
  (select count(*)::int from public.audit_log where action = 'membership.role_changed'),
  1,
  'an update that leaves the role alone writes nothing'
);

select tests.authenticate_as('admin');
delete from public.gym_memberships where user_id = tests.get_user_id('staff_a');
select tests.become_postgres();
select is(
  (select count(*)::int from public.audit_log where action = 'membership.revoked'),
  1,
  'revoking a membership is audited'
);

-- -------------------------------------------------------------- read/write --
select tests.authenticate_as('admin');
select is(
  (select count(*)::int from public.audit_log),
  0,
  'an admin cannot read the audit log'
);

select throws_ok(
  $$insert into public.audit_log (action, entity_type) values ('forged', 'profile')$$,
  '42501',
  null,
  'a client cannot write an audit row'
);

select * from finish();
rollback;
