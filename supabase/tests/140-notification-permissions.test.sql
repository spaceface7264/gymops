-- P5-01: the inbox, the preferences and the push subscriptions.
--
-- The rule under test is PROJECT_SPEC.md §5: notifications are created by
-- database triggers only. A client may read its own, mark them read, and
-- nothing else — not write one, not touch somebody else's, not edit the text
-- it was sent.
begin;
select plan(26);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('staff_b');

insert into public.gyms (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff');

-- Written as the owner, which is what a trigger does.
insert into public.notifications (id, user_id, type, title, body, url, gym_id)
values
  ('dddddddd-0000-0000-0000-000000000001', tests.get_user_id('staff_a'),
   'incident_reported', 'Fall from wall 4', 'Ice applied.', '/incidents/1',
   '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-0000-0000-0000-000000000002', tests.get_user_id('manager_a'),
   'ack_reminder', 'Confirm the belay guide', null, '/guides/1', null);

-- --------------------------------------------------------------- structure --
select has_table('public', 'notifications', 'notifications exists');
select has_table('public', 'notification_prefs', 'notification_prefs exists');
select has_table('public', 'push_subscriptions', 'push_subscriptions exists');
select is(
  (select count(*)::int from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('notifications', 'notification_prefs', 'push_subscriptions')
     and relrowsecurity),
  3,
  'RLS is enabled on all three notification tables'
);
select is(
  (select count(*)::int from pg_policy
   where polrelid = 'public.notifications'::regclass and polcmd = 'a'),
  0,
  'nothing may insert a notification: there is no insert policy'
);

-- ----------------------------------------------------------------- reading --
select tests.authenticate_as('staff_a');
select results_eq(
  $$ select id from public.notifications $$,
  $$ values ('dddddddd-0000-0000-0000-000000000001'::uuid) $$,
  'a recipient sees their own inbox and only that'
);
select throws_ok(
  $$ insert into public.notifications (user_id, type, title)
     values (tests.get_user_id('staff_a'), 'invite', 'I told myself something') $$,
  '42501',
  null,
  'and cannot write one, not even to themselves'
);

select lives_ok(
  $$ update public.notifications set read_at = now()
     where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  'marking one read is allowed'
);
select isnt(
  (select read_at from public.notifications
   where id = 'dddddddd-0000-0000-0000-000000000001'),
  null,
  'and it takes effect'
);

-- The guard, not the policy, is what keeps the text honest.
update public.notifications
set title = 'Nothing happened', url = '/somewhere-else',
    user_id = tests.get_user_id('staff_b'), email_requested = true
where id = 'dddddddd-0000-0000-0000-000000000001';
select results_eq(
  $$ select title, url, user_id, email_requested from public.notifications
     where id = 'dddddddd-0000-0000-0000-000000000001' $$,
  $$ select 'Fall from wall 4', '/incidents/1', tests.get_user_id('staff_a'), false $$,
  'rewriting the message, its link, its owner or its email flag does nothing'
);

select is(
  (select count(*)::int from public.notifications
   where id = 'dddddddd-0000-0000-0000-000000000002'),
  0,
  'somebody else''s notification is invisible'
);
with touched as (
  update public.notifications set read_at = now()
  where id = 'dddddddd-0000-0000-0000-000000000002'
  returning 1
)
select is(
  (select count(*)::int from touched),
  0,
  'and out of reach of an update'
);

-- ------------------------------------------------------------- preferences --
select lives_ok(
  $$ insert into public.notification_prefs (user_id, type, email, push)
     values (tests.get_user_id('staff_a'), 'incident_reported', false, false) $$,
  'a person switches off a channel for themselves'
);
select throws_ok(
  $$ insert into public.notification_prefs (user_id, type, email)
     values (tests.get_user_id('staff_b'), 'incident_reported', false) $$,
  '42501',
  null,
  'and not for anybody else'
);
select results_eq(
  $$ select in_app, email, push
     from public.notification_pref(tests.get_user_id('staff_a'), 'incident_reported') $$,
  $$ values (true, false, false) $$,
  'the stored row is the effective preference'
);
select results_eq(
  $$ select in_app, email, push
     from public.notification_pref(tests.get_user_id('staff_a'), 'invite') $$,
  $$ values (true, true, true) $$,
  'a type with no row is every channel on'
);
select lives_ok(
  $$ delete from public.notification_prefs
     where user_id = tests.get_user_id('staff_a') and type = 'incident_reported' $$,
  'deleting the row is how you go back to the defaults'
);

-- ------------------------------------------------------------------- push --
select lives_ok(
  $$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
     values (tests.get_user_id('staff_a'), 'https://push.example/a', 'key-a', 'auth-a') $$,
  'a browser registers itself'
);
select throws_ok(
  $$ insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
     values (tests.get_user_id('staff_b'), 'https://push.example/b', 'key-b', 'auth-b') $$,
  '42501',
  null,
  'nobody registers a browser on somebody else''s account'
);

select tests.authenticate_as('manager_a');
select is(
  (select count(*)::int from public.push_subscriptions),
  0,
  'subscriptions are private to their owner'
);
select results_eq(
  $$ select id from public.notifications $$,
  $$ values ('dddddddd-0000-0000-0000-000000000002'::uuid) $$,
  'and so is the inbox, from the other side'
);

-- --------------------------------------------------------------- realtime --
select is(
  (select count(*)::int from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public' and tablename = 'notifications'),
  1,
  'notifications are published to Realtime'
);
select is(
  (select count(*)::int from pg_policy
   where polrelid = 'realtime.messages'::regclass
     and polname = 'notifications_realtime_listen'),
  1,
  'the private channel is opened by a policy on realtime.messages'
);
select ok(
  public.can_listen_to_notifications(
    'notifications:' || tests.get_user_id('manager_a')::text),
  'a person joins their own notification channel'
);
select ok(
  not public.can_listen_to_notifications(
    'notifications:' || tests.get_user_id('staff_a')::text),
  'and not anybody else''s'
);
select ok(
  not public.can_listen_to_notifications('notifications:all'),
  'there is no channel that carries everybody''s'
);

select * from finish();
rollback;
