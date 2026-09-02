-- P4-02: generate_checklist_runs() and the hourly job that calls it.
--
-- Spec §1: runs appear at 03:00 gym-local. The job fires hourly at :00 UTC and
-- each gym generates on its own clock, so the interesting cases are gyms in
-- different zones — including Chatham, whose +12:45/+13:45 offset means its
-- local hour 3 is reached at a :45, not a :00.
begin;
select plan(13);

-- ---------------------------------------------------------------- fixtures --
-- 2026-03-04 is a Wednesday (ISO 3). At 02:00Z Copenhagen reads 03:00 (CET);
-- at 14:00Z Auckland reads 03:00 and Chatham 03:45, both on Thursday the 5th.
-- The seeded gyms would generate runs of their own; this test is about which
-- clock decides, so it takes them out of the chain first.
update public.gyms set active = false;

insert into public.gyms (id, name, slug, timezone, active)
values
  ('11111111-1111-1111-1111-111111111111', 'Copenhagen', 'cph', 'Europe/Copenhagen', true),
  ('22222222-2222-2222-2222-222222222222', 'Auckland', 'akl', 'Pacific/Auckland', true),
  ('33333333-3333-3333-3333-333333333333', 'Chatham', 'cha', 'Pacific/Chatham', true),
  ('44444444-4444-4444-4444-444444444444', 'Closed down', 'old', 'Europe/Copenhagen', false);

insert into public.checklist_templates (id, gym_id, kind, name, weekdays, active)
values
  ('dddddddd-0000-0000-0000-000000000001', null, 'opening', 'Company opening',
   '{1,2,3,4,5,6,7}', true),
  ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'closing', 'Wednesday closing', '{3}', true),
  ('dddddddd-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'custom', 'Monday deep clean', '{1}', true),
  ('dddddddd-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'custom', 'Retired checklist', '{1,2,3,4,5,6,7}', false),
  ('dddddddd-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
   'custom', 'Empty draft', '{1,2,3,4,5,6,7}', true);

insert into public.checklist_template_items (template_id, position, label, required)
values
  ('dddddddd-0000-0000-0000-000000000001', 1, 'Unlock the front door', true),
  ('dddddddd-0000-0000-0000-000000000001', 2, 'Water the plants', false),
  ('dddddddd-0000-0000-0000-000000000002', 1, 'Empty the chalk buckets', true),
  ('dddddddd-0000-0000-0000-000000000003', 1, 'Scrub the holds', true),
  ('dddddddd-0000-0000-0000-000000000004', 1, 'Never generated', true);

-- ------------------------------------------------------- Copenhagen, 03:00 --
select is(
  public.generate_checklist_runs('2026-03-04 02:00:00+00'),
  2,
  'a gym generates the templates due on its own weekday, and only those'
);
select results_eq(
  $$ select t.name, r.gym_id, r.run_date
     from public.checklist_runs r
     join public.checklist_templates t on t.id = r.template_id
     order by t.name $$,
  $$ values ('Company opening', '11111111-1111-1111-1111-111111111111'::uuid,
             '2026-03-04'::date),
            ('Wednesday closing', '11111111-1111-1111-1111-111111111111'::uuid,
             '2026-03-04'::date) $$,
  'the company template and the Wednesday one ran, dated by the gym''s own calendar'
);
select results_eq(
  $$ select i.position, i.label, i.required
     from public.checklist_run_items i
     join public.checklist_runs r on r.id = i.run_id
     where r.template_id = 'dddddddd-0000-0000-0000-000000000001'
     order by i.position $$,
  $$ values (1, 'Unlock the front door', true), (2, 'Water the plants', false) $$,
  'a run snapshots every item of its template, labels and required flags included'
);
select is(
  (select count(*)::int from public.checklist_runs
   where gym_id <> '11111111-1111-1111-1111-111111111111'),
  0,
  'gyms whose local clock does not read 03:xx generate nothing'
);
select is(
  (select count(*)::int from public.checklist_runs
   where template_id = 'dddddddd-0000-0000-0000-000000000004'),
  0,
  'a deactivated template never generates'
);
select is(
  (select count(*)::int from public.checklist_runs
   where template_id = 'dddddddd-0000-0000-0000-000000000005'),
  0,
  'a template with no items generates nothing — it is a draft, not a checklist'
);

-- ------------------------------------------------------------- idempotence --
select is(
  public.generate_checklist_runs('2026-03-04 02:00:00+00'),
  0,
  'a second pass in the same gym-local hour creates nothing'
);
select is((select count(*)::int from public.checklist_runs), 2, 'and duplicates nothing');
select is(
  (select count(*)::int from public.checklist_run_items),
  3,
  'nor does it duplicate the run items'
);

-- ------------------------------------------- the other side of the planet --
select is(
  public.generate_checklist_runs('2026-03-04 14:00:00+00'),
  2,
  'twelve hours later it is 03:xx in New Zealand and those gyms generate'
);
select results_eq(
  $$ select g.slug, r.run_date
     from public.checklist_runs r
     join public.gyms g on g.id = r.gym_id
     where r.run_date = '2026-03-05'
     order by g.slug $$,
  $$ values ('akl', '2026-03-05'::date), ('cha', '2026-03-05'::date) $$,
  'Chatham''s 45-minute offset is reached by the same hourly schedule'
);

-- -------------------------------------------------------------- the job --
select results_eq(
  $$ select jobname, schedule, command, active from cron.job
     where jobname = 'generate-checklist-runs' $$,
  $$ values ('generate-checklist-runs', '0 * * * *',
             'select public.generate_checklist_runs()', true) $$,
  'the hourly job is scheduled'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.generate_checklist_runs(timestamptz)', 'execute'
  ),
  'no client can call the generator — runs are the job''s to create'
);

select * from finish();
rollback;
