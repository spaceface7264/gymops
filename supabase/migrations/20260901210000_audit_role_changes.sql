-- P2-06 — audit trail for the privileged columns.
--
-- Spec §2.1: only a superadmin promotes admins, only an admin deactivates a
-- user, and managers may grant staff membership in their own gyms. Those are
-- the changes the audit log exists for; the guard trigger from P1-04 decides
-- who may make them, these triggers record that it happened.
--
-- Tested by supabase/tests/020-audit-role-changes.test.sql.

-- Security definer because audit_log has no insert policy: the client must
-- never be able to write or forge a row, only a superadmin may read one.
create function public.audit_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_superadmin is not distinct from old.is_superadmin
     and new.is_admin is not distinct from old.is_admin
     and new.active is not distinct from old.active then
    return new;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, before, after)
  values (
    auth.uid(),
    'profile.privileges_changed',
    'profile',
    new.id,
    jsonb_build_object(
      'is_superadmin', old.is_superadmin, 'is_admin', old.is_admin, 'active', old.active
    ),
    jsonb_build_object(
      'is_superadmin', new.is_superadmin, 'is_admin', new.is_admin, 'active', new.active
    )
  );

  return new;
end;
$$;

create trigger profiles_audit_privileges
  after update on public.profiles
  for each row execute function public.audit_profile_privileges();

create function public.audit_gym_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry_action text;
begin
  if tg_op = 'UPDATE' and new.role is not distinct from old.role then
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, gym_id, before, after)
    values (
      auth.uid(), 'membership.revoked', 'gym_membership', old.id, old.gym_id,
      jsonb_build_object('user_id', old.user_id, 'gym_id', old.gym_id, 'role', old.role),
      null
    );
    return old;
  end if;

  entry_action := case tg_op when 'INSERT' then 'membership.granted' else 'membership.role_changed' end;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, gym_id, before, after)
  values (
    auth.uid(), entry_action, 'gym_membership', new.id, new.gym_id,
    case when tg_op = 'INSERT' then null
         else jsonb_build_object('user_id', old.user_id, 'gym_id', old.gym_id, 'role', old.role) end,
    jsonb_build_object('user_id', new.user_id, 'gym_id', new.gym_id, 'role', new.role)
  );

  return new;
end;
$$;

create trigger gym_memberships_audit
  after insert or update or delete on public.gym_memberships
  for each row execute function public.audit_gym_membership();
