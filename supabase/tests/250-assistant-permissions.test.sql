-- P8-01 — the assistant's tables, the cap, and the flag chat needs.
--
-- The assertions that matter: a conversation is its owner's and nobody
-- else's; nobody but the function (service role) writes any of these tables,
-- so an authenticated insert is refused everywhere; a person cannot post as
-- the assistant, and a moderator's delete does not turn an assistant reply
-- into a person's; the cap is read by everyone and moved by a superadmin only.
--
-- Tested against supabase/migrations/20260904130000_assistant_schema.sql.
begin;
select plan(31);

-- ---------------------------------------------------------------- fixtures --
insert into public.gyms (id, name, slug)
values ('88888888-8888-8888-8888-888888888888', 'Gym H', 'gym-h');

update public.channels set id = 'ffffffff-0000-0000-0000-000000000001'
where kind = 'gym' and gym_id = '88888888-8888-8888-8888-888888888888';

select tests.create_user('owner');
select tests.create_user('other');
select tests.create_user('super');
update public.profiles set is_superadmin = true, is_admin = true
where id = tests.get_user_id('super');

insert into public.gym_memberships (user_id, gym_id, role)
select tests.get_user_id(who), '88888888-8888-8888-8888-888888888888', 'staff'
from unnest(array['owner', 'other']) who;

-- Written the way the function writes them: as the service role, not a person.
insert into public.assistant_conversations (id, user_id, title)
values ('cccccccc-0000-0000-0000-000000000001', tests.get_user_id('owner'), 'Chalk?');
insert into public.assistant_messages (conversation_id, role, body, sources)
values
  ('cccccccc-0000-0000-0000-000000000001', 'user', 'What is the chalk policy?', '[]'),
  ('cccccccc-0000-0000-0000-000000000001', 'assistant', 'Liquid chalk only.',
   '[{"kind":"news","id":"aaaaaaaa-0000-0000-0000-000000000001","title":"Chalk policy"}]');

insert into public.assistant_usage (user_id, surface, conversation_id, model, created_at)
values
  (tests.get_user_id('owner'), 'ask', 'cccccccc-0000-0000-0000-000000000001', 'claude-opus-5', now()),
  (tests.get_user_id('owner'), 'ask', 'cccccccc-0000-0000-0000-000000000001', 'claude-opus-5', now()),
  (tests.get_user_id('owner'), 'channel', null, 'claude-opus-5', now() - interval '2 days'),
  (tests.get_user_id('other'), 'channel', null, 'claude-opus-5', now());

-- --------------------------------------------------------------- structure --
select has_table('public', 'app_settings', 'app_settings exists');
select has_table('public', 'assistant_conversations', 'assistant_conversations exists');
select has_table('public', 'assistant_messages', 'assistant_messages exists');
select has_table('public', 'assistant_usage', 'assistant_usage exists');
select has_column('public', 'messages', 'from_assistant', 'messages know when the assistant wrote them');

-- ---------------------------------------------------------------- settings --
select tests.authenticate_as('owner');
select is(
  (select value from public.app_settings where key = 'assistant_daily_cap'),
  '50'::jsonb,
  'everyone can read the cap, which starts at 50'
);
with changed as (
  update public.app_settings set value = '1'::jsonb where key = 'assistant_daily_cap' returning 1
)
select is((select count(*)::int from changed), 0, 'a member cannot move it');
select throws_ok(
  $$ insert into public.app_settings (key, value) values ('anything', '1'::jsonb) $$,
  '42501', null,
  'nor add a setting'
);
select results_eq(
  $$ select used, cap from public.assistant_quota() $$,
  $$ values (2, 50) $$,
  'the quota counts today''s calls against the cap'
);

select tests.authenticate_as('super');
with changed as (
  update public.app_settings set value = '20'::jsonb where key = 'assistant_daily_cap' returning 1
)
select is((select count(*)::int from changed), 1, 'a superadmin can move the cap');
select is(
  (select updated_by from public.app_settings where key = 'assistant_daily_cap'),
  tests.get_user_id('super'),
  'and is recorded as having done so'
);

select tests.authenticate_as('owner');
select results_eq(
  $$ select used, cap from public.assistant_quota() $$,
  $$ values (2, 20) $$,
  'the new cap applies at once'
);

-- ----------------------------------------------------------- conversations --
select is(
  (select count(*)::int from public.assistant_conversations),
  1,
  'the owner sees their conversation'
);
select is(
  (select count(*)::int from public.assistant_messages),
  2,
  'and its messages'
);
select throws_ok(
  $$ insert into public.assistant_conversations (user_id, title)
     values (tests.get_user_id('owner'), 'Mine') $$,
  '42501', null,
  'but cannot open one themselves — the function does'
);
select throws_ok(
  $$ insert into public.assistant_messages (conversation_id, role, body)
     values ('cccccccc-0000-0000-0000-000000000001', 'user', 'Hi') $$,
  '42501', null,
  'nor write into one'
);

select tests.authenticate_as('other');
select is(
  (select count(*)::int from public.assistant_conversations),
  0,
  'somebody else sees no conversation'
);
select is(
  (select count(*)::int from public.assistant_messages),
  0,
  'and none of its messages'
);

-- ------------------------------------------------------------------- usage --
select is(
  (select count(*)::int from public.assistant_usage),
  1,
  'a member sees their own usage rows'
);
select throws_ok(
  $$ insert into public.assistant_usage (user_id, surface, model)
     values (tests.get_user_id('other'), 'ask', 'claude-opus-5') $$,
  '42501', null,
  'and cannot add to them'
);

select tests.authenticate_as('super');
select is(
  (select count(*)::int from public.assistant_usage),
  4,
  'a superadmin sees everybody''s'
);

-- ---------------------------------------------------------------- messages --
select tests.authenticate_as('owner');
insert into public.messages (id, channel_id, body)
values ('dddddddd-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'Anyone seen the chalk?');
select is(
  (select from_assistant from public.messages where id = 'dddddddd-0000-0000-0000-000000000001'),
  false,
  'a person''s message is not the assistant''s'
);
select throws_ok(
  $$ insert into public.messages (channel_id, body, from_assistant)
     values ('ffffffff-0000-0000-0000-000000000001', 'I am the assistant', true) $$,
  '42501', null,
  'and a person cannot post as the assistant'
);

select tests.become_postgres();
insert into public.messages (id, channel_id, body, from_assistant)
values ('dddddddd-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000001', 'Liquid chalk only.', true);
select is(
  (select created_by from public.messages where id = 'dddddddd-0000-0000-0000-000000000002'),
  null,
  'the function''s reply has no author'
);

select tests.authenticate_as('super');
with changed as (
  update public.messages set from_assistant = false
  where id = 'dddddddd-0000-0000-0000-000000000002' returning 1
)
select is((select count(*)::int from changed), 1, 'a moderator may touch an assistant reply');
select is(
  (select from_assistant from public.messages where id = 'dddddddd-0000-0000-0000-000000000002'),
  true,
  'but cannot make it a person''s'
);
with changed as (
  update public.messages set deleted_at = now()
  where id = 'dddddddd-0000-0000-0000-000000000002' returning 1
)
select is((select count(*)::int from changed), 1, 'and can delete it like any other message');
select is(
  (select body from public.messages where id = 'dddddddd-0000-0000-0000-000000000002'),
  '',
  'which empties it as usual'
);

-- ------------------------------------------------------------------ delete --
select tests.authenticate_as('owner');
with changed as (
  delete from public.assistant_conversations
  where id = 'cccccccc-0000-0000-0000-000000000001' returning 1
)
select is((select count(*)::int from changed), 1, 'the owner can delete their conversation');
select tests.become_postgres();
select is(
  (select count(*)::int from public.assistant_messages
   where conversation_id = 'cccccccc-0000-0000-0000-000000000001'),
  0,
  'which takes its messages with it'
);
select is(
  (select count(*)::int from public.assistant_usage
   where user_id = tests.get_user_id('owner')),
  3,
  'but not its usage — the cap still counts'
);

select * from finish();
rollback;
