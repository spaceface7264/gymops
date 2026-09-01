# GymOps — Project State

Last updated: 2026-09-01

## Currently working on

**P1-01 to P1-05 done** on branch `phase-1-scaffold`. Next up: **P1-06** (Supabase client, auth provider, protected routes) and **P1-09** (seed data), both unblocked.

## Phase status

| Phase                    | Status         | Notes                                           |
| ------------------------ | -------------- | ----------------------------------------------- |
| Design                   | ✅ Complete    | Approved 2026-09-01. Spec in `PROJECT_SPEC.md`. |
| P1 Scaffold and auth | 🔄 In progress | P1-01 to P1-05 done. |
| P2 Users and gyms admin  | ⬜ Not started |                                                 |
| P3 News and guides       | ⬜ Not started |                                                 |
| P4 Daily ops             | ⬜ Not started |                                                 |
| P5 Notifications and PWA | ⬜ Not started |                                                 |
| P6 Team chat             | ⬜ Not started |                                                 |
| P7 Desktop and release   | ⬜ Not started |                                                 |
| P8 AI assistant (V1.5)   | ⬜ Not started | Needs Anthropic API key in Supabase secrets.    |

## Task status

Update this list as work begins:

| Task | Status | Started | Done | Notes |
| --- | --- | --- | --- | --- |
| P1-01 | ✅ done | 2026-09-01 | 2026-09-01 | Vite 8 + React 19 + TS 6, Tailwind v4, shadcn/ui, React Router 7, TanStack Query 5, ESLint 10 + Prettier, Vitest 4 + RTL. Branch `phase-1-scaffold`. |
| P1-02 | ✅ done | 2026-09-01 | 2026-09-01 | `supabase init`, invite-only auth config, 3 storage buckets, pgTAP harness (5/5 pass), `db:*` npm scripts, generated `database.types.ts`. |
| P1-03 | ✅ done | 2026-09-01 | 2026-09-01 | react-i18next with bundled `en`/`da` `common` namespaces, localStorage + navigator detection, typed `t()` keys, key-parity test as the missing-key gate. |
| P1-04 | ✅ done | 2026-09-01 | 2026-09-01 | `gyms`, `profiles`, `gym_memberships`, `invites`, `audit_log`; helpers `is_superadmin()`, `is_admin()`, `member_gym_ids()`, `managed_gym_ids()`; RLS on all five; `handle_new_user` and privilege-guard triggers. Migration `20260901194004_core_schema.sql`. |
| P1-05 | ✅ done | 2026-09-01 | 2026-09-01 | `supabase/tests/010-core-permissions.test.sql` — 33 assertions covering the §2.1 matrix for the core tables. 38/38 pass with the harness. |
| P1-06 … P8-06 | ⬜ not started | | | |

Status values: ⬜ not started · 🔄 in progress · ✅ done · ⏸ blocked

## Blockers and external dependencies

| Item                                                        | Needed for                           | Owner                      | Status               |
| ----------------------------------------------------------- | ------------------------------------ | -------------------------- | -------------------- |
| Supabase project (hosted) | first deploy after P1 | Rami | `.env.local` already points at project `ngcqpftfqepvhpjikaqq` — confirm it is the GymOps one |
| Resend account + API key                                    | P5-03                                | Rami                       | not created          |
| VAPID key pair                                              | P5-03                                | generated during P5-03     | —                    |
| Anthropic API key                                           | P8-03                                | Rami                       | not created          |
| Apple Developer ID + Windows signing cert                   | first public desktop release (P7-04) | Rami                       | not started          |
| BRP Systems API key, service account, rate limits, webhooks | V3                                   | Rami → BRP account manager | not requested        |
| Final product name                                          | before public release                | Rami                       | placeholder `gymops` |

## Decisions log

| Date       | Decision                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------- |
| 2026-09-01 | Single React app + Supabase, Tauri 2 desktop, PWA for phones.                                       |
| 2026-09-01 | Team chat ships in V1; AI assistant in V1.5; tasks/calendar V2; reports/BRP V3.                     |
| 2026-09-01 | Assistant uses Claude Opus 5 via Edge Function with full-text search tools, no embeddings pipeline. |
| 2026-09-01 | P1-01: kept ESLint + Prettier as specced rather than the oxlint the current Vite template ships; typed linting scoped to `.ts`/`.tsx`. Design docs are in `.prettierignore`. |
| 2026-09-01 | P1-02: OrbStack is the container runtime for the local Supabase stack (lighter than Docker Desktop; any Docker-compatible runtime works). |
| 2026-09-01 | P1-02: pgTAP and the `tests` schema helpers live in `supabase/seeds/test-helpers.sql`, loaded by `db reset`. Not a migration, so they never reach a deployed database; not under `supabase/tests/`, because `supabase test db` treats every `.sql` there as a test. |
| 2026-09-01 | P1-01: kept ESLint + Prettier as specced rather than the oxlint the current Vite template ships. Typed linting (`recommendedTypeChecked`) is scoped to `.ts`/`.tsx`. |
| 2026-09-01 | P1-04: `is_admin()` is true for superadmins as well; `is_superadmin()` guards only gym management, admin promotion and the audit log. |
| 2026-09-01 | P1-04: privileged `profiles` columns (`is_admin`, `is_superadmin`, `active`) are protected by a `before update` trigger, not by RLS, which cannot restrict columns. The trigger only applies to `authenticated` sessions, so seeds and service-role calls behave as they do under RLS. |
| 2026-09-01 | P1-04: `invites` stores no token — Supabase Auth's `inviteUserByEmail` owns it; the row records target gym, role, admin flag and status. |
| 2026-09-01 | P1-04: `profiles` is readable by yourself, admins and the managers of your gyms. Staff-to-staff visibility waits for chat (P6). |
| 2026-09-01 | P1-03: locale resources are bundled, not fetched; the missing-key gate is a key-parity Vitest test plus typed `t()` keys (`src/types/i18next.d.ts`) rather than a separate CI script. |

## How to update this file

- When starting a task: add a row to Task status with 🔄 and the date, and set "Currently working on".
- When finishing: mark ✅, add the commit hash in Notes, update the Phase status when all its tasks are done.
- Record any new decision or rejected option here and in `PROJECT_SPEC.md` §4.
