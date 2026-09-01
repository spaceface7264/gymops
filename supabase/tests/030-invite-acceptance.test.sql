-- P2-03: the pending invite closes on the invited person's first sign-in.
begin;
select plan(4);

select tests.create_user('newcomer', 'newcomer@gymops.test');

insert into public.gyms (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a');

insert into public.invites (email, gym_id, role)
values ('Newcomer@Gymops.test', '11111111-1111-1111-1111-111111111111', 'staff');

select is(
  (select status::text from public.invites),
  'pending',
  'a fresh invite is pending'
);

select throws_ok(
  $$insert into public.invites (email, gym_id, role)
    values ('newcomer@gymops.test', '11111111-1111-1111-1111-111111111111', 'staff')$$,
  '23505',
  null,
  'a second pending invite to the same address is refused'
);

update auth.users set last_sign_in_at = now() where id = tests.get_user_id('newcomer');

select is(
  (select status::text from public.invites),
  'accepted',
  'the first sign-in accepts the invite, whatever case the address was typed in'
);

select is(
  (select accepted_by from public.invites),
  tests.get_user_id('newcomer'),
  'the invite records who accepted it'
);

select * from finish();
rollback;
