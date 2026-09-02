-- pgTAP bootstrap and RLS test helpers.
--
-- Loaded by `supabase db reset` via db.seed.sql_paths in config.toml, so it
-- exists locally and in CI but never in a deployed database — seeds are not
-- part of `supabase db push`. It lives outside supabase/tests/ because
-- `supabase test db` treats every .sql file in there as a test.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;

-- Create an auth user we can act as. `identifier` is a short handle used by the
-- other helpers, e.g. 'manager_aarhus'.
create or replace function tests.create_user(identifier text, email text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid := extensions.uuid_generate_v4();
  user_email text := coalesce(email, identifier || '@example.test');
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values (
    user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    user_email, extensions.crypt('password123', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('identifier', identifier), now(), now()
  );

  return user_id;
end;
$$;

-- Look up a user created with tests.create_user().
create or replace function tests.get_user_id(identifier text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from auth.users
  where raw_user_meta_data ->> 'identifier' = identifier
  limit 1;
$$;

-- Act as that user for the rest of the transaction: RLS policies then see the
-- same `auth.uid()` and role a real request would carry.
create or replace function tests.authenticate_as(identifier text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  user_id uuid := tests.get_user_id(identifier);
begin
  if user_id is null then
    raise exception 'No test user with identifier %. Create it with tests.create_user().', identifier;
  end if;

  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

-- Drop back to an unauthenticated (anon) request.
create or replace function tests.clear_authentication()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;

-- Run as the service role / migration owner again.
create or replace function tests.become_postgres()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;

-- Tests keep calling these helpers after authenticate_as() has switched the
-- session to `authenticated` or `anon`, so those roles need access too.
grant usage on schema tests to postgres, anon, authenticated, service_role;
grant execute on all functions in schema tests to postgres, anon, authenticated, service_role;
alter default privileges in schema tests
  grant execute on functions to postgres, anon, authenticated, service_role;
