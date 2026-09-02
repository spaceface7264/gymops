-- P1-09 — local fixtures, applied by `supabase db reset`. Never deployed:
-- seeds are not part of `db push`.
--
-- Three gyms and one user per role, all with the password `Password123`:
--   super@gymops.test     superadmin
--   admin@gymops.test     admin
--   manager@gymops.test   manager of Copenhagen Nord and Aarhus C
--   staff@gymops.test     staff at Copenhagen Nord

insert into public.gyms (id, name, slug, city, timezone)
values
  ('a0000000-0000-4000-8000-000000000001', 'Copenhagen Nord', 'copenhagen-nord', 'København', 'Europe/Copenhagen'),
  ('a0000000-0000-4000-8000-000000000002', 'Aarhus C', 'aarhus-c', 'Aarhus', 'Europe/Copenhagen'),
  ('a0000000-0000-4000-8000-000000000003', 'Odense', 'odense', 'Odense', 'Europe/Copenhagen');

-- auth.users rows need a matching auth.identities row, or GoTrue rejects the
-- password grant, and its token columns must be '' rather than null — GoTrue
-- scans them into non-nullable strings. public.handle_new_user() creates the
-- profile.
do $$
declare
  seed_user record;
begin
  for seed_user in
    select *
    from (values
      ('b0000000-0000-4000-8000-000000000001'::uuid, 'super@gymops.test', 'Sofie Superadmin', 'da'),
      ('b0000000-0000-4000-8000-000000000002'::uuid, 'admin@gymops.test', 'Anders Admin', 'da'),
      ('b0000000-0000-4000-8000-000000000003'::uuid, 'manager@gymops.test', 'Mette Manager', 'da'),
      ('b0000000-0000-4000-8000-000000000004'::uuid, 'staff@gymops.test', 'Sam Staff', 'en')
    ) as u(id, email, full_name, locale)
  loop
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    values (
      seed_user.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      seed_user.email, extensions.crypt('Password123', extensions.gen_salt('bf')), now(),
      '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', seed_user.full_name, 'locale', seed_user.locale),
      now(), now()
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    values (
      seed_user.id::text, seed_user.id,
      jsonb_build_object('sub', seed_user.id::text, 'email', seed_user.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end;
$$;

update public.profiles set is_superadmin = true, is_admin = true
where id = 'b0000000-0000-4000-8000-000000000001';

update public.profiles set is_admin = true
where id = 'b0000000-0000-4000-8000-000000000002';

insert into public.gym_memberships (user_id, gym_id, role)
values
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'manager'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', 'manager'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'staff');
