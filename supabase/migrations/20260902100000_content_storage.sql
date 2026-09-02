-- P3-01 — storage RLS for the `content` bucket, which holds the images pasted
-- into news posts and guides.
--
-- Object names are `<gym id>/<uuid>.<ext>`, or `company/<uuid>.<ext>` for
-- company-wide content, so an object carries the same scope its post or guide
-- does and the policies below are the table policies again (spec §3).

-- The gym an object belongs to, from its first path segment. Anything that is
-- neither `company` nor a uuid resolves to the nil uuid: no gym has that id,
-- so such a path is readable and writable by nobody rather than by everybody.
create function public.content_object_gym(object_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when folder = 'company' then null
    when folder ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then folder::uuid
    else '00000000-0000-0000-0000-000000000000'::uuid
  end
  from (select (storage.foldername(object_name))[1] as folder) f;
$$;

grant execute on function public.content_object_gym(text) to authenticated;

-- Reading an image follows reading the content it illustrates.
create policy content_objects_select on storage.objects
  for select to authenticated using (
    bucket_id = 'content'
    and public.can_read_content(public.content_object_gym(name))
  );

-- Uploading follows publishing: an admin anywhere, a manager in their gyms.
create policy content_objects_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'content'
    and public.can_publish_content(public.content_object_gym(name))
  );

create policy content_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'content'
    and public.can_publish_content(public.content_object_gym(name))
  )
  with check (
    bucket_id = 'content'
    and public.can_publish_content(public.content_object_gym(name))
  );

-- No delete policy: storage objects are not deleted from the UI in V1
-- (spec §2.5), so an image an old revision still points at cannot vanish.
