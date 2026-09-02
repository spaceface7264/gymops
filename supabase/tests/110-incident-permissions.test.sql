-- P4-07: incidents, their attachments and their comment thread.
--
-- Permission matrix (PROJECT_SPEC.md §2.1): "report incidents" is own gyms for
-- managers and staff alike; "change incident status" is managers in their own
-- gyms and admins anywhere. The trigger is what keeps those two apart on a
-- table both of them may write to.
begin;
select plan(32);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('staff_a2');
select tests.create_user('staff_b');

update public.profiles set is_admin = true where id = tests.get_user_id('admin');

insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

insert into storage.buckets (id, name, public) values ('incidents', 'incidents', false)
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name)
values
  ('incidents', '11111111-1111-1111-1111-111111111111/gym-a-photo.jpg'),
  ('incidents', '22222222-2222-2222-2222-222222222222/gym-b-photo.jpg'),
  ('incidents', 'company/loose-photo.jpg');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_a2'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

-- --------------------------------------------------------------- structure --
select has_table('public', 'incidents', 'incidents exists');
select has_table('public', 'incident_attachments', 'incident_attachments exists');
select has_table('public', 'incident_comments', 'incident_comments exists');
select is(
  (select count(*)::int from pg_class
   where relnamespace = 'public'::regnamespace
     and relname like 'incident%' and relrowsecurity),
  3,
  'RLS is enabled on all three incident tables'
);

-- --------------------------------------------------------------- reporting --
select tests.authenticate_as('staff_a');
select lives_ok(
  $$ insert into public.incidents (id, gym_id, kind, severity, title, body)
     values ('cccccccc-0000-0000-0000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'injury', 'high',
             'Fall from the top of wall 4', 'Member landed badly, ice applied.') $$,
  'staff report an incident in their own gym'
);
select is(
  (select created_by from public.incidents
   where id = 'cccccccc-0000-0000-0000-000000000001'),
  tests.get_user_id('staff_a'),
  'the reporter is the session, not the request'
);

-- Reporting is not handling: filing one already dealt with would leave the
-- gym's managers with nothing to see.
insert into public.incidents (id, gym_id, title, body, status, assignee_id)
values ('cccccccc-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111', 'Filed as resolved',
        'Trying to close it on the way in', 'resolved', tests.get_user_id('staff_a2'));
select results_eq(
  $$ select status::text, assignee_id, resolved_at from public.incidents
     where id = 'cccccccc-0000-0000-0000-000000000002' $$,
  $$ values ('open', null::uuid, null::timestamptz) $$,
  'staff cannot file an incident that is already resolved or already assigned'
);

select tests.authenticate_as('manager_a');
insert into public.incidents (id, gym_id, title, body, status)
values ('cccccccc-0000-0000-0000-000000000003',
        '11111111-1111-1111-1111-111111111111', 'Already dealt with',
        'Swept up before the shift ended', 'resolved');
select isnt(
  (select resolved_at from public.incidents
   where id = 'cccccccc-0000-0000-0000-000000000003'),
  null,
  'a manager may file one already resolved, and it is stamped as such'
);
select tests.authenticate_as('staff_a');
select throws_ok(
  $$ insert into public.incidents (gym_id, title, body)
     values ('22222222-2222-2222-2222-222222222222', 'Not my gym', 'Nope') $$,
  '42501',
  null,
  'and not in a gym they have nothing to do with'
);
select throws_ok(
  $$ insert into public.incidents (gym_id, title, body)
     values ('11111111-1111-1111-1111-111111111111', '  ', 'No title') $$,
  '23514',
  null,
  'an incident with no title is refused'
);

-- ----------------------------------------------------------------- reading --
select tests.authenticate_as('staff_b');
select is(
  (select count(*)::int from public.incidents),
  0,
  'another gym''s incidents are not theirs to read'
);
select tests.authenticate_as('staff_a2');
select is(
  (select count(*)::int from public.incidents), 3, 'a colleague reads them'
);

-- ------------------------------------------------------------- the handling --
-- Staff may not move the status, even on the incident they reported.
select tests.authenticate_as('staff_a');
update public.incidents set status = 'resolved', severity = 'low',
  assignee_id = tests.get_user_id('staff_a')
where id = 'cccccccc-0000-0000-0000-000000000001';
select results_eq(
  $$ select status::text, severity::text, assignee_id from public.incidents
     where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  $$ values ('open', 'high', null::uuid) $$,
  'staff cannot change the status, the severity or who is on it'
);
select lives_ok(
  $$ update public.incidents set body = 'Member landed badly; ice applied, no ambulance.'
     where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'but the reporter can correct their own description'
);

select tests.authenticate_as('staff_a2');
with changed as (
  update public.incidents set body = 'A colleague''s rewrite'
  where id = 'cccccccc-0000-0000-0000-000000000001' returning 1
)
select is(
  (select count(*)::int from changed),
  0,
  'a colleague can neither rewrite it nor handle it'
);

select tests.authenticate_as('manager_a');
select lives_ok(
  $$ update public.incidents
     set status = 'in_progress', assignee_id = tests.get_user_id('staff_a2')
     where id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'a manager takes it on and assigns somebody'
);
update public.incidents set title = 'A manager''s rewrite'
where id = 'cccccccc-0000-0000-0000-000000000001';
select is(
  (select title from public.incidents where id = 'cccccccc-0000-0000-0000-000000000001'),
  'Fall from the top of wall 4',
  'but does not rewrite what the reporter wrote'
);
select is(
  (select resolved_at from public.incidents
   where id = 'cccccccc-0000-0000-0000-000000000001'),
  null,
  'an incident in progress has no resolution time'
);
update public.incidents set status = 'resolved'
where id = 'cccccccc-0000-0000-0000-000000000001';
select isnt(
  (select resolved_at from public.incidents
   where id = 'cccccccc-0000-0000-0000-000000000001'),
  null,
  'and resolving one stamps it, from the database rather than the request'
);
update public.incidents set status = 'open'
where id = 'cccccccc-0000-0000-0000-000000000001';
select is(
  (select resolved_at from public.incidents
   where id = 'cccccccc-0000-0000-0000-000000000001'),
  null,
  'reopening clears it again'
);

with removed as (
  delete from public.incidents
  where id = 'cccccccc-0000-0000-0000-000000000001' returning 1
)
select is(
  (select count(*)::int from removed),
  0,
  'nobody deletes an incident — resolving one is what closing it looks like'
);

-- ---------------------------------------------------------------- comments --
select tests.authenticate_as('staff_a2');
select lives_ok(
  $$ insert into public.incident_comments (id, incident_id, body)
     values ('dddddddd-0000-0000-0000-000000000001',
             'cccccccc-0000-0000-0000-000000000001', 'Wall 4 is taped off for now') $$,
  'anybody who works there can comment'
);

select tests.authenticate_as('staff_a');
with changed as (
  update public.incident_comments set body = 'Not my comment'
  where id = 'dddddddd-0000-0000-0000-000000000001' returning 1
)
select is(
  (select count(*)::int from changed), 0, 'but only its author may edit it'
);

select tests.authenticate_as('staff_b');
select is(
  (select count(*)::int from public.incident_comments),
  0,
  'and the thread stays inside the gym'
);

-- ------------------------------------------------------------- attachments --
select tests.authenticate_as('staff_a');
select lives_ok(
  $$ insert into public.incident_attachments (incident_id, path, mime_type)
     values ('cccccccc-0000-0000-0000-000000000001',
             '11111111-1111-1111-1111-111111111111/cccccccc-0000-0000-0000-000000000001/photo.jpg',
             'image/jpeg') $$,
  'staff attach a photograph to an incident in their gym'
);

-- The bucket path is what the storage policies read, so the helper that parses
-- it is the policy: no company scope here, and nothing else is a gym either.
select is(
  public.incident_object_gym(
    '11111111-1111-1111-1111-111111111111/cccccccc-0000-0000-0000-000000000001/photo.jpg'
  ),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'an object''s first path segment is its gym'
);
select is(
  public.incident_object_gym('company/photo.jpg'),
  '00000000-0000-0000-0000-000000000000'::uuid,
  'and "company" is nobody''s gym here, unlike the content bucket'
);

-- ---------------------------------------------------------- the bucket --
select tests.clear_authentication();
select is(
  (select count(*)::int from storage.objects where bucket_id = 'incidents'),
  0,
  'anon reads no incident photographs'
);

select tests.authenticate_as('staff_a');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'incidents' order by name $$,
  $$ values ('11111111-1111-1111-1111-111111111111/gym-a-photo.jpg') $$,
  'staff see their own gym''s photographs, and neither another gym''s nor a loose path'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('incidents',
             '11111111-1111-1111-1111-111111111111/cccccccc-0000-0000-0000-000000000001/new.jpg') $$,
  'and can upload one — photographing what you find is reporting, not publishing'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('incidents', '22222222-2222-2222-2222-222222222222/sneaky.jpg') $$,
  '42501',
  null,
  'but not into another gym''s folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('incidents', 'company/sneaky.jpg') $$,
  '42501',
  null,
  'nor into a path that belongs to no gym'
);

select * from finish();
rollback;
