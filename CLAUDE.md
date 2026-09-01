# GymOps

Internal operations app for a multi-gym bouldering chain. Read these before working:

- `PROJECT_SPEC.md` — requirements, architecture, rejected options, conventions (§5 is binding).
- `PROJECT_TASKS.md` — task graph with IDs and dependencies. Reference task IDs in commits.
- `PROJECT_STATE.md` — what is done and in progress. Update it when you start or finish a task.

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

Seed users (local only, from `supabase/seed.sql`): `super@`, `admin@`, `manager@`, `staff@` `gymops.test`, all with password `Password123`; gyms Copenhagen Nord, Aarhus C, Odense.
