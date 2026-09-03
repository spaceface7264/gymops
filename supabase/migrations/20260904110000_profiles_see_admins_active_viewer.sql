-- P7B-03 follow-up — gate the "everyone sees the admins" branch on the
-- VIEWER being active, not just the admin being visible. Every sibling
-- branch on this policy gates the viewer (`is_admin()`/`is_superadmin()`
-- check `p.active`, and `shares_gym_with()` opens with
-- `public.is_active_user() and ...` in 20260902180000_daily_log.sql), but
-- `20260904100000_profiles_see_admins.sql` did not: a just-deactivated
-- person could read every admin's email/phone/name for the life of their
-- access token, contradicting PROJECT_SPEC §2.1 ("Only their own profile
-- stays readable, so the app can tell them why"). Do not edit that
-- migration — this drops and recreates the policy with the identical body,
-- except the admins branch now also requires `public.is_active_user()`.
--
-- Tested by supabase/tests/060-content-integrity.test.sql.

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
    -- The admins: the people #company puts you in a room with — but only
    -- for a viewer who is still active themselves.
    or (public.is_active_user() and profiles.active and (profiles.is_admin or profiles.is_superadmin))
  );
