-- P6-06 — starting a DM: the same conversation twice is one channel.
--
-- `start_dm()` is `security invoker`, so the assertions worth making are the
-- ones showing it adds no authority: it opens what the caller could have
-- opened by hand, refuses somebody they cannot see, and — the point of the
-- function — hands back the existing channel instead of a second one.
--
-- Tested against supabase/migrations/20260903150000_start_dm.sql.
begin;
select plan(20);

-- ---------------------------------------------------------------- fixtures --
insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

select tests.create_user('staff_a');
select tests.create_user('staff_a2');
select tests.create_user('staff_a3');
select tests.create_user('staff_b');
select tests.create_user('gone');
select tests.create_user('admin');
select tests.create_user('old_admin');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_a2'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_a3'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('gone'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

update public.profiles set active = false where id = tests.get_user_id('gone');
update public.profiles set is_admin = true
where id in (tests.get_user_id('admin'), tests.get_user_id('old_admin'));
update public.profiles set active = false where id = tests.get_user_id('old_admin');

-- --------------------------------------------------------------- structure --
select has_function('public', 'start_dm', array['uuid[]'], 'start_dm exists');
select function_privs_are(
  'public', 'start_dm', array['uuid[]'], 'authenticated', array['EXECUTE'],
  'signed-in people may call it'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.start_dm(uuid[])'::regprocedure),
  false,
  'and it runs as them, not as its owner'
);

-- ---------------------------------------------------------------- starting --
select tests.authenticate_as('staff_a');

-- The channel it opened, kept in a setting because a test that authenticates
-- as somebody has no table of its own to put it in.
select set_config(
  'tests.dm', public.start_dm(array[tests.get_user_id('staff_a2')])::text, false
);

select isnt(current_setting('tests.dm')::uuid, null, 'a DM is opened');
select is(
  (select kind::text from public.channels where id = current_setting('tests.dm')::uuid),
  'dm',
  'as a DM'
);
select ok(
  (select is_private from public.channels where id = current_setting('tests.dm')::uuid),
  'and a private one'
);
select is(
  (select count(*)::int from public.channel_members
   where channel_id = current_setting('tests.dm')::uuid),
  2,
  'with both people in it'
);
select isnt(
  (select member_hash from public.channels where id = current_setting('tests.dm')::uuid),
  null,
  'and the fingerprint the trigger derives'
);

-- ------------------------------------------------------------------ dedupe --
select is(
  public.start_dm(array[tests.get_user_id('staff_a2')]),
  current_setting('tests.dm')::uuid,
  'asking again returns the same channel'
);
select is(
  (select count(*)::int from public.channels where kind = 'dm'),
  1,
  'and opens no second one'
);

-- The other side asking is the same conversation: a DM is its member set, not
-- whoever happened to open it.
select tests.authenticate_as('staff_a2');
select is(
  public.start_dm(array[tests.get_user_id('staff_a')]),
  current_setting('tests.dm')::uuid,
  'and neither does the other person asking'
);

-- Three people are a different conversation, not the same one grown.
select tests.authenticate_as('staff_a');
select isnt(
  public.start_dm(array[tests.get_user_id('staff_a2'), tests.get_user_id('staff_a3')]),
  current_setting('tests.dm')::uuid,
  'a third person makes a different conversation'
);

-- ----------------------------------------------------------------- seating --
-- The policy branch `start_dm()` leans on, asked directly: a DM you opened is
-- one you may seat people in, and somebody else's is not.
select ok(
  public.can_seat_in_dm(current_setting('tests.dm')::uuid),
  'a member may seat somebody in their own DM'
);

select tests.authenticate_as('staff_a3');
select throws_ok(
  format(
    $$ insert into public.channel_members (channel_id, user_id) values (%L, %L) $$,
    current_setting('tests.dm'), tests.get_user_id('staff_a3')
  ),
  '42501',
  null,
  'and nobody else can let themselves into it'
);

select tests.authenticate_as('staff_a');

-- ---------------------------------------------------------------- refusals --
select throws_ok(
  format($$ select public.start_dm(array[%L]::uuid[]) $$, tests.get_user_id('staff_b')),
  'P0001',
  null,
  'a colleague at another gym is not somebody you can message'
);
select throws_ok(
  format($$ select public.start_dm(array[%L]::uuid[]) $$, tests.get_user_id('gone')),
  'P0001',
  null,
  'and neither is a deactivated one'
);
select throws_ok(
  $$ select public.start_dm(array[]::uuid[]) $$,
  'P0001',
  null,
  'a conversation with nobody is not a conversation'
);

-- ------------------------------------------------------- reaching an admin --
select tests.authenticate_as('staff_a');
select lives_ok(
  $$ select public.start_dm(array[tests.get_user_id('admin')]) $$,
  'staff can open a DM with an admin (P7B-03)'
);
select throws_ok(
  $$ select public.start_dm(array[tests.get_user_id('old_admin')]) $$,
  'P0001',
  'Cannot start a conversation with somebody you cannot see',
  'but not with a deactivated admin'
);
select throws_ok(
  $$ select public.start_dm(array[tests.get_user_id('staff_b')]) $$,
  'P0001',
  'Cannot start a conversation with somebody you cannot see',
  'and still not with staff at another gym'
);

select * from finish();
rollback;
