-- P6C-18 — reactions: four emoji, one row per person per emoji per line, added
-- or taken away and never edited.
--
-- What matters: the message decides the channel and the caller decides only
-- the emoji (a client cannot file a reaction under a channel it is not in, or
-- as somebody else); a deleted line takes none; reading an open channel is
-- not being in it, so an admin who can see a gym's channel cannot react in it
-- without a seat; a DM's reactions are as private as its lines; and a
-- reaction changes nothing about what is unread.
--
-- Tested against supabase/migrations/20260905110000_chat_reply_reactions.sql.
begin;
select plan(15);

-- ---------------------------------------------------------------- fixtures --
insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

update public.channels set id = 'aaaaaaaa-0000-0000-0000-000000000001'
where kind = 'gym' and gym_id = '11111111-1111-1111-1111-111111111111';
update public.channels set id = 'aaaaaaaa-0000-0000-0000-000000000002'
where kind = 'gym' and gym_id = '22222222-2222-2222-2222-222222222222';

select tests.create_user('admin');
select tests.create_user('staff_a');
select tests.create_user('staff_a2');
select tests.create_user('staff_b');

update public.profiles set is_admin = true where id = tests.get_user_id('admin');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_a2'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

-- A DM between the two Gym A staff.
insert into public.channels (id, kind, name, is_private, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000006', 'dm', null, true, tests.get_user_id('staff_a'));
insert into public.channel_members (channel_id, user_id)
values
  ('aaaaaaaa-0000-0000-0000-000000000006', tests.get_user_id('staff_a')),
  ('aaaaaaaa-0000-0000-0000-000000000006', tests.get_user_id('staff_a2'));

insert into public.messages (id, channel_id, body, created_by)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Wall 4 is taped off', tests.get_user_id('staff_a')),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Gone soon', tests.get_user_id('staff_a')),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000006', 'Just us', tests.get_user_id('staff_a'));

update public.messages set deleted_at = now()
where id = 'bbbbbbbb-0000-0000-0000-000000000002';

-- ------------------------------------------------------------- reacting --
select tests.authenticate_as('staff_a2');

select lives_ok(
  $$ insert into public.message_reactions (message_id, channel_id, user_id, emoji)
     values ('bbbbbbbb-0000-0000-0000-000000000001',
             'aaaaaaaa-0000-0000-0000-000000000002',
             tests.get_user_id('staff_a'), '👍') $$,
  'a member reacts, whatever channel and person the client claimed'
);

select is(
  (select channel_id::text || '|' || (user_id = tests.get_user_id('staff_a2'))::text
   from public.message_reactions where message_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'aaaaaaaa-0000-0000-0000-000000000001|true',
  'the message decided the channel and the session decided the person'
);

select throws_ok(
  $$ insert into public.message_reactions (message_id, channel_id, emoji)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '👍') $$,
  '23505',
  null,
  'the same emoji twice is one reaction'
);

select throws_ok(
  $$ insert into public.message_reactions (message_id, channel_id, emoji)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '🎉') $$,
  '23514',
  null,
  'only the four emoji count'
);

select throws_ok(
  $$ insert into public.message_reactions (message_id, channel_id, emoji)
     values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '👍') $$,
  '23514',
  'cannot react to a deleted message',
  'a deleted line takes no reactions'
);

update public.message_reactions set emoji = '✅'
where message_id = 'bbbbbbbb-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.message_reactions where emoji = '✅'),
  0,
  'a reaction is never edited into another'
);

-- ------------------------------------------------------- other people --
select tests.authenticate_as('staff_a');

select is(
  (select count(*)::int from public.message_reactions
   where message_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  1,
  'a colleague in the channel sees the reaction'
);

delete from public.message_reactions
where message_id = 'bbbbbbbb-0000-0000-0000-000000000001';

select tests.authenticate_as('staff_a2');
select is(
  (select count(*)::int from public.message_reactions
   where message_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  1,
  'but cannot take it away'
);

delete from public.message_reactions
where message_id = 'bbbbbbbb-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.message_reactions
   where message_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  0,
  'the person who reacted can'
);

-- ------------------------------------------------- reading is not a seat --
select tests.authenticate_as('admin');
select throws_ok(
  $$ insert into public.message_reactions (message_id, channel_id, emoji)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '👀') $$,
  '42501',
  null,
  'an admin who can read the gym''s channel cannot react without a seat in it'
);

-- ---------------------------------------------------------------- the DM --
select tests.authenticate_as('staff_a');
insert into public.message_reactions (message_id, channel_id, emoji)
values ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000006', '❤️');

select tests.authenticate_as('staff_b');
select is(
  (select count(*)::int from public.message_reactions
   where message_id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  0,
  'a DM''s reactions are as private as its lines'
);

select tests.authenticate_as('admin');
select is(
  (select count(*)::int from public.message_reactions
   where message_id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  0,
  'from an admin too'
);

select tests.clear_authentication();
set local role anon;
select is(
  (select count(*)::int from public.message_reactions),
  0,
  'and nothing is visible signed out'
);
reset role;

-- ----------------------------------------------------------------- unread --
-- staff_a2 has read nothing since joining; a reaction on their colleague's
-- line must not become a line to read.
select tests.authenticate_as('staff_a2');
update public.channel_members set last_read_at = now()
where channel_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = tests.get_user_id('staff_a2');

select tests.authenticate_as('staff_a');
insert into public.message_reactions (message_id, channel_id, emoji)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '✅');

select tests.authenticate_as('staff_a2');
select is(
  (select unread from public.chat_overview()
   where channel_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0,
  'a reaction is not something to read'
);

select is(
  (select count(*)::int from public.message_reactions
   where message_id = 'bbbbbbbb-0000-0000-0000-000000000001' and emoji = '✅'),
  1,
  'though it is there to see'
);

select * from finish();
rollback;
