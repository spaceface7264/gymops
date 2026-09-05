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
- A deactivated account (`profiles.active = false`) is a revocation, not a label: every content read goes through `is_active_user()`, and the auth user is banned so sign-in and token refresh both fail. Only their own profile stays readable, so the app can tell them why.
- "Complete checklists, write daily log, report incidents" means the gyms you are a member of, for managers as well as staff; only the company-wide roles reach every gym. `can_complete_in()` is the policy that says so.
- Events are the one exception to "managers publish in their own gyms": the calendar is run centrally, so `events_insert`/`events_update` are `is_admin()`, not `can_publish_content()`. Everyone in the audience reads them.
- Events are also the one record whose scope is a *set* of gyms rather than one nullable `gym_id`: an event runs at any number of gyms (`event_gyms`), and one with no rows there is company-wide.
- An acknowledgement is the database's record, not the client's claim: timestamps and the acknowledged guide version are stamped server-side, and you can only confirm content you are allowed to read.
- Every active person can see the active admins and superadmins (name, email, phone); gym members see each other; managers see their gyms' members; admins see everyone.

Permission matrix (also the RLS test spec):

| Action                                                 | Superadmin | Admin   | Manager              | Staff    |
| ------------------------------------------------------ | ---------- | ------- | -------------------- | -------- |
| Manage gyms, promote/demote admins                     | yes        | no      | no                   | no       |
| Invite users, assign to gyms                           | yes        | yes     | own gyms, staff only | no       |
| Publish company-wide news/guides                       | yes        | yes     | no                   | no       |
| Publish gym news/guides, edit checklist templates      | yes        | yes     | own gyms             | no       |
| Complete checklists, write daily log, report incidents | yes        | yes     | own gyms             | own gyms |
| Manage events (calendar)                               | yes        | yes     | no                   | no       |
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
- **Events:** the calendar — title, description, type (community/campaign/groups/offer/other), optional link, and a single date or a from → to range with optional times. Runs at any number of gyms, or company-wide when none are picked; read by everyone at those gyms, written by admins only. List and month views.
- **Notifications:** in-app inbox, email (Resend), web push (VAPID) for PWA, native desktop notifications via Realtime in the Tauri app. Per-user preferences per notification type.
- **Team chat:** auto channel per gym + `#company`, custom public/private channels, DMs (2+ people), @mentions, image/file attachments, delete own messages (edit was removed 2026-09-05, §4), quote-replies and four fixed reactions (added 2026-09-05), unread badges, typing presence. No threads or search in V1.
- **Admin:** gym CRUD, user list, invite dialog, deactivate, role editing with audit log.
- **i18n:** UI in English and Danish; content in whatever language the author uses.

### 2.3 V1.5 — AI assistant

- Read-only Q&A over published guides and news the user is allowed to see, with source links on every answer.
- Surfaces: a private "Ask" page with conversation history, and an `@assistant` bot that answers inside chat channels using the last 20 channel messages as context.
- Only guide/news text, the question, and (for channel mentions) recent channel messages are sent to Anthropic. No member/customer data. Incidents and daily logs are excluded.
- Per-user daily message cap, adjustable by superadmin.

### 2.4 Later releases

- **V2:** tasks (assignable to a person or a gym, due dates, recurrence, incident → task conversion). Calendars came forward into V1 as the Events module (§2.2); only shift rostering stays out (§4).
- **V3:** dashboards over in-app data, sync from BRP Systems (membership/booking). Needs BRP API key, service account, rate limits and webhook info from BRP first.

### 2.5 Non-functional

- Works on phone (PWA), browser, Windows and Mac desktop from one codebase.
- Permissions enforced in the database (RLS), never only in the UI.
- Soft delete on posts, guides, incidents, messages, events. Storage objects are never deleted from the UI in V1.
- Audit log for membership, role and incident changes.
- Auto-update for desktop installers.

## 3. Architecture

- **Frontend:** Vite + React + TypeScript, React Router, TanStack Query, Tailwind + shadcn/ui, react-i18next (`en`, `da`), Tiptap for rich text (stored as JSON).
- **Backend:** one Supabase project. Postgres row-level security is the only permission layer. Storage buckets `content` (news/guides), `incidents`, `chat` with storage RLS mirroring table RLS. Realtime (`postgres_changes`, private channels) for checklists, incidents, chat and notifications. Presence for typing indicators.
- **Server-side jobs:** Edge Functions `invite`, `notify` (web push + email), later `assistant` and `brp-sync`. pg_cron for daily checklist generation. Database webhooks trigger `notify` on `notifications` insert.
- **Desktop:** Tauri 2 wrapping the built web assets (not a remote URL) with plugins `updater` (+ `process` for the relaunch), `deep-link` (`gymops://`), `notification`, `single-instance`. GitHub Releases on the public `gymops-releases` repository as the update feed (the source repository is private).
- **PWA:** `vite-plugin-pwa`, `display: standalone`, service worker handling `push` and `notificationclick`. In-app install guide (iOS needs Add to Home Screen; permission prompt only from a user gesture).
- **Auth:** Supabase Auth email/password with PKCE. Invite/reset links open the desktop app via deep link with a web fallback page.
- **AI assistant:** Edge Function using `@anthropic-ai/sdk`, model `claude-opus-5`, adaptive thinking, streaming via SSE. Tool runner with two tools, `search_content` (Postgres full-text search) and `read_content`, both executed with the caller's JWT so RLS applies. Stable system prompt + tool definitions cached with `cache_control`.
- **Observability:** Sentry for web and desktop; token usage logged per assistant call.

### 3.1 Data model (V1)

Core: `gyms`, `profiles` (id = auth user id, `is_superadmin`, `is_admin`, `locale`, `active`), `gym_memberships` (user, gym, role manager/staff), `invites`, `audit_log`.
News: `posts`, `post_reads`. Guides: `guide_categories`, `guides`, `guide_acks`.
Checklists: `checklist_templates`, `checklist_template_items`, `checklist_runs`, `checklist_run_items`.
Daily log: `daily_log_entries`. Incidents: `incidents`, `incident_attachments`, `incident_comments`.
Events: `events` (`event_type`, `starts_on`/`start_time`/`ends_on`/`end_time`, generated `last_on`), `event_gyms` (event, gym; no rows = company-wide).
Notifications: `notifications`, `notification_prefs`, `push_subscriptions`.
Chat: `channels` (kind gym/company/custom/dm, `member_hash` for DM dedupe), `channel_members` (`last_read_at`, `muted`), `messages` (`mentions uuid[]`, soft delete, `from_assistant` for a reply the assistant wrote with `created_by null`), `message_attachments`.
Assistant (V1.5): `app_settings` (key/value; `assistant_daily_cap`), `assistant_conversations`, `assistant_messages` (`sources jsonb`), `assistant_usage` (one row per call, token counts); `assistant_quota()`; tool functions `search_content(query)` and `read_content(target_kind, target_id)` (security invoker, published rows only).
RLS helpers: `is_superadmin()`, `is_admin()`, `member_gym_ids()`, `managed_gym_ids()`, `can_read_event(event_id)`, `is_channel_member(channel_id)`, `can_read_channel(channel_id)`, `can_moderate_channel(channel_id)`, `can_seat_in_dm(channel_id)`.

### 3.2 Repository layout

```
gymops/
  src/
    components/             shared composition layer (Logo, PageHeader, EmptyState,
                             LoadingState, StatusBadge, Markdown); features compose these and
                             reach into components/ui/ only for what these don't cover
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
  src-tauri/                desktop shell (Tauri 2; icons, capabilities, the Rust entry point)
  docs/                     the P7-07 manual walkthrough checklist
  .github/workflows/        ci.yml: web gates, migrations/pgTAP, e2e, Edge Functions, cargo check;
                            release.yml: tagged desktop builds to gymops-releases
  PROJECT_SPEC.md  PROJECT_TASKS.md  PROJECT_STATE.md  CLAUDE.md
```

## 4. Rejected options and why

| Option                                                                    | Rejected because                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js full-stack with its own API layer                                 | Would duplicate permissions (API + RLS), require running a Node server, and make the desktop app a thin browser window dependent on that server. RLS alone covers the rules.                                                               |
| A curated list of Danish time zones on the gym form                       | One select over `Intl.supportedValuesOf('timeZone')` is shorter code and does not need a migration the first time a gym opens outside Denmark. Checklist generation (P4-02) reads this field, so a wrong or missing zone is a silent operational bug.                                          |
| Electron desktop shell                                                    | 80–200 MB installers vs ~5 MB for Tauri; Tauri has first-party updater/deep-link/notification plugins. Electron only wins for Node native modules (RFID, printers), not needed now. Re-evaluate if reception hardware integration appears. |
| Separate desktop and mobile web clients                                   | Doubles frontend work for better offline at the desk. Offline can be added later for checklists specifically.                                                                                                                              |
| Native iOS/Android apps                                                   | Only worth it for push and offline; PWA web push covers iOS 16.4+ when installed to Home Screen, which is acceptable.                                                                                                                      |
| Google Workspace SSO                                                      | Not all staff have company Google accounts; invite-only email/password is simpler. Can be added as an additional provider later.                                                                                                           |
| Markdown editor or PDF document library for guides                        | Managers need a friendly editor; rich text with images/files/video links chosen.                                                                                                                                                           |
| Shift rostering in the calendar                                           | A large product on its own (availability, swaps, hours). Calendar stays events-only.                                                                                                                                                       |
| `timestamptz` for event dates                                             | A company-wide event has no gym and therefore no zone to render an instant in, and "19:00" is a wall-clock fact about the gym's own day. `date` + optional `time` says exactly that and needs no conversion on either side; a future ICS export composes the instant against `gyms.timezone` at export time. |
| `react-day-picker` / `date-fns` for the month view                        | A date *picker* has no event-chip slot, so the grid would be styled around it anyway. The month math is one pure module over `Date.UTC` (`month-grid.ts`), and date entry is native `type="date"`/`type="time"`. No new dependency.        |
| A copy of the event per gym, or a nullable `gym_id`                       | A `gym_id` cannot say "two of the three gyms", and copies drift the moment one of them is edited. `event_gyms` keeps one event to edit and lets `on delete cascade` clean up when a gym closes.                                            |
| Spanning bars for multi-day events in the grid                            | Needs per-week lane assignment and row measurement. Repeating the chip on every day it covers reads the same and survives the grid collapsing on a phone.                                                                                  |
| Threads, reactions, message search in chat V1                             | Cut to ship chat sooner. Reactions (four fixed) and quote-replies came in on 2026-09-05 (P6C-17/18) after Rami compared the chat with WhatsApp's message menu; threads and search stay out.                                                    |
| Embeddings/pgvector pipeline for the assistant                            | Corpus is small; Postgres full-text search behind Claude tools is enough to start and needs no extra provider. pgvector is the upgrade path if recall is poor.                                                                             |
| Assistant taking actions (create incidents etc.) or reading live ops data | Read-only over guides/news keeps permissions and data exposure simple in V1.5. Revisit after usage.                                                                                                                                        |
| Self-hosted Postgres/Node backend                                         | More ops work; team already uses Supabase.                                                                                                                                                                                                 |
| A bot auth user + profile for the assistant (V1.5)                        | A `messages.from_assistant` flag with `created_by null`, written by the Edge Function as the service role, needs no `profiles_select` carve-out, no seat in every channel and no password-less account. The UI names the author "Assistant" from the flag.                                                    |
| A pg_net after-insert trigger to answer `@assistant` messages             | The trigger has no caller JWT, so `search_content`/`read_content` would need security-definer twins that re-implement content visibility for a user id, and the function URL + service key would have to live in Vault (as `notify`'s do). The sender's client already holds the token and is waiting: it calls the function itself (P8-05). |
| `supabase.functions.invoke` for the Ask page                              | It resolves after the whole body has arrived, and the answer is a stream. A raw `fetch` with the same two headers (`Authorization`, `apikey`) reads the server-sent events as they come; the function answers CORS for it (P8-03/P8-04). The channel surface, which nobody watches, keeps `invoke`. |
| Both chat and assistant in V1                                             | Assistant needs guides to exist first; team chat ships in V1, assistant in V1.5.                                                                                                                                                           |
| oxlint as the linter (current Vite template default) | Faster, but the project needs type-aware rules (banning `any`, cross-feature and deep relative imports per §5) that ESLint + typescript-eslint provide today. Revisit when oxlint ships type-aware rules. |
| Docker Desktop as the container runtime | OrbStack is lighter and starts faster for the same Docker API; any Docker-compatible runtime works, so this is a local preference, not a project dependency. |
| pgTAP + test helpers installed by a migration | Migrations deploy, and test scaffolding has no business in a production database. They load from `supabase/seeds/`, which `db reset` runs locally and in CI but `db push` never does. |
| Keeping the session in a TanStack Query cache entry | Sign-out clears the cache and the route guard needs the session synchronously on every render. `AuthProvider` owns it from `onAuthStateChange`; queries read the user id from that context. |
| Realtime on the incident list and detail (P4-08) | §3 lists incidents among the Realtime consumers, but a photograph and a status move are minutes-scale events, not a shared checklist being ticked in the same room. The notification triggers in P5-02 are what actually tell a manager an incident was filed; live-updating the list can follow if it turns out managers sit on it. |
| Letting the reporter rewrite the report after filing (P4-08) | The trigger allows it, but a report is what somebody saw at the time, and the thread is where corrections belong. The UI offers comments instead; the column-level permission stays for a later edit affordance. |
| Uploading incident photographs before the incident row exists | Both the storage path (`<gym>/<incident>/…`, which `incident_object_gym()` reads) and `incident_attachments.incident_id` need the id, so a temporary path would have to be moved and re-recorded. The report form holds the files and uploads them the moment the insert returns. |
| Filing the incident outright from a log entry, with no form (P4-09) | §2.2's "one click" is one click to a *filled* form, not to a filed report: kind and severity are judgements the entry does not carry, and an incident nobody chose the severity of is one nobody triages. The link fills everything the entry knows and leaves those two fields to the person converting. |
| A column linking the incident back to the daily-log entry | Would need a migration, an RLS story of its own and a second place to keep in step, to render one back-link. The entry's own words and tags are copied into the report, so the trail is in the text. Revisit if managers ask where a report came from. |
| Hiding a home-page card when its block is empty (P4-10) | Tempting on a quiet morning, but a page whose sections move around is a page nobody learns the shape of, and "nothing is open here" is itself worth reading. Every card renders with its own empty line, as the news block has since P3-07. |
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
| Waiting for the full app shell before adding sign out | Front-desk machines are shared between shifts, so leaving no way out of a session is a permissions problem, not a missing convenience. The header has carried a way to sign out from P1-07 onward — an email link and a standing Sign out button until the facelift's avatar menu (2026-09-03, see below). |
| Switching the client to `flowType: 'implicit'` so invite links work | PKCE is required for the recovery link and for the `gymops://` desktop deep link (P7-02). Only the invite callback needs implicit handling, and `useUrlSession` is a dozen lines. |
| Marking the `invites` row accepted from the client | Acceptance changes gym membership and the admin flag; those are permission decisions and stay server-side in the `invite` Edge Function (P2-03). The accept screen only sets password, name and locale. |
| One CI job running both the web gates and the database | The web gates finish in a couple of minutes; the database job spends most of its time booting containers. Two jobs run in parallel and the failed job's name says which half broke. |
| Starting the whole Supabase stack in CI | pgTAP needs Postgres, plus gotrue (the seed inserts `auth.users` rows) and storage-api (`db reset` creates the three buckets). `supabase start -x` drops realtime, imgproxy, studio, postgres-meta, edge-runtime, logflare, vector and supavisor. |
| `supabase/setup-cli` with `version: latest` | A CLI release would then break CI on an unrelated commit. The version is pinned to 2.116.0, the one used locally, and bumped deliberately. |
| Running CI on the newest Node LTS | CI runs Node 20, the version this project is developed on, so a green build means the same toolchain that runs locally. |
| A run item pointing at its template item for the text it shows | Editing a checklist would then rewrite every run it had ever generated, including the ones staff signed off months ago. The run snapshots `label` and `required`; the template item id is kept only for reporting. |
| Trusting the client for `acknowledged_at`, `read_at` and the acknowledged guide version | The audit showed a reader could confirm a guide as version 9999 and backdate it by years, so the "who has confirmed" report — the thing you reach for after an injury — could be made to say anything. Triggers stamp all three. |
| Treating `profiles.active` as a UI flag | It was one: a deactivated member kept reading their gym and could sign in again, because only `is_admin()`/`is_superadmin()` consulted the column and GoTrue never saw it. Revocation has to live in the RLS helpers *and* in Auth. |
| A `guide_revisions` table keeping every published body                    | The data model (§3.1) carries no history table, and the requirement is re-confirmation, not archaeology: `guides.version` plus the version stored in `guide_acks` answers "is this reader behind?". History would double the write path and the RLS surface for no V1 screen. |
| `to_tsvector('danish')` (or `'english'`) for guide and news search        | Authors write in whichever language they please (§2.2), and one stemmer applied to the other language matches worse than no stemmer. Search uses `'simple'` with `websearch_to_tsquery`, title weighted above body. |
| A cron schedule per time zone, or one job at 03:00 UTC | 03:00 UTC is 04:00 or 05:00 in Copenhagen, i.e. inside opening hours in summer, and a job per zone makes opening a gym abroad a migration. One hourly job whose function picks the gyms currently reading 03:xx locally covers every offset, including the 30- and 45-minute ones, and a new gym is a row in `gyms`. |
| Backfilling checklist runs for nights the job did not run | A run conjured up days later claims work nobody was asked to do, and the completion history is the record a manager relies on. The generator only ever writes the gym's current local date; a gap is a gap, and P4-05 shows it. |
| Generating a run from a template that has no items | Every required item is ticked the moment it exists, so it lands on the home page already complete. A template without items is an unfinished draft and generates nothing. |
| The checklist template editor under `/admin` | `/admin` is company administration — users, gyms, the audit log. Editing a checklist is managers' daily work in their own gyms (§2.1), so the editor lives in the checklists module at `/checklists/templates`, beside the runs it generates. |
| Drag-and-drop reordering of checklist items | The lists are short and half the editing happens on a front-desk touch screen. Up/down buttons are keyboard- and screen-reader-usable as they stand and cost no dependency. |
| Replacing a template's items on every save | Run items point back at the template item they came from with `on delete set null`, so delete-and-reinsert would cut the reporting link on every run ever generated. Saving diffs the items: ids are kept, positions renumbered, and only items the editor actually dropped are deleted. |
| One shared Realtime channel for every gym's checklists | Payloads are RLS-filtered either way, but a private channel per gym scope (`checklists:<gym id>`) refuses the join itself, so a gym's activity is not something another gym's client is merely trusted not to read. `can_listen_to_checklists()` is the rule, and it is tested like every other permission helper. |
| Patching the cached run from the Realtime payload | The event may belong to a run the screen is not showing, and the screen would then have to reconcile two sources of truth. It refetches the gym's runs instead — one small query per change. |
| `replica identity full` on `checklist_run_items` | Tried while diagnosing missing events. Realtime checks RLS with `exists(… where <primary key>)` and the WAL already carries the whole new tuple on update, so it only added WAL volume. It matters for DELETE payloads, which nothing subscribes to. |
| Calling a checklist missed at a fixed time of day | A closing checklist is finished when the gym closes, so any cut-off before midnight would flag it wrongly every evening. A run is missed once the gym's own date has moved past it — the same clock that dated it (§2.2, P4-02). |
| ~~Staff seeing every profile in their own gyms~~ **Reversed in P4-06** | It was "not needed by any V1 screen before chat", but the daily log is a handover log: an entry with no author is a note from nobody, and the checklist run screen had the same hole. `profiles` is now readable by yourself, admins, the managers of your gyms, and anyone you share a gym with (`shares_gym_with()`). The trade, accepted deliberately: a colleague's phone and email are visible to the people they work with, not just their name. |
| A rich-text body for daily log entries, like news and guides | An entry is a sentence typed one-handed mid-shift. Plain text with line breaks needs no editor, no image bucket and no sanitiser; photographs belong to incidents (§2.2), which is the next module. |
| A `tags` table with a join | Tags here are labels for filtering one gym's timeline, not a taxonomy: `text[]` with a GIN index answers "everything tagged wall4" in one query and needs no second screen to manage. A trigger lower-cases, trims and de-duplicates them so "#Broken" and "broken" are one tag. |
| Letting a manager edit an entry somebody else wrote | The log is a record of shifts; a manager rewriting what staff reported would make it worthless as one. A manager can take an entry off the timeline, and a trigger holds every other column to its old value when the editor is not the author. |
| `deleted_at is null` inside a SELECT policy | It reads well and it breaks soft delete: Postgres refuses an UPDATE that would leave the row invisible to its own writer, so "delete" failed for every user on posts and guides (found in P4-06, fixed in `20260902171000`). The row stays visible to the people who may publish there — the ones deleting it — and the listing queries filter it out. |
| Repeating the active check inside `can_publish_content()` | Proposed after misreading the publish gate as unguarded. The check belongs in `managed_gym_ids()`/`member_gym_ids()` where `20260902130000` put it — one place, every caller, gates included. A second copy in the gate would be dead code that reads like a real rule, and the next person would have to prove to themselves which of the two is load-bearing. A test pins it instead (`supabase/tests/120-deactivated-publisher.test.sql`). |
| One dropdown component for every `<select>` | The 21 of them are three different controls wearing one tag. A form field needs a real form control (`Select`); a filter needs a trigger that reads as the current state (`DropdownMenu` + `DropdownMenuRadioGroup`); and a 400-entry timezone list needs type-to-search (`Combobox`). Using `DropdownMenu` for a form field would drop it out of the form, and a `Select` for the timezone list is unusable at that length. |

| A `notification_prefs` row per user per notification type, written on sign-up | It has to be backfilled by a migration every time the enum gains a type, and P6-08 already adds two. The table is sparse instead: no row means every channel is on, and `notification_pref()` applies the defaults for the one caller that needs them. |
| A notification that points at the row that caused it, rendering its text on read | The inbox is a record of what somebody was told. An incident that has since been re-titled, re-graded and resolved would render as a message nobody ever sent, and the email and the push — already delivered with the old wording — would disagree with it. `title`/`body`/`url` are written once, at the event. |
| Letting the recipient's preferences decide that something deserves an email | The grading belongs where the event is raised (`email_requested`, set for a high-severity incident and not for an ordinary one), because it is a property of what happened, not of who is reading. A preference can silence a channel; it cannot promote one. |
| An admin-wide notification channel, the way `checklists:all` exists | An inbox is per person by definition. One channel carrying 200 users' notifications would hand every admin the whole company's fan-out and make RLS the only thing standing between them, on a stream that exists to update a badge. |

| Notifying people of their own actions, and leaving it to a preference | The reporter of an incident and the manager who resolves it both already know. A switch that has to be found and turned off is not a fix for noise that should never have been sent. |
| One notification at publish time for content that must be confirmed | It arrives when the feed is already showing the post, and it is useless the moment it is read and not acted on. The nightly pass chases only what is *still* unconfirmed, once a week per item, which is the state a manager actually cares about. |
| Running the reminder job gym-locally like the checklist job (P4-02) | A checklist run is dated by its gym's own day; a reminder is not, and a company-wide guide has no gym whose clock to follow. One daily schedule at 07:00 UTC. |

| The dashboard's Database Webhooks UI for `notifications` → `notify` | It writes the service role key into a trigger definition that lives only in the hosted project — outside git, invisible to review, and printed by `pg_dump`. The trigger here ships as a migration and reads its URL and key from Vault at call time, so the same schema works locally, in CI and hosted with no fan-out configured. |
| Treating a private chat channel as private *from admins too* | §2.1 draws the line at the DM — "delete any chat message (non-DM)" is an admin right, and a channel an admin may moderate but not read is a rule that cannot be enforced coherently. So a DM is the one record in this project with no admin override, and a private custom channel is hidden from colleagues, not from the people answerable for it (`can_read_channel()` includes `can_moderate_channel()`). |
| A client-supplied `member_hash` on DMs | The fingerprint is what stops "message these three people" from opening a second channel, so it is derived server-side from the sorted member ids by a trigger on `channel_members`, the way acknowledgements are stamped rather than posted. It is null until the channel has members — the hash is of a member set that does not exist at the insert creating the channel — and a partial unique index makes the collision the error it should be. |
| Auto-creating a gym's channel and its roster from the client | A channel that exists only once somebody opened the chat screen, and a roster that drifts every time a membership is granted elsewhere in the app. `gyms`, `gym_memberships` and `profiles.active` carry the triggers instead (P6-02), and the migration backfills what predates them. |
| Filtering the chat list by the gym switcher | Somebody who works at two gyms is in both channels at once, and a conversation does not belong to whichever gym they happen to be looking at. News and checklists are scoped because they are *about* a gym; a channel list is about a person. |
| Counting unread per channel from the client | One query per channel, on every screen the badge appears on. `chat_overview()` answers the whole list — count, last activity and mute — in one call, and the shell's badge reads the same rows the list does. |
| A muted channel that shows no count | Mute is about being interrupted, not about being kept in the dark. The channel keeps its badge in the list; only the shell's total leaves it out, which is what the nav badge is for. |
| Marking a route full-bleed with a react-router `handle` | It reads better and it needs `useMatches()`, which throws outside a data router — and `renderWithProviders` mounts every component test in a `MemoryRouter`. `fullBleedRoutes` in `routes/nav.ts` keeps the knowledge next to the route table without making the shell untestable. |
| Paging the message list on `created_at` alone | `now()` is the transaction's clock, so two messages written in one statement share a microsecond. A tie has no defined order, and one straddling a page boundary drops out of the list entirely — found in the browser, where two seeded messages rendered in the wrong order. The cursor is the pair `(created_at, id)`. |
| Marking a channel read only when it is opened | A message arriving while somebody is looking at the channel would badge a line already on their screen. The read marker follows the newest message, not the route. |
| A markdown library for chat messages | A message is the one thing in this app that arrives from another user and is rendered verbatim. `ChatMarkdown` handles the four things spec §2.2 promises and returns React nodes, so there is no path from somebody's typing to `dangerouslySetInnerHTML`. |
| A second Realtime channel for typing presence | Presence and the message stream share a topic, so a second subscription would be a second socket for the same permission. `useChannelLive()` owns one channel and returns both halves. |
| An on/off pair of typing events | Nobody sends the "off" when they close the tab mid-sentence, and the indicator hangs there for everybody else. Presence carries a `typing_until` window instead, and the hook drops entries as they expire — presence only fires when state *changes*, and stopping is the absence of a change. |
| Parsing `mentions` out of the message text server-side, or on read | An `@name` is a string; a mention is a person, and P6-08 has to aim a notification at one. The composer resolves the names it offered — the people actually in the channel — and stores their ids with the message. |
| Letting anyone who can read a channel broadcast on its topic | Posting takes membership (P6-01), so a typing indicator from a non-member would be a message from somebody who is not there. `realtime.messages` gets an INSERT policy of its own: `is_channel_member()`, not `can_read_channel()`. |
| Hiding a deleted message's attachments by row alone | The path is the object's name, so anybody who noted it could sign it again. Both the `message_attachments` policy and the `chat` bucket's read policy go through the message, and a deleted one matches neither. A signed URL already issued still lives out its hour — deleting stops new signatures, it does not revoke old ones. |
| Opening a DM from the client, insert by insert | The dedupe is the whole difficulty and the client cannot do it: `member_hash` is md5 of the sorted member ids, derived by a trigger *after* the members exist, so "is this the same conversation" cannot be asked before a second channel has already been created — and a browser has no md5 either. `start_dm(target_ids)` finds or creates in one statement, and a lost race takes the winner's channel. |
| `security definer` on `start_dm()` | It would have to re-implement who you may message, and the answer would then be its own rather than `profiles_select`'s. Invoker keeps the reachable set honest: somebody you cannot see is somebody you cannot message, and every statement in the function is one the caller could have run by hand. |
| `returning id` on the DM it just opened | `channels_select` is membership, and a channel one statement old has no members — reading back your own new DM is a row you may not see. The id is generated in the function instead. The same reason `channel_members_insert`'s DM branch needed `can_seat_in_dm()`: a policy's subquery is filtered by the referenced table's RLS, so P6-01's "the creator counts before the first row exists" was dead until it was asked through a definer function. |
| `can_moderate_channel(id)` inside `channels_select` | It looks the channel up by id, and a command cannot see its own tuple — so a manager creating a *private* channel and reading back its id was refused, while the public case passed because its branch reads the new row's own columns. A policy filtering `channels` asks the moderation rule of the row in hand; `can_moderate_channel()` stays as it is for the tables that are asking about a channel they are not (P6-07). |
| Editing a custom channel's scope or its privacy | Both are what the people in it joined. Moving one into another gym hands it to a different set of managers — `channels_update`'s check is on the new row, so the manager doing it could be locked out of what they just moved — and making a public channel private silently drops every reader who never joined. The dialog asks for both at creation and neither afterwards. |
| Reading a public channel before joining it | Posting takes membership (P6-01), so a preview would be a conversation with no way to answer, and the read marker would have nowhere to live. Browse lists what you could join, joining opens it, and leaving puts it back on the list. |
| Telling somebody twice when they are mentioned inside a DM | Being named in a two-person conversation is not a second event. The DM branch and the mention branch never overlap: a DM is told as a DM, named or not. |
| One notification per message in a DM | A conversation is a stream and an inbox is not. The DM branch de-duplicates per channel over five minutes; the mention branch does not, because somebody typed a name on purpose and the second one is as deliberate as the first. |
| Email for chat | §4 already says the grading belongs where the event is raised, and a chat line is not what "email-worthy" means. `email_requested` is false for both types; push and the inbox still follow the recipient's own preferences. |
| Per-channel mute as a notification preference | The preferences screen switches a *type* off everywhere. Mute is "not from here" — one conversation, whatever the type — so it lives on `channel_members` and is set from the channel itself. |
| Adding the two enum values in the same migration as the trigger that uses them | Postgres refuses a new enum label in the transaction that created it, and each migration runs in one. `20260903140000` adds the labels, `20260903140100` uses them. |
| Making `notify` re-read the notification it was handed | The webhook fires inside the transaction that wrote the row; a re-read is a race with its own trigger. The payload is the message, and only what it cannot carry — the recipient's address, locale and preferences — is looked up. |
| Hand-rolling RFC 8291 payload encryption instead of `npm:web-push` | It works under the edge runtime's node compatibility, and push encryption is not a thing to implement twice for the sake of one fewer dependency. |

| A Notifications entry in the left nav | The nav lists the modules a shift moves through. An inbox is about the person, not the gym's work, so it sits in the header with the gym switcher and the account — where every app that has one puts it, and where it can carry a badge without competing with the modules. |

| `generateSW` for the service worker | The worker exists for `push` and `notificationclick`; a generated one has neither, and the precaching it does give us is available from `injectManifest` too. |
| One push subscription per user | A subscription is a browser's, not a person's: the same person's phone and laptop are two endpoints, and a browser that re-subscribes gets a new one. `push_subscriptions.endpoint` is the key, and `notify` deletes a row when the push service answers 404 or 410. |

| Registering the service worker in the desktop shell too | The worker is the web's precache and push receiver (P5-05); the desktop ships the build inside the app, updates through the updater and is notified natively (P7-03/04). WKWebView also serves no service worker on the `tauri://` scheme, so it would be a silent no-op on macOS and a second update path on Windows. `main.tsx` skips it when `isDesktop()`. |

| Sending desktop-requested reset links through the web callback page | The page could try `gymops://` itself and explain when nothing opens, but it cannot complete the reset: the PKCE verifier is in the app that asked, and only there. It would add a hop and a hosted-origin setting to the desktop build for a nicer error on the wrong device. The mail redirects straight to `gymops://auth/callback`. |

| GitHub Releases on the private source repository as the update feed | `releases/latest/download/latest.json` on a private repository answers 404 without a token, and an installed app has none to give. The feed and the installers live on the public `gymops-releases` repository instead; the workflow in the private repository publishes there. |

| `supabase-js` in the Playwright fixtures | Creating a client opens a Realtime socket, and Node 20 — the version CI runs — has no native WebSocket. The fixtures need three REST verbs; `fetch` against PostgREST has no such dependency. |

| Ranking in the client (sorting the two lists by a score computed in JS) | The score lives with the vector; two queries cannot be ranked against each other without the database's `ts_rank`, and one function is also one round trip. |

| Dark mode | Removed 2026-09-03 with the facelift: one theme designed well; front desks and phones in a lit gym. |

| A standing Sign out button in the header | Moved into the account menu 2026-09-03: on a shared front-desk machine an always-visible sign-out invited accidental taps; the menu is one tap further and names who is signed in. |
| Joining `checklists:all` while the gym scope is still null | Rejected 2026-09-04 (P7-07): for a manager or staff member a null gym means "not resolved yet", not "all gyms" — the join is refused by `can_listen_to_checklists()`, and the churn cost the gym channel its events (ticks from another window arrived 0 of 3 times; 2 of 2 once the join waits for `canSeeAllGyms`). No Realtime topic is joined until the scope has resolved. |
| One-click deletes (a chat message, a log entry, a guide category, a channel member, leaving a channel) | Guarded 2026-09-04 (P7D-03): everything irreversible asks once through `ConfirmDialog` (an `AlertDialog`: no close button, Cancel focused, the failure shown inside it). Reversible toggles — deactivate, pin, mute, activate — never confirm; they get a toast instead. `window.confirm` stays rejected: untranslated, and a browser modal blocks the app. |
| Toasts for everything, or toasts from the shared `queries.ts` hooks | Decided 2026-09-04 (P7D-04): a form that stays on screen keeps its inline `role="alert"` line; a toast is used only when the result leaves the screen (save then navigate, a dialog that closes) or the action has no form at all (pin, mute, activate, mark read: error toast at least, a success toast where the change is consequential, such as deactivating a person). Nothing toasts the user's own checklist ticks or chat sends (principle 3, quiet unless it matters). `toast()` is called from the screen, not the hook, because the wording depends on the screen. |
| Rows of `aria-pressed` buttons as filters and values | Replaced 2026-09-04 (P7D-05): `Tabs` switches between panels of one screen (the admin sections, as links so the URL stays the state), `ToggleGroup type="single"` is a filter or a one-of value (incident status, log kind, events view, the incident status setter), `ToggleGroup type="multiple"` or a `Toggle` is a set of values (event gyms, weekdays, past, multi-day). They share the segmented-pill look; the difference is the role a screen reader hears. |

| A hand-rolled transcript scroller (scroll events, a `ResizeObserver`, a sticky pill) | Replaced 2026-09-05 (P6C-12) by shadcn's `MessageScroller` over `@shadcn/react` 0.3.1, vendored and adapted: it follows the live edge only while the reader is there, holds its place when older pages are prepended, exposes jump-to-message (which the "New" landing and any future search need) and marks lines on screen. One small pre-1.0 dependency against three behaviours that were each a bug once. |
| Rows in gym and company channels, bubbles only in DMs | Rejected 2026-09-05, the same day it was decided (P6C-13): Rami saw both side by side and chose bubbles everywhere. One shape for every channel (principle 2) beat the argument about long handovers; the side says who, a line by somebody else carries their name, a line that names the reader says "Mentions you" beside the time. |
| Threaded replies | Rejected 2026-09-05 (P6C-17): a quote keeps one stream; a thread is a second place to look, and the reply notification already brings the person back to the line. `messages.reply_to` names the quoted line. |
| A free emoji picker for reactions | Rejected 2026-09-05 (P6C-18): four fixed ones (👍 ✅ 👀 ❤️) are the whole vocabulary a shift needs, a `text` column with a check beats an emoji table, and a fixed row of four fits a 44 px menu. |
| Persisting the reply target with the draft | Rejected 2026-09-05: a quote is a moment's intention; the text draft survives a channel switch, the target does not. |
| A tooltip for who reacted | Rejected 2026-09-05: touch has no hover (DESIGN §Tooltips); a count opens a dialog of names. |
| A side stripe on the quote block and the reply strip | Rejected 2026-09-05: the shared ban on side-stripe borders; a tinted block with the name in the accent says "quote" without it. |
| A `…` menu per chat message holding one item | Replaced 2026-09-05 (P6C-09, second critique): a menu that opens to a single red Delete is indirection with no payoff. Delete became a direct icon button. The menu returned the same day (P6C-19) when Reply, React and Copy joined Delete: four actions earn one. |
| Mute as a "Muted" checkbox item in the channel menu | Replaced 2026-09-05 (P6C-09): an unchecked adjective read as a status, not a switch, and said nothing when off. The item is a verb ("Mute this channel" / "Unmute this channel") with a toast; the title's `BellOff` mark carries the state. |
| Deriving mentions from the text at send time | Replaced 2026-09-05 (P6C-07): `text.includes('@Full Name')` meant a hand-typed "@Mette" notified nobody, silently, and looked like a mention in the stream. Only a pick from the list is a person; picks are kept in state and sent if still named; the stream sets a resolved `@Name` in the accent and a typed one stays plain. |
| Naming an attachment by the tail of its storage path | Replaced 2026-09-05 (P6C-08): the path is a UUID, so a PDF in the stream had no name a person could read. `message_attachments.file_name` holds what the sender called it. |
| Editing a sent chat message | Removed 2026-09-05 (chat critique): the daily log is the record and a shift chat is talk; a wrong line is corrected by the next line, as in any chat people already use. Edit put a bold button under every own message, an `edited` marker and a second form in the stream for a case nobody had. Delete stays, behind one menu per message; the `guard_message_edit()` trigger and the update policy stay in the database untouched. |
| Enter-to-send on a touch keyboard | Rejected 2026-09-05: a phone keyboard has no shift+Enter, so a two-line handover went out as two half-messages. Enter sends only where `(pointer: fine)` matches; on touch it starts a line and the button sends. |
| Inserting the message row before its attachments are uploaded | Reversed 2026-09-05 (it was P6-05's order, after P4-07's): a failed upload left a fileless message in the channel and a box that said the message could not be sent, and a retry posted it twice. The files go up first and the row after; a file nobody points at is the cheaper leftover. |
| One icon button per channel action in the conversation header | Replaced 2026-09-05: up to six unlabeled icons for a manager, with mute beside delete and a second bell under the shell's. One `…` menu (members, muted, settings, leave, delete) and a muted mark beside the title. |
| A flat stream of author / time / body triplets | Replaced 2026-09-05: the day is cut by headings, lines by the same person within five minutes share one name, times are 24-hour, the reader's own lines say "You", the first unread line has a "New" rule above it, and the list follows the newest line only while the reader is at the bottom. |

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
