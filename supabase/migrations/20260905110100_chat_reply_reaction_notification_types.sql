-- P6C-17 / P6C-18 — being told about a reply to your line, and a reaction to
-- it. Separate from the migration that uses the labels: Postgres refuses to use
-- a new enum label in the same transaction that created it, and
-- `supabase db reset` runs each migration in its own.
--
-- Tested by supabase/tests/280-chat-reply-reaction-notifications.test.sql.

alter type public.notification_type add value 'chat_reply';
alter type public.notification_type add value 'chat_reaction';
