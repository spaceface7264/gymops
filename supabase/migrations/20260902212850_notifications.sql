-- P5-01 — the inbox, what each person wants to be told, and where to push it.
--
-- Spec §2.2: in-app inbox, email (Resend), web push (VAPID), per-user
-- preferences per notification type. §5 is the rule that shapes the tables:
-- notifications are *created only by database triggers* and the `notify`
-- function fans them out — no client ever inserts one. So there is no insert
-- policy here at all, and the only column a recipient may move is `read_at`.
--
-- Three tables:
--   `notifications`      one row per person per event; the inbox.
--   `notification_prefs` one row per person per type; absent means the default.
--   `push_subscriptions` one row per browser that accepted a push permission.
--
-- Tested by supabase/tests/140-notification-permissions.test.sql.

-- The events V1 can raise. P5-02 writes the first four; P6-08 adds the chat
-- ones, which is why this is an enum and not a check constraint.
create type public.notification_type as enum (
  'incident_reported',
  'incident_status_changed',
  'ack_reminder',
  'invite'
);

-- ================================================================ tables ==

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  type public.notification_type not null,
  -- Already-rendered text. A notification is a message that was true when it
  -- was sent: re-deriving it later from a row that has since moved would show
  -- the reader something that never happened.
  title text not null,
  body text,
  -- Where it takes you in the app, e.g. `/incidents/<id>`. Also the desktop
  -- deep link's path (P7-03) and the service worker's `notificationclick`.
  url text,
  gym_id uuid references public.gyms on delete cascade,
  -- The row the event happened to, for de-duplication by the triggers.
  subject_id uuid,
  -- Whether *this* event is worth an email, decided where it is raised (a
  -- high-severity incident is, an ordinary one is not). The recipient's
  -- preference can still turn it off; it can never turn it on.
  email_requested boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_title_check check (btrim(title) <> '')
);

comment on table public.notifications is
  'One row per recipient per event. Written by triggers only; the notify function fans out.';

create index notifications_inbox_idx
  on public.notifications (user_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

-- Absent row = the defaults in `notification_pref()`. Writing the defaults out
-- for 200 users on every new type is a migration nobody should have to write.
create table public.notification_prefs (
  user_id uuid not null references public.profiles on delete cascade,
  type public.notification_type not null,
  in_app boolean not null default true,
  email boolean not null default true,
  push boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

comment on table public.notification_prefs is
  'Per-user, per-type channel switches. No row means the defaults are in force.';

-- One row per browser. The endpoint is the identity of the subscription: the
-- same browser re-subscribing after a permission reset gets a new one, and the
-- old one starts returning 410, which is when `notify` deletes it.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ============================================================== triggers ==

create trigger notification_prefs_set_updated_at before update
  on public.notification_prefs
  for each row execute function public.set_updated_at();

-- The inbox is a log. A recipient marks something read or unread; they do not
-- rewrite what they were told, or hand it to somebody else.
create function public.guard_notification_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  new.id := old.id;
  new.user_id := old.user_id;
  new.type := old.type;
  new.title := old.title;
  new.body := old.body;
  new.url := old.url;
  new.gym_id := old.gym_id;
  new.subject_id := old.subject_id;
  new.email_requested := old.email_requested;
  new.created_at := old.created_at;

  return new;
end;
$$;

create trigger notifications_guard_edit before update on public.notifications
  for each row execute function public.guard_notification_edit();

-- =========================================================== preferences ==

-- The effective preference for one person and one type, defaults included, as
-- one row. `notify` reads it for the email and push decision; the trigger in
-- P5-02 reads `in_app` to decide whether the row is written at all.
create function public.notification_pref(
  target_user uuid,
  target_type public.notification_type
)
returns table (in_app boolean, email boolean, push boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p.in_app, true),
    coalesce(p.email, true),
    coalesce(p.push, true)
  from (select 1) one
  left join public.notification_prefs p
    on p.user_id = target_user and p.type = target_type;
$$;

comment on function public.notification_pref(uuid, public.notification_type) is
  'Effective channel switches for one person and one type. Missing row = all on.';

-- ================================================================== RLS ==

alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_subscriptions enable row level security;

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

-- No insert policy: §5 says triggers create these, and the trigger runs as the
-- table owner. No delete policy either — the inbox trims itself by age (P5-04
-- shows the last 30 days), not by hand.
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notification_prefs_select on public.notification_prefs
  for select to authenticated using (user_id = auth.uid());

create policy notification_prefs_insert on public.notification_prefs
  for insert to authenticated with check (user_id = auth.uid());

create policy notification_prefs_update on public.notification_prefs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Turning a type back to its defaults is deleting the row.
create policy notification_prefs_delete on public.notification_prefs
  for delete to authenticated using (user_id = auth.uid());

create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Signing out of a browser, or turning push off, removes the subscription.
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================= realtime ==

-- The unread badge updates without a reload, and the Tauri shell raises native
-- notifications from the same stream (P7-03). Each person listens on their own
-- topic; RLS on the row still decides what they receive.
alter publication supabase_realtime add table public.notifications;

create function public.can_listen_to_notifications(topic text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select topic = 'notifications:' || coalesce(auth.uid()::text, '-');
$$;

grant execute on function public.can_listen_to_notifications(text) to authenticated;

create policy notifications_realtime_listen on realtime.messages
  for select to authenticated
  using (public.can_listen_to_notifications(realtime.topic()));
