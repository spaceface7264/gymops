-- P4-01 — checklists: templates, their items, the daily runs generated from
-- them, and the items staff tick.
--
-- Permission matrix: PROJECT_SPEC.md §2.1 — "edit checklist templates" is the
-- publishing rule (admins anywhere, managers in their own gyms), "complete
-- checklists" is membership of the gym the run belongs to.
-- Tested by supabase/tests/070-checklist-permissions.test.sql.

create type public.checklist_kind as enum ('opening', 'closing', 'custom');

-- ================================================================ tables ==

-- gym_id null = a company-wide template, generated into a run for every gym.
create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms on delete cascade,
  kind public.checklist_kind not null default 'custom',
  name text not null,
  -- Which weekdays this template runs on (ISO: 1 = Monday). P4-02 reads it
  -- against the gym's own date, so a Sunday template does not fire on Saturday
  -- in one time zone and Sunday in another.
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}',
  -- Deactivated rather than deleted: the runs it has already generated stay
  -- readable, exactly as gyms do.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null,
  constraint checklist_templates_weekdays_check check (
    array_length(weekdays, 1) between 1 and 7
    and weekdays <@ '{1,2,3,4,5,6,7}'::smallint[]
  )
);

comment on table public.checklist_templates is
  'Opening/closing/custom checklists, company-wide or per gym. Deactivated, never deleted.';

create index checklist_templates_gym_idx on public.checklist_templates (gym_id) where active;

create table public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates on delete cascade,
  position integer not null,
  label text not null,
  -- A run is complete when every required item is ticked; the rest are optional.
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users on delete set null,
  updated_by uuid references auth.users on delete set null
);

create index checklist_template_items_template_idx
  on public.checklist_template_items (template_id, position);

-- One row per template per gym per day, created by the scheduled job (P4-02).
-- `gym_id` is stored rather than followed through the template, because a
-- company-wide template has none and every run belongs to exactly one gym.
create table public.checklist_runs (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates on delete restrict,
  gym_id uuid not null references public.gyms on delete cascade,
  run_date date not null,
  created_at timestamptz not null default now(),
  unique (template_id, gym_id, run_date)
);

create index checklist_runs_gym_date_idx on public.checklist_runs (gym_id, run_date desc);

-- `label` is a snapshot, not a lookup: a template edited in March must not
-- rewrite what somebody ticked in February. `template_item_id` is kept for
-- reporting and goes null if the item is removed from the template.
create table public.checklist_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.checklist_runs on delete cascade,
  template_item_id uuid references public.checklist_template_items on delete set null,
  position integer not null,
  label text not null,
  required boolean not null default true,
  done_at timestamptz,
  done_by uuid references public.profiles on delete set null,
  note text
);

create index checklist_run_items_run_idx on public.checklist_run_items (run_id, position);

-- ============================================================== triggers ==

create trigger checklist_templates_set_updated_at before update on public.checklist_templates
  for each row execute function public.set_updated_at();
create trigger checklist_templates_set_created_by before insert on public.checklist_templates
  for each row execute function public.set_created_by();

create trigger checklist_template_items_set_updated_at
  before update on public.checklist_template_items
  for each row execute function public.set_updated_at();
create trigger checklist_template_items_set_created_by
  before insert on public.checklist_template_items
  for each row execute function public.set_created_by();

-- Who ticked an item is the session's own answer, never the request's — the
-- same rule the acknowledgements learned the hard way (audit, 2026-09-02).
create function public.guard_run_item_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.done_at is null then
    new.done_by := null;
  else
    new.done_at := coalesce(old.done_at, now());
    new.done_by := coalesce(old.done_by, auth.uid());
  end if;

  return new;
end;
$$;

create trigger checklist_run_items_guard_completion
  before update on public.checklist_run_items
  for each row execute function public.guard_run_item_completion();

-- ================================================================== RLS ==

alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.checklist_runs enable row level security;
alter table public.checklist_run_items enable row level security;

-- Ticking a checklist needs membership of that gym, not publishing rights:
-- staff do it in their own gyms (spec §2.1), and an admin anywhere.
create function public.can_complete_in(target_gym_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_admin()
    or (public.is_active_user() and target_gym_id in (select public.member_gym_ids()));
$$;

grant execute on function public.can_complete_in(uuid) to authenticated;

-- templates: readable by the people they apply to, writable by the people who
-- may publish there.
create policy checklist_templates_select on public.checklist_templates
  for select to authenticated using (public.can_read_content(gym_id));

create policy checklist_templates_insert on public.checklist_templates
  for insert to authenticated with check (public.can_publish_content(gym_id));

create policy checklist_templates_update on public.checklist_templates
  for update to authenticated
  using (public.can_publish_content(gym_id))
  with check (public.can_publish_content(gym_id));

-- Items follow their template, both for reading and for writing.
create policy checklist_template_items_select on public.checklist_template_items
  for select to authenticated using (
    exists (
      select 1 from public.checklist_templates t
      where t.id = template_id and public.can_read_content(t.gym_id)
    )
  );

create policy checklist_template_items_write on public.checklist_template_items
  for all to authenticated
  using (
    exists (
      select 1 from public.checklist_templates t
      where t.id = template_id and public.can_publish_content(t.gym_id)
    )
  )
  with check (
    exists (
      select 1 from public.checklist_templates t
      where t.id = template_id and public.can_publish_content(t.gym_id)
    )
  );

-- runs: read-only to every client. They are created by the scheduled job
-- (P4-02) running as the service role, so there is no insert policy at all.
create policy checklist_runs_select on public.checklist_runs
  for select to authenticated using (public.can_read_content(gym_id));

-- run items: the same audience reads them; ticking needs membership.
create policy checklist_run_items_select on public.checklist_run_items
  for select to authenticated using (
    exists (
      select 1 from public.checklist_runs r
      where r.id = run_id and public.can_read_content(r.gym_id)
    )
  );

create policy checklist_run_items_update on public.checklist_run_items
  for update to authenticated
  using (
    exists (
      select 1 from public.checklist_runs r
      where r.id = run_id and public.can_complete_in(r.gym_id)
    )
  )
  with check (
    exists (
      select 1 from public.checklist_runs r
      where r.id = run_id and public.can_complete_in(r.gym_id)
    )
  );
