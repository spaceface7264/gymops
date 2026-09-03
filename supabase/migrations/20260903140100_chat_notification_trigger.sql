-- P6-08 — the trigger. Separate from the migration that adds the enum values:
-- Postgres refuses to use a new enum label in the same transaction that
-- created it, and `supabase db reset` runs each migration in its own.
--
-- Tested by supabase/tests/200-chat-notifications.test.sql.

-- Who is in this channel and has not silenced it. Mute is per person per
-- channel (`channel_members.muted`), and it is a stronger no than the
-- per-type preference: it means "not from here", whatever the type.
create function public.chat_audience(target_channel uuid, excluding uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id
  from public.channel_members m
  where m.channel_id = target_channel
    and not m.muted
    and m.user_id is distinct from excluding;
$$;

-- The name to put in the heading: the author's, falling back to their email,
-- because a colleague who has not filled in their name is still somebody.
create function public.chat_author_name(author uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.full_name), ''), p.email)
  from public.profiles p
  where p.id = author;
$$;

/*
 * One insert, at most one notification per person.
 *
 * A DM is told as a DM even when it names somebody — being mentioned in a
 * two-person conversation is not a second event — so the two branches never
 * overlap. The mention branch is deliberately not de-duplicated: somebody
 * typed a name on purpose, and the second one is as deliberate as the first.
 * The DM branch is, per channel and per five minutes, because a conversation
 * is a stream of messages and an inbox is not.
 */
create function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  channel public.channels;
  author text := public.chat_author_name(new.created_by);
  -- The body is the author's own words, in whatever language they wrote them,
  -- trimmed to something an inbox row and a push notification can hold.
  preview text := left(new.body, 140);
begin
  select * into channel from public.channels c where c.id = new.channel_id;

  if channel.kind = 'dm' then
    perform public.raise_notification(
      array(select public.chat_audience(new.channel_id, new.created_by)),
      'chat_dm',
      author,
      preview,
      '/chat/' || new.channel_id,
      null,
      new.channel_id,
      false,
      jsonb_build_object('channel_id', new.channel_id),
      interval '5 minutes'
    );
  else
    perform public.raise_notification(
      array(
        select m.user_id
        from public.chat_audience(new.channel_id, new.created_by) m(user_id)
        where m.user_id = any (new.mentions)
      ),
      'chat_mention',
      author || ' — ' || coalesce(channel.name, ''),
      preview,
      '/chat/' || new.channel_id,
      channel.gym_id,
      new.channel_id,
      false,
      jsonb_build_object('channel_id', new.channel_id)
    );
  end if;

  return null;
end;
$$;

create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_chat_message();

grant execute on function public.chat_author_name(uuid) to authenticated;
