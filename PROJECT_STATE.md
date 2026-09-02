# GymOps — Project State

Last updated: 2026-09-02

## Currently working on

**Phase 3, news and guides** (P3-01 … P3-07) is in progress on branch
`phase-3-content`, branched off `phase-2-admin` because `main` does not yet
carry phases 1 and 2. It needs no hosted project. Phase 2 is done; the `invite`
function (P2-03) has never been deployed, and doing so — with a Resend account
behind it — is the first item of "Hosted project cutover".

The repo has no git remote yet, so CI has never actually run on GitHub: the workflow is verified only by running the same commands locally. Push the branch and check the first run.

## Phase status

| Phase                    | Status         | Notes                                           |
| ------------------------ | -------------- | ----------------------------------------------- |
| Design                   | ✅ Complete    | Approved 2026-09-01. Spec in `PROJECT_SPEC.md`. |
| P1 Scaffold and auth | ✅ Complete | P1-01 to P1-10 done on `phase-1-scaffold`. |
| P2 Users and gyms admin  | ✅ Complete    | P2-01 to P2-06 done on `phase-2-admin`.         |
| P3 News and guides       | 🔄 In progress | `phase-3-content`. P3-01 … P3-06 done.          |
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
| P2-06 | ✅ done | 2026-09-01 | 2026-09-01 | `20260901210000_audit_role_changes.sql`: security-definer triggers writing `profile.privileges_changed` and `membership.granted`/`role_changed`/`revoked` to `audit_log`. `supabase/tests/020-audit-role-changes.test.sql` — 13 assertions; 51/51 pass with the harness. Commit `fe453af`. |
| P2-01 | ✅ done | 2026-09-01 | 2026-09-01 | `src/features/admin` (queries, `GymsPanel`, `GymDialog`, `toSlug`) and `src/routes/admin-page.tsx` (`AdminPage` layout + `RequireSuperadmin`); `/admin` redirects to the first section the user may see. shadcn `table`, `badge`, `dialog` added. 75 unit tests; create/edit/deactivate driven in Chrome as a superadmin. Commit `a3d78a1`. |
| P2-02 | ✅ done | 2026-09-01 | 2026-09-01 | `UsersPanel` at `/admin/users` (now the section `/admin` redirects to): role badges, active/inactive, deactivate for admins only, filtered by the shell's gym switcher. The nav's Admin entry is now shown to managers too — they administer their own gyms' staff. 83 unit tests; checked in Chrome as a superadmin (all gyms and one gym) and as a manager (own gyms only, no deactivate, `/admin/gyms` bounces home). |
| P2-05 | ✅ done | 2026-09-01 | 2026-09-01 | `RolesDialog` from the user list (gym roles for admins, staff-in-own-gyms for managers, the admin flag for superadmins) and `AuditPanel` at `/admin/audit`, superadmin-only. Membership writes are upserts, so the P2-06 trigger records grant vs role change. 90 unit tests; role changes and the resulting log entries checked in Chrome as a superadmin. |
| P2-03 | ✅ done | 2026-09-02 | 2026-09-02 | `supabase/functions/invite`: checks the caller against the §2.1 matrix, records the `invites` row, calls `inviteUserByEmail`, then applies the membership or admin flag with the service role. Migration `20260901220000_invite_acceptance.sql` closes the pending invite on first sign-in (4 pgTAP assertions, 55/55 pass). The accept screen now offers the name the inviter typed. Verified locally end to end: mail in Mailpit → link → password → session → membership → invite accepted, plus the whole permission matrix by HTTP (201/403/409/400/401). **Not deployed** — hosted cutover pending. |
| P2-04 | ✅ done | 2026-09-02 | 2026-09-02 | `InviteDialog` on the user list: role and gym limited to what the inviter may hand out (staff-in-own-gyms for a manager, the company-wide admin only for a superadmin), defaulting to the gym in the switcher. The function's refusals are shown as translated messages. 96 unit tests; a manager invited two people in Chrome, and the "already a user" refusal was checked in the dialog. |
| P3-02 | ✅ done | 2026-09-02 | 2026-09-02 | `20260902090000_content_schema.sql`: `posts`, `post_reads`, `guide_categories`, `guides`, `guide_acks`; generated `body_text` and weighted `search_vector` columns from `tiptap_text()`; `can_publish_content()`/`can_read_content()` carry the §2.1 content rows; publishing stamps `published_at`; no delete policy anywhere (soft delete). `supabase/tests/040-content-permissions.test.sql` — 44 assertions, 99/99 pass with the harness. |
| P3-01 | ✅ done | 2026-09-02 | 2026-09-02 | `src/features/content`: `RichTextEditor` (bold, italic, H2, lists, link bar, image upload) and `RichText`, both on one Tiptap schema; `doc.ts` helpers (`toDoc`, `docText`, `excerpt`, `contentImagePath`). Images are uploaded to `content/<gym id or company>/<uuid>.<ext>` and the document keeps the **object path**, signed at render by `useSignedContentUrl`. Migration `20260902100000_content_storage.sql` mirrors the table rules onto `storage.objects` via `content_object_gym()`; `supabase/tests/050-content-storage.test.sql` — 11 assertions, 110/110 pass. 107 unit tests. |
| P3-03 | ✅ done | 2026-09-02 | 2026-09-02 | `src/features/news`: feed (pinned first, drafts labelled, excerpt, pin from the list), post detail (edit, pin, publish/unpublish, delete behind a dialog) and the editor page at `/news/new` and `/news/:postId/edit`. `usePublishScope()` in `features/content` is the UI half of `can_publish_content()`. News lost its nav placeholder. 121 unit tests; driven in Chrome as a manager (draft → image upload → publish, image signed and rendered) and as staff (another gym's post invisible, no editing controls). |
| P3-04 | ✅ done | 2026-09-02 | 2026-09-02 | `acknowledgement.tsx` (button + per-gym report) and `use-track-post-read.ts`: opening a published post writes `post_reads` once (`ignoreDuplicates`), the button upserts `acknowledged_at`, and the report lists the audience with the people who have not confirmed first — `gym_memberships` RLS narrows a manager's report to their own gyms without asking for a gym. The reminder itself is P5-02's `ack reminder` trigger. 128 unit tests; the manager/staff report and refusal paths checked against the local API by HTTP. |
| P3-05 | ✅ done | 2026-09-02 | 2026-09-02 | `src/features/guides`: `/guides` (one tree mixing company and gym categories, guides filtered by the selected branch), the viewer, the editor at `/guides/new` and `/guides/:guideId/edit`, and category create/rename/delete. `guides.version` is bumped only when the author ticks "significant change", and `guide_acks` stores the confirmed version, so a reader who is behind is asked again. Guides lost their nav placeholder. 140 unit tests; the tree, the confirmation and the re-confirmation after a version bump driven in Chrome as staff. |
| P3-06 | ✅ done | 2026-09-02 | 2026-09-02 | `features/content/search.ts` + `ContentSearch`: one debounced search over both `posts` and `guides` using `websearch_to_tsquery` on the `simple` configuration, with a snippet cut around the first matching word and hits labelled news/guide, scope and draft. The box sits on `/news` and `/guides`. 145 unit tests; a Danish word matched through RLS by HTTP, and another gym's post did not. |
| P3-07, P4-01 … P8-06 | ⬜ not started | | | |

Status values: ⬜ not started · 🔄 in progress · ✅ done · ⏸ blocked

## Blockers and external dependencies

| Item                                                        | Needed for                           | Owner                      | Status               |
| ----------------------------------------------------------- | ------------------------------------ | -------------------------- | -------------------- |
| Supabase project (hosted) | deploying `invite` (P2-03, written and working locally) | Rami | `.env.local` points at the local stack since P1-02; the hosted `ngcqpftfqepvhpjikaqq` values sit commented out beneath it. Confirm that ref is the GymOps project — the Supabase MCP connection currently points at a different project (`ooikemajridlhceejgmo`), which times out. Steps in "Hosted project cutover" below. |
| GitHub repository (remote) | P1-10 CI actually running | Rami | `.github/workflows/ci.yml` exists and its steps pass locally, but the repo has no remote, so no run has happened. Add the remote, push `phase-1-scaffold` and `phase-2-admin`, confirm both jobs go green. |
| Resend account + API key | real invite mail (P2-03), P5-03 | Rami | not created. `[auth.rate_limit] email_sent = 2` per hour and hosted Supabase's built-in SMTP are both far below what inviting 200+ staff needs, so a provider must exist before invites go out for real. |
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
| 2026-09-01 | P2-06: the audit triggers are security definer and `audit_log` keeps no insert policy, so a client can neither forge an entry nor read one unless it is a superadmin. Membership updates that leave `role` alone write nothing, so the log stays a role history rather than a row-touch log. |
| 2026-09-01 | P2-01: the admin module is one route with a section per task (`/admin/gyms` first), not one nav entry per admin screen — the shell's nav is for the modules staff use during a shift. `/admin` redirects to the first section the signed-in user may open. |
| 2026-09-01 | P2-01: the time-zone field is a native select over `Intl.supportedValuesOf('timeZone')`. A hand-curated Danish list would be shorter, but P4-02 generates checklist runs at 03:00 gym-local and a gym abroad must not need a migration. |
| 2026-09-01 | P2-01: `toSlug` maps æ/ø/å to ae/oe/aa before stripping accents. NFD does not decompose them, so the ASCII filter silently ate them and "Aalborg Øst" became `aalborg-st` — found by driving the real browser, not by the unit tests. |
| 2026-09-01 | P2-02: the shell's gym switcher is the user list's filter rather than a second gym control on the page. Selecting a gym joins `gym_memberships` inner, so the list answers "who works here" and drops the admins, who hold no membership anywhere; "all gyms" lists everyone the viewer may see. |
| 2026-09-01 | P2-02: the Admin nav entry is shown to managers, not only admins — a manager invites and lists their own gyms' staff (spec §2.1). Deactivating stays admin-only, matching `guard_profile_privileges`, and nobody can deactivate themselves. |
| 2026-09-01 | P2-05: role editing is one dialog per user listing the gyms the *actor* may assign — every gym for an admin, the managed ones for a manager — rather than a separate screen per membership. Each change is its own write, so the audit trail is one row per decision. |
| 2026-09-01 | P2-05: the audit view resolves actor names from the user list rather than a join: `audit_log.actor_id` points at `auth.users`, which PostgREST cannot embed, and a superadmin can already read every profile. |
| 2026-09-02 | P2-03: `inviteUserByEmail` creates the account at invite time, so the function applies the gym membership (or the admin flag) immediately rather than waiting for acceptance. The accept screen stays about the password, as P1-07 decided, and "accepted" is defined as the first sign-in — a trigger on `auth.users` closes the pending row, which is what frees the address for a new invite. |
| 2026-09-02 | P2-03: the function authorises from the caller's own profile read with the service role, and never trusts the request body for anything but the target. A manager may only create staff in a gym they manage; only a superadmin may invite an admin. RLS on `invites` says the same thing, so a client that skips the function gains nothing. |
| 2026-09-02 | P2-03: `supabase/functions` is excluded from ESLint — it is Deno, with its own imports — and type-checked by the Supabase CLI instead. |
| 2026-09-02 | P2-04: the dialog offers only the choices the inviter may make, and the Edge Function checks the same rules again — the UI is a convenience, the function is the gate. Its refusal codes (`forbidden`, `already_a_user`) are translated; anything else is "try again". |
| 2026-09-01 | P1-08: `profiles.locale` overrides the browser language once the profile loads (`useLocaleSync`), which is where P1-06 said this belonged. The signed-out screens keep detecting from the browser. |

| 2026-09-02 | P3-02: content search is `to_tsvector('simple', …)`, not the Danish or English configuration. Authors write in whichever language they please (spec §2.2) and one stemmer applied to the other language matches worse than no stemmer at all. Title is weight A, body weight B. |
| 2026-09-02 | P3-02: `body_text` and `search_vector` are generated columns over `tiptap_text(body)`, so no client and no trigger can let them drift from the document. `tiptap_text` uses a **strict** jsonpath with `silent` — lax `$.**.text` unwraps arrays and counted every text node twice, which the pgTAP test caught. |
| 2026-09-02 | P3-02: guides carry a `version` counter and `guide_acks` stores the version confirmed, rather than a `guide_revisions` history table. §3.1 lists no history table, and re-acknowledgement only needs to know whether the reader is behind. |
| 2026-09-02 | P3-02: neither `posts` nor `guides` has a delete policy — deleting is setting `deleted_at` (spec §2.5), so a client cannot destroy a row at all. |
| 2026-09-02 | P3-02: an RLS `update` refusal shows up as zero rows changed, not as `42501`; only `with check` and `insert` raise. The pgTAP tests assert the row count for update denials and `throws_ok` only for inserts. |

| 2026-09-02 | P3-01: the `content` bucket stays private, so an image node stores its **object path** and the URL is signed when the image is shown. A signed URL saved inside a document would carry an expiry into stored content, and re-signing on read is one query with a stale time. |
| 2026-09-02 | P3-01: an object's first path segment is its scope — a gym id, or `company` — so `storage.objects` policies reuse `can_read_content()`/`can_publish_content()` and an image inherits the permissions of the post it sits in. A segment that is neither resolves to the nil uuid, which belongs to nobody, so a hand-made path is refused rather than treated as company-wide. |
| 2026-09-02 | P3-01: no delete policy on `content` objects either (spec §2.5). Images are orphaned, not destroyed, when a post stops referring to them. |
| 2026-09-02 | P3-01: jsdom implements no `Range` measurement and no `elementFromPoint`, so `src/test/setup.ts` stubs them. Without that, typing into or clicking in a Tiptap editor throws inside ProseMirror instead of failing an assertion. |

| 2026-09-02 | P3-03: a post's scope defaults from the gym switcher, but the default is resolved at render rather than captured in `useState`. The profile that says where an author may publish arrives a render later, and the captured version left the form posting `company/…` while the select showed a gym — found by uploading an image in Chrome, where storage RLS refused it. |
| 2026-09-02 | P3-03: deleting a post asks in a translated dialog, not `window.confirm`, and writes `deleted_at`. Publishing and unpublishing are one-field updates, so the feed's pin control and the detail view share the same mutations. |
| 2026-09-02 | P3-03: a query whose first attempt fails does not retry while the tab is hidden — TanStack pauses on `focusManager`. It looks like a hang when driving a background tab, but a real user's focused tab shows the error. Left alone; worth remembering the next time a screen sits on "Loading…" under automation. |

| 2026-09-02 | P3-04: the acknowledgement report asks for no gym. `gym_memberships` RLS already limits a manager to their own gyms, so one query answers "who still has to confirm" per gym for a manager and company-wide for an admin — the §2.1 row "See acknowledgement reports" without a second rule in the client. |
| 2026-09-02 | P3-04: reading a post is recorded with `ignoreDuplicates`, so `read_at` is the *first* time someone opened it and an acknowledgement is never overwritten by a later visit. Drafts are not recorded — only their editors can see them. |
| 2026-09-02 | P3-04: the reminder half of the task moves to P5-02, whose trigger list already carries "ack reminder". Notifications are created only by database triggers (spec §5) and `notifications` does not exist before P5-01, so a reminder written now would be a second, private notification path. The report is what a manager acts on until then. |

| 2026-09-02 | P3-05: a category is deleted outright rather than soft-deleted — it holds no content of its own — and `on delete restrict` on both the guides and the child categories means only an emptied category can go. Renaming keeps the scope: moving a category between gyms would move the guides under it out of the audience that has been reading them. |
| 2026-09-02 | P3-05: the tree keeps a category whose parent RLS filtered out, at the root. Losing a whole branch because its parent belongs to another gym would be worse than showing it one level too high. |
| 2026-09-02 | P3-05: the whole guide list is fetched once and filtered by branch in the client. A chain of this size has a few hundred guides at most, and the tree then filters without a round trip per click. |

| 2026-09-02 | P3-06: search is `websearch_to_tsquery` against the generated `search_vector` columns — quoted phrases and `-word` work without a parser of our own — and it runs as two queries rather than a view or an RPC, so RLS on each table is what limits the hits. There is no Search nav entry: the box sits on the two modules it covers. |

## How to update this file

- When starting a task: add a row to Task status with 🔄 and the date, and set "Currently working on".
- When finishing: mark ✅, add the commit hash in Notes, update the Phase status when all its tasks are done.
- Record any new decision or rejected option here and in `PROJECT_SPEC.md` §4.
