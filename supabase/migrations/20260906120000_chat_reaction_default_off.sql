-- P7M-04 — a reaction tells the line's author only if they asked for it.
--
-- P6C-18 made every reaction an inbox row and the first day of use showed the
-- inbox was mostly reactions, which is the opposite of "quiet unless it
-- matters". The trigger stays; the default flips. A missing `notification_prefs`
-- row still means every channel on for every other type, and `chat_reaction`
-- is the one type whose missing row means off. Anybody who wants them turns
-- the type on under Notification preferences, which writes the row.

create or replace function public.notification_pref(
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
    coalesce(p.in_app, target_type <> 'chat_reaction'),
    coalesce(p.email, target_type <> 'chat_reaction'),
    coalesce(p.push, target_type <> 'chat_reaction')
  from (select 1) one
  left join public.notification_prefs p
    on p.user_id = target_user and p.type = target_type;
$$;

comment on function public.notification_pref(uuid, public.notification_type) is
  'Effective channel switches for one person and one type. Missing row = all on, except chat_reaction, which is opt-in.';
