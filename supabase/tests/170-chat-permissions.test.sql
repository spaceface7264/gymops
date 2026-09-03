-- P6-01 — chat permissions: who sees a channel, who may post in it, and who
-- may take a message away again.
--
-- The assertions that matter most are the DM ones. Every other table in this
-- project answers `is_admin()` with "yes, everywhere"; §2.1 says nobody reads a
-- DM they are not part of, superadmins included, so if `can_read_channel()`
-- ever grows an admin branch those are what fail.
--
-- The second group is posting: reading an open channel is not being in it, so
-- an admin who can list a gym's channel still cannot speak in it without
-- joining, and a moderator who deletes somebody's message cannot rewrite it.
--
-- Tested against supabase/migrations/20260903090000_chat_schema.sql.
begin;
select plan(54);

-- ---------------------------------------------------------------- fixtures --
insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

-- The gym channels and #company come from the P6-02 triggers, not from this
-- fixture. The two gym ones have no members yet, so they can take the ids the
-- assertions below name; #company already has the seed's people in it and is
-- referred to by kind instead.
update public.channels set id = 'aaaaaaaa-0000-0000-0000-000000000001'
where kind = 'gym' and gym_id = '11111111-1111-1111-1111-111111111111';
update public.channels set id = 'aaaaaaaa-0000-0000-0000-000000000002'
where kind = 'gym' and gym_id = '22222222-2222-2222-2222-222222222222';

select tests.create_user('super');
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('staff_a2');
select tests.create_user('staff_b');

update public.profiles set is_superadmin = true where id = tests.get_user_id('super');
update public.profiles set is_admin = true where id = tests.get_user_id('admin');

-- Granting a membership seats the person in their gym channel (P6-02).
insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_a2'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

-- The ones somebody has to create: a public and a private custom channel, and
-- a DM between the two Gym A staff.
insert into public.channels (id, kind, gym_id, name, is_private)
values
  ('aaaaaaaa-0000-0000-0000-000000000004', 'custom', '11111111-1111-1111-1111-111111111111', 'Route setting', false),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'custom', '11111111-1111-1111-1111-111111111111', 'Managers', true);

insert into public.channels (id, kind, name, is_private, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000006', 'dm', null, true, tests.get_user_id('staff_a'));

insert into public.channel_members (channel_id, user_id)
values
  ('aaaaaaaa-0000-0000-0000-000000000004', tests.get_user_id('staff_a')),
  ('aaaaaaaa-0000-0000-0000-000000000005', tests.get_user_id('manager_a')),
  ('aaaaaaaa-0000-0000-0000-000000000006', tests.get_user_id('staff_a')),
  ('aaaaaaaa-0000-0000-0000-000000000006', tests.get_user_id('staff_a2'));

-- --------------------------------------------------------------- structure --
select has_table('public', 'channels', 'channels exists');
select has_table('public', 'channel_members', 'channel_members exists');
select has_table('public', 'messages', 'messages exists');
select has_table('public', 'message_attachments', 'message_attachments exists');
select is(
  (select count(*)::int from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('channels', 'channel_members', 'messages', 'message_attachments')
     and relrowsecurity),
  4,
  'RLS is enabled on all four chat tables'
);
select enum_has_labels(
  'public', 'channel_kind',
  array['gym', 'company', 'custom', 'dm'],
  'the four kinds of channel'
);
select has_column('public', 'messages', 'mentions', 'messages carry the mentioned profiles');

-- ----------------------------------------------------------------- reading --
select tests.authenticate_as('staff_a');

select is(
  (select count(*)::int from public.channels where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'staff read their own gym channel'
);
select is(
  (select count(*)::int from public.channels where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  'staff do not read another gym channel'
);
select is(
  (select count(*)::int from public.channels where kind = 'company'),
  1,
  'everybody reads #company'
);
select is(
  (select count(*)::int from public.channels where id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  1,
  'a public custom channel is visible in its scope'
);
select is(
  (select count(*)::int from public.channels where id = 'aaaaaaaa-0000-0000-0000-000000000005'),
  0,
  'a private channel is invisible to a non-member'
);
select is(
  (select count(*)::int from public.channels where id = 'aaaaaaaa-0000-0000-0000-000000000006'),
  1,
  'a DM is visible to the people in it'
);

select tests.authenticate_as('admin');
select is(
  (select count(*)::int from public.channels
   where kind = 'gym'
     and gym_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')),
  2,
  'an admin lists every gym channel'
);
select is(
  (select count(*)::int from public.channels where kind = 'dm'),
  0,
  'an admin cannot read a DM they are not part of'
);

select tests.authenticate_as('super');
select is(
  (select count(*)::int from public.channels where kind = 'dm'),
  0,
  'neither can a superadmin'
);
select is(
  (select count(*)::int from public.channels where id = 'aaaaaaaa-0000-0000-0000-000000000005'),
  1,
  'a private custom channel is still administrable content'
);

-- ---------------------------------------------------------------- creating --
select tests.authenticate_as('staff_a');
select throws_ok(
  $$ insert into public.channels (kind, gym_id, name) values ('custom', '11111111-1111-1111-1111-111111111111', 'Staff idea') $$,
  '42501',
  null,
  'staff cannot create a custom channel'
);
select lives_ok(
  $$ insert into public.channels (kind, name, is_private) values ('dm', null, true) $$,
  'anybody may open a DM'
);

select tests.authenticate_as('manager_a');
select lives_ok(
  $$ insert into public.channels (kind, gym_id, name) values ('custom', '11111111-1111-1111-1111-111111111111', 'Comp planning') $$,
  'a manager creates a custom channel in their own gym'
);
select throws_ok(
  $$ insert into public.channels (kind, gym_id, name) values ('custom', null, 'Whole company') $$,
  '42501',
  null,
  'a manager cannot create a company-wide channel'
);
select throws_ok(
  $$ insert into public.channels (kind, gym_id, name) values ('gym', '11111111-1111-1111-1111-111111111111', 'Second Gym A') $$,
  '42501',
  null,
  'gym channels are the trigger''s, not a hand-written row'
);

select tests.authenticate_as('admin');
select lives_ok(
  $$ insert into public.channels (kind, gym_id, name) values ('custom', null, 'All gyms') $$,
  'an admin creates a company-wide custom channel'
);

-- --------------------------------------------------------------- DM dedupe --
select tests.become_postgres();
select is(
  (select member_hash from public.channels where id = 'aaaaaaaa-0000-0000-0000-000000000006'),
  md5(
    (select string_agg(u, ',') from (
      select unnest(array[
        tests.get_user_id('staff_a')::text,
        tests.get_user_id('staff_a2')::text
      ]) as u order by u
    ) s)
  ),
  'the DM is fingerprinted by its sorted member ids'
);
select throws_ok(
  format(
    $$ with c as (
         insert into public.channels (kind, name, is_private) values ('dm', null, true) returning id
       )
       insert into public.channel_members (channel_id, user_id)
       select c.id, u from c, unnest(array['%s'::uuid, '%s'::uuid]) u $$,
    tests.get_user_id('staff_a'), tests.get_user_id('staff_a2')
  ),
  '23505',
  null,
  'a second DM between the same people collides with the first'
);

-- ----------------------------------------------------------------- posting --
select tests.authenticate_as('staff_a');
select lives_ok(
  $$ insert into public.messages (id, channel_id, body)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Wall 4 is reset') $$,
  'a member posts in their gym channel'
);

select tests.authenticate_as('staff_a2');
select lives_ok(
  $$ insert into public.messages (id, channel_id, body)
     values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Thanks') $$,
  'so does a colleague'
);

-- An attachment, so the delete below has something to take with it.
select lives_ok(
  $$ insert into public.message_attachments (id, message_id, path, mime_type)
     values (
       'ffffffff-0000-0000-0000-000000000001',
       'bbbbbbbb-0000-0000-0000-000000000002',
       'aaaaaaaa-0000-0000-0000-000000000001/topo.png',
       'image/png'
     ) $$,
  'a file goes with your own message'
);

select tests.authenticate_as('staff_b');
select throws_ok(
  $$ insert into public.messages (channel_id, body)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Hello from Gym B') $$,
  '42501',
  null,
  'somebody from another gym cannot post there'
);

select tests.authenticate_as('admin');
select is(
  (select count(*)::int from public.messages where channel_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  2,
  'an admin reads a gym channel they are not in'
);
select throws_ok(
  $$ insert into public.messages (channel_id, body)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'From the office') $$,
  '42501',
  null,
  'reading a channel is not being in it: an admin must join to post'
);

-- --------------------------------------------------------- editing, deleting --
select tests.authenticate_as('staff_a');
update public.messages set body = 'Wall 4 is reset (blue)'
where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select isnt(
  (select edited_at from public.messages where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  null,
  'editing your own message stamps edited_at'
);

update public.messages set body = 'Rewritten by somebody else'
where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is(
  (select body from public.messages where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'Thanks',
  'staff cannot rewrite a colleague''s message'
);

update public.messages set deleted_at = now()
where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is(
  (select deleted_at from public.messages where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  null,
  'neither can they delete it'
);

select tests.authenticate_as('staff_a');
select is(
  (select count(*)::int from public.message_attachments
   where id = 'ffffffff-0000-0000-0000-000000000001'),
  1,
  'a colleague sees the file on a message that stands'
);

select tests.become_postgres();
insert into storage.objects (bucket_id, name)
values ('chat', 'aaaaaaaa-0000-0000-0000-000000000001/topo.png');

select tests.authenticate_as('staff_a');
select is(
  (select count(*)::int from storage.objects
   where name = 'aaaaaaaa-0000-0000-0000-000000000001/topo.png'),
  1,
  'and can open the object behind it'
);

select tests.authenticate_as('manager_a');
update public.messages set body = 'Manager''s words', deleted_at = now()
where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select isnt(
  (select deleted_at from public.messages where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  null,
  'a manager deletes any message in their own gym channel'
);
select is(
  (select body from public.messages where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  '',
  'a deleted message loses its body rather than merely hiding it'
);
select is(
  (select deleted_by from public.messages where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  tests.get_user_id('manager_a'),
  'and records who took it away'
);

-- Deleting is not hiding a line and keeping the picture: the attachment row
-- and the object itself both go with the message.
select tests.authenticate_as('staff_a');
select is(
  (select count(*)::int from public.message_attachments
   where id = 'ffffffff-0000-0000-0000-000000000001'),
  0,
  'a deleted message takes its attachments with it'
);
select is(
  (select count(*)::int from storage.objects
   where name = 'aaaaaaaa-0000-0000-0000-000000000001/topo.png'),
  0,
  'including the object, which a remembered path can no longer sign'
);

select tests.authenticate_as('manager_a');
update public.messages set deleted_at = null, body = 'Back again'
where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select is(
  (select body from public.messages where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  '',
  'deleting is final: a deleted message does not come back'
);

-- ------------------------------------------------------------- membership --
select tests.authenticate_as('staff_a2');
select lives_ok(
  format(
    $$ insert into public.channel_members (channel_id, user_id)
       values ('aaaaaaaa-0000-0000-0000-000000000004', '%s') $$,
    tests.get_user_id('staff_a2')
  ),
  'anybody in scope joins a public custom channel'
);
select throws_ok(
  format(
    $$ insert into public.channel_members (channel_id, user_id)
       values ('aaaaaaaa-0000-0000-0000-000000000005', '%s') $$,
    tests.get_user_id('staff_a2')
  ),
  '42501',
  null,
  'a private channel is joined by invitation, not by asking'
);

select tests.authenticate_as('staff_a');
update public.channel_members set last_read_at = now(), muted = true
where channel_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = tests.get_user_id('staff_a');
select is(
  (select muted from public.channel_members
   where channel_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = tests.get_user_id('staff_a')),
  true,
  'your own row carries your read marker and your mute switch'
);

update public.channel_members set muted = true
where channel_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = tests.get_user_id('staff_a2');
select is(
  (select muted from public.channel_members
   where channel_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = tests.get_user_id('staff_a2')),
  false,
  'and nobody else''s'
);

delete from public.channel_members
where channel_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = tests.get_user_id('staff_a');
select is(
  (select count(*)::int from public.channel_members
   where channel_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = tests.get_user_id('staff_a')),
  1,
  'you cannot leave your own gym channel'
);

delete from public.channel_members
where channel_id = 'aaaaaaaa-0000-0000-0000-000000000004' and user_id = tests.get_user_id('staff_a');
select is(
  (select count(*)::int from public.channel_members
   where channel_id = 'aaaaaaaa-0000-0000-0000-000000000004' and user_id = tests.get_user_id('staff_a')),
  0,
  'but you can leave a custom one'
);

-- ------------------------------------------------------ storage and realtime --
select is(
  public.chat_object_channel('aaaaaaaa-0000-0000-0000-000000000001/photo.jpg'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'an attachment path names its channel first'
);
select is(
  public.chat_object_channel('not-a-channel/photo.jpg'),
  '00000000-0000-0000-0000-000000000000'::uuid,
  'anything else resolves to a channel nobody is in'
);

select tests.authenticate_as('staff_a2');
select ok(
  public.can_listen_to_chat('chat:aaaaaaaa-0000-0000-0000-000000000001'),
  'a member may join their channel topic'
);
select ok(
  not public.can_listen_to_chat('chat:aaaaaaaa-0000-0000-0000-000000000002'),
  'another gym channel topic refuses the join itself'
);
select ok(
  not public.can_listen_to_chat('aaaaaaaa-0000-0000-0000-000000000001'),
  'and so does a topic that is not a chat topic'
);

select tests.authenticate_as('admin');
select ok(
  not public.can_listen_to_chat('chat:aaaaaaaa-0000-0000-0000-000000000006'),
  'an admin cannot subscribe to a DM either'
);

select * from finish();
rollback;
