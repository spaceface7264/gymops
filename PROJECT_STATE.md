# GymOps — Project State

Last updated: 2026-09-01

## Currently working on

**Phase 1 is done** on branch `phase-1-scaffold` — P1-10 added `.github/workflows/ci.yml`. Next up: **phase 2**, and P2-03 is where the hosted project is needed; see "Hosted project cutover".

The repo has no git remote yet, so CI has never actually run on GitHub: the workflow is verified only by running the same commands locally. Push the branch and check the first run.

## Phase status

| Phase                    | Status         | Notes                                           |
| ------------------------ | -------------- | ----------------------------------------------- |
| Design                   | ✅ Complete    | Approved 2026-09-01. Spec in `PROJECT_SPEC.md`. |
| P1 Scaffold and auth | ✅ Complete | P1-01 to P1-10 done on `phase-1-scaffold`. |
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
| P1-06 | ✅ done | 2026-09-01 | 2026-09-01 | `src/lib/supabase.ts` (typed, PKCE), `src/features/auth` (provider, `useAuth`, `RequireAuth`, `useProfile`/`useSignIn`/`useSignOut`), all routes below `/` guarded. Provisional login screen until P1-07. 19 unit tests; sign-in verified end to end in a headless browser. |
| P1-07 | ✅ done | 2026-09-01 | 2026-09-01 | `AuthLayout` plus the sign-in, forgot-password, reset-password and accept-invite screens; hooks `useRequestPasswordReset`, `useSetPassword`, `useCompleteInvite`; shared `PasswordFields` + `checkPassword` mirroring the server policy. 30 unit tests; both flows driven end to end in Chrome against the local stack (Mailpit → link → session → password → sign-in), which is how the implicit-invite bug surfaced. |
| P1-09 | ✅ done | 2026-09-01 | 2026-09-01 | `supabase/seed.sql`: 3 gyms, one user per role (`<role>@gymops.test` / `Password123`, raised from `password123` in P1-07 to satisfy the password policy), memberships. Password sign-in and per-role RLS verified through the local API. |
| P1-08 | ✅ done | 2026-09-01 | 2026-09-01 | `AppShell` (sidebar from `md`, bottom tab bar on phones), nav from `src/routes/nav.ts` with placeholders for unbuilt modules, `src/features/gyms` (provider, `useGymScope`, switcher, `useGyms`), `useLocaleSync`, sign out. 15 tests; checked in Chrome as manager and admin, desktop and phone width. |
| P1-10 | ✅ done | 2026-09-01 | 2026-09-01 | `.github/workflows/ci.yml`: job `web` (typecheck, lint, format:check, test, build on Node 20) and job `database` (pinned Supabase CLI, `supabase start -x` the services the tests do not need, `db reset`, `test db`). Both sequences verified locally; never run on GitHub — the repo has no remote. |
| P2-01 … P8-06 | ⬜ not started | | | |

Status values: ⬜ not started · 🔄 in progress · ✅ done · ⏸ blocked

## Blockers and external dependencies

| Item                                                        | Needed for                           | Owner                      | Status               |
| ----------------------------------------------------------- | ------------------------------------ | -------------------------- | -------------------- |
| Supabase project (hosted) | P2-03 (`invite` Edge Function) | Rami | `.env.local` points at the local stack since P1-02; the hosted `ngcqpftfqepvhpjikaqq` values sit commented out beneath it. Confirm that ref is the GymOps project — the Supabase MCP connection currently points at a different project (`ooikemajridlhceejgmo`), which times out. Steps in "Hosted project cutover" below. |
| GitHub repository (remote) | P1-10 CI actually running | Rami | `.github/workflows/ci.yml` exists and its steps pass locally, but the repo has no remote, so no run has happened. Add the remote, push `phase-1-scaffold`, confirm both jobs go green. |
| Resend account + API key | P2-03 (real invite mail), P5-03 | Rami | not created. `[auth.rate_limit] email_sent = 2` per hour and hosted Supabase's built-in SMTP are both far below what inviting 200+ staff needs, so a provider must exist before invites go out for real. |
| VAPID key pair                                              | P5-03                                | generated during P5-03     | —                    |
| Anthropic API key                                           | P8-03                                | Rami                       | not created          |
| Apple Developer ID + Windows signing cert                   | first public desktop release (P7-04) | Rami                       | not started          |
| BRP Systems API key, service account, rate limits, webhooks | V3                                   | Rami → BRP account manager | not requested        |
| Final product name                                          | before public release                | Rami                       | placeholder `gymops` |

## Hosted project cutover

Everything through P1-10 runs on the local stack: CI is `supabase db reset` + pgTAP, and
`supabase/seeds/` never reaches a deployed database. The first task that cannot be finished
locally is **P2-03** (the `invite` Edge Function needs to be deployed and to send real mail);
after that come P4-02 (pg_cron), P5-03 (`notify`, database webhook, Resend, VAPID), P5-05
(web push needs HTTPS and a real origin), P7-02 (`gymops://` plus a web fallback page) and
P8-03 (assistant, `ANTHROPIC_API_KEY`). Work through this list once, at P2-03.

**Before touching anything**

- [ ] Confirm which hosted project is GymOps. `.env.local` carries `ngcqpftfqepvhpjikaqq`
      commented out; the Supabase MCP connection points at `ooikemajridlhceejgmo` and times
      out. One of them is right, possibly neither.
- [ ] Confirm the project runs Postgres 17 (`db.major_version = 17` locally). A mismatch
      changes what migrations are allowed to assume.
- [ ] Create the Resend account and get the API key.

**Schema and code**

- [ ] `supabase link --project-ref <ref>`, then `supabase db push`. Never `db reset` against
      hosted, and never let `supabase/seed.sql` or `supabase/seeds/` near it: they contain
      pgTAP helpers and four users with a published password.
- [ ] Enable **pg_cron** (P4-02) and confirm `pg_graphql`/`pgcrypto` availability.
- [ ] Create the three private buckets — `content`, `incidents`, `chat`, all
      `public = false`, 50 MiB — and apply the storage RLS policies from migrations.
- [ ] Regenerate `src/lib/database.types.ts` and check it matches; `db:types` is pinned to
      `--local`, so a hosted-only drift would go unnoticed.

**Auth settings to mirror from `supabase/config.toml`** (the dashboard is a separate source
of truth; nothing in config.toml applies to a hosted project)

- [ ] Sign-ups **off** (`[auth] enable_signup = false`) — invite-only.
- [ ] Email provider **on** (`[auth.email] enable_signup = true`). Turning this off kills
      password login; it cost a debugging session in P1-09.
- [ ] `minimum_password_length = 10` and `lower_upper_letters_digits`. `checkPassword()` in
      `src/features/auth/password.ts` mirrors these — a mismatch means users see GoTrue's
      untranslated error instead of ours.
- [ ] Site URL = the deployed web origin, and the redirect allow-list must include
      `/auth/callback`, `/reset-password`, `/accept-invite` and `gymops://auth/callback`.
- [ ] Raise `email_sent` well above 2/hour; keep anonymous sign-ins, manual linking, MFA and
      every external provider off.
- [ ] Point SMTP at Resend and set the sender name and admin address.

**Secrets** (Supabase secrets and GitHub Actions secrets only, per spec §5)

- [ ] Service-role key for the `invite` function (P2-03).
- [ ] `RESEND_API_KEY` and the VAPID key pair (P5-03), plus the database webhook on
      `notifications` insert → `notify`.
- [ ] `ANTHROPIC_API_KEY` (P8-03).

**First user**

- [ ] Seeds never run against hosted, so create the first superadmin deliberately — invite
      or an explicit SQL insert — and verify sign-in, password recovery and invite accept
      against the hosted project before relying on it.

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
| 2026-09-01 | P1-06: the session lives in `AuthProvider` (React context fed by `onAuthStateChange`), not in the query cache; PKCE is on for the desktop deep-link flow. `RequireAuth` renders nothing while the session is restoring, so a refresh does not bounce a signed-in user to `/login`. |
| 2026-09-01 | P1-06: `profiles.locale` → i18next syncing moved to P1-08, where the app shell reads the profile. |
| 2026-09-01 | P1-09: `[auth.email] enable_signup` set back to `true` — it is the email provider switch, and P1-02 had turned it off, which disabled password logins. Invite-only stays enforced by `[auth] enable_signup = false`. |
| 2026-09-01 | P1-03: locale resources are bundled, not fetched; the missing-key gate is a key-parity Vitest test plus typed `t()` keys (`src/types/i18next.d.ts`) rather than a separate CI script. |
| 2026-09-01 | P1-07: `checkPassword()` mirrors `minimum_password_length = 10` and `password_requirements` from `supabase/config.toml`, so a weak password is refused with a translated message instead of GoTrue's English one. |
| 2026-09-01 | P1-07: the seed password became `Password123` — `password123` fails the configured policy and cannot be set through the API or the UI at all. |
| 2026-09-01 | P1-07: recovery links are PKCE (`?code=`) and the client exchanges them itself; admin-issued invite links are implicit (`#access_token=`), which auth-js refuses to read under `flowType: 'pkce'`. `useUrlSession` adopts the fragment with `setSession` and strips it from the URL, so the tokens never enter browser history. Both screens treat `signedOut` (or an `error_code` in the link) as expired. |
| 2026-09-01 | P1-07: the accept-invite screen writes only password, name and locale. Gym membership and the admin flag come from the `invites` row and are applied by the `invite` Edge Function (P2-03). |
| 2026-09-01 | P1-07: forgot-password shows the same confirmation whether or not the address has an account, so the screen cannot enumerate staff. |
| 2026-09-01 | P1-07: `additional_redirect_urls` gained `/reset-password` and `/accept-invite`; the same paths must be added to the hosted project's redirect allow-list before the first deploy. |
| 2026-09-01 | P1-08: sign out shipped ahead of the rest of the shell. The screens run on machines shared between shifts, and P1-07 showed what a stale session costs: an invite link opened in a browser that still held someone else's session acted as that person. |
| 2026-09-01 | Development stays on the local stack until P2-03. CI (P1-10) runs `supabase db reset` + pgTAP locally, and no task before the `invite` Edge Function needs a deployed project; the cutover steps live in "Hosted project cutover" above so they are not re-derived under pressure. || 2026-09-01 | P1-08: the nav is data (`src/routes/nav.ts`) and the router builds placeholder routes from the same list, so a phase cannot add a page without adding its nav entry. |
| 2026-09-01 | P1-08: the selected gym lives in `GymProvider`, stored per device under `gymops.gym` and always validated against what the signed-in user may see; `null` means "all gyms" and is offered to admins and superadmins only. A staff member with one gym sees its name, not a dead dropdown. |
| 2026-09-01 | P1-10: CI is two jobs — the web gates and the database — so they run in parallel and the job name says which half broke. The database job starts the stack with `-x` and keeps only postgres, gotrue (the seed writes `auth.users`) and storage-api (`db reset` creates the buckets); the Supabase CLI version is pinned. |
| 2026-09-01 | P1-08: `profiles.locale` overrides the browser language once the profile loads (`useLocaleSync`), which is where P1-06 said this belonged. The signed-out screens keep detecting from the browser. |

## How to update this file

- When starting a task: add a row to Task status with 🔄 and the date, and set "Currently working on".
- When finishing: mark ✅, add the commit hash in Notes, update the Phase status when all its tasks are done.
- Record any new decision or rejected option here and in `PROJECT_SPEC.md` §4.
