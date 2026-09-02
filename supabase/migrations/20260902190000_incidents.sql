-- P4-07 — incidents: what went wrong, who is on it, and the photographs.
--
-- Spec §2.2: kind, severity, status open → in progress → resolved, photo
-- attachments, a comment thread and an assignee. §2.1 splits the rights:
-- *reporting* is `can_complete_in()` (anyone who works in that gym), while
-- *changing the status* is `can_publish_content()` (managers in their own
-- gyms, admins anywhere).
--
-- Tested by supabase/tests/110-incident-permissions.test.sql.

create type public.incident_kind as enum ('injury', 'equipment', 'cleaning', 'other');
create type public.incident_severity as enum ('low', 'medium', 'high');
create type public.incident_status as enum ('open', 'in_progress', 'resolved');

-- ================================================================ tables ==

-- Always a gym's, like the daily log: there is no company-wide incident.
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms on delete cascade,
  kind public.incident_kind not null default 'other',
  severity public.incident_severity not null default 'low',
  status public.incident_status not null default 'open',
  title text not null,
  body text not null,
  -- Whoever is on it. Null until a manager picks somebody.
  assignee_id uuid references public.profiles on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles on delete set null,
  updated_by uuid references public.profiles on delete set null,
  constraint incidents_title_check check (btrim(title) <> ''),
  constraint incidents_body_check check (btrim(body) <> '')
);

comment on table public.incidents is
  'Injury, equipment, cleaning and other reports per gym. Resolved, never deleted.';

create index incidents_gym_idx on public.incidents (gym_id, created_at desc);
create index incidents_open_idx on public.incidents (gym_id, severity desc)
  where status <> 'resolved';

-- One row per uploaded photograph. `path` is the object in the `incidents`
-- bucket, `<gym id>/<incident id>/<uuid>.<ext>`.
create table public.incident_attachments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents on delete cascade,
  path text not null unique,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles on delete set null
);

create index incident_attachments_incident_idx
  on public.incident_attachments (incident_id, created_at);

create table public.incident_comments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles on delete set null,
  constraint incident_comments_body_check check (btrim(body) <> '')
);

create index incident_comments_incident_idx
  on public.incident_comments (incident_id, created_at);

-- ============================================================== triggers ==

create trigger incidents_set_updated_at before update on public.incidents
  for each row execute function public.set_updated_at();
create trigger incidents_set_created_by before insert on public.incidents
  for each row execute function public.set_created_by();

create trigger incident_attachments_set_created_by before insert
  on public.incident_attachments
  for each row execute function public.set_created_by();

create trigger incident_comments_set_updated_at before update
  on public.incident_comments
  for each row execute function public.set_updated_at();
create trigger incident_comments_set_created_by before insert
  on public.incident_comments
  for each row execute function public.set_created_by();

-- Reporting is not handling: somebody who cannot change the status of an
-- incident cannot file one that is already resolved or already assigned
-- either. Without this the insert policy would let a reporter post any status
-- they liked, and the update guard would only start caring afterwards.
create function public.guard_incident_report()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and not public.can_publish_content(new.gym_id) then
    new.status := 'open';
    new.assignee_id := null;
  end if;

  new.resolved_at := case when new.status = 'resolved' then now() end;

  return new;
end;
$$;

create trigger incidents_guard_report before insert on public.incidents
  for each row execute function public.guard_incident_report();

-- The two halves of §2.1 in one trigger: the reporter owns the description,
-- the gym's managers own the handling. `resolved_at` follows the status rather
-- than being posted, the way `done_at` does on a checklist item (P4-01).
create function public.guard_incident_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  new.gym_id := old.gym_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if not public.can_publish_content(old.gym_id) then
    new.status := old.status;
    new.severity := old.severity;
    new.assignee_id := old.assignee_id;
  end if;

  if auth.uid() is distinct from old.created_by then
    new.title := old.title;
    new.body := old.body;
    new.kind := old.kind;
  end if;

  new.resolved_at := case
    when new.status = 'resolved' then coalesce(old.resolved_at, now())
    else null
  end;

  return new;
end;
$$;

create trigger incidents_guard_edit before update on public.incidents
  for each row execute function public.guard_incident_edit();

-- ================================================================== RLS ==

alter table public.incidents enable row level security;
alter table public.incident_attachments enable row level security;
alter table public.incident_comments enable row level security;

create policy incidents_select on public.incidents
  for select to authenticated using (public.can_read_content(gym_id));

-- Reporting an incident is working in that gym (§2.1).
create policy incidents_insert on public.incidents
  for insert to authenticated with check (public.can_complete_in(gym_id));

-- Both the reporter and the gym's managers may write; the trigger above
-- decides which columns each of them actually moves.
create policy incidents_update on public.incidents
  for update to authenticated
  using (
    public.can_publish_content(gym_id)
    or (created_by = auth.uid() and public.can_complete_in(gym_id))
  )
  with check (
    public.can_publish_content(gym_id)
    or (created_by = auth.uid() and public.can_complete_in(gym_id))
  );

-- No delete policy: an incident is a record of something that happened, and
-- "resolved" is what closing one looks like.

create policy incident_attachments_select on public.incident_attachments
  for select to authenticated using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_id and public.can_read_content(i.gym_id)
    )
  );

create policy incident_attachments_insert on public.incident_attachments
  for insert to authenticated with check (
    exists (
      select 1 from public.incidents i
      where i.id = incident_id and public.can_complete_in(i.gym_id)
    )
  );

create policy incident_comments_select on public.incident_comments
  for select to authenticated using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_id and public.can_read_content(i.gym_id)
    )
  );

create policy incident_comments_insert on public.incident_comments
  for insert to authenticated with check (
    exists (
      select 1 from public.incidents i
      where i.id = incident_id and public.can_complete_in(i.gym_id)
    )
  );

-- A comment is somebody's own words: only they may change them, and nobody
-- deletes them in V1.
create policy incident_comments_update on public.incident_comments
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ============================================================== storage ==

-- The gym an object belongs to, from its first path segment. Unlike the
-- `content` bucket there is no company-wide scope here, so anything that is
-- not a uuid resolves to the nil uuid — readable and writable by nobody.
create function public.incident_object_gym(object_name text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when folder ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then folder::uuid
    else '00000000-0000-0000-0000-000000000000'::uuid
  end
  from (select (storage.foldername(object_name))[1] as folder) f;
$$;

grant execute on function public.incident_object_gym(text) to authenticated;

-- A photograph of an injury is gym-scoped and stays inside the gym.
create policy incident_objects_select on storage.objects
  for select to authenticated using (
    bucket_id = 'incidents'
    and public.can_read_content(public.incident_object_gym(name))
  );

-- Uploading follows reporting, not publishing: staff photograph what they find.
create policy incident_objects_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'incidents'
    and public.can_complete_in(public.incident_object_gym(name))
  );

-- No update or delete policy, as in the `content` bucket: an attachment a
-- report still points at cannot vanish.
