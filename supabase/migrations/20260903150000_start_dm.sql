-- P6-06 — starting a direct message.
--
-- The rows a DM is made of are ones the client is already allowed to write:
-- `channels_insert` lets any active person open one and `channel_members_insert`
-- lets its creator seat the people in it (P6-01). What the client cannot do is
-- the dedupe. `member_hash` is md5 of the sorted member ids, derived by a
-- trigger *after* the members exist, so "message these two again" cannot be
-- answered before the channel is created — the client would have to open a
-- second channel to discover the first one, and a browser has no md5 anyway.
--
-- Hence one function, and deliberately `security invoker`: it adds atomicity,
-- not authority. Every statement in it is one the caller could have run, which
-- is also what keeps the reachable set honest — a person you cannot select
-- under `profiles_select` is a person you cannot message, and the picker in the
-- client shows exactly that list.
--
-- Tested by supabase/tests/210-chat-dm.test.sql.

-- ------------------------------------------------------- seating the people --

-- P6-01 meant "you may put people into a DM you just opened" and wrote it as a
-- subquery on `channels` inside `channel_members_insert`. A policy's subquery
-- is itself filtered by the referenced table's RLS, and `channels_select` is
-- membership: a DM one statement old has no members, so the creator could not
-- see the channel they had just created and the branch was dead. Nothing
-- caught it, because every DM in the tests so far was seated as `postgres`.
--
-- Asked through a definer function, it says what it always meant.
create function public.can_seat_in_dm(target_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user()
    and exists (
      select 1 from public.channels c
      where c.id = target_channel
        and c.kind = 'dm'
        and (c.created_by = auth.uid() or public.is_channel_member(c.id))
    );
$$;

comment on function public.can_seat_in_dm(uuid) is
  'True when the signed-in user opened this DM or is already in it.';

grant execute on function public.can_seat_in_dm(uuid) to authenticated;

drop policy channel_members_insert on public.channel_members;

-- Unchanged but for the last branch: you join an open channel yourself, a
-- manager adds you to a custom one, or you are seated in a DM by whoever
-- opened it.
create policy channel_members_insert on public.channel_members
  for insert to authenticated with check (
    (
      user_id = auth.uid()
      and exists (
        select 1 from public.channels c
        where c.id = channel_id
          and c.kind <> 'dm'
          and not c.is_private
          and public.can_read_content(c.gym_id)
      )
    )
    or public.can_moderate_channel(channel_id)
    or public.can_seat_in_dm(channel_id)
  );

-- ------------------------------------------------------------ the function --

create function public.start_dm(target_ids uuid[])
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  members uuid[];
  fingerprint text;
  channel uuid;
begin
  if not public.is_active_user() then
    raise exception 'Only an active user can start a conversation';
  end if;

  -- Sorted and de-duplicated, with the caller in it: a DM is its member set,
  -- and naming somebody twice is the same conversation.
  select array_agg(distinct id order by id) into members
  from unnest(target_ids || auth.uid()) as id;

  if coalesce(array_length(members, 1), 0) < 2 then
    raise exception 'A conversation needs somebody else in it';
  end if;

  -- `profiles_select` decides who this even matches: somebody you cannot see
  -- is not somebody you can message.
  if (
    select count(*) from public.profiles p
    where p.id = any (members) and p.active
  ) <> array_length(members, 1) then
    raise exception 'Cannot start a conversation with somebody you cannot see';
  end if;

  -- The same fingerprint `dm_member_hash()` writes, asked before there is
  -- anything to write it on.
  fingerprint := md5(array_to_string(members, ','));

  select c.id into channel
  from public.channels c
  where c.kind = 'dm' and c.member_hash = fingerprint;

  if found then
    return channel;
  end if;

  begin
    -- The id is chosen here rather than read back: `channels_select` is
    -- membership, and a channel one statement old has no members, so
    -- `returning id` on a DM you just opened is a row you may not see.
    channel := gen_random_uuid();
    insert into public.channels (id, kind, is_private) values (channel, 'dm', true);

    insert into public.channel_members (channel_id, user_id)
    select channel, id from unnest(members) as id;
  exception when unique_violation then
    -- Two people opened the same conversation at once. The loser of the race
    -- takes the winner's channel: the block rolls back, the unique index on
    -- `member_hash` having done exactly its job.
    select c.id into channel
    from public.channels c
    where c.kind = 'dm' and c.member_hash = fingerprint;
  end;

  return channel;
end;
$$;

comment on function public.start_dm(uuid[]) is
  'Opens the DM with these people, or returns the one that already exists.';

grant execute on function public.start_dm(uuid[]) to authenticated;
