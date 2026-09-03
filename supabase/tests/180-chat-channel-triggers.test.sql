-- P6-02 — the automatic half of chat: the channels and rosters nobody creates.
--
-- These are the assertions that a gym's channel and its member list are facts
-- of the database rather than something a screen remembers to do. They run as
-- the migration owner: the point is what the triggers do, not who may ask.
--
-- Tested against supabase/migrations/20260903100000_chat_channel_triggers.sql.
begin;
select plan(13);

select is(
  (select count(*)::int from public.channels where kind = 'company'),
  1,
  'there is exactly one #company'
);
select is(
  (select count(*)::int from public.gyms),
  (select count(*)::int from public.channels where kind = 'gym'),
  'and one gym channel per gym, backfilled for the ones that predate P6-02'
);
select is(
  (select count(*)::int
   from public.gym_memberships m
   join public.channels c on c.kind = 'gym' and c.gym_id = m.gym_id
   left join public.channel_members cm
     on cm.channel_id = c.id and cm.user_id = m.user_id
   where cm.user_id is null),
  0,
  'every existing membership was seated in its gym channel'
);

-- ------------------------------------------------------------- new gyms --
insert into public.gyms (id, name, slug)
values ('44444444-4444-4444-4444-444444444444', 'Gym D', 'gym-d');

select is(
  (select name from public.channels
   where kind = 'gym' and gym_id = '44444444-4444-4444-4444-444444444444'),
  'Gym D',
  'a new gym arrives with its channel, named after it'
);

update public.gyms set name = 'Gym D (Vest)'
where id = '44444444-4444-4444-4444-444444444444';
select is(
  (select name from public.channels
   where kind = 'gym' and gym_id = '44444444-4444-4444-4444-444444444444'),
  'Gym D (Vest)',
  'renaming the gym renames the channel'
);

select throws_ok(
  $$ insert into public.channels (kind, gym_id, name)
     values ('gym', '44444444-4444-4444-4444-444444444444', 'Second one') $$,
  '23505',
  null,
  'a gym cannot have a second channel'
);

-- ------------------------------------------------------------ new people --
select tests.create_user('newcomer');
select is(
  (select count(*)::int
   from public.channel_members m
   join public.channels c on c.id = m.channel_id
   where c.kind = 'company' and m.user_id = tests.get_user_id('newcomer')),
  1,
  'a new profile is in #company'
);

insert into public.gym_memberships (user_id, gym_id, role)
values (tests.get_user_id('newcomer'), '44444444-4444-4444-4444-444444444444', 'staff');
select is(
  (select count(*)::int
   from public.channel_members m
   join public.channels c on c.id = m.channel_id
   where c.kind = 'gym' and c.gym_id = '44444444-4444-4444-4444-444444444444'
     and m.user_id = tests.get_user_id('newcomer')),
  1,
  'a membership seats them in the gym channel'
);

update public.gym_memberships set role = 'manager'
where user_id = tests.get_user_id('newcomer')
  and gym_id = '44444444-4444-4444-4444-444444444444';
select is(
  (select count(*)::int
   from public.channel_members m
   join public.channels c on c.id = m.channel_id
   where c.kind = 'gym' and c.gym_id = '44444444-4444-4444-4444-444444444444'
     and m.user_id = tests.get_user_id('newcomer')),
  1,
  'a promotion moves nobody'
);

update public.profiles set active = false where id = tests.get_user_id('newcomer');
select is(
  (select count(*)::int
   from public.channel_members m
   join public.channels c on c.id = m.channel_id
   where c.kind = 'company' and m.user_id = tests.get_user_id('newcomer')),
  0,
  'a deactivated colleague leaves #company'
);

update public.profiles set active = true where id = tests.get_user_id('newcomer');
select is(
  (select count(*)::int
   from public.channel_members m
   join public.channels c on c.id = m.channel_id
   where c.kind = 'company' and m.user_id = tests.get_user_id('newcomer')),
  1,
  'and is back in it when they return'
);

delete from public.gym_memberships
where user_id = tests.get_user_id('newcomer')
  and gym_id = '44444444-4444-4444-4444-444444444444';
select is(
  (select count(*)::int
   from public.channel_members m
   join public.channels c on c.id = m.channel_id
   where c.kind = 'gym' and c.gym_id = '44444444-4444-4444-4444-444444444444'
     and m.user_id = tests.get_user_id('newcomer')),
  0,
  'revoking a membership empties the seat'
);

delete from public.gyms where id = '44444444-4444-4444-4444-444444444444';
select is(
  (select count(*)::int from public.channels
   where kind = 'gym' and gym_id = '44444444-4444-4444-4444-444444444444'),
  0,
  'a deleted gym takes its channel with it'
);

select * from finish();
rollback;
