-- P3-01: storage RLS for the `content` bucket. An object's first path segment
-- is its scope, and reading and writing it must follow the same §2.1 rules as
-- the post or guide it belongs to.
begin;
select plan(11);

select tests.create_user('super');
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('outsider');

update public.profiles set is_superadmin = true, is_admin = true
where id = tests.get_user_id('super');
update public.profiles set is_admin = true where id = tests.get_user_id('admin');

insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff');

insert into storage.buckets (id, name, public) values ('content', 'content', false)
on conflict (id) do nothing;

insert into storage.objects (bucket_id, name)
values
  ('content', 'company/company-image.png'),
  ('content', '11111111-1111-1111-1111-111111111111/gym-a-image.png'),
  ('content', '22222222-2222-2222-2222-222222222222/gym-b-image.png'),
  ('content', 'loose-image.png');

-- ------------------------------------------------------------ path scoping --
select is(
  public.content_object_gym('company/x.png'),
  null,
  'a company path has no gym'
);
select is(
  public.content_object_gym('11111111-1111-1111-1111-111111111111/x.png'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'a gym path resolves to that gym'
);
select is(
  public.content_object_gym('whatever/x.png'),
  '00000000-0000-0000-0000-000000000000'::uuid,
  'a path that is neither resolves to a gym nobody belongs to'
);

-- ------------------------------------------------------------------ access --
select tests.clear_authentication();
select is(
  (select count(*)::int from storage.objects where bucket_id = 'content'),
  0,
  'anon reads no content objects'
);

select tests.authenticate_as('staff_a');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'content' order by name $$,
  $$ values ('11111111-1111-1111-1111-111111111111/gym-a-image.png'),
            ('company/company-image.png') $$,
  'staff read company images and their own gym''s, and not a stray path'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('content', '11111111-1111-1111-1111-111111111111/from-staff.png') $$,
  '42501',
  null,
  'staff cannot upload'
);

select tests.authenticate_as('outsider');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'content' $$,
  $$ values ('company/company-image.png') $$,
  'a user with no gym reads only company images'
);

select tests.authenticate_as('manager_a');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('content', '11111111-1111-1111-1111-111111111111/from-manager.png') $$,
  'a manager can upload into a gym they manage'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('content', 'company/from-manager.png') $$,
  '42501',
  null,
  'a manager cannot upload a company-wide image'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('content', '22222222-2222-2222-2222-222222222222/from-manager.png') $$,
  '42501',
  null,
  'a manager cannot upload into a gym they do not manage'
);

select tests.authenticate_as('admin');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('content', 'company/from-admin.png') $$,
  'an admin can upload a company-wide image'
);

select * from finish();
rollback;
