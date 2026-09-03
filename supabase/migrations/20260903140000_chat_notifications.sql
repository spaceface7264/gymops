-- P6-08 — being told: an @mention, and a direct message.
--
-- P6-05 already resolves `messages.mentions` to profile ids, and until now
-- nothing read them: somebody could be mentioned and never find out. These are
-- the two chat events worth an inbox row (spec §2.2), and both obey the mute
-- switch the channel list has been showing since P6-03.
--
-- Neither asks for email. A chat message is not what §4's "the grading belongs
-- where the event is raised" calls email-worthy, and a preference can silence
-- a channel but never promote one. Push and the inbox still follow the
-- recipient's own preferences through `notification_pref()`.
--
-- Tested by supabase/tests/200-chat-notifications.test.sql.

alter type public.notification_type add value 'chat_mention';
alter type public.notification_type add value 'chat_dm';
