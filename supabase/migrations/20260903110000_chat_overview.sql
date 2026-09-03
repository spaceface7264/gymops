-- P6-03 — the numbers the channel list is made of.
--
-- "Unread" is per person and per channel: everything posted in a channel since
-- that person's `last_read_at` that they did not write themselves. Asking that
-- from the client would be one query per channel — 200 users times a dozen
-- channels each — so it is one function, and the badge in the shell reads the
-- same rows as the list.
--
-- Muted channels are reported with their count, not without one: the channel
-- still shows what it missed, and only the shell's total leaves them out
-- (spec §2.2, "per-channel mute" silences notifications, not the channel).
--
-- Tested by supabase/tests/190-chat-overview.test.sql.

create function public.chat_overview()
returns table (
  channel_id uuid,
  unread integer,
  last_message_at timestamptz,
  muted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.channel_id,
    count(msg.id) filter (
      where msg.created_at > m.last_read_at
        and msg.deleted_at is null
        and msg.created_by is distinct from auth.uid()
    )::int,
    max(msg.created_at) filter (where msg.deleted_at is null),
    m.muted
  from public.channel_members m
  left join public.messages msg on msg.channel_id = m.channel_id
  where m.user_id = auth.uid() and public.is_active_user()
  group by m.channel_id, m.muted;
$$;

comment on function public.chat_overview() is
  'Per-channel unread count and last activity for the signed-in user.';

grant execute on function public.chat_overview() to authenticated;
