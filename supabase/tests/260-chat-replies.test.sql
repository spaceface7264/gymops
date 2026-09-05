-- P6C-17 — a reply quotes one line in the same channel, and keeps quoting it.
--
-- What matters: a quote cannot reach into another channel (that is how a
-- private line would leak into a public one), an edit cannot re-point it, a
-- moderator's delete keeps it (the stream still knows what was answered), and
-- posting rules are unchanged by it.
--
-- Tested against supabase/migrations/20260905110000_chat_reply_reactions.sql.
begin;
select plan(8);

-- ---------------------------------------------------------------- fixtures --
insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

update public.channels set id = 'aaaaaaaa-0000-0000-0000-000000000001'
where kind = 'gym' and gym_id = '11111111-1111-1111-1111-111111111111';
update public.channels set id = 'aaaaaaaa-0000-0000-0000-000000000002'
where kind = 'gym' and gym_id = '22222222-2222-2222-2222-222222222222';

select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('staff_a2');
select tests.create_user('staff_b');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_a2'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

insert into public.messages (id, channel_id, body, created_by)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Wall 4 is taped off', tests.get_user_id('staff_a')),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Gym B line', tests.get_user_id('staff_b'));

-- --------------------------------------------------------------- quoting --
select tests.authenticate_as('staff_a2');

select lives_ok(
  $$ insert into public.messages (id, channel_id, body, created_by, reply_to)
     values ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
             'On it', tests.get_user_id('staff_a2'), 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  'a line in the same channel can be quoted'
);

select throws_ok(
  $$ insert into public.messages (channel_id, body, created_by, reply_to)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Quoting across',
             tests.get_user_id('staff_a2'), 'bbbbbbbb-0000-0000-0000-000000000002') $$,
  '23514',
  'reply_to must name a message in the same channel',
  'a line in another channel cannot, whoever may read it'
);

select is(
  (select reply_to from public.messages where id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
  'and a member reads the quote back'
);

-- ----------------------------------------------------------------- pinned --
update public.messages set reply_to = null
where id = 'bbbbbbbb-0000-0000-0000-000000000003';

select is(
  (select reply_to from public.messages where id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
  'the author cannot un-quote or re-point a line once it is said'
);

select tests.authenticate_as('manager_a');
update public.messages set deleted_at = now()
where id = 'bbbbbbbb-0000-0000-0000-000000000003';

select is(
  (select body || '|' || coalesce(reply_to::text, '')
   from public.messages where id = 'bbbbbbbb-0000-0000-0000-000000000003'),
  '|bbbbbbbb-0000-0000-0000-000000000001',
  'a moderator''s delete empties the words and keeps what they answered'
);

-- ------------------------------------------------------ a deleted quote --
select tests.authenticate_as('staff_a');
select lives_ok(
  $$ insert into public.messages (channel_id, body, created_by, reply_to)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Still answering',
             tests.get_user_id('staff_a'), 'bbbbbbbb-0000-0000-0000-000000000003') $$,
  'a deleted line can still be quoted; the stream says it was deleted'
);

-- --------------------------------------------------------- posting rules --
select tests.authenticate_as('staff_b');
select throws_ok(
  $$ insert into public.messages (channel_id, body, created_by, reply_to)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'From outside',
             tests.get_user_id('staff_b'), 'bbbbbbbb-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'quoting does not let somebody into a channel they are not in'
);

select is(
  (select count(*)::int from public.messages where reply_to = 'bbbbbbbb-0000-0000-0000-000000000001'),
  0,
  'nor read the quoted line from outside'
);

select * from finish();
rollback;
