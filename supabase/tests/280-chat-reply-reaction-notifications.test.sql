-- P6C-17 / P6C-18 — who is told about a reply to their line, and a reaction
-- to it, and who is deliberately not.
--
-- Still one insert, at most one notification per person: a reply that also
-- names the quoted author raises the mention row and not a second one; a
-- reply in a DM is a DM; nobody is told about their own line, a muted channel,
-- or the assistant's line; and a line reacted to by three colleagues in a
-- minute is one inbox row, not three.
--
-- Tested against supabase/migrations/20260905110200_chat_reply_reaction_notifications.sql.
begin;
select plan(14);

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
update public.profiles set full_name = 'Nils Named' where id = tests.get_user_id('named');

insert into public.gym_memberships (user_id, gym_id, role)
select tests.get_user_id(who), '77777777-7777-7777-7777-777777777777', 'staff'
from unnest(array['talker', 'named', 'bystander', 'muter']) who;

update public.channel_members set muted = true
where channel_id = 'eeeeeeee-0000-0000-0000-000000000001'
  and user_id = tests.get_user_id('muter');

insert into public.channels (id, kind, name, is_private, created_by)
values ('eeeeeeee-0000-0000-0000-000000000002', 'dm', null, true, tests.get_user_id('talker'));
insert into public.channel_members (channel_id, user_id)
values
  ('eeeeeeee-0000-0000-0000-000000000002', tests.get_user_id('talker')),
  ('eeeeeeee-0000-0000-0000-000000000002', tests.get_user_id('named'));

-- The lines that get answered and reacted to.
insert into public.messages (id, channel_id, body, created_by)
values
  ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'Who has the crate key?', tests.get_user_id('named')),
  ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', 'Muted line', tests.get_user_id('muter')),
  ('ffffffff-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000002', 'DM line', tests.get_user_id('named'));
insert into public.messages (id, channel_id, body, from_assistant)
values ('ffffffff-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000001', 'The guide says Thursday.', true);

-- ---------------------------------------------------------------- replies --
insert into public.messages (channel_id, body, created_by, reply_to)
values ('eeeeeeee-0000-0000-0000-000000000001', 'I do, in the office', tests.get_user_id('talker'), 'ffffffff-0000-0000-0000-000000000001');

select is(
  (select count(*)::int from public.notifications
   where type = 'chat_reply' and user_id = tests.get_user_id('named')),
  1,
  'the person answered is told'
);
select is(
  (select title || '|' || body || '|' || url from public.notifications
   where type = 'chat_reply' and user_id = tests.get_user_id('named')),
  'Tina Talker — Gym G|I do, in the office|/chat/eeeeeeee-0000-0000-0000-000000000001',
  'who answered, where, with their words, and a way back'
);
select is(
  (select count(*)::int from public.notifications
   where type = 'chat_reply' and user_id <> tests.get_user_id('named')),
  0,
  'and nobody else is'
);

insert into public.messages (channel_id, body, created_by, reply_to)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Answering myself', tests.get_user_id('named'), 'ffffffff-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.notifications
   where type = 'chat_reply' and user_id = tests.get_user_id('named')),
  1,
  'not for answering your own line'
);

insert into public.messages (channel_id, body, created_by, reply_to)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Answering the muter', tests.get_user_id('talker'), 'ffffffff-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.notifications
   where type = 'chat_reply' and user_id = tests.get_user_id('muter')),
  0,
  'nor for somebody who muted the channel'
);

insert into public.messages (channel_id, body, mentions, created_by, reply_to)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Named and answered', array[tests.get_user_id('named')], tests.get_user_id('talker'), 'ffffffff-0000-0000-0000-000000000001');
select is(
  (select string_agg(type::text, ',' order by type) from public.notifications
   where user_id = tests.get_user_id('named') and body = 'Named and answered'),
  'chat_mention',
  'a reply that also names the person raises the mention row and not a second one'
);

insert into public.messages (channel_id, body, created_by, reply_to)
values ('eeeeeeee-0000-0000-0000-000000000002', 'DM answer', tests.get_user_id('talker'), 'ffffffff-0000-0000-0000-000000000003');
select is(
  (select string_agg(type::text, ',' order by type) from public.notifications
   where user_id = tests.get_user_id('named') and body = 'DM answer'),
  'chat_dm',
  'a reply in a DM is a DM'
);

insert into public.messages (channel_id, body, created_by, reply_to)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Thanks, assistant', tests.get_user_id('talker'), 'ffffffff-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.notifications where type = 'chat_reply'),
  1,
  'an answer to the assistant tells nobody'
);

-- -------------------------------------------------------------- reactions --
-- Reacting takes a session (the trigger reads the reactor from the JWT);
-- counting what was raised takes none (`notifications` shows each person
-- their own rows only).
select tests.authenticate_as('talker');
insert into public.message_reactions (message_id, channel_id, emoji)
values ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', '👍');
select tests.become_postgres();

select is(
  (select count(*)::int from public.notifications
   where type = 'chat_reaction' and user_id = tests.get_user_id('named')),
  1,
  'the line''s author is told about a reaction'
);
select is(
  (select title || '|' || body || '|' || subject_id::text from public.notifications
   where type = 'chat_reaction' and user_id = tests.get_user_id('named')),
  'Tina Talker 👍|Who has the crate key?|ffffffff-0000-0000-0000-000000000001',
  'who, with what, to which line'
);

select tests.authenticate_as('bystander');
insert into public.message_reactions (message_id, channel_id, emoji)
values ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', '✅');
select tests.become_postgres();
select is(
  (select count(*)::int from public.notifications
   where type = 'chat_reaction' and user_id = tests.get_user_id('named')),
  1,
  'a second reaction within five minutes is the same inbox row'
);

select tests.authenticate_as('named');
insert into public.message_reactions (message_id, channel_id, emoji)
values ('ffffffff-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', '❤️');
insert into public.message_reactions (message_id, channel_id, emoji)
values ('ffffffff-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000001', '👍');
insert into public.message_reactions (message_id, channel_id, emoji)
values ('ffffffff-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000001', '👍');
select tests.become_postgres();
select is(
  (select count(*)::int from public.notifications where type = 'chat_reaction'),
  1,
  'reacting to your own line, a muted colleague''s, or the assistant''s tells nobody'
);

insert into public.notification_prefs (user_id, type, in_app, email, push)
values (tests.get_user_id('bystander'), 'chat_reaction', false, false, false);
insert into public.messages (id, channel_id, body, created_by)
values ('ffffffff-0000-0000-0000-000000000005', 'eeeeeeee-0000-0000-0000-000000000001', 'Bystander line', tests.get_user_id('bystander'));

select tests.authenticate_as('talker');
insert into public.message_reactions (message_id, channel_id, emoji)
values ('ffffffff-0000-0000-0000-000000000005', 'eeeeeeee-0000-0000-0000-000000000001', '👀');
select tests.become_postgres();
select is(
  (select count(*)::int from public.notifications
   where type = 'chat_reaction' and user_id = tests.get_user_id('bystander')),
  0,
  'the per-type switch silences a reaction too'
);

select is(
  (select count(*)::int from public.notifications where email_requested),
  0,
  'and none of it asks for an email'
);

select * from finish();
rollback;
