# GymOps

Internal operations app for a multi-gym bouldering chain. Read these before working:

- `PROJECT_SPEC.md` — requirements, architecture, rejected options, conventions (§5 is binding).
- `PROJECT_TASKS.md` — task graph with IDs and dependencies. Reference task IDs in commits.
- `PROJECT_STATE.md` — what is done and in progress. Update it when you start or finish a task. Its "Hosted project cutover" section holds the steps for moving off the local stack, which happens at P2-03 and not before.

Key rules: schema changes only via `supabase/migrations`; every table has RLS with pgTAP tests; no hard-coded UI strings (en + da); components never call Supabase directly (use feature `queries.ts` hooks); Claude API code uses `@anthropic-ai/sdk` with `claude-opus-5`.

## Local development

Requires a Docker-compatible container runtime (OrbStack installed 2026-09-01) for the Supabase stack.

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run db:start` / `db:stop` | local Supabase stack |
| `npm run db:reset` | re-apply migrations + seeds (also installs the pgTAP helpers) |
| `npm run db:test` | pgTAP RLS tests — run `db:reset` first |
| `npm run db:migration <name>` | new migration file |
| `npm run db:types` | regenerate `src/lib/database.types.ts` (commit it) |
| `npm run typecheck lint format:check test build` | the gates CI runs |

The notification fan-out (P5-03) runs as an Edge Function with secrets the
stack's own runtime does not have: serve it with
`npx supabase functions serve --env-file supabase/functions/.env` (that file is
local-only and gitignored; it holds a development VAPID pair). The webhook that
calls it reads `notify_functions_url` and `notify_service_key` from Vault, set
locally by `supabase/seeds/local-webhook.sql`; with either missing the inbox
still fills and nothing is pushed or emailed.

Realtime features (checklist live sync, later chat and notifications) need the
realtime container, which a stack started with `supabase start -x …` does not
have — `supabase stop && supabase start` brings the full stack back. Node 20 has
no native WebSocket, so a script that drives a Realtime client needs Node 22+.

CI is `.github/workflows/ci.yml`: a `web` job running those gates on Node 20, and a `database` job that starts the local stack (minus the services the tests do not need) and runs `db reset` + `test db`.

Seed users (local only, from `supabase/seed.sql`): `super@`, `admin@`, `manager@`, `staff@` `gymops.test`, all with password `Password123`; gyms Copenhagen Nord, Aarhus C, Odense.
