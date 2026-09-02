-- P5-02: the triggers and the nightly job that fill the inbox.
--
-- What is being pinned here is *who* hears about something and *how often* —
-- the two things that make a notification system either useful or the first
-- feature everybody switches off.
--
-- `db reset` has already loaded supabase/seed.sql, whose admin is an admin
-- everywhere and so a legitimate recipient of half of this. Every assertion
-- therefore looks only at the users created here, which the `@example.test`
-- domain separates from the seeded `@gymops.test` ones.
begin;
select plan(23);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('manager_b');
select tests.create_user('staff_a');
select tests.create_user('staff_a2');
select tests.create_user('staff_b');

update public.profiles set is_admin = true where id = tests.get_user_id('admin');

insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('manager_b'), '22222222-2222-2222-2222-222222222222', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_a2'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

-- ------------------------------------------------------------- recipients --
select results_eq(
  $$ select p.email from public.gym_overseers('11111111-1111-1111-1111-111111111111') o
     join public.profiles p on p.id = o
     where p.email like '%@example.test' order by 1 $$,
  $$ values ('admin@example.test'), ('manager_a@example.test') $$,
  'a gym is watched by its own manager and by an admin'
);
select results_eq(
  $$ select count(*)::int from public.content_audience(null) a
     join public.profiles p on p.id = a where p.email like '%@example.test' $$,
  $$ values (6) $$,
  'company-wide content is addressed to everybody active'
);
select results_eq(
  $$ select p.email from public.content_audience('22222222-2222-2222-2222-222222222222') a
     join public.profiles p on p.id = a
     where p.email like '%@example.test' order by 1 $$,
  $$ values ('manager_b@example.test'), ('staff_b@example.test') $$,
  'and a gym''s content only to the people who work there'
);

select tests.authenticate_as('staff_a');
select throws_ok(
  $$ select public.raise_notification(
       array[tests.get_user_id('staff_a')], 'invite', 'Hand-made') $$,
  '42501',
  null,
  'no client can call the writer directly'
);

-- --------------------------------------------------------------- incidents --
insert into public.incidents (id, gym_id, kind, severity, title, body)
values ('cccccccc-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'injury', 'high',
        'Fall from wall 4', 'Member landed badly, ice applied.');

reset role;
select results_eq(
  $$ select p.email from public.notifications n
     join public.profiles p on p.id = n.user_id
     where n.type = 'incident_reported' and p.email like '%@example.test'
     order by 1 $$,
  $$ values ('admin@example.test'), ('manager_a@example.test') $$,
  'an incident reaches the gym''s manager and the admin, and nobody else'
);
select results_eq(
  $$ select distinct title, url, email_requested, data->>'severity'
     from public.notifications where type = 'incident_reported' $$,
  $$ values ('Fall from wall 4', '/incidents/cccccccc-0000-0000-0000-000000000001',
             true, 'high') $$,
  'it carries the incident''s own words, its link, and asks for an email because it is severe'
);
select is(
  (select count(*)::int from public.notifications n
   where n.user_id = tests.get_user_id('staff_a')),
  0,
  'the person who filed it is not told about their own report'
);

-- A low-severity one is inbox and push only (spec §2.2).
select tests.authenticate_as('staff_a');
insert into public.incidents (id, gym_id, severity, title, body)
values ('cccccccc-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111', 'low',
        'Chalk bucket cracked', 'Bottom split, taped for now.');
reset role;
select is(
  (select bool_or(email_requested) from public.notifications
   where subject_id = 'cccccccc-0000-0000-0000-000000000002'),
  false,
  'an ordinary incident asks for no email'
);

-- Switching the type off in the inbox is the one thing that stops the row.
insert into public.notification_prefs (user_id, type, in_app)
values (tests.get_user_id('admin'), 'incident_status_changed', false);

update public.incidents set assignee_id = tests.get_user_id('staff_a2')
where id = 'cccccccc-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.notifications
   where type = 'incident_status_changed'),
  0,
  'assigning somebody is not a status change'
);

select tests.authenticate_as('manager_a');
update public.incidents set status = 'in_progress'
where id = 'cccccccc-0000-0000-0000-000000000001';
reset role;
select results_eq(
  $$ select p.email from public.notifications n
     join public.profiles p on p.id = n.user_id
     where n.type = 'incident_status_changed' and p.email like '%@example.test'
     order by p.email collate "C" $$,
  $$ values ('staff_a2@example.test'), ('staff_a@example.test') $$,
  'a status move tells the reporter and the assignee, not the manager who made it, and not the admin who switched it off'
);
select results_eq(
  $$ select distinct data->>'from', data->>'status' from public.notifications
     where type = 'incident_status_changed' $$,
  $$ values ('open', 'in_progress') $$,
  'and it records which way the status moved'
);

-- ----------------------------------------------------------------- invites --
insert into public.invites (id, email, gym_id, role, created_by)
values ('eeeeeeee-0000-0000-0000-000000000001', 'newcomer@example.test',
        '11111111-1111-1111-1111-111111111111', 'staff',
        tests.get_user_id('manager_a'));

update public.invites set status = 'accepted', accepted_by = tests.get_user_id('staff_b')
where id = 'eeeeeeee-0000-0000-0000-000000000001';

select results_eq(
  $$ select user_id, title, url from public.notifications where type = 'invite' $$,
  $$ select tests.get_user_id('manager_a'), 'staff_b@example.test', '/admin/users' $$,
  'accepting an invitation tells whoever sent it, and names who accepted'
);
update public.invites set expires_at = now() + interval '1 day'
where id = 'eeeeeeee-0000-0000-0000-000000000001';
select is(
  (select count(*)::int from public.notifications where type = 'invite'),
  1,
  'a later touch of the same accepted row tells nobody a second time'
);

-- ------------------------------------------------------ acknowledgements --
delete from public.notifications;

insert into public.posts (id, gym_id, title, status, requires_ack, published_at, created_by)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'New belay policy', 'published', true, now() - interval '3 days',
   tests.get_user_id('manager_a')),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Posted this morning', 'published', true, now() - interval '2 hours',
   tests.get_user_id('manager_a')),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Just news', 'published', false, now() - interval '3 days',
   tests.get_user_id('manager_a'));

insert into public.guides (id, gym_id, title, status, requires_ack, version, published_at, created_by)
values ('bbbbbbbb-0000-0000-0000-000000000001', null, 'How to belay',
        'published', true, 2, now() - interval '9 days',
        tests.get_user_id('admin'));

-- staff_a has confirmed the post, and the guide at the version before this one.
insert into public.post_reads (post_id, user_id, acknowledged_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', tests.get_user_id('staff_a'), now());
insert into public.guide_acks (guide_id, user_id, version)
values ('bbbbbbbb-0000-0000-0000-000000000001', tests.get_user_id('staff_a'), 1);

select ok(public.send_ack_reminders() > 0, 'the nightly pass has something to chase');
select results_eq(
  $$ select p.email from public.notifications n
     join public.profiles p on p.id = n.user_id
     where n.subject_id = 'aaaaaaaa-0000-0000-0000-000000000001'
       and p.email like '%@example.test' order by 1 $$,
  $$ values ('manager_a@example.test'), ('staff_a2@example.test') $$,
  'the post is owed by the members of its gym who have not confirmed it, and by nobody else'
);
select is(
  (select count(*)::int from public.notifications
   where subject_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  0,
  'and nothing is chased on the day it was published'
);
select is(
  (select count(*)::int from public.notifications
   where subject_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  0,
  'nor is ordinary news, which asks for no confirmation'
);
select results_eq(
  $$ select count(*)::int from public.notifications n
     join public.profiles p on p.id = n.user_id
     where n.subject_id = 'bbbbbbbb-0000-0000-0000-000000000001'
       and p.email like '%@example.test' $$,
  $$ values (6) $$,
  'a company-wide guide at version 2 is owed by everybody, including whoever confirmed version 1'
);
select results_eq(
  $$ select distinct data->>'kind', url from public.notifications
     where subject_id = 'bbbbbbbb-0000-0000-0000-000000000001' $$,
  $$ values ('guide', '/guides/bbbbbbbb-0000-0000-0000-000000000001') $$,
  'and it says which of the two kinds of content is waiting'
);

-- The dedupe window is what stands between a reminder and a nightly nag.
select is(public.send_ack_reminders(), 0, 'running it again the same week reminds nobody twice');

-- Somebody who switched the reminders off hears nothing at all.
delete from public.notifications;
insert into public.notification_prefs (user_id, type, in_app)
values (tests.get_user_id('staff_a2'), 'ack_reminder', false);
select is(
  (select count(*)::int from public.notifications n
   where n.user_id = tests.get_user_id('staff_a2')),
  0,
  'a switched-off type writes no inbox row'
);
select ok(
  public.send_ack_reminders() > 0,
  'the week-old reminders are due again once the inbox is empty'
);
select is(
  (select count(*)::int from public.notifications n
   where n.user_id = tests.get_user_id('staff_a2')),
  0,
  'but not for the person who turned them off'
);

select * from finish();
rollback;
