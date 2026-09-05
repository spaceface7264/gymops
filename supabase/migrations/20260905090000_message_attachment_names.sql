-- P6C-08: what a file was called when it was attached. The storage path is a
-- UUID (the storage policies resolve the channel from its first segment), so
-- without this a PDF in the stream had no name a person could read.
alter table public.message_attachments add column file_name text;

comment on column public.message_attachments.file_name is
  'The name the file had on the sender''s device; shown in the stream (P6C-08).';
