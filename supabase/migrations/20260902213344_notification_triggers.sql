-- P5-02 — the four things V1 tells people about.
--
-- Spec §2.2: an incident notifies the gym's managers and the admins, and a
-- high-severity one is also emailed; a guide or a post that must be confirmed
-- reminds the people who have not; an accepted invitation tells whoever sent
-- it. Every one of them is written by a trigger or by the nightly job here —
-- §5: no client-side notification sending.
--
-- Tested by supabase/tests/150-notification-triggers.test.sql.

-- The type-specific half of a notification: the status an incident moved to,
-- how bad it is, whether the reminder is about a guide or a post. It belongs
-- with the triggers rather than in P5-01's table, because the triggers are
-- what turned out to need it. The rendered `title`/`body` stay the entity's
-- own words; `data` is what the client and `notify` translate around them.
alter table public.notifications
  add column data jsonb not null default '{}'::jsonb;

-- ============================================================ recipients ==

-- Who watches a gym: its managers, plus every admin (`is_admin` is true for
-- superadmins too, P1-04). Deactivated accounts are nobody's audience.
create function public.gym_overseers(target_gym uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.active
    and (
      p.is_admin
      or exists (
        select 1 from public.gym_memberships m
        where m.user_id = p.id and m.gym_id = target_gym and m.role = 'manager'
      )
    );
$$;

comment on function public.gym_overseers(uuid) is
  'P5-02: the managers of one gym and every admin — who an incident there is reported to.';

-- Everyone a piece of content is addressed to: the members of its gym, or the
-- whole company when it has none.
create function public.content_audience(target_gym uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.active
    and (
      target_gym is null
      or exists (
        select 1 from public.gym_memberships m
        where m.user_id = p.id and m.gym_id = target_gym
      )
    );
$$;

comment on function public.content_audience(uuid) is
  'P5-02: who a post or guide is for — its gym''s members, or everybody when it is company-wide.';

-- ================================================================= write ==

-- The one way a notification comes into being. Drops recipients who have
-- switched the type off in the inbox, and — when `dedupe_within` is given —
-- anyone already told about this subject inside that window, which is what
-- keeps the nightly reminder from becoming a nightly nag.
--
-- Returns the number of rows written, so the cron log says something.
create function public.raise_notification(
  recipients uuid[],
  notification_type public.notification_type,
  title_text text,
  body_text text default null,
  link text default null,
  target_gym uuid default null,
  subject uuid default null,
  email_wanted boolean default false,
  data_json jsonb default '{}'::jsonb,
  dedupe_within interval default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  written integer;
begin
  insert into public.notifications (
    user_id, type, title, body, url, gym_id, subject_id, email_requested, data
  )
  select
    r.user_id, notification_type, title_text, body_text, link,
    target_gym, subject, email_wanted, data_json
  from (select distinct u as user_id from unnest(recipients) u where u is not null) r
  join public.profiles p on p.id = r.user_id and p.active
  where (select pref.in_app from public.notification_pref(r.user_id, notification_type) pref)
    and (
      dedupe_within is null
      or not exists (
        select 1 from public.notifications n
        where n.user_id = r.user_id
          and n.type = notification_type
          and n.subject_id is not distinct from subject
          and n.created_at > now() - dedupe_within
      )
    );

  get diagnostics written = row_count;
  return written;
end;
$$;

comment on function public.raise_notification is
  'P5-02: the only writer of public.notifications. Applies the in-app preference and optional per-subject de-duplication.';

-- Clients neither call it nor need to: it runs inside the triggers below,
-- which are owned by the same role. Supabase grants every new public function
-- to anon/authenticated/service_role, so this has to be taken back by hand.
revoke all on function public.raise_notification(
  uuid[], public.notification_type, text, text, text, uuid, uuid, boolean, jsonb, interval
) from public, anon, authenticated, service_role;

-- ============================================================= incidents ==

create function public.notify_incident_reported()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.raise_notification(
    recipients := array(
      select o from public.gym_overseers(new.gym_id) o
      -- The person who filed it already knows.
      where o is distinct from new.created_by
    ),
    notification_type := 'incident_reported',
    title_text := new.title,
    body_text := left(new.body, 300),
    link := '/incidents/' || new.id,
    target_gym := new.gym_id,
    subject := new.id,
    -- Spec §2.2: "high severity also emails".
    email_wanted := new.severity = 'high',
    data_json := jsonb_build_object('kind', new.kind, 'severity', new.severity)
  );

  return null;
end;
$$;

create trigger incidents_notify_reported after insert on public.incidents
  for each row execute function public.notify_incident_reported();

-- A status move is news for the gym's managers, the admins, the person who
-- reported it and whoever it is assigned to — everybody except whoever just
-- moved it.
create function public.notify_incident_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  perform public.raise_notification(
    recipients := array(
      select r from (
        select o from public.gym_overseers(new.gym_id) o
        union
        select new.created_by
        union
        select new.assignee_id
      ) recipients(r)
      where r is distinct from auth.uid()
    ),
    notification_type := 'incident_status_changed',
    title_text := new.title,
    link := '/incidents/' || new.id,
    target_gym := new.gym_id,
    subject := new.id,
    data_json := jsonb_build_object(
      'status', new.status, 'from', old.status, 'severity', new.severity
    )
  );

  return null;
end;
$$;

create trigger incidents_notify_status_changed after update on public.incidents
  for each row execute function public.notify_incident_status_changed();

-- =============================================================== invites ==

-- P2-03 defines acceptance as the first sign-in, which `close_accepted_invite`
-- records. Whoever sent the invitation hears about it then.
create function public.notify_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_name text;
begin
  if new.status is not distinct from old.status or new.status <> 'accepted' then
    return null;
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.email)
  into accepted_name
  from public.profiles p
  where p.id = new.accepted_by;

  perform public.raise_notification(
    recipients := array[new.created_by],
    notification_type := 'invite',
    title_text := coalesce(accepted_name, new.email),
    link := '/admin/users',
    target_gym := new.gym_id,
    subject := new.id,
    data_json := jsonb_build_object('email', new.email, 'as_admin', new.as_admin)
  );

  return null;
end;
$$;

create trigger invites_notify_accepted after update on public.invites
  for each row execute function public.notify_invite_accepted();

-- ======================================================= acknowledgements ==

-- The reminder half of P3-04. One pass over the published content that must be
-- confirmed, telling the people who have not confirmed it — at most once a
-- week each, and never on the day it was published, when the feed is doing
-- that job already.
--
-- `as_of` exists so the tests can pin the moment, as in P4-02.
create function public.send_ack_reminders(as_of timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  sent integer := 0;
  item record;
begin
  for item in
    select
      p.id, p.gym_id, p.title, 'post' as kind, '/news/' || p.id as url,
      array(
        select a from public.content_audience(p.gym_id) a
        where not exists (
          select 1 from public.post_reads r
          where r.post_id = p.id and r.user_id = a and r.acknowledged_at is not null
        )
      ) as pending
    from public.posts p
    where p.status = 'published' and p.requires_ack and p.deleted_at is null
      and p.published_at < as_of - interval '1 day'
    union all
    select
      g.id, g.gym_id, g.title, 'guide', '/guides/' || g.id,
      array(
        select a from public.content_audience(g.gym_id) a
        where not exists (
          select 1 from public.guide_acks k
          where k.guide_id = g.id and k.user_id = a and k.version >= g.version
        )
      )
    from public.guides g
    where g.status = 'published' and g.requires_ack and g.deleted_at is null
      and g.published_at < as_of - interval '1 day'
  loop
    sent := sent + public.raise_notification(
      recipients := item.pending,
      notification_type := 'ack_reminder',
      title_text := item.title,
      link := item.url,
      target_gym := item.gym_id,
      subject := item.id,
      data_json := jsonb_build_object('kind', item.kind),
      dedupe_within := interval '7 days'
    );
  end loop;

  return sent;
end;
$$;

comment on function public.send_ack_reminders(timestamptz) is
  'P5-02: nightly reminder for unconfirmed news and guides. At most one per person per item per week.';

revoke all on function public.send_ack_reminders(timestamptz)
  from public, anon, authenticated, service_role;

-- Unlike the checklist job (P4-02) this one has no gym-local date to respect —
-- a guide can be company-wide, and a reminder is not dated by the gym's day —
-- so it is a single daily schedule: 07:00 UTC, which is the start of a Danish
-- working morning either side of the summer change.
select cron.unschedule('send-ack-reminders')
where exists (select 1 from cron.job where jobname = 'send-ack-reminders');

select cron.schedule(
  'send-ack-reminders',
  '0 7 * * *',
  $job$select public.send_ack_reminders()$job$
);
