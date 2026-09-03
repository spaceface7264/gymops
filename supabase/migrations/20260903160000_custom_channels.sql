-- P6-07 — custom channels: the one policy that could not answer for a row
-- that does not exist yet.
--
-- `channels_select` asked `can_moderate_channel(id)`, which looks the channel
-- up by id. Inside the very INSERT that creates it, that lookup finds nothing:
-- a command cannot see its own tuple. So a manager creating a *private*
-- channel and reading back its id was refused — the public case only worked
-- because its branch reads the new row's own columns and never goes looking.
--
-- The moderation rule is about the row being filtered, so the policy asks it
-- of that row directly. `can_moderate_channel()` stays exactly as it is: the
-- other tables (messages, members, attachments) ask about a channel they are
-- *not*, and for them a lookup is the only way to ask.
--
-- Tested by supabase/tests/220-chat-custom-channels.test.sql.

drop policy channels_select on public.channels;

create policy channels_select on public.channels
  for select to authenticated using (
    public.is_channel_member(id)
    -- `can_moderate_channel(id)`, inlined: everything but the lookup.
    or (kind <> 'dm' and public.can_publish_content(gym_id))
    or (kind <> 'dm' and not is_private and public.can_read_content(gym_id))
  );
