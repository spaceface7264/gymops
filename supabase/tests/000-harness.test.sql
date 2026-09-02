-- Proves the pgTAP harness itself works: extension present, helpers loaded, and
-- authenticate_as() actually changes auth.uid(). Real policy tests land in P1-05.
--
-- pgTAP and the `tests` schema come from supabase/seeds/test-helpers.sql, which
-- `supabase db reset` loads. Run `npm run db:reset` before `npm run db:test`.
begin;
select plan(5);

select has_extension('extensions', 'pgtap', 'pgTAP is installed');
select has_schema('tests', 'test helper schema exists');

select lives_ok(
  $$ select tests.create_user('harness_user') $$,
  'tests.create_user() creates an auth user'
);

select isnt(
  tests.get_user_id('harness_user'),
  null,
  'tests.get_user_id() finds the created user'
);

select tests.authenticate_as('harness_user');
select is(
  auth.uid(),
  tests.get_user_id('harness_user'),
  'authenticate_as() sets auth.uid() for RLS'
);

select * from finish();
rollback;
