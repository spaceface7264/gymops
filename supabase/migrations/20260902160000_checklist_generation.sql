-- P4-02 — the scheduled job that turns checklist templates into daily runs.
--
-- Spec §1 "Checklists": runs are generated at 03:00 gym-local. The job itself
-- runs hourly at :00 and each gym generates when *its own* clock says 3, which
-- is what makes a chain spanning time zones work from a single schedule; every
-- UTC offset, the 30- and 45-minute ones included, passes through local hour 3
-- exactly once a day.
--
-- Tested by supabase/tests/080-checklist-generation.test.sql.

create extension if not exists pg_cron with schema pg_catalog;

-- `as_of` exists so the tests can pin the moment; production always calls it
-- with now(). Returns the number of runs created, for the cron log.
create function public.generate_checklist_runs(as_of timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_count integer;
begin
  with due_gyms as (
    select
      g.id as gym_id,
      (as_of at time zone g.timezone)::date as local_date,
      extract(isodow from (as_of at time zone g.timezone))::smallint as local_dow
    from public.gyms g
    where g.active
      and extract(hour from (as_of at time zone g.timezone)) = 3
  ),
  due_templates as (
    select d.gym_id, d.local_date, t.id as template_id
    from due_gyms d
    join public.checklist_templates t
      on t.active
     and (t.gym_id is null or t.gym_id = d.gym_id)
     and d.local_dow = any (t.weekdays)
    -- A template with no items would generate a run that is complete the
    -- moment it exists; it is an unfinished draft, not a checklist.
    where exists (
      select 1 from public.checklist_template_items i where i.template_id = t.id
    )
  ),
  new_runs as (
    insert into public.checklist_runs (template_id, gym_id, run_date)
    select template_id, gym_id, local_date from due_templates
    -- The unique key is (template_id, gym_id, run_date): running the job twice
    -- in the same gym-local hour changes nothing.
    on conflict (template_id, gym_id, run_date) do nothing
    returning id, template_id
  ),
  new_items as (
    insert into public.checklist_run_items (run_id, template_item_id, position, label, required)
    select r.id, i.id, i.position, i.label, i.required
    from new_runs r
    join public.checklist_template_items i on i.template_id = r.template_id
    returning run_id
  )
  select count(distinct run_id) from new_items into created_count;

  return created_count;
end;
$$;

comment on function public.generate_checklist_runs(timestamptz) is
  'P4-02: creates today''s checklist runs for every gym whose local time is 03:xx. Idempotent.';

-- Runs as the job owner only. Clients read runs, they never create them
-- (P4-01: checklist_runs has no insert policy). Supabase's default privileges
-- hand every new function in `public` to anon/authenticated/service_role, so
-- revoking from PUBLIC alone would leave it callable by a logged-in browser.
revoke all on function public.generate_checklist_runs(timestamptz)
  from public, anon, authenticated, service_role;

-- `db reset` replays this on a database that may already carry the job.
select cron.unschedule('generate-checklist-runs')
where exists (select 1 from cron.job where jobname = 'generate-checklist-runs');

select cron.schedule(
  'generate-checklist-runs',
  '0 * * * *',
  $job$select public.generate_checklist_runs()$job$
);
