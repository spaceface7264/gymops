-- P4-04 — live sync for the checklist run screen.
--
-- Two people work a closing shift from different ends of the gym; a tick has
-- to show up on the other phone without a reload. Realtime carries
-- `checklist_run_items` changes over a private channel per gym
-- (`checklists:<gym id>`, or `checklists:all` for an admin looking at every
-- gym), and RLS decides per subscriber which rows they actually receive.
--
-- Tested by supabase/tests/090-checklist-realtime.test.sql.

alter publication supabase_realtime add table public.checklist_run_items;

-- Who may join a checklist channel. Named rather than inlined in the policy so
-- the rule can be tested directly, the way the other permission helpers are.
create function public.can_listen_to_checklists(topic text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    -- The "all gyms" scope in the gym switcher is admins only.
    when topic = 'checklists:all' then public.is_admin()
    when topic ~ '^checklists:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_read_content(substring(topic from 12)::uuid)
    else false
  end;
$$;

grant execute on function public.can_listen_to_checklists(text) to authenticated;

-- `realtime.messages` carries every private channel; with RLS on and no policy
-- (the state Supabase ships), joining one is refused outright.
create policy checklists_realtime_listen on realtime.messages
  for select to authenticated
  using (public.can_listen_to_checklists(realtime.topic()));
