-- P6-02 — the channels nobody creates: one per gym, and #company.
--
-- Spec §2.2 promises "auto channel per gym + #company". Doing that in the
-- client would mean a channel that exists only once somebody has opened the
-- chat screen, and a roster that drifts every time a membership is granted
-- somewhere else in the app, so it is the database's job here: a gym gets its
-- channel when it is created, a person gets their seat when they are given a
-- membership, and everybody active is in #company.
--
-- All four functions are `security definer` because they run from triggers on
-- tables whose writers — an admin granting a membership, GoTrue creating a
-- profile — have no rights of their own on `channels` (P6-01 lets nobody
-- hand-write a gym channel at all).
--
-- Tested by supabase/tests/180-chat-channel-triggers.test.sql.

-- ============================================================ #company ==

-- The singleton, created once here. `channels_company_idx` guarantees there is
-- never a second one.
insert into public.channels (kind, name, description)
values ('company', 'Company', 'Everyone at every gym.');

-- ======================================================== gym channels ==

create function public.ensure_gym_channel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.channels (kind, gym_id, name)
    values ('gym', new.id, new.name)
    on conflict do nothing;
  else
    -- A renamed gym is a renamed channel; the alternative is a sidebar full of
    -- the names gyms used to have.
    update public.channels set name = new.name
    where kind = 'gym' and gym_id = new.id;
  end if;

  return null;
end;
$$;

create trigger gyms_ensure_channel after insert on public.gyms
  for each row execute function public.ensure_gym_channel();

create trigger gyms_rename_channel after update of name on public.gyms
  for each row when (new.name is distinct from old.name)
  execute function public.ensure_gym_channel();

-- Working at a gym is being in its channel; the membership row is the fact
-- both follow from. A role change is an update and moves nobody.
create function public.sync_gym_channel_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.channel_members (channel_id, user_id)
    select c.id, new.user_id
    from public.channels c
    where c.kind = 'gym' and c.gym_id = new.gym_id
    on conflict do nothing;
  else
    delete from public.channel_members m
    using public.channels c
    where m.channel_id = c.id
      and c.kind = 'gym'
      and c.gym_id = old.gym_id
      and m.user_id = old.user_id;
  end if;

  return null;
end;
$$;

create trigger gym_memberships_sync_channel
  after insert or delete on public.gym_memberships
  for each row execute function public.sync_gym_channel_membership();

-- ================================================== #company membership ==

-- "#company for all active profiles": a deactivated colleague leaves it, and
-- comes back if they are reactivated. `is_active_user()` already refuses them
-- everything, but a member list is also a list of who is here.
create function public.sync_company_channel_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active then
    insert into public.channel_members (channel_id, user_id)
    select c.id, new.id from public.channels c where c.kind = 'company'
    on conflict do nothing;
  else
    delete from public.channel_members m
    using public.channels c
    where m.channel_id = c.id and c.kind = 'company' and m.user_id = new.id;
  end if;

  return null;
end;
$$;

create trigger profiles_sync_company_channel after insert on public.profiles
  for each row execute function public.sync_company_channel_membership();

create trigger profiles_sync_company_channel_active
  after update of active on public.profiles
  for each row when (new.active is distinct from old.active)
  execute function public.sync_company_channel_membership();

-- ============================================================== backfill ==

-- The gyms, people and memberships that already exist predate all of the
-- above. On this machine that is the seed; on the hosted project it will be
-- the live data at cutover.
insert into public.channels (kind, gym_id, name)
select 'gym', g.id, g.name from public.gyms g
on conflict do nothing;

insert into public.channel_members (channel_id, user_id)
select c.id, m.user_id
from public.gym_memberships m
join public.channels c on c.kind = 'gym' and c.gym_id = m.gym_id
on conflict do nothing;

insert into public.channel_members (channel_id, user_id)
select c.id, p.id
from public.profiles p
cross join public.channels c
where c.kind = 'company' and p.active
on conflict do nothing;
