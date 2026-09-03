-- P6-07 — custom channels, asked as the client actually asks.
--
-- P6-01 tested who may read and write these rows. What this file tests is the
-- *statements the screen sends*: create and read the id back, seat yourself,
-- join, post, leave, seat somebody else, rename, delete. The DM work found two
-- policies that were right about permission and wrong about the statement —
-- a `returning` on a row not yet visible, and a policy subquery filtered by the
-- policy it was helping — so this is the same shape of check, before the
-- dialogs are written.
--
-- Tested against supabase/migrations/20260903090000_chat_schema.sql.
begin;
select plan(17);

-- ---------------------------------------------------------------- fixtures --
insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('staff_a2');
select tests.create_user('staff_b');

update public.profiles set is_admin = true where id = tests.get_user_id('admin');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_a2'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

-- ---------------------------------------------------------------- creating --
select tests.authenticate_as('manager_a');

-- The dialog's own two statements: insert returning the id, then seat the
-- person who made it. A channel with no members is visible to its creator
-- because they moderate it — the DM's trap does not repeat here, and that is
-- worth an assertion rather than an assumption.
with made as (
  insert into public.channels (kind, gym_id, name, description, is_private)
  values ('custom', '11111111-1111-1111-1111-111111111111', 'Route setting', null, false)
  returning id
)
select set_config('tests.public_channel', (select id::text from made), false);

select isnt(
  current_setting('tests.public_channel', true), null,
  'a manager creates a channel and is handed its id'
);

with seated as (
  insert into public.channel_members (channel_id, user_id)
  values (current_setting('tests.public_channel')::uuid, tests.get_user_id('manager_a'))
  returning 1
)
select is((select count(*)::int from seated), 1, 'and seats themselves in it');

-- The private one, for the seating assertions further down.
with made as (
  insert into public.channels (kind, gym_id, name, is_private)
  values ('custom', '11111111-1111-1111-1111-111111111111', 'Managers', true)
  returning id
)
select set_config('tests.private_channel', (select id::text from made), false);

select isnt(
  current_setting('tests.private_channel', true), null,
  'a private one is created the same way'
);

select throws_ok(
  $$ insert into public.channels (kind, gym_id, name, is_private)
     values ('custom', null, 'Everybody', false) $$,
  '42501',
  null,
  'but a manager cannot open a company-wide channel'
);

select tests.authenticate_as('staff_a');
select throws_ok(
  $$ insert into public.channels (kind, gym_id, name, is_private)
     values ('custom', '11111111-1111-1111-1111-111111111111', 'Mine', false) $$,
  '42501',
  null,
  'and staff cannot open one at all'
);

-- ----------------------------------------------------------------- joining --
-- What the browse list asks: the custom channels I can see and am not in.
select is(
  (select count(*)::int from public.channels
   where kind = 'custom'
     and not exists (
       select 1 from public.channel_members m
       where m.channel_id = channels.id and m.user_id = auth.uid()
     )),
  1,
  'staff are offered the public channel and not the private one'
);

with joined as (
  insert into public.channel_members (channel_id, user_id)
  values (current_setting('tests.public_channel')::uuid, tests.get_user_id('staff_a'))
  returning 1
)
select is((select count(*)::int from joined), 1, 'and can join it themselves');

with said as (
  insert into public.messages (channel_id, body)
  values (current_setting('tests.public_channel')::uuid, 'First one in.')
  returning 1
)
select is((select count(*)::int from said), 1, 'joining is what lets them post');

select throws_ok(
  format(
    $$ insert into public.channel_members (channel_id, user_id) values (%L, %L) $$,
    current_setting('tests.private_channel'), tests.get_user_id('staff_a')
  ),
  '42501',
  null,
  'a private channel is not one you let yourself into'
);

select tests.authenticate_as('staff_b');
select is(
  (select count(*)::int from public.channels where kind = 'custom'),
  0,
  'another gym is offered neither'
);

-- ----------------------------------------------------------------- managing --
select tests.authenticate_as('manager_a');

with seated as (
  insert into public.channel_members (channel_id, user_id)
  values (current_setting('tests.private_channel')::uuid, tests.get_user_id('staff_a2'))
  returning 1
)
select is((select count(*)::int from seated), 1, 'a manager seats somebody in a private channel');

with removed as (
  delete from public.channel_members
  where channel_id = current_setting('tests.private_channel')::uuid
    and user_id = tests.get_user_id('staff_a2')
  returning 1
)
select is((select count(*)::int from removed), 1, 'and can take them out again');

with renamed as (
  update public.channels set name = 'Route setting & strip'
  where id = current_setting('tests.public_channel')::uuid
  returning 1
)
select is((select count(*)::int from renamed), 1, 'a manager renames their channel');

-- ------------------------------------------------------------------ leaving --
select tests.authenticate_as('staff_a');

with renamed as (
  update public.channels set name = 'Mine now'
  where id = current_setting('tests.public_channel')::uuid
  returning 1
)
select is((select count(*)::int from renamed), 0, 'staff rename nothing');

with left_it as (
  delete from public.channel_members
  where channel_id = current_setting('tests.public_channel')::uuid
    and user_id = auth.uid()
  returning 1
)
select is((select count(*)::int from left_it), 1, 'but they can leave');

-- ----------------------------------------------------------------- deleting --
select tests.authenticate_as('manager_a');

with gone as (
  delete from public.channels where id = current_setting('tests.public_channel')::uuid
  returning 1
)
select is((select count(*)::int from gone), 1, 'a manager deletes their channel');

select is(
  (select count(*)::int from public.messages
   where channel_id = current_setting('tests.public_channel')::uuid),
  0,
  'and what was said in it goes with it'
);

select * from finish();
rollback;
