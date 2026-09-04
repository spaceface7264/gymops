-- P8-02 — search_content() and read_content(): what the assistant may see.
--
-- The one thing these add to content_search() is the status test. A publisher
-- searching by hand should find their own draft; an assistant answering a
-- question must never quote one. Everything else — which gym, deleted or not —
-- is the select policy on posts and guides, because both run as the caller.
--
-- Tested against supabase/migrations/20260904120000_assistant_content_tools.sql.
begin;
select plan(11);

-- ---------------------------------------------------------------- fixtures --
insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

select tests.create_user('admin');
select tests.create_user('staff_a');
update public.profiles set is_admin = true where id = tests.get_user_id('admin');
insert into public.gym_memberships (user_id, gym_id, role)
values (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff');

select tests.authenticate_as('admin');
insert into public.posts (id, gym_id, title, body, status, published_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', null, 'Chalk policy',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Only liquid chalk from Monday."}]},{"type":"paragraph","content":[{"type":"text","text":"Loose chalk stays in the bag."}]}]}',
   'published', now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', null, 'Anything else',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"We mention chalk once, in passing."}]}]}',
   'published', now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', null, 'Draft about chalk',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Not published."}]}]}',
   'draft', null);
insert into public.guides (id, gym_id, title, body, status, published_at)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Chalk in Gym B',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Gym B only."}]}]}',
   'published', now());

-- --------------------------------------------------------------- structure --
select has_function('public', 'search_content', array['text'], 'search_content exists');
select has_function('public', 'read_content', array['text', 'uuid'], 'read_content exists');
select is(
  (select bool_or(prosecdef) from pg_proc
   where oid in ('public.search_content(text)'::regprocedure,
                 'public.read_content(text, uuid)'::regprocedure)),
  false,
  'both run as the caller, so the content policies decide'
);

-- ------------------------------------------------------------------ search --
select tests.authenticate_as('staff_a');
select results_eq(
  $$ select id from public.search_content('chalk') $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid),
            ('aaaaaaaa-0000-0000-0000-000000000002'::uuid) $$,
  'staff get the published posts they may read, title hit first, nothing from Gym B'
);
select is(
  (select snippet from public.search_content('chalk')
   where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Only liquid chalk from Monday. Loose chalk stays in the bag.',
  'the snippet is the flattened body on one line'
);

select tests.authenticate_as('admin');
select is(
  (select count(*)::int from public.search_content('chalk')),
  3,
  'a publisher still does not get their draft from the assistant''s search'
);

-- -------------------------------------------------------------------- read --
select tests.authenticate_as('staff_a');
select is(
  (select title from public.read_content('news', 'aaaaaaaa-0000-0000-0000-000000000001')),
  'Chalk policy',
  'a published post can be read in full'
);
select is(
  (select body_text from public.read_content('news', 'aaaaaaaa-0000-0000-0000-000000000001')),
  'Only liquid chalk from Monday. Loose chalk stays in the bag.',
  'as its flattened text'
);
select is(
  (select count(*)::int from public.read_content('guide', 'bbbbbbbb-0000-0000-0000-000000000001')),
  0,
  'a guide from a gym the reader is not at is not readable'
);
select is(
  (select count(*)::int from public.read_content('guide', 'aaaaaaaa-0000-0000-0000-000000000001')),
  0,
  'and the kind has to match the id'
);

select tests.authenticate_as('admin');
select is(
  (select count(*)::int from public.read_content('news', 'aaaaaaaa-0000-0000-0000-000000000003')),
  0,
  'a draft is not readable even by its author'
);

select * from finish();
rollback;
