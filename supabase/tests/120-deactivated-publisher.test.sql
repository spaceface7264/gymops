-- Deactivating a manager must close the *writing* half of their access, not
-- only the reading half that `060-content-integrity.test.sql` covers — that
-- one deactivates a staff member and asserts about reads.
--
-- The rule lives one level down from the gates: `can_publish_content()` never
-- looks at `profiles.active` itself, it trusts `managed_gym_ids()`, which
-- gained the `p.active` join in `20260902130000_content_integrity.sql`. So a
-- single edit to that function would reopen publishing for a deactivated
-- manager in every content table at once, and silently. These assertions pin
-- the behaviour to the outcome rather than to the implementation.
--
-- The draft check matters most: `posts_select` is an `or`, and its second
-- branch is `can_publish_content(gym_id)` with no `status` filter. If the
-- publish gate ever returns true for a deactivated manager, it does not just
-- let them write — it hands back their gyms' unpublished drafts too.
begin;
select plan(16);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('manager_a');
select tests.create_user('staff_a');

insert into public.gyms (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff');

insert into public.posts (id, gym_id, title, status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Gym A news', 'published'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Gym A draft', 'draft');

insert into public.guide_categories (id, gym_id, name)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'Routines');

insert into public.guides (id, gym_id, category_id, title, status)
values ('cccccccc-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'bbbbbbbb-0000-0000-0000-000000000001', 'Setting day', 'published');

insert into public.checklist_templates (id, gym_id, kind, name)
values ('dddddddd-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'closing', 'Gym A closing');

-- ================================================ 1. while still active ==
select tests.authenticate_as('manager_a');
select lives_ok(
  $$ insert into public.posts (gym_id, title)
     values ('11111111-1111-1111-1111-111111111111', 'Written while active') $$,
  'an active manager publishes in the gym they manage'
);
select is(
  (select count(*)::int from public.posts where status = 'draft'),
  2,
  'an active manager sees their gym''s drafts'
);

-- ==================================================== 2. once deactivated ==
select tests.become_postgres();
update public.profiles set active = false where id = tests.get_user_id('manager_a');

select tests.authenticate_as('manager_a');

-- The mechanism, so a failure here names the cause rather than the symptom.
select is(
  (select count(*)::int from public.managed_gym_ids()),
  0,
  'a deactivated manager manages no gyms'
);
select is(
  public.can_publish_content('11111111-1111-1111-1111-111111111111'),
  false,
  'a deactivated manager may not publish in the gym they managed'
);

select throws_ok(
  $$ insert into public.posts (gym_id, title)
     values ('11111111-1111-1111-1111-111111111111', 'Written while deactivated') $$,
  '42501',
  null,
  'a deactivated manager cannot write a post'
);
with changed as (
  update public.posts set title = 'Edited while deactivated'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1
)
select is(
  (select count(*)::int from changed),
  0,
  'a deactivated manager cannot edit their gym''s post'
);
select is(
  (select count(*)::int from public.posts),
  0,
  'a deactivated manager reads no posts, their own gym''s drafts included'
);

select throws_ok(
  $$ insert into public.guides (gym_id, category_id, title)
     values ('11111111-1111-1111-1111-111111111111',
             'bbbbbbbb-0000-0000-0000-000000000001', 'Written while deactivated') $$,
  '42501',
  null,
  'a deactivated manager cannot write a guide'
);
with changed as (
  update public.guides set title = 'Edited while deactivated'
  where id = 'cccccccc-0000-0000-0000-000000000001' returning 1
)
select is(
  (select count(*)::int from changed),
  0,
  'a deactivated manager cannot edit a guide'
);
select throws_ok(
  $$ insert into public.guide_categories (gym_id, name)
     values ('11111111-1111-1111-1111-111111111111', 'Written while deactivated') $$,
  '42501',
  null,
  'a deactivated manager cannot add a guide category'
);

select throws_ok(
  $$ insert into public.checklist_templates (gym_id, kind, name)
     values ('11111111-1111-1111-1111-111111111111', 'opening',
             'Written while deactivated') $$,
  '42501',
  null,
  'a deactivated manager cannot write a checklist template'
);
with changed as (
  update public.checklist_templates set name = 'Edited while deactivated'
  where id = 'dddddddd-0000-0000-0000-000000000001' returning 1
)
select is(
  (select count(*)::int from changed),
  0,
  'a deactivated manager cannot edit a checklist template'
);
select is(
  (select count(*)::int from public.checklist_templates),
  0,
  'a deactivated manager reads no checklist templates'
);

-- ===================================================== 3. and back again ==
-- Proves the refusals above follow the active flag, not some other difference
-- between the fixtures.
select tests.become_postgres();
update public.profiles set active = true where id = tests.get_user_id('manager_a');

select tests.authenticate_as('manager_a');
select is(
  public.can_publish_content('11111111-1111-1111-1111-111111111111'),
  true,
  'reactivating restores the right to publish'
);
select lives_ok(
  $$ insert into public.posts (gym_id, title)
     values ('11111111-1111-1111-1111-111111111111', 'Written after reactivation') $$,
  'a reactivated manager publishes again'
);
select isnt(
  (select count(*)::int from public.posts),
  0,
  'a reactivated manager reads their gym''s posts again'
);

select * from finish();
rollback;
