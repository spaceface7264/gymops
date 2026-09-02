-- P4-04: the Realtime side of the run screen — which table is published and
-- who may join a checklist channel.
begin;
select plan(8);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
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
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

-- ------------------------------------------------------------- publication --
select is(
  (select count(*)::int from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public' and tablename = 'checklist_run_items'),
  1,
  'checklist_run_items is published to Realtime'
);
select is(
  (select count(*)::int from pg_policy
   where polrelid = 'realtime.messages'::regclass
     and polname = 'checklists_realtime_listen'),
  1,
  'private channels are opened by a policy on realtime.messages'
);

-- ----------------------------------------------------------------- topics --
select tests.authenticate_as('staff_a');
select ok(
  public.can_listen_to_checklists('checklists:11111111-1111-1111-1111-111111111111'),
  'staff join their own gym''s channel'
);
select ok(
  not public.can_listen_to_checklists('checklists:22222222-2222-2222-2222-222222222222'),
  'and not another gym''s'
);
select ok(
  not public.can_listen_to_checklists('checklists:all'),
  'the "all gyms" channel is not theirs either'
);

select tests.authenticate_as('admin');
select ok(public.can_listen_to_checklists('checklists:all'), 'an admin joins "all gyms"');
select ok(
  public.can_listen_to_checklists('checklists:22222222-2222-2222-2222-222222222222'),
  'and any single gym'
);

-- A topic that is not a checklist channel, and one carrying something that is
-- not a gym id, are both simply refused rather than raising.
select ok(
  not public.can_listen_to_checklists('checklists:; drop table gyms')
    and not public.can_listen_to_checklists('chat:11111111-1111-1111-1111-111111111111'),
  'anything else is refused, malformed topics included'
);

select * from finish();
rollback;
