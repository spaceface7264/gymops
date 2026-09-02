-- P4-01: the checklist tables — checklist_templates, checklist_template_items,
-- checklist_runs, checklist_run_items.
--
-- Permission matrix (PROJECT_SPEC.md §2.1): "Publish gym news/guides, edit
-- checklist templates" (admins anywhere, managers in their own gyms) and
-- "Complete checklists…" (admins anywhere, everyone else in the gyms they
-- belong to).
begin;
select plan(27);

-- ---------------------------------------------------------------- fixtures --
select tests.create_user('super');
select tests.create_user('admin');
select tests.create_user('manager_a');
select tests.create_user('staff_a');
select tests.create_user('staff_b');

update public.profiles set is_superadmin = true, is_admin = true
where id = tests.get_user_id('super');
update public.profiles set is_admin = true where id = tests.get_user_id('admin');

insert into public.gyms (id, name, slug)
values
  ('11111111-1111-1111-1111-111111111111', 'Gym A', 'gym-a'),
  ('22222222-2222-2222-2222-222222222222', 'Gym B', 'gym-b');

insert into public.gym_memberships (user_id, gym_id, role)
values
  (tests.get_user_id('manager_a'), '11111111-1111-1111-1111-111111111111', 'manager'),
  (tests.get_user_id('staff_a'), '11111111-1111-1111-1111-111111111111', 'staff'),
  (tests.get_user_id('staff_b'), '22222222-2222-2222-2222-222222222222', 'staff');

insert into public.checklist_templates (id, gym_id, kind, name)
values
  ('dddddddd-0000-0000-0000-000000000001', null, 'opening', 'Company opening'),
  ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'closing', 'Gym A closing'),
  ('dddddddd-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
   'custom', 'Gym B setting day');

insert into public.checklist_template_items (id, template_id, position, label)
values
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 1,
   'Unlock the front door'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002', 1,
   'Empty the chalk buckets');

insert into public.checklist_runs (id, template_id, gym_id, run_date)
values
  ('ffffffff-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
   '11111111-1111-1111-1111-111111111111', current_date),
  ('ffffffff-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222', current_date);

insert into public.checklist_run_items (id, run_id, template_item_id, position, label)
values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001',
   'eeeeeeee-0000-0000-0000-000000000001', 1, 'Unlock the front door'),
  ('aaaaaaaa-1111-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000002',
   'eeeeeeee-0000-0000-0000-000000000001', 1, 'Unlock the front door');

-- --------------------------------------------------------------- structure --
select has_table('public', 'checklist_templates', 'checklist_templates exists');
select has_table('public', 'checklist_template_items', 'checklist_template_items exists');
select has_table('public', 'checklist_runs', 'checklist_runs exists');
select has_table('public', 'checklist_run_items', 'checklist_run_items exists');
select is(
  (select count(*)::int from pg_class
   where relnamespace = 'public'::regnamespace
     and relname like 'checklist%' and relrowsecurity),
  4,
  'RLS is enabled on all four checklist tables'
);
select throws_ok(
  $$ insert into public.checklist_runs (template_id, gym_id, run_date)
     values ('dddddddd-0000-0000-0000-000000000001',
             '11111111-1111-1111-1111-111111111111', current_date) $$,
  '23505',
  null,
  'a template generates at most one run per gym per day'
);

-- --------------------------------------------------------------- templates --
select tests.clear_authentication();
select is((select count(*)::int from public.checklist_templates), 0, 'anon reads no templates');

select tests.authenticate_as('staff_a');
select results_eq(
  $$ select name from public.checklist_templates order by name $$,
  $$ values ('Company opening'), ('Gym A closing') $$,
  'staff see the company templates and their own gym''s'
);
select throws_ok(
  $$ insert into public.checklist_templates (gym_id, name)
     values ('11111111-1111-1111-1111-111111111111', 'From staff') $$,
  '42501',
  null,
  'staff cannot write a template'
);
select throws_ok(
  $$ insert into public.checklist_template_items (template_id, position, label)
     values ('dddddddd-0000-0000-0000-000000000002', 2, 'From staff') $$,
  '42501',
  null,
  'staff cannot add an item to a template'
);

select tests.authenticate_as('manager_a');
select lives_ok(
  $$ insert into public.checklist_templates (gym_id, kind, name)
     values ('11111111-1111-1111-1111-111111111111', 'custom', 'Wall wash') $$,
  'a manager writes templates for a gym they manage'
);
select lives_ok(
  $$ insert into public.checklist_template_items (template_id, position, label)
     values ('dddddddd-0000-0000-0000-000000000002', 2, 'Turn off the fans') $$,
  'a manager adds items to their own gym''s template'
);
select throws_ok(
  $$ insert into public.checklist_templates (gym_id, name) values (null, 'Company-wide') $$,
  '42501',
  null,
  'a manager cannot write a company-wide template'
);
select throws_ok(
  $$ insert into public.checklist_template_items (template_id, position, label)
     values ('dddddddd-0000-0000-0000-000000000001', 2, 'Into the company template') $$,
  '42501',
  null,
  'a manager cannot add items to a company-wide template'
);
with changed as (
  update public.checklist_templates set name = 'Renamed'
  where id = 'dddddddd-0000-0000-0000-000000000003' returning 1
)
select is((select count(*)::int from changed), 0, 'a manager cannot edit another gym''s template');

select tests.authenticate_as('admin');
select lives_ok(
  $$ insert into public.checklist_templates (gym_id, kind, name)
     values (null, 'opening', 'Company weekend opening') $$,
  'an admin writes company-wide templates'
);

-- -------------------------------------------------------------------- runs --
select tests.authenticate_as('staff_a');
select is(
  (select count(*)::int from public.checklist_runs),
  1,
  'staff see only their own gym''s runs'
);
select throws_ok(
  $$ insert into public.checklist_runs (template_id, gym_id, run_date)
     values ('dddddddd-0000-0000-0000-000000000001',
             '11111111-1111-1111-1111-111111111111', current_date + 1) $$,
  '42501',
  null,
  'nobody creates runs from a client — the scheduled job does (P4-02)'
);

select tests.authenticate_as('admin');
select is((select count(*)::int from public.checklist_runs), 2, 'an admin sees every gym''s runs');

-- --------------------------------------------------------------- run items --
select tests.authenticate_as('staff_b');
with changed as (
  update public.checklist_run_items set done_at = now()
  where id = 'aaaaaaaa-1111-0000-0000-000000000001' returning 1
)
select is(
  (select count(*)::int from changed),
  0,
  'staff cannot tick an item in a gym they do not belong to'
);

select tests.authenticate_as('staff_a');
select lives_ok(
  $$ update public.checklist_run_items
     set done_at = now(), note = 'Door was already open'
     where id = 'aaaaaaaa-1111-0000-0000-000000000001' $$,
  'staff tick items in their own gym'
);
select is(
  (select done_by from public.checklist_run_items
   where id = 'aaaaaaaa-1111-0000-0000-000000000001'),
  tests.get_user_id('staff_a'),
  'ticking records who did it, from the session and not from the request'
);

-- Ticking on someone else's behalf, the way a client could ask for it.
update public.checklist_run_items
set done_at = now(), done_by = tests.get_user_id('staff_b')
where id = 'aaaaaaaa-1111-0000-0000-000000000001';
select is(
  (select done_by from public.checklist_run_items
   where id = 'aaaaaaaa-1111-0000-0000-000000000001'),
  tests.get_user_id('staff_a'),
  'a client cannot claim someone else ticked an item'
);

update public.checklist_run_items set done_at = null
where id = 'aaaaaaaa-1111-0000-0000-000000000001';
select is(
  (select done_by from public.checklist_run_items
   where id = 'aaaaaaaa-1111-0000-0000-000000000001'),
  null,
  'un-ticking clears who did it'
);

select throws_ok(
  $$ insert into public.checklist_run_items (run_id, position, label)
     values ('ffffffff-0000-0000-0000-000000000001', 9, 'Sneaked in') $$,
  '42501',
  null,
  'nobody adds items to a run that is already generated'
);

-- The run keeps what staff actually saw, even after the template moves on.
select tests.become_postgres();
update public.checklist_template_items set label = 'Unlock both doors'
where id = 'eeeeeeee-0000-0000-0000-000000000001';

select tests.authenticate_as('staff_a');
select is(
  (select label from public.checklist_run_items
   where id = 'aaaaaaaa-1111-0000-0000-000000000001'),
  'Unlock the front door',
  'editing a template does not rewrite the runs already generated from it'
);

select tests.authenticate_as('manager_a');
select is(
  (select count(*)::int from public.checklist_run_items),
  1,
  'a manager sees the run items of the gyms they belong to'
);

select * from finish();
rollback;
