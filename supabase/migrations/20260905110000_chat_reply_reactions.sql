-- P6C-17 / P6C-18 — a reply that quotes a line, and reactions on a line.
--
-- Reply is a quote, not a thread: `messages.reply_to` names one earlier line in
-- the same channel and the stream stays one stream. Reactions are four fixed
-- emoji, one row per person per emoji per message, added or taken away and
-- never edited. Neither touches `messages.created_at`, so `chat_overview()`
-- (which joins `messages` only) counts nothing new and a thumbs-up never moves
-- a channel to the top of the list.
--
-- `message_reactions.channel_id` is denormalised from the message and pinned
-- by a BEFORE INSERT trigger: the Realtime listener filters the channel's
-- topic on `channel_id=eq.<id>`, and a row event only carries its own columns.
-- Postgres evaluates a policy's WITH CHECK after BEFORE ROW triggers, so the
-- insert policy sees the pinned value, whatever the client sent.
--
-- Tested by supabase/tests/260-chat-replies.test.sql and
-- supabase/tests/270-chat-reactions.test.sql.

-- ==================================================================== reply ==

alter table public.messages
  add column reply_to uuid references public.messages on delete set null;

comment on column public.messages.reply_to is
  'The line this one quotes (P6C-17). Same channel, checked on insert, pinned after.';

create index messages_reply_to_idx on public.messages (reply_to)
  where reply_to is not null;

-- Same channel or nothing. BEFORE INSERT, so the row never exists wrong.
create function public.guard_message_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reply_to is not null and not exists (
    select 1 from public.messages q
    where q.id = new.reply_to and q.channel_id = new.channel_id
  ) then
    raise exception 'reply_to must name a message in the same channel'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger messages_guard_reply
  before insert on public.messages
  for each row execute function public.guard_message_reply();

-- The 20260904130000 body, plus `reply_to` among the pinned columns: an edit
-- may not re-point a quote.
create or replace function public.guard_message_edit()
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
  new.from_assistant := old.from_assistant;
  new.reply_to := old.reply_to;

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

-- ================================================================ reactions ==

create table public.message_reactions (
  message_id uuid not null references public.messages on delete cascade,
  channel_id uuid not null references public.channels on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji),
  constraint message_reactions_emoji_check check (emoji in ('👍', '✅', '👀', '❤️'))
);

comment on table public.message_reactions is
  'One row per person per emoji per message (P6C-18). Four emoji; added or removed, never edited.';

create index message_reactions_channel_idx on public.message_reactions (channel_id);
create index message_reactions_user_idx on public.message_reactions (user_id);

-- A DELETE event carries only the primary key unless the identity is the whole
-- row, and the listener filters on channel_id: without this a reaction taken
-- away never reaches the other readers.
alter table public.message_reactions replica identity full;
alter publication supabase_realtime add table public.message_reactions;

-- The message decides the channel, the caller decides nothing but the emoji,
-- and a deleted line takes no reactions.
create function public.guard_reaction_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.messages;
begin
  select * into target from public.messages m where m.id = new.message_id;

  if target.id is null then
    raise exception 'no such message' using errcode = '23503';
  end if;
  if target.deleted_at is not null then
    raise exception 'cannot react to a deleted message' using errcode = '23514';
  end if;

  new.channel_id := target.channel_id;
  -- `current_user` here is the definer, so the caller is read from the JWT:
  -- a request has one, a migration or a test running as postgres has none.
  if auth.uid() is not null then
    new.user_id := auth.uid();
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger message_reactions_guard_insert
  before insert on public.message_reactions
  for each row execute function public.guard_reaction_insert();

alter table public.message_reactions enable row level security;

create policy message_reactions_select on public.message_reactions
  for select to authenticated using (public.can_read_channel(channel_id));

-- Reading an open channel is not being in it (P6-01): reacting takes a seat.
create policy message_reactions_insert on public.message_reactions
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_channel_member(channel_id)
  );

create policy message_reactions_delete on public.message_reactions
  for delete to authenticated using (user_id = auth.uid());

-- No update policy: a reaction is added or taken away, never edited.
