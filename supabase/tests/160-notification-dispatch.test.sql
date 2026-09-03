-- P5-03: the database webhook that hands a new notification to `notify`.
--
-- The request itself cannot be made from a test, but everything around it can:
-- that a row is queued at all, where it is addressed, what it carries, and —
-- the case every environment starts in — that an unconfigured database still
-- writes the inbox rather than failing the insert that caused it.
begin;
select plan(8);

select tests.create_user('staff_a');

select has_function('public', 'dispatch_notification', 'the webhook function exists');
select is(
  (select count(*)::int from pg_trigger
   where tgrelid = 'public.notifications'::regclass
     and tgname = 'notifications_dispatch' and not tgisinternal),
  1,
  'and fires on every new notification'
);
select is(
  (select count(*)::int from pg_extension where extname = 'pg_net'),
  1,
  'pg_net is installed, so the post is queued and not waited for'
);

-- ------------------------------------------------------------- configured --
-- supabase/seeds/local-webhook.sql has already set both secrets on this
-- database; the hosted project gets its own during the cutover.
insert into public.notifications (id, user_id, type, title, url)
values ('dddddddd-0000-0000-0000-000000000001', tests.get_user_id('staff_a'),
        'incident_reported', 'Fall from wall 4', '/incidents/1');

select is(
  (select count(*)::int from net.http_request_queue
   where url like '%/notify' and method = 'POST'),
  1,
  'a new notification queues exactly one post to the function'
);
select ok(
  (select (headers->>'Authorization') like 'Bearer %'
   from net.http_request_queue where url like '%/notify' limit 1),
  'carrying the service role key, which is the only thing notify accepts'
);
select results_eq(
  $$ select payload->>'type', payload->>'table', payload#>>'{record,title}'
     from (
       select convert_from(body, 'utf8')::jsonb as payload
       from net.http_request_queue where url like '%/notify' limit 1
     ) queued $$,
  $$ values ('INSERT', 'notifications', 'Fall from wall 4') $$,
  'and the row itself, in the shape a Supabase database webhook sends'
);

-- ----------------------------------------------------------- unconfigured --
-- Every environment starts here, CI included: no secrets, no fan-out, and an
-- inbox that still works. This is also what stops a missing key from rolling
-- back the incident that raised the notification.
delete from vault.secrets where name in ('notify_functions_url', 'notify_service_key');
delete from net.http_request_queue;

select lives_ok(
  $$ insert into public.notifications (user_id, type, title)
     values (tests.get_user_id('staff_a'), 'ack_reminder', 'Confirm the belay guide') $$,
  'without the secrets the notification is still written'
);
select is(
  (select count(*)::int from net.http_request_queue),
  0,
  'and nothing is posted anywhere'
);

select * from finish();
rollback;
