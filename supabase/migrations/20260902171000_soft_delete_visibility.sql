-- Fix (found while building P4-06): soft delete never worked.
--
-- `posts_select` and `guides_select` both require `deleted_at is null`, and
-- Postgres will not let an UPDATE leave the updated row invisible to the
-- writer's own SELECT policy. So `update posts set deleted_at = now()` — the
-- only way to delete a post or a guide (spec §2.5) — was refused for every
-- user with "new row violates row-level security policy". The unit tests mock
-- the client, so the button looked fine and failed in the browser.
--
-- The row now stays visible to the people who may publish there, which is who
-- deleted it; everyone else still cannot see it at all. Listing queries filter
-- `deleted_at is null` themselves.
--
-- Tested by supabase/tests/040-content-permissions.test.sql.

alter policy posts_select on public.posts using (
  (deleted_at is null or public.can_publish_content(gym_id))
  and (
    (status = 'published' and public.can_read_content(gym_id))
    or public.can_publish_content(gym_id)
  )
);

alter policy guides_select on public.guides using (
  (deleted_at is null or public.can_publish_content(gym_id))
  and (
    (status = 'published' and public.can_read_content(gym_id))
    or public.can_publish_content(gym_id)
  )
);
