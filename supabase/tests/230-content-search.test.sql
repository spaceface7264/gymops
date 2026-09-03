-- supabase/tests/230-content-search.test.sql
-- P7B-02 — content_search(): one ranked list over news and guides, and no
-- more than the caller could read table by table.
begin;
select plan(7);

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
-- A Tiptap document with one paragraph; `tiptap_text()` flattens it.
insert into public.posts (id, gym_id, title, body, status, published_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', null, 'Chalk policy',
   '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Only liquid chalk from Monday."}]}]}',
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

select has_function('public', 'content_search', array['text'], 'content_search exists');
select is(
  (select prosecdef from pg_proc where oid = 'public.content_search(text)'::regprocedure),
  false,
  'and runs as the caller'
);

select tests.authenticate_as('staff_a');
select results_eq(
  $$ select id from public.content_search('chalk') $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid),
            ('aaaaaaaa-0000-0000-0000-000000000002'::uuid) $$,
  'staff get the published posts they may read, title hit first, and nothing from Gym B or a draft'
);
select is(
  (select kind from public.content_search('chalk') limit 1),
  'news',
  'rows say what they are'
);
select is(
  (select count(*)::int from public.content_search('liquid')),
  1,
  'a body-only word still matches'
);

select tests.authenticate_as('admin');
select is(
  (select count(*)::int from public.content_search('chalk')),
  4,
  'the admin sees the draft and the other gym too'
);
select is(
  (select gym_name from public.content_search('chalk') where kind = 'guide'),
  'Gym B',
  'the gym name rides along'
);

select * from finish();
rollback;
