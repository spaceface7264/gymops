-- P6-08 — who is told about a chat message, and who is deliberately not.
--
-- The assertions that matter are the silences. Nobody is told about their own
-- message; nobody is told about a channel they have muted; and a name typed in
-- an ordinary channel reaches the person named, not everybody in it. A DM is
-- the other way round — everybody in it, named or not — and is de-duplicated,
-- because a conversation is a stream and an inbox is not.
--
-- Tested against supabase/migrations/20260903140100_chat_notification_trigger.sql.
begin;
select plan(12);

-- ---------------------------------------------------------------- fixtures --
insert into public.gyms (id, name, slug)
values ('77777777-7777-7777-7777-777777777777', 'Gym G', 'gym-g');

update public.channels set id = 'eeeeeeee-0000-0000-0000-000000000001'
where kind = 'gym' and gym_id = '77777777-7777-7777-7777-777777777777';

select tests.create_user('talker');
select tests.create_user('named');
select tests.create_user('bystander');
select tests.create_user('muter');

update public.profiles set full_name = 'Tina Talker' where id = tests.get_user_id('talker');

insert into public.gym_memberships (user_id, gym_id, role)
select tests.get_user_id(who), '77777777-7777-7777-7777-777777777777', 'staff'
from unnest(array['talker', 'named', 'bystander', 'muter']) who;

update public.channel_members set muted = true
where channel_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = tests.get_user_id('muter');

-- A DM between the talker and the person they name.
insert into public.channels (id, kind, name, is_private, created_by)
values ('eeeeeeee-0000-0000-0000-000000000002', 'dm', null, true, tests.get_user_id('talker'));
insert into public.channel_members (channel_id, user_id)
values
  ('eeeeeeee-0000-0000-0000-000000000002', tests.get_user_id('talker')),
  ('eeeeeeee-0000-0000-0000-000000000002', tests.get_user_id('named'));

-- ---------------------------------------------------------------- mentions --
insert into public.messages (channel_id, body, mentions, created_by)
values (
  'eeeeeeee-0000-0000-0000-000000000001',
  'Can you look at wall 4?',
  array[tests.get_user_id('named'), tests.get_user_id('muter')],
  tests.get_user_id('talker')
);

select is(
  (select count(*)::int from public.notifications
   where type = 'chat_mention' and user_id = tests.get_user_id('named')),
  1,
  'the person named is told'
);
select is(
  (select title from public.notifications
   where type = 'chat_mention' and user_id = tests.get_user_id('named')),
  'Tina Talker — Gym G',
  'and told who said it, and where'
);
select is(
  (select body from public.notifications
   where type = 'chat_mention' and user_id = tests.get_user_id('named')),
  'Can you look at wall 4?',
  'with the author''s own words rather than a summary of them'
);
select is(
  (select url from public.notifications
   where type = 'chat_mention' and user_id = tests.get_user_id('named')),
  '/chat/eeeeeeee-0000-0000-0000-000000000001',
  'and a way back to the channel'
);
select is(
  (select count(*)::int from public.notifications
   where type = 'chat_mention' and user_id = tests.get_user_id('bystander')),
  0,
  'somebody merely in the channel is not'
);
select is(
  (select count(*)::int from public.notifications
   where type = 'chat_mention' and user_id = tests.get_user_id('muter')),
  0,
  'and neither is somebody who muted it, name or no name'
);
select is(
  (select count(*)::int from public.notifications
   where type = 'chat_mention' and user_id = tests.get_user_id('talker')),
  0,
  'nobody is told about their own message'
);

-- -------------------------------------------------------------------- DMs --
insert into public.messages (channel_id, body, created_by)
values (
  'eeeeeeee-0000-0000-0000-000000000002',
  'Are you in tomorrow?',
  tests.get_user_id('talker')
);

select is(
  (select count(*)::int from public.notifications
   where type = 'chat_dm' and user_id = tests.get_user_id('named')),
  1,
  'a direct message is told to the other person, named or not'
);
select is(
  (select title from public.notifications
   where type = 'chat_dm' and user_id = tests.get_user_id('named')),
  'Tina Talker',
  'and a DM is titled by who it is from, since it has no channel name'
);

-- A second message in the same conversation, moments later.
insert into public.messages (channel_id, body, created_by)
values (
  'eeeeeeee-0000-0000-0000-000000000002',
  'Or Thursday?',
  tests.get_user_id('talker')
);

select is(
  (select count(*)::int from public.notifications
   where type = 'chat_dm' and user_id = tests.get_user_id('named')),
  1,
  'a conversation is one notification, not one per line'
);

-- A mention inside a DM is not a second event.
insert into public.messages (channel_id, body, mentions, created_by)
values (
  'eeeeeeee-0000-0000-0000-000000000002',
  'Thursday then, @named',
  array[tests.get_user_id('named')],
  tests.get_user_id('talker')
);

select is(
  (select count(*)::int from public.notifications
   where type = 'chat_mention' and user_id = tests.get_user_id('named')),
  1,
  'being named in a two-person conversation raises nothing extra'
);

-- Turning the type off in the inbox stops it, as for every other type (P5-01).
insert into public.notification_prefs (user_id, type, in_app, email, push)
values (tests.get_user_id('bystander'), 'chat_mention', false, false, false);

insert into public.messages (channel_id, body, mentions, created_by)
values (
  'eeeeeeee-0000-0000-0000-000000000001',
  'And you?',
  array[tests.get_user_id('bystander')],
  tests.get_user_id('talker')
);

select is(
  (select count(*)::int from public.notifications
   where type = 'chat_mention' and user_id = tests.get_user_id('bystander')),
  0,
  'the per-type switch silences a mention too'
);

select * from finish();
rollback;
