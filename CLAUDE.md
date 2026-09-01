# GymOps

Internal operations app for a multi-gym bouldering chain. Read these before working:

- `PROJECT_SPEC.md` — requirements, architecture, rejected options, conventions (§5 is binding).
- `PROJECT_TASKS.md` — task graph with IDs and dependencies. Reference task IDs in commits.
- `PROJECT_STATE.md` — what is done and in progress. Update it when you start or finish a task.

Key rules: schema changes only via `supabase/migrations`; every table has RLS with pgTAP tests; no hard-coded UI strings (en + da); components never call Supabase directly (use feature `queries.ts` hooks); Claude API code uses `@anthropic-ai/sdk` with `claude-opus-5`.
