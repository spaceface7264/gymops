# GymOps — Project Specification

Working name: **gymops** (placeholder used for repo, bundle id and deep-link scheme; rename before public release).
Status: V1 design approved 2026-09-01. See `PROJECT_TASKS.md` for the task graph and `PROJECT_STATE.md` for progress.

## 1. Purpose

A single internal system for a chain of 10+ bouldering gyms in Denmark (200+ users) covering daily operations, news, guides/how-to's, team chat, and later tasks, calendars and reports. It replaces scattered chat groups, documents and spreadsheets with one app that runs as an installable Windows/Mac desktop app and as a browser/phone PWA, with role levels scoped per gym.

## 2. Requirements

### 2.1 Users, gyms, roles

- Four roles: **superadmin**, **admin** (both global), **manager**, **staff** (both assigned per gym; a person can hold roles at several gyms).
- Invite-only email + password login. No public signup. Admins invite; managers may invite staff to their own gyms.
- Superadmin differs from admin only in: managing gyms, promoting/demoting admins, and viewing the audit log.
- Every content record is either gym-scoped (`gym_id`) or company-wide (`gym_id = null`, visible to all).

Permission matrix (also the RLS test spec):

| Action                                                 | Superadmin | Admin   | Manager              | Staff    |
| ------------------------------------------------------ | ---------- | ------- | -------------------- | -------- |
| Manage gyms, promote/demote admins                     | yes        | no      | no                   | no       |
| Invite users, assign to gyms                           | yes        | yes     | own gyms, staff only | no       |
| Publish company-wide news/guides                       | yes        | yes     | no                   | no       |
| Publish gym news/guides, edit checklist templates      | yes        | yes     | own gyms             | no       |
| Complete checklists, write daily log, report incidents | yes        | yes     | yes                  | own gyms |
| Change incident status                                 | yes        | yes     | own gyms             | no       |
| See acknowledgement reports                            | yes        | yes     | own gyms             | no       |
| Create custom chat channels                            | company    | company | own gyms             | no       |
| Delete any chat message (non-DM)                       | yes        | yes     | own gyms             | no       |
| Read DMs they are not part of                          | no         | no      | no                   | no       |
| View audit log                                         | yes        | no      | no                   | no       |

### 2.2 V1 modules

- **Home:** unread news needing acknowledgement, today's checklists, open incidents, latest daily log entry, gym switcher.
- **News:** rich-text posts, per gym or company-wide, pinned, drafts, optional required acknowledgement with per-gym "who hasn't confirmed" report and reminder.
- **Guides:** categorised rich-text pages (how-to's, guides, explanations), versions, optional re-acknowledgement on edit, full-text search, one tree mixing company and gym guides.
- **Checklists:** opening/closing/custom templates (company-wide or per gym) generated into daily runs at 03:00 gym-local time; items ticked by staff with live sync; completion history; missed runs surfaced to managers.
- **Daily log:** per-gym timeline of handover/note/issue entries; "issue" entries convert to incidents in one click.
- **Incidents & maintenance:** kind (injury/equipment/cleaning/other), severity, status open → in progress → resolved, photo attachments, comment thread, assignee. Creation notifies gym managers and admins; high severity also emails.
- **Notifications:** in-app inbox, email (Resend), web push (VAPID) for PWA, native desktop notifications via Realtime in the Tauri app. Per-user preferences per notification type.
- **Team chat:** auto channel per gym + `#company`, custom public/private channels, DMs (2+ people), @mentions, image/file attachments, edit/delete own messages, unread badges, typing presence. No threads, reactions or search in V1.
- **Admin:** gym CRUD, user list, invite dialog, deactivate, role editing with audit log.
- **i18n:** UI in English and Danish; content in whatever language the author uses.

### 2.3 V1.5 — AI assistant

- Read-only Q&A over published guides and news the user is allowed to see, with source links on every answer.
- Surfaces: a private "Ask" page with conversation history, and an `@assistant` bot that answers inside chat channels using the last 20 channel messages as context.
- Only guide/news text, the question, and (for channel mentions) recent channel messages are sent to Anthropic. No member/customer data. Incidents and daily logs are excluded.
- Per-user daily message cap, adjustable by superadmin.

### 2.4 Later releases

- **V2:** tasks (assignable to a person or a gym, due dates, recurrence, incident → task conversion), calendars (events per gym + company-wide; no shift rostering).
- **V3:** dashboards over in-app data, sync from BRP Systems (membership/booking). Needs BRP API key, service account, rate limits and webhook info from BRP first.

### 2.5 Non-functional

- Works on phone (PWA), browser, Windows and Mac desktop from one codebase.
- Permissions enforced in the database (RLS), never only in the UI.
- Soft delete on posts, guides, incidents, messages. Storage objects are never deleted from the UI in V1.
- Audit log for membership, role and incident changes.
- Auto-update for desktop installers.

## 3. Architecture

- **Frontend:** Vite + React + TypeScript, React Router, TanStack Query, Tailwind + shadcn/ui, react-i18next (`en`, `da`), Tiptap for rich text (stored as JSON).
- **Backend:** one Supabase project. Postgres row-level security is the only permission layer. Storage buckets `content` (news/guides), `incidents`, `chat` with storage RLS mirroring table RLS. Realtime (`postgres_changes`, private channels) for checklists, incidents, chat and notifications. Presence for typing indicators.
- **Server-side jobs:** Edge Functions `invite`, `notify` (web push + email), later `assistant` and `brp-sync`. pg_cron for daily checklist generation. Database webhooks trigger `notify` on `notifications` insert.
- **Desktop:** Tauri 2 wrapping the built web assets (not a remote URL) with plugins `updater`, `deep-link` (`gymops://`), `notification`, `single-instance`. GitHub Releases as the update feed.
- **PWA:** `vite-plugin-pwa`, `display: standalone`, service worker handling `push` and `notificationclick`. In-app install guide (iOS needs Add to Home Screen; permission prompt only from a user gesture).
- **Auth:** Supabase Auth email/password with PKCE. Invite/reset links open the desktop app via deep link with a web fallback page.
- **AI assistant:** Edge Function using `@anthropic-ai/sdk`, model `claude-opus-5`, adaptive thinking, streaming via SSE. Tool runner with two tools, `search_content` (Postgres full-text search) and `read_content`, both executed with the caller's JWT so RLS applies. Stable system prompt + tool definitions cached with `cache_control`.
- **Observability:** Sentry for web and desktop; token usage logged per assistant call.

### 3.1 Data model (V1)

Core: `gyms`, `profiles` (id = auth user id, `is_superadmin`, `is_admin`, `locale`, `active`), `gym_memberships` (user, gym, role manager/staff), `invites`, `audit_log`.
News: `posts`, `post_reads`. Guides: `guide_categories`, `guides`, `guide_acks`.
Checklists: `checklist_templates`, `checklist_template_items`, `checklist_runs`, `checklist_run_items`.
Daily log: `daily_log_entries`. Incidents: `incidents`, `incident_attachments`, `incident_comments`.
Notifications: `notifications`, `notification_prefs`, `push_subscriptions`.
Chat: `channels` (kind gym/company/custom/dm, `member_hash` for DM dedupe), `channel_members` (`last_read_at`, `muted`), `messages` (`mentions uuid[]`, soft delete), `message_attachments`.
Assistant (V1.5): `assistant_conversations`, `assistant_messages`, `assistant_usage`.
RLS helpers: `is_superadmin()`, `is_admin()`, `member_gym_ids()`, `managed_gym_ids()`, `is_channel_member(channel_id)`.

### 3.2 Repository layout

```
gymops/
  src/
    components/ui/          shadcn/ui primitives
    features/<module>/      components, hooks, queries, types per feature
                            (auth also owns the shared password fields and their rule)
    lib/                    supabase client, generated database.types.ts, query client,
                            i18n, platform shims (web vs tauri)
    locales/{en,da}/        one JSON namespace per feature
    routes/                 route table, layouts, page components
    test/                   Vitest setup and render helpers
    types/                  ambient declarations (typed i18next keys, import.meta.env)
  supabase/
    migrations/             schema source of truth, one file per feature
    seeds/                  local-only SQL loaded by `db reset`; never in `db push`
    tests/                  pgTAP RLS tests (every .sql here is run as a test)
    functions/              invite, notify, assistant, brp-sync
    seed.sql
  src-tauri/                desktop shell
  .github/workflows/        CI: web gates + migrations/pgTAP on every push and PR
  PROJECT_SPEC.md  PROJECT_TASKS.md  PROJECT_STATE.md  CLAUDE.md
```

## 4. Rejected options and why

| Option                                                                    | Rejected because                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js full-stack with its own API layer                                 | Would duplicate permissions (API + RLS), require running a Node server, and make the desktop app a thin browser window dependent on that server. RLS alone covers the rules.                                                               |
| Electron desktop shell                                                    | 80–200 MB installers vs ~5 MB for Tauri; Tauri has first-party updater/deep-link/notification plugins. Electron only wins for Node native modules (RFID, printers), not needed now. Re-evaluate if reception hardware integration appears. |
| Separate desktop and mobile web clients                                   | Doubles frontend work for better offline at the desk. Offline can be added later for checklists specifically.                                                                                                                              |
| Native iOS/Android apps                                                   | Only worth it for push and offline; PWA web push covers iOS 16.4+ when installed to Home Screen, which is acceptable.                                                                                                                      |
| Google Workspace SSO                                                      | Not all staff have company Google accounts; invite-only email/password is simpler. Can be added as an additional provider later.                                                                                                           |
| Markdown editor or PDF document library for guides                        | Managers need a friendly editor; rich text with images/files/video links chosen.                                                                                                                                                           |
| Shift rostering in the calendar                                           | A large product on its own (availability, swaps, hours). Calendar stays events-only.                                                                                                                                                       |
| Threads, reactions, message search in chat V1                             | Cut to ship chat sooner; listed as first chat follow-ups if channels get busy.                                                                                                                                                             |
| Embeddings/pgvector pipeline for the assistant                            | Corpus is small; Postgres full-text search behind Claude tools is enough to start and needs no extra provider. pgvector is the upgrade path if recall is poor.                                                                             |
| Assistant taking actions (create incidents etc.) or reading live ops data | Read-only over guides/news keeps permissions and data exposure simple in V1.5. Revisit after usage.                                                                                                                                        |
| Self-hosted Postgres/Node backend                                         | More ops work; team already uses Supabase.                                                                                                                                                                                                 |
| Both chat and assistant in V1                                             | Assistant needs guides to exist first; team chat ships in V1, assistant in V1.5.                                                                                                                                                           |
| oxlint as the linter (current Vite template default) | Faster, but the project needs type-aware rules (banning `any`, cross-feature and deep relative imports per §5) that ESLint + typescript-eslint provide today. Revisit when oxlint ships type-aware rules. |
| Docker Desktop as the container runtime | OrbStack is lighter and starts faster for the same Docker API; any Docker-compatible runtime works, so this is a local preference, not a project dependency. |
| pgTAP + test helpers installed by a migration | Migrations deploy, and test scaffolding has no business in a production database. They load from `supabase/seeds/`, which `db reset` runs locally and in CI but `db push` never does. |
| Keeping the session in a TanStack Query cache entry | Sign-out clears the cache and the route guard needs the session synchronously on every render. `AuthProvider` owns it from `onAuthStateChange`; queries read the user id from that context. |
| Supabase's default implicit auth flow | Invite and password-reset links must survive the redirect into the desktop app (`gymops://`, P7-02), which needs PKCE. |
| `[auth.email] enable_signup = false` as the invite-only switch | That flag is the email *provider* switch (`GOTRUE_EXTERNAL_EMAIL_ENABLED`); false disables password logins entirely. Invite-only comes from `[auth] enable_signup = false`, which sets `GOTRUE_DISABLE_SIGNUP`. |
| i18next HTTP backend with lazily loaded namespaces | Both languages are a few kilobytes and the Tauri shell loads from the filesystem, so namespaces are bundled with the app. Revisit if the translation volume grows. |
| A separate CI script (or i18next-parser) for the missing-key check | `src/lib/i18n.test.ts` compares the key sets across locales in `npm test`, which CI already runs, and `src/types/i18next.d.ts` makes `t()` key-checked at compile time — a typo fails `typecheck` before it reaches CI. |
| Separate `is_admin()` and "admin or superadmin" checks in every policy | A superadmin can do everything an admin can (§2.1), so `is_admin()` returns true for superadmins and `is_superadmin()` guards only the three superadmin-only actions. Fewer places to get wrong. |
| Column grants (or column-specific policies) to protect `profiles.is_admin` | RLS cannot restrict which columns an `update` touches and column grants cannot express "only a superadmin". A `before update` trigger raises instead, and it applies only to `authenticated` sessions so seeds and service-role calls behave like they do under RLS. |
| Own invite token column and accept flow | Supabase Auth's `inviteUserByEmail` already issues and verifies the token; `invites` only records what the person becomes on accept (gym, role, admin flag) plus its status. |
| A single shared "set password" screen for both recovery and invite | The invite screen also collects name and language and reads as a welcome; only the password fields and their validation are shared (`features/auth/password-fields.tsx`). |
| A Radix/shadcn `Select` for the invite locale picker | One field on one screen; a native `<select>` is keyboard- and screen-reader-correct out of the box and needs no extra primitive. |
| A client-side password rule of "8 characters or more" | GoTrue rejects anything weaker than `minimum_password_length = 10` plus `lower_upper_letters_digits` with an English server message. `checkPassword()` mirrors config.toml so the user sees a translated rule instead. |
| Keeping the seed password `password123` | It violates the project's own password policy, so it cannot be set through the API or the UI — only by the seed's direct bcrypt insert. Changed to `Password123` (P1-09 seed, CLAUDE.md). |
| Forcing invite links through PKCE too | `inviteUserByEmail` is issued server-side, where no code verifier exists, so its link is always an implicit hash fragment. The client stays on PKCE for the desktop deep link and the screens adopt the fragment themselves (`useUrlSession`). |
| Letting `detectSessionInUrl` pick up the invite fragment | It cannot: auth-js throws "Not a valid PKCE flow url" for an implicit callback whenever the client runs `flowType: 'pkce'`. The link then established no session at all, and — worse — the invite screen fell back to whatever session the browser already held, so it acted as the previously signed-in user. |
| The gym in the URL (`/g/:gymId/...`) | Would reshape every route added in P3–P6 and complicate the `gymops://` deep links, to buy two windows on two gyms. The gym lives in `GymProvider` instead, per device, so a shared front-desk machine keeps the gym it stands in. |
| Per-page gym filters instead of one switcher | Every module would reinvent the same control and they would drift apart. §2.2 asks for one switcher. |
| Nav entries disabled until their phase lands | A permanently greyed-out nav reads as broken software. Unbuilt modules route to a placeholder naming the phase that replaces it, so the shell is navigable now. |
| A hamburger drawer for phone navigation | Costs two taps for every move between sections. Staff use this one-handed mid-shift, so the phone layout is a bottom tab bar; the sidebar appears from `md` up. |
| Waiting for the full app shell before adding sign out | Front-desk machines are shared between shifts, so leaving no way out of a session is a permissions problem, not a missing convenience. The header carries the signed-in address and a sign-out button from P1-07 onward. |
| Switching the client to `flowType: 'implicit'` so invite links work | PKCE is required for the recovery link and for the `gymops://` desktop deep link (P7-02). Only the invite callback needs implicit handling, and `useUrlSession` is a dozen lines. |
| Marking the `invites` row accepted from the client | Acceptance changes gym membership and the admin flag; those are permission decisions and stay server-side in the `invite` Edge Function (P2-03). The accept screen only sets password, name and locale. |
| One CI job running both the web gates and the database | The web gates finish in a couple of minutes; the database job spends most of its time booting containers. Two jobs run in parallel and the failed job's name says which half broke. |
| Starting the whole Supabase stack in CI | pgTAP needs Postgres, plus gotrue (the seed inserts `auth.users` rows) and storage-api (`db reset` creates the three buckets). `supabase start -x` drops realtime, imgproxy, studio, postgres-meta, edge-runtime, logflare, vector and supavisor. |
| `supabase/setup-cli` with `version: latest` | A CLI release would then break CI on an unrelated commit. The version is pinned to 2.116.0, the one used locally, and bumped deliberately. |
| Running CI on the newest Node LTS | CI runs Node 20, the version this project is developed on, so a green build means the same toolchain that runs locally. |
| Staff seeing every profile in their own gyms | Not needed by any V1 screen before chat. `profiles` is readable by yourself, admins and the managers of your gyms; widen it in P6 if the chat member list needs it. |

## 5. Conventions

- **Language:** TypeScript strict everywhere, including Edge Functions (Deno). No `any`.
- **Schema:** every change is a migration in `supabase/migrations`; never edit the remote DB by hand. Regenerate types with `supabase gen types` after each migration and commit them to `src/lib/database.types.ts`.
- **Permissions:** every table has RLS enabled with explicit policies; every policy row in the permission matrix has a pgTAP test. UI hides what the user cannot do, but the database is the enforcement point.
- **Rows:** all content tables have `gym_id` (nullable), `created_by`, `updated_by`, `created_at`, `updated_at`, and `deleted_at` where soft delete applies.
- **Features:** one folder per feature under `src/features`; no cross-feature imports except through `src/lib` or a feature's `index.ts`.
- **Data access:** all reads/writes go through TanStack Query hooks in `features/<x>/queries.ts`; components never call Supabase directly.
- **i18n:** no hard-coded UI strings; every string has a key in both `en` and `da`. Missing-key warnings are build failures in CI.
- **Rich text:** Tiptap JSON in `body`, generated `body_text` column for search.
- **Notifications:** created only by database triggers writing to `notifications`; the `notify` function fans out. No client-side notification sending.
- **Testing:** Vitest + React Testing Library for hooks/components, pgTAP for RLS, Playwright for critical flows. Test-first for RLS policies and hooks.
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`, `db:`), one phase per branch, PR into `main`.
- **Secrets:** only in Supabase secrets and GitHub Actions secrets. `.env.local` is git-ignored.
- **Naming:** snake_case in SQL, camelCase in TS, kebab-case for files and routes.
- **Claude API code:** `@anthropic-ai/sdk` only, model `claude-opus-5`, streaming, typed SDK error classes, never raw fetch.
