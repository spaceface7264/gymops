-- P8-01 — the assistant's own tables, the cap, and the one flag chat needs.
--
-- There is no bot user. An assistant reply in a channel is a messages row
-- with created_by null and from_assistant true, written by the assistant
-- Edge Function with the service role; a person cannot post one and a
-- moderator's delete does not turn one into a person's (spec §4). A private
-- conversation on the Ask page is its owner's alone. Only the function
-- writes any table here, so `authenticated` has no insert policy on them —
-- the caller's JWT reads, the service role records.
--
-- The cap is calls per person per UTC day (spec §2.3), counted as rows in
-- assistant_usage, which doubles as the token log (spec §3, observability).
-- Its value lives in app_settings, one row per tunable, read by everyone and
-- moved by a superadmin.
--
-- Tested by supabase/tests/250-assistant-permissions.test.sql; the trigger
-- change by supabase/tests/200-chat-notifications.test.sql.

-- ================================================================ settings ==

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles on delete set null
);

comment on table public.app_settings is
  'One row per tunable. assistant_daily_cap: assistant calls per person per UTC day (P8-01).';

insert into public.app_settings (key, value) values ('assistant_daily_cap', '50'::jsonb);

create function public.stamp_app_setting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger app_settings_stamp before update on public.app_settings
  for each row execute function public.stamp_app_setting();

alter table public.app_settings enable row level security;

create policy app_settings_select on public.app_settings
  for select to authenticated using (public.is_active_user());

create policy app_settings_update on public.app_settings
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- No insert or delete policy: the set of settings is the migrations'.

-- =========================================================== conversations ==

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assistant_conversations is
  'A private thread on the Ask page; the owner''s alone (P8-01).';

create index assistant_conversations_user_idx
  on public.assistant_conversations (user_id, updated_at desc);

create trigger assistant_conversations_set_updated_at
  before update on public.assistant_conversations
  for each row execute function public.set_updated_at();

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null,
  -- [{kind, id, title}] — every published item read while answering, in order.
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.assistant_messages is
  'One turn of an Ask conversation; sources are what the answer was read from (P8-01).';

create index assistant_messages_conversation_idx
  on public.assistant_messages (conversation_id, created_at);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

create policy assistant_conversations_select on public.assistant_conversations
  for select to authenticated using (user_id = auth.uid());

create policy assistant_conversations_delete on public.assistant_conversations
  for delete to authenticated using (user_id = auth.uid());

create policy assistant_messages_select on public.assistant_messages
  for select to authenticated using (
    exists (
      select 1 from public.assistant_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- No insert policies: the function writes both, as the service role.

-- =================================================================== usage ==

create table public.assistant_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  surface text not null check (surface in ('ask', 'channel')),
  conversation_id uuid references public.assistant_conversations on delete set null,
  channel_id uuid references public.channels on delete set null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.assistant_usage is
  'One row per assistant call: who, where, and what it cost. Counted against the daily cap (P8-01).';

create index assistant_usage_user_idx on public.assistant_usage (user_id, created_at desc);
create index assistant_usage_created_idx on public.assistant_usage (created_at desc);

alter table public.assistant_usage enable row level security;

create policy assistant_usage_select on public.assistant_usage
  for select to authenticated using (user_id = auth.uid() or public.is_superadmin());

-- No insert policy: the function records, as the service role.

-- Calls so far today against the cap, for the function (under the caller's
-- JWT, before it spends anything) and for the Ask page's "12 of 50 today".
create function public.assistant_quota()
returns table (used integer, cap integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int
     from public.assistant_usage
     where user_id = auth.uid()
       and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')),
    (select coalesce((value #>> '{}')::int, 50)
     from public.app_settings
     where key = 'assistant_daily_cap');
$$;

comment on function public.assistant_quota() is
  'The caller''s assistant calls today and the cap they count against (P8-01).';

grant execute on function public.assistant_quota() to authenticated;

-- ==================================================================== chat ==

alter table public.messages
  add column from_assistant boolean not null default false;

comment on column public.messages.from_assistant is
  'True for a reply the assistant Edge Function wrote; created_by is null then (P8-01).';

-- A person cannot post as the assistant.
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated with check (
    public.is_channel_member(channel_id) and created_by = auth.uid() and not from_assistant
  );

-- Nor make a message become, or stop being, the assistant's.
create or replace function public.guard_message_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  new.channel_id := old.channel_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.from_assistant := old.from_assistant;

  -- A moderator may delete somebody's message; they may not rewrite it.
  if auth.uid() is distinct from old.created_by then
    new.body := old.body;
    new.mentions := old.mentions;
  elsif new.body is distinct from old.body then
    new.edited_at := now();
  end if;

  if old.deleted_at is not null then
    -- Deleting is final: nothing about a deleted message moves again.
    return old;
  end if;

  if new.deleted_at is not null then
    new.deleted_at := now();
    new.deleted_by := auth.uid();
    new.body := '';
    new.mentions := '{}';
  else
    new.deleted_by := null;
  end if;

  return new;
end;
$$;

-- An assistant reply is nobody's message: it names nobody and, in a DM, it
-- answers the person who is already looking at it. It raises nothing —
-- rather than a notification titled by an author it does not have.
create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  channel public.channels;
  author text := public.chat_author_name(new.created_by);
  -- The body is the author's own words, in whatever language they wrote them,
  -- trimmed to something an inbox row and a push notification can hold.
  preview text := left(new.body, 140);
begin
  if new.from_assistant then
    return null;
  end if;

  select * into channel from public.channels c where c.id = new.channel_id;

  if channel.kind = 'dm' then
    perform public.raise_notification(
      array(select public.chat_audience(new.channel_id, new.created_by)),
      'chat_dm',
      author,
      preview,
      '/chat/' || new.channel_id,
      null,
      new.channel_id,
      false,
      jsonb_build_object('channel_id', new.channel_id),
      interval '5 minutes'
    );
  else
    perform public.raise_notification(
      array(
        select m.user_id
        from public.chat_audience(new.channel_id, new.created_by) m(user_id)
        where m.user_id = any (new.mentions)
      ),
      'chat_mention',
      author || ' — ' || coalesce(channel.name, ''),
      preview,
      '/chat/' || new.channel_id,
      channel.gym_id,
      new.channel_id,
      false,
      jsonb_build_object('channel_id', new.channel_id)
    );
  end if;

  return null;
end;
$$;
