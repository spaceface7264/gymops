-- P6-05 follow-up — a deleted message keeps its photographs, which is not what
-- deleting means.
--
-- `guard_message_edit()` empties the body of a soft-deleted message (P6-01),
-- and the message list renders "this message was deleted" in its place. Its
-- `message_attachments` rows were untouched by any of that: the select policy
-- asked only `can_read_channel()`, so every member of the channel could still
-- list the paths and sign a URL for each file. P6-01's own rule is that a
-- "deleted" message the API still answers with is not deleted, and the
-- photograph is the half people would most want gone.
--
-- The storage policy is tightened the same way, and by the same join rather
-- than by the object's path: hiding the row alone leaves anybody who noted the
-- path earlier able to sign it again. What this cannot reach is a signed URL
-- already handed out — those are stateless and stay valid for their hour, so
-- deleting stops new signatures rather than revoking old ones.
--
-- Tested by supabase/tests/170-chat-permissions.test.sql.

drop policy message_attachments_select on public.message_attachments;

create policy message_attachments_select on public.message_attachments
  for select to authenticated using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.deleted_at is null
        and public.can_read_channel(m.channel_id)
    )
  );

-- Nothing can be attached to a message that is already gone either.
drop policy message_attachments_insert on public.message_attachments;

create policy message_attachments_insert on public.message_attachments
  for insert to authenticated with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.deleted_at is null
        and m.created_by = auth.uid()
        and public.is_channel_member(m.channel_id)
    )
  );

-- An object in the `chat` bucket is now readable through the message it
-- belongs to rather than through the channel its path names. `is_channel_member`
-- still governs the upload, which happens before the row exists.
drop policy chat_objects_select on storage.objects;

create policy chat_objects_select on storage.objects
  for select to authenticated using (
    bucket_id = 'chat'
    and exists (
      select 1
      from public.message_attachments a
      join public.messages m on m.id = a.message_id
      where a.path = name
        and m.deleted_at is null
        and public.can_read_channel(m.channel_id)
    )
  );
