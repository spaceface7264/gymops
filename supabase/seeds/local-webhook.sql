-- Local-only wiring for the P5-03 database webhook.
--
-- `dispatch_notification()` reads its target and its key from Vault and does
-- nothing when either is missing, so this file is what turns the fan-out on for
-- the local stack. It is a seed, not a migration: the values below are this
-- machine's, and the hosted project gets its own during the cutover.
--
-- The key is the local stack's demo service role key — the same one
-- `supabase status` prints for every Supabase installation on earth.
select vault.create_secret(
  'http://host.docker.internal:54321/functions/v1',
  'notify_functions_url',
  'P5-03: where the notify function lives, read by dispatch_notification()'
);

select vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  'notify_service_key',
  'P5-03: local demo service role key, posted as the webhook Authorization header'
);
