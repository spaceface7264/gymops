-- P2-03 — close the invite when the person actually arrives.
--
-- `inviteUserByEmail` creates the account at invite time, so "has an account"
-- cannot mean "accepted". The first sign-in can: it is the moment the invited
-- person has set a password and used it. Until then the pending row keeps the
-- partial unique index from letting a second invite go out to the same address.

create function public.close_accepted_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.last_sign_in_at is not null or new.last_sign_in_at is null then
    return new;
  end if;

  update public.invites
  set status = 'accepted', accepted_at = now(), accepted_by = new.id
  where lower(email) = lower(new.email) and status = 'pending';

  return new;
end;
$$;

create trigger on_auth_user_first_sign_in
  after update on auth.users
  for each row execute function public.close_accepted_invite();
