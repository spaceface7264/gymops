-- P3-02: permission matrix (PROJECT_SPEC.md §2.1) for the news and guides
-- tables — posts, post_reads, guide_categories, guides, guide_acks — plus the
-- generated body_text/search columns they depend on.
--
-- Run `npm run db:reset` before `npm run db:test`.
begin;
select plan(44);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('super');
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('staff_b');
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
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

-- A published post per scope, one draft and one soft-deleted post.
insert into public.posts (id, gym_id, title, body, status, requires_ack)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', null,
   'Company news',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"New chalk policy"}]}]}'::jsonb,
   'published', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Gym A news', '{"type":"doc","content":[]}'::jsonb, 'published', false),
  ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
   'Gym B news', '{"type":"doc","content":[]}'::jsonb, 'published', false),
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Gym A draft', '{"type":"doc","content":[]}'::jsonb, 'draft', false);

update public.posts set deleted_at = now()
where id = 'aaaaaaaa-0000-0000-0000-000000000003';

insert into public.guide_categories (id, gym_id, name)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', null, 'Company handbook'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Gym A routines');

insert into public.guides (id, gym_id, category_id, title, body, status, requires_ack, version)
values
  ('cccccccc-0000-0000-0000-000000000001', null, 'bbbbbbbb-0000-0000-0000-000000000001',
   'Opening the gym',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Unlock the front door"}]}]}'::jsonb,
   'published', true, 2),
  ('cccccccc-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', null,
   'Gym B routing', '{"type":"doc","content":[]}'::jsonb, 'published', false, 1);

-- --------------------------------------------------------------- structure --
select has_table('public', 'posts', 'posts table exists');
select has_table('public', 'post_reads', 'post_reads table exists');
select has_table('public', 'guide_categories', 'guide_categories table exists');
select has_table('public', 'guides', 'guides table exists');
select has_table('public', 'guide_acks', 'guide_acks table exists');

select is(
  (select count(*)::int from pg_class
   where relnamespace = 'public'::regnamespace
     and relname in ('posts', 'post_reads', 'guide_categories', 'guides', 'guide_acks')
     and relrowsecurity),
  5,
  'RLS is enabled on all five content tables'
);

-- ------------------------------------------------- generated text and search --
select is(
  (select body_text from public.posts where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'New chalk policy',
  'body_text is generated from the Tiptap document'
);
select is(
  (select body_text from public.posts where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  '',
  'an empty document generates empty body_text rather than null'
);
select isnt(
  (select search_vector from public.guides where id = 'cccccccc-0000-0000-0000-000000000001'),
  null,
  'guides get a search vector'
);
select is(
  (select count(*)::int from public.posts
   where search_vector @@ websearch_to_tsquery('simple', 'chalk')),
  1,
  'a word in the body is findable through the search vector'
);
select is(
  (select count(*)::int from public.guides
   where search_vector @@ websearch_to_tsquery('simple', 'opening')),
  1,
  'a word in the title is findable through the search vector'
);

select is(
  (select published_at is not null from public.posts
   where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  true,
  'publishing stamps published_at'
);
select is(
  (select published_at from public.posts where id = 'aaaaaaaa-0000-0000-0000-000000000004'),
  null,
  'a draft has no published_at'
);

-- ------------------------------------------------------------------- posts --
select tests.clear_authentication();
select is((select count(*)::int from public.posts), 0, 'anon cannot read posts');

select tests.authenticate_as('staff_a');
select results_eq(
  $$ select title from public.posts order by title $$,
  $$ values ('Company news'), ('Gym A news') $$,
  'staff read company-wide and their own gym''s published posts, and nothing else'
);
select throws_ok(
  $$ insert into public.posts (gym_id, title)
     values ('11111111-1111-1111-1111-111111111111', 'From staff') $$,
  '42501',
  null,
  'staff cannot write news'
);

select tests.authenticate_as('staff_b');
select is(
  (select count(*)::int from public.posts where gym_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'a soft-deleted post is invisible to its own gym'
);

select tests.authenticate_as('outsider');
select results_eq(
  $$ select title from public.posts $$,
  $$ values ('Company news') $$,
  'a user with no gym sees only company-wide news'
);

select tests.authenticate_as('manager_a');
select is(
  (select count(*)::int from public.posts),
  3,
  'a manager also sees their own gym''s drafts'
);
select lives_ok(
  $$ insert into public.posts (gym_id, title)
     values ('11111111-1111-1111-1111-111111111111', 'From the manager') $$,
  'a manager can write news for a gym they manage'
);
select throws_ok(
  $$ insert into public.posts (gym_id, title) values (null, 'Company-wide from a manager') $$,
  '42501',
  null,
  'a manager cannot publish company-wide news'
);
select throws_ok(
  $$ insert into public.posts (gym_id, title)
     values ('22222222-2222-2222-2222-222222222222', 'Another gym') $$,
  '42501',
  null,
  'a manager cannot write news for a gym they do not manage'
);
select throws_ok(
  $$ update public.posts set gym_id = null
     where id = 'aaaaaaaa-0000-0000-0000-000000000002' $$,
  '42501',
  null,
  'a manager cannot move their post to company-wide'
);
with changed as (
  update public.posts set pinned = true
  where id = 'aaaaaaaa-0000-0000-0000-000000000002' returning 1
)
select is((select count(*)::int from changed), 1, 'a manager can pin their own gym''s post');
with changed as (
  update public.posts set title = 'Edited'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1
)
select is((select count(*)::int from changed), 0, 'a manager cannot edit a company-wide post');
with removed as (
  delete from public.posts where id = 'aaaaaaaa-0000-0000-0000-000000000002' returning 1
)
select is(
  (select count(*)::int from removed),
  0,
  'nobody deletes a post outright — deleting is setting deleted_at'
);

select tests.authenticate_as('admin');
select is((select count(*)::int from public.posts), 4, 'an admin sees every gym''s posts and drafts');
select lives_ok(
  $$ insert into public.posts (gym_id, title) values (null, 'Company-wide from an admin') $$,
  'an admin can publish company-wide news'
);

-- -------------------------------------------------------------- post_reads --
select tests.authenticate_as('staff_a');
select lives_ok(
  $$ insert into public.post_reads (post_id, user_id, acknowledged_at)
     values ('aaaaaaaa-0000-0000-0000-000000000001', tests.get_user_id('staff_a'), now()) $$,
  'a user can acknowledge a post for themselves'
);
select throws_ok(
  $$ insert into public.post_reads (post_id, user_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001', tests.get_user_id('staff_b')) $$,
  '42501',
  null,
  'a user cannot acknowledge a post on someone else''s behalf'
);

select tests.authenticate_as('staff_b');
select is(
  (select count(*)::int from public.post_reads),
  0,
  'staff cannot see who else has acknowledged'
);

select tests.authenticate_as('manager_a');
select is(
  (select count(*)::int from public.post_reads
   where user_id = tests.get_user_id('staff_a')),
  1,
  'a manager sees acknowledgements from their own gyms'' staff'
);

select tests.authenticate_as('super');
select is(
  (select count(*)::int from public.post_reads),
  1,
  'a superadmin sees every acknowledgement'
);

-- -------------------------------------------------------- guide categories --
select tests.authenticate_as('staff_a');
select results_eq(
  $$ select name from public.guide_categories order by name $$,
  $$ values ('Company handbook'), ('Gym A routines') $$,
  'staff see company and their own gym''s categories'
);
select throws_ok(
  $$ insert into public.guide_categories (gym_id, name)
     values ('11111111-1111-1111-1111-111111111111', 'From staff') $$,
  '42501',
  null,
  'staff cannot create a category'
);

select tests.authenticate_as('manager_a');
select lives_ok(
  $$ insert into public.guide_categories (gym_id, name, parent_id)
     values ('11111111-1111-1111-1111-111111111111', 'Wall cleaning',
             'bbbbbbbb-0000-0000-0000-000000000002') $$,
  'a manager can add a category under their own gym'
);
select throws_ok(
  $$ insert into public.guide_categories (gym_id, name) values (null, 'Company-wide') $$,
  '42501',
  null,
  'a manager cannot add a company-wide category'
);

-- ------------------------------------------------------------------ guides --
select tests.authenticate_as('staff_a');
select results_eq(
  $$ select title from public.guides order by title $$,
  $$ values ('Opening the gym') $$,
  'staff read company guides and their own gym''s, not another gym''s'
);
with changed as (
  update public.guides set title = 'Rewritten'
  where id = 'cccccccc-0000-0000-0000-000000000001' returning 1
)
select is((select count(*)::int from changed), 0, 'staff cannot edit a guide');

select tests.authenticate_as('manager_a');
select lives_ok(
  $$ insert into public.guides (gym_id, category_id, title)
     values ('11111111-1111-1111-1111-111111111111',
             'bbbbbbbb-0000-0000-0000-000000000002', 'Setting day') $$,
  'a manager can write a guide for a gym they manage'
);

-- -------------------------------------------------------------- guide_acks --
select tests.authenticate_as('staff_a');
select lives_ok(
  $$ insert into public.guide_acks (guide_id, user_id, version)
     values ('cccccccc-0000-0000-0000-000000000001', tests.get_user_id('staff_a'), 2) $$,
  'a user can confirm a guide version'
);
select is(
  (select version from public.guide_acks
   where guide_id = 'cccccccc-0000-0000-0000-000000000001'
     and user_id = tests.get_user_id('staff_a')),
  2,
  'the acknowledgement records which version was confirmed'
);
select throws_ok(
  $$ insert into public.guide_acks (guide_id, user_id, version)
     values ('cccccccc-0000-0000-0000-000000000001', tests.get_user_id('staff_b'), 2) $$,
  '42501',
  null,
  'a user cannot confirm a guide for someone else'
);

select tests.authenticate_as('manager_a');
select is(
  (select count(*)::int from public.guide_acks where user_id = tests.get_user_id('staff_a')),
  1,
  'a manager sees their own gyms'' guide acknowledgements'
);

select * from finish();
rollback;
