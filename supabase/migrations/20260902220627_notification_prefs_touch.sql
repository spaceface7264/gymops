-- P5-01 fix, found in P5-05 while switching push back on in Chrome.
--
-- `set_updated_at()` stamps `updated_at` *and* `updated_by`, because every
-- table that had it until now is a record of who changed something. A
-- preferences row is not: it is always its own owner who edits it, so
-- `notification_prefs` has no `updated_by` — and the trigger then failed every
-- UPDATE with `record "new" has no field "updated_by"` (42703). The insert
-- worked, which is why switching a channel *off* looked fine and switching it
-- back on did not.
--
-- Tested by supabase/tests/140-notification-permissions.test.sql.

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.touch_updated_at() is
  'set_updated_at() without the author, for tables whose editor is always their owner.';

drop trigger notification_prefs_set_updated_at on public.notification_prefs;

create trigger notification_prefs_set_updated_at before update
  on public.notification_prefs
  for each row execute function public.touch_updated_at();
