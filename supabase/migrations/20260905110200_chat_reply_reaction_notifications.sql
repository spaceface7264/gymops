-- P6C-17 / P6C-18 — the triggers for `chat_reply` and `chat_reaction`.
--
-- Still one insert, at most one notification per person. A reply tells the
-- quoted author unless the line already told them: the replier is themselves,
-- they muted the channel, they are named in the same line (the mention row
-- carries author, channel and preview), the line is the assistant's, or the
-- channel is a DM (`chat_dm` reaches everyone in it). A reaction tells the
-- line's author once per line per five minutes, whoever reacts: a thumbs-up
-- is worth one inbox row, not one per colleague.
--
-- Tested by supabase/tests/280-chat-reply-reaction-notifications.test.sql.

create or replace function public.notify_chat_message()
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
  if new.from_assistant then
    return null;
  end if;

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

    if new.reply_to is not null then
      perform public.raise_notification(
        array(
          select q.created_by
          from public.messages q
          where q.id = new.reply_to
            and q.created_by is not null
            and q.created_by is distinct from new.created_by
            and not (q.created_by = any (new.mentions))
            and q.created_by in (
              select public.chat_audience(new.channel_id, new.created_by)
            )
        ),
        'chat_reply',
        author || ' — ' || coalesce(channel.name, ''),
        preview,
        '/chat/' || new.channel_id,
        channel.gym_id,
        new.channel_id,
        false,
        jsonb_build_object('channel_id', new.channel_id, 'message_id', new.id)
      );
    end if;
  end if;

  return null;
end;
$$;

create function public.notify_message_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.messages;
  channel public.channels;
begin
  select * into target from public.messages m where m.id = new.message_id;

  if target.created_by is null
     or target.created_by = new.user_id
     or target.deleted_at is not null then
    return null;
  end if;

  select * into channel from public.channels c where c.id = target.channel_id;

  perform public.raise_notification(
    array(
      select a from public.chat_audience(target.channel_id, new.user_id) a
      where a = target.created_by
    ),
    'chat_reaction',
    public.chat_author_name(new.user_id) || ' ' || new.emoji,
    left(target.body, 140),
    '/chat/' || target.channel_id,
    channel.gym_id,
    target.id,
    false,
    jsonb_build_object(
      'channel_id', target.channel_id, 'message_id', target.id, 'emoji', new.emoji
    ),
    interval '5 minutes'
  );

  return null;
end;
$$;

create trigger message_reactions_notify
  after insert on public.message_reactions
  for each row execute function public.notify_message_reaction();
