-- P6-05 — typing presence: the one thing on the chat topic that is written
-- rather than read.
--
-- Presence and broadcast both go through `realtime.messages`, and P6-01 gave
-- the chat topic a SELECT policy only — enough to receive a colleague's
-- messages, not enough to say "I am typing". Writing is membership, not mere
-- access: somebody who can read an open channel they have not joined cannot
-- post in it (P6-01), and a typing indicator from them would be a message from
-- a person who is not there.
--
-- The channel id was parsed inline in `can_listen_to_chat()`; both policies
-- need it now, so it becomes a function of its own.
--
-- Tested by supabase/tests/190-chat-overview.test.sql.

create function public.chat_topic_channel(topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when topic ~ '^chat:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then substring(topic from 6)::uuid
    else '00000000-0000-0000-0000-000000000000'::uuid
  end;
$$;

comment on function public.chat_topic_channel(text) is
  'The channel a `chat:<uuid>` topic names, or the nil uuid for anything else.';

grant execute on function public.chat_topic_channel(text) to authenticated;

create or replace function public.can_listen_to_chat(topic text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.can_read_channel(public.chat_topic_channel(topic));
$$;

-- Saying something on the topic — a typing indicator today — is for the people
-- who are in the channel.
create policy chat_realtime_speak on realtime.messages
  for insert to authenticated
  with check (public.is_channel_member(public.chat_topic_channel(realtime.topic())));
