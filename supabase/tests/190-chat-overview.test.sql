-- P6-03 — the channel list's numbers: what is unread, and when the channel
-- last had anything in it.
--
-- The assertions worth having are the three exclusions. Your own message is
-- not unread to you, a deleted one is not unread to anybody, and neither is
-- anything you had already read — a badge that counts any of those is a badge
-- people learn to ignore.
--
-- Tested against supabase/migrations/20260903110000_chat_overview.sql.
begin;
select plan(13);

-- ---------------------------------------------------------------- fixtures --
insert into public.gyms (id, name, slug)
values ('55555555-5555-5555-5555-555555555555', 'Gym E', 'gym-e');

update public.channels set id = 'cccccccc-0000-0000-0000-000000000001'
where kind = 'gym' and gym_id = '55555555-5555-5555-5555-555555555555';

select tests.create_user('reader');
select tests.create_user('writer');
select tests.create_user('outsider');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('reader'), '55555555-5555-5555-5555-555555555555', 'staff'),
  (tests.get_user_id('writer'), '55555555-5555-5555-5555-555555555555', 'staff');

-- Everything so far was read an hour ago.
update public.channel_members set last_read_at = now() - interval '1 hour'
where channel_id = 'cccccccc-0000-0000-0000-000000000001';

insert into public.messages (id, channel_id, body, created_at, created_by)
values
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
   'Read long ago', now() - interval '2 hours', tests.get_user_id('writer')),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001',
   'New from a colleague', now() - interval '10 minutes', tests.get_user_id('writer')),
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000001',
   'New from me', now() - interval '5 minutes', tests.get_user_id('reader')),
  ('dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001',
   'New and deleted', now() - interval '1 minute', tests.get_user_id('writer'));

update public.messages set deleted_at = now(), body = ''
where id = 'dddddddd-0000-0000-0000-000000000004';

-- ------------------------------------------------------------------ counts --
select tests.authenticate_as('reader');

select is(
  (select unread from public.chat_overview()
   where channel_id = 'cccccccc-0000-0000-0000-000000000001'),
  1,
  'one unread: the colleague message posted since the last read'
);
select is(
  (select last_message_at from public.chat_overview()
   where channel_id = 'cccccccc-0000-0000-0000-000000000001'),
  (select created_at from public.messages
   where id = 'dddddddd-0000-0000-0000-000000000003'),
  'the last activity is the newest message still standing'
);
select is(
  (select muted from public.chat_overview()
   where channel_id = 'cccccccc-0000-0000-0000-000000000001'),
  false,
  'and the channel reports whether it is muted'
);
select is(
  (select count(*)::int from public.chat_overview()
   where channel_id = 'cccccccc-0000-0000-0000-000000000001'),
  1,
  'one row per channel the reader is in'
);

-- Reading the channel now clears it.
select tests.become_postgres();
update public.channel_members set last_read_at = now()
where channel_id = 'cccccccc-0000-0000-0000-000000000001'
  and user_id = tests.get_user_id('reader');
select tests.authenticate_as('reader');
select is(
  (select unread from public.chat_overview()
   where channel_id = 'cccccccc-0000-0000-0000-000000000001'),
  0,
  'moving the read marker clears the badge'
);

-- A channel nobody has written in is listed, with nothing in it. It has to be
-- a channel this test made: `#company` and the seed's gyms carry whatever the
-- rest of the database has been doing.
select tests.become_postgres();
insert into public.gyms (id, name, slug)
values ('66666666-6666-6666-6666-666666666666', 'Gym F', 'gym-f');
insert into public.gym_memberships (user_id, gym_id, role)
values (tests.get_user_id('reader'), '66666666-6666-6666-6666-666666666666', 'staff');

select tests.authenticate_as('reader');
select is(
  (select count(*)::int from public.chat_overview() o
   join public.channels c on c.id = o.channel_id
   where c.gym_id = '66666666-6666-6666-6666-666666666666'
     and o.unread = 0 and o.last_message_at is null),
  1,
  'a channel nobody has posted in is listed with nothing in it'
);

-- The writer posted three of the four messages; only the reader's is new to
-- them.
select tests.authenticate_as('writer');
select is(
  (select unread from public.chat_overview()
   where channel_id = 'cccccccc-0000-0000-0000-000000000001'),
  1,
  'your own messages are not unread to you'
);

select tests.authenticate_as('outsider');
select is(
  (select count(*)::int from public.chat_overview()
   where channel_id = 'cccccccc-0000-0000-0000-000000000001'),
  0,
  'somebody who is not in the channel gets no row for it'
);

select tests.become_postgres();
update public.profiles set active = false where id = tests.get_user_id('reader');
select tests.authenticate_as('reader');
select is(
  (select count(*)::int from public.chat_overview()),
  0,
  'a deactivated colleague sees nothing, definer function or not'
);

-- ------------------------------------------------------ the chat topic (P6-05) --
select tests.authenticate_as('writer');
select is(
  public.chat_topic_channel('chat:cccccccc-0000-0000-0000-000000000001'),
  'cccccccc-0000-0000-0000-000000000001'::uuid,
  'a chat topic names its channel'
);
select is(
  public.chat_topic_channel('chat:cccccccc-0000-0000-0000-000000000001:typing'),
  '00000000-0000-0000-0000-000000000000'::uuid,
  'and anything with more in it than that names none'
);
select ok(
  public.can_listen_to_chat('chat:cccccccc-0000-0000-0000-000000000001'),
  'a member may listen to their channel'
);
-- Typing is speaking: it takes membership, which is what the insert policy on
-- realtime.messages asks (P6-05).
select ok(
  public.is_channel_member(
    public.chat_topic_channel('chat:cccccccc-0000-0000-0000-000000000001')
  ),
  'and may say they are typing in it'
);

select * from finish();
rollback;
