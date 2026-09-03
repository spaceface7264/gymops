-- P6-01 — team chat: the channels, who is in them, and what was said.
--
-- Spec §2.2: an automatic channel per gym plus `#company`, custom public and
-- private channels, DMs between two or more people, @mentions, attachments,
-- edit and delete of your own messages, unread badges. No threads, reactions
-- or search in V1.
--
-- Two rules from §2.1 shape every policy here:
--   * "Create custom chat channels" is `can_publish_content()` — a manager in
--     their own gyms, an admin company-wide, staff never.
--   * "Read DMs they are not part of" is *no* for everybody, superadmins
--     included. So a DM is the one record in this project where membership,
--     not `is_admin()`, is the whole of the read rule.
--
-- Tested by supabase/tests/170-chat-permissions.test.sql.

create type public.channel_kind as enum ('gym', 'company', 'custom', 'dm');

-- ================================================================ tables ==

-- One table for all four kinds. `gym_id` carries the scope exactly as it does
-- for news and guides: a row with `gym_id` null is company-wide, which is what
-- makes `can_read_content()` and `can_publish_content()` reusable here.
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  kind public.channel_kind not null,
  gym_id uuid references public.gyms on delete cascade,
  -- Null on DMs: a DM is named by the people in it, in the client.
  name text,
  description text,
  -- Private channels are joined by invitation only; DMs are always private.
  is_private boolean not null default false,
  -- The fingerprint of a DM's member set, maintained by the trigger below and
  -- unique, so "message these three people" always lands in the same channel.
  member_hash text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles on delete set null,
  updated_by uuid references public.profiles on delete set null,
  constraint channels_name_check check (
    case kind
      when 'dm' then name is null
      else btrim(coalesce(name, '')) <> ''
    end
  ),
  -- A gym channel belongs to its gym; the other three do not name one, except
  -- a custom channel, which may be either.
  constraint channels_scope_check check (
    case kind
      when 'gym' then gym_id is not null
      when 'custom' then true
      else gym_id is null
    end
  ),
  constraint channels_private_check check (kind <> 'dm' or is_private),
  constraint channels_public_check check (kind not in ('gym', 'company') or not is_private),
  -- Only a DM has one, and it appears once the channel has members: the
  -- fingerprint is of the member set, which does not exist at the insert that
  -- creates the channel.
  constraint channels_member_hash_check check (member_hash is null or kind = 'dm')
);

comment on table public.channels is
  'Chat channels: one per gym, one #company, custom public/private ones, and DMs.';

-- The two automatic channels are singletons: one per gym, one for the company.
create unique index channels_gym_idx on public.channels (gym_id) where kind = 'gym';
create unique index channels_company_idx on public.channels ((true)) where kind = 'company';
create index channels_custom_idx on public.channels (gym_id) where kind = 'custom';

-- `last_read_at` is what the unread badge counts against (P6-03); `muted`
-- silences the channel's notifications without leaving it (P6-08).
create table public.channel_members (
  channel_id uuid not null references public.channels on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create index channel_members_user_idx on public.channel_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels on delete cascade,
  body text not null,
  -- The profiles named with @ in the body, resolved by the composer (P6-05)
  -- and read by the notification trigger (P6-08).
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  -- Soft delete: the row stays so the pagination cursor and the reply context
  -- stay stable, but `guard_message_edit()` empties it.
  deleted_at timestamptz,
  deleted_by uuid references public.profiles on delete set null,
  created_by uuid references public.profiles on delete set null,
  constraint messages_body_check check (deleted_at is not null or btrim(body) <> '')
);

comment on table public.messages is
  'Chat messages. Deleted ones keep their row and lose their body.';

-- The message list reads one channel newest-first and pages backwards (P6-04).
create index messages_channel_idx on public.messages (channel_id, created_at desc);

-- One row per uploaded file. `path` is the object in the `chat` bucket,
-- `<channel id>/<uuid>.<ext>` — the channel first, because that is what the
-- storage policies below have to resolve a permission from.
create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages on delete cascade,
  path text not null unique,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles on delete set null
);

create index message_attachments_message_idx
  on public.message_attachments (message_id, created_at);

-- ====================================================== helper functions ==

-- `channel_members` has RLS of its own, and its policies ask this question, so
-- the membership lookup has to be a definer function or it recurses.
create function public.is_channel_member(target_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user()
    and exists (
      select 1 from public.channel_members m
      where m.channel_id = target_channel and m.user_id = auth.uid()
    );
$$;

comment on function public.is_channel_member(uuid) is
  'True when the signed-in user is a member of the channel. The whole of the DM rule.';

-- "Delete any chat message (non-DM)" (§2.1): the gym's managers and admins.
-- Nobody moderates a DM or, therefore, needs to be able to read one.
create function public.can_moderate_channel(target_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.channels c
    where c.id = target_channel
      and c.kind <> 'dm'
      and public.can_publish_content(c.gym_id)
  );
$$;

-- Membership, an open channel you are in scope for, or a channel you moderate.
-- A DM matches none of the three, which is §2.1's "read DMs they are not part
-- of: no" — the privacy line in this module is drawn at the DM, not at the
-- private channel, because §2.1 also puts every *non-DM* message within an
-- admin's reach. A private channel is hidden from colleagues, not from the
-- people answerable for it.
create function public.can_read_channel(target_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_channel_member(target_channel)
    or public.can_moderate_channel(target_channel)
    or exists (
      select 1 from public.channels c
      where c.id = target_channel
        and c.kind <> 'dm'
        and not c.is_private
        and public.can_read_content(c.gym_id)
    );
$$;

grant execute on function
  public.is_channel_member(uuid), public.can_read_channel(uuid),
  public.can_moderate_channel(uuid)
to authenticated;

-- ============================================================== triggers ==

create trigger channels_set_updated_at before update on public.channels
  for each row execute function public.set_updated_at();
create trigger channels_set_created_by before insert on public.channels
  for each row execute function public.set_created_by();

create trigger message_attachments_set_created_by before insert
  on public.message_attachments
  for each row execute function public.set_created_by();

-- A DM is identified by the people in it, so "start a DM with these two" can
-- find the existing one instead of opening a second. The hash is derived here
-- rather than posted, for the same reason acknowledgements are stamped
-- server-side (P3): a client-chosen fingerprint is not a fingerprint.
create function public.dm_member_hash(target_channel uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(string_agg(m.user_id::text, ',' order by m.user_id))
  from public.channel_members m
  where m.channel_id = target_channel;
$$;

create function public.sync_dm_member_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.channel_id, old.channel_id);
begin
  update public.channels c
  set member_hash = public.dm_member_hash(target)
  where c.id = target and c.kind = 'dm';

  return null;
end;
$$;

-- After, not before: the hash is of the member set as it now stands.
create trigger channel_members_sync_dm_hash
  after insert or delete on public.channel_members
  for each row execute function public.sync_dm_member_hash();

-- A DM's membership is fixed when it is created; a gym channel's follows the
-- gym's roster (P6-02). Either way, moving a row between channels or people
-- would silently rewrite history, so only the two personal columns may change.
create function public.guard_channel_member_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  new.channel_id := old.channel_id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;

  return new;
end;
$$;

create trigger channel_members_guard_edit before update on public.channel_members
  for each row execute function public.guard_channel_member_edit();

-- Who wrote a message, when, and in which channel are not editable facts.
-- Editing is the body; deleting empties it, and does not undo.
create function public.guard_message_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  new.channel_id := old.channel_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  -- A moderator may delete somebody's message; they may not rewrite it.
  if auth.uid() is distinct from old.created_by then
    new.body := old.body;
    new.mentions := old.mentions;
  elsif new.body is distinct from old.body then
    new.edited_at := now();
  end if;

  if old.deleted_at is not null then
    -- Deleting is final: nothing about a deleted message moves again.
    return old;
  end if;

  if new.deleted_at is not null then
    new.deleted_at := now();
    new.deleted_by := auth.uid();
    new.body := '';
    new.mentions := '{}';
  else
    new.deleted_by := null;
  end if;

  return new;
end;
$$;

create trigger messages_guard_edit before update on public.messages
  for each row execute function public.guard_message_edit();

create trigger messages_set_created_by before insert on public.messages
  for each row execute function public.set_created_by();

-- ================================================================== RLS ==

alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;

-- The channel list: the ones you are in, plus the open ones you are in scope
-- for, so a public channel can be browsed and joined before you belong to it.
create policy channels_select on public.channels
  for select to authenticated using (
    public.is_channel_member(id)
    or public.can_moderate_channel(id)
    or (kind <> 'dm' and not is_private and public.can_read_content(gym_id))
  );

-- Only two kinds are created by hand: a custom channel by whoever may publish
-- in that scope, and a DM by anybody active. The gym channels and `#company`
-- are the triggers' (P6-02), which run as owner and skip this policy.
create policy channels_insert on public.channels
  for insert to authenticated with check (
    (kind = 'custom' and public.can_publish_content(gym_id))
    or (kind = 'dm' and public.is_active_user())
  );

-- Renaming and describing a channel is managing it (P6-07). A DM has neither.
create policy channels_update on public.channels
  for update to authenticated
  using (kind = 'custom' and public.can_publish_content(gym_id))
  with check (kind = 'custom' and public.can_publish_content(gym_id));

create policy channels_delete on public.channels
  for delete to authenticated
  using (kind = 'custom' and public.can_publish_content(gym_id));

-- The member list is visible to everyone who can read the channel — including,
-- for a public channel, somebody who has not joined it yet.
create policy channel_members_select on public.channel_members
  for select to authenticated using (public.can_read_channel(channel_id));

-- Three ways in: you join an open channel yourself, a manager adds you to a
-- custom one, or you are put into a DM by whoever opened it — which is why the
-- creator counts before the first row exists.
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
    or exists (
      select 1 from public.channels c
      where c.id = channel_id
        and c.kind = 'dm'
        and (c.created_by = auth.uid() or public.is_channel_member(c.id))
    )
  );

-- Your own row is your read marker and your mute switch.
create policy channel_members_update on public.channel_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Leaving is for the channels you chose to be in: a gym channel would be
-- restored by the P6-02 trigger, and a DM you left would reopen under a
-- different member hash.
create policy channel_members_delete on public.channel_members
  for delete to authenticated using (
    exists (
      select 1 from public.channels c
      where c.id = channel_id
        and c.kind = 'custom'
        and (user_id = auth.uid() or public.can_publish_content(c.gym_id))
    )
  );

create policy messages_select on public.messages
  for select to authenticated using (public.can_read_channel(channel_id));

-- Reading an open channel is not being in it: posting is membership.
create policy messages_insert on public.messages
  for insert to authenticated with check (
    public.is_channel_member(channel_id) and created_by = auth.uid()
  );

-- Your own message, or a moderator's delete; the guard trigger decides which
-- columns each of them actually moves.
create policy messages_update on public.messages
  for update to authenticated
  using (
    (created_by = auth.uid() and public.is_channel_member(channel_id))
    or public.can_moderate_channel(channel_id)
  )
  with check (
    (created_by = auth.uid() and public.is_channel_member(channel_id))
    or public.can_moderate_channel(channel_id)
  );

-- No delete policy: `deleted_at` is what deleting a message means here.

create policy message_attachments_select on public.message_attachments
  for select to authenticated using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and public.can_read_channel(m.channel_id)
    )
  );

create policy message_attachments_insert on public.message_attachments
  for insert to authenticated with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.created_by = auth.uid()
        and public.is_channel_member(m.channel_id)
    )
  );

-- ============================================================== storage ==

-- The channel an object belongs to, from its first path segment, exactly as
-- `incident_object_gym()` does it: anything that is not a uuid resolves to the
-- nil uuid, which is a channel nobody is a member of.
create function public.chat_object_channel(object_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when folder ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then folder::uuid
    else '00000000-0000-0000-0000-000000000000'::uuid
  end
  from (select (storage.foldername(object_name))[1] as folder) f;
$$;

grant execute on function public.chat_object_channel(text) to authenticated;

-- An attachment is as readable as the channel it was posted in, and uploading
-- one is posting, so it takes membership rather than mere access.
create policy chat_objects_select on storage.objects
  for select to authenticated using (
    bucket_id = 'chat'
    and public.can_read_channel(public.chat_object_channel(name))
  );

create policy chat_objects_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'chat'
    and public.is_channel_member(public.chat_object_channel(name))
  );

-- No update or delete policy, as in the other two buckets: a message that
-- still points at a file cannot have it vanish underneath it.

-- ============================================================= realtime ==

-- The message list subscribes per channel (P6-04). The topic names the channel
-- and the policy refuses the join itself, the way `checklists:<gym id>` does,
-- so another channel's traffic is not something a client is merely trusted not
-- to read. RLS on the row still filters what arrives.
alter publication supabase_realtime add table public.messages;

create function public.can_listen_to_chat(topic text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select topic like 'chat:%'
    and public.can_read_channel(
      case
        when substring(topic from 6) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          then substring(topic from 6)::uuid
        else '00000000-0000-0000-0000-000000000000'::uuid
      end
    );
$$;

grant execute on function public.can_listen_to_chat(text) to authenticated;

create policy chat_realtime_listen on realtime.messages
  for select to authenticated
  using (public.can_listen_to_chat(realtime.topic()));
