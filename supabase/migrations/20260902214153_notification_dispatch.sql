-- P5-03 — the database webhook that hands a new notification to `notify`.
--
-- Spec §3: "Database webhooks trigger `notify` on `notifications` insert." The
-- post is made by pg_net, which queues the request and returns immediately, so
-- reporting an incident is never slowed down — or rolled back — by a push
-- service being unreachable.
--
-- The URL and the key it posts with are read from Vault at call time, not
-- written into this migration: a migration is in git, and one of them is the
-- service role key. Both are absent by default, which makes the trigger a
-- no-op — the state every environment starts in, CI included.
--
-- Tested by supabase/tests/160-notification-dispatch.test.sql.

create extension if not exists pg_net;

create function public.dispatch_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  service_key text;
begin
  select decrypted_secret into functions_url
  from vault.decrypted_secrets where name = 'notify_functions_url';

  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'notify_service_key';

  -- Not configured: the inbox still works, and nothing is pushed or emailed.
  if functions_url is null or service_key is null then
    return null;
  end if;

  perform net.http_post(
    url := functions_url || '/notify',
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    timeout_milliseconds := 5000
  );

  return null;
end;
$$;

comment on function public.dispatch_notification() is
  'P5-03: posts a new notification to the notify function through pg_net. No-op until the Vault secrets are set.';

create trigger notifications_dispatch after insert on public.notifications
  for each row execute function public.dispatch_notification();
