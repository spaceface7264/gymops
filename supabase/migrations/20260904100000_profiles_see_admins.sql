-- P7B-03 — every active person sees the active admins. `#company` already
-- seats staff and admins together, and `start_dm()`, the member lists and
-- the @mention picker all read names through this policy: without the
-- branch an admin was a nameless row to staff and could not be messaged.
-- A superadmin is also `is_admin`, and is reachable too (decided 2026-09-03).
-- A deactivated admin stays invisible, like anybody deactivated.

drop policy profiles_select on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.gym_memberships m
      where m.user_id = profiles.id and m.gym_id in (select public.managed_gym_ids())
    )
    -- Colleagues: somebody you share a gym with.
    or public.shares_gym_with(profiles.id)
    -- The admins: the people #company puts you in a room with.
    or (profiles.active and (profiles.is_admin or profiles.is_superadmin))
  );
