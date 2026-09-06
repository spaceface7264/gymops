# GymOps — Task Graph

Task IDs are stable; reference them in commits and in `PROJECT_STATE.md`. "Depends on" lists hard prerequisites. Tasks in the same phase with no mutual dependency can run in parallel.

Legend: P1 = Phase 1 etc. Effort: S (< half day), M (1–2 days), L (3+ days).

## Phase 1 — Scaffold and auth

| ID    | Task                                                                                                   | Depends on   | Effort |
| ----- | ------------------------------------------------------------------------------------------------------ | ------------ | ------ |
| P1-01 | Scaffold Vite + React + TS, Tailwind, shadcn/ui, React Router, TanStack Query, ESLint/Prettier, Vitest | —            | S      |
| P1-02 | Supabase local stack (`supabase init`, config, `.env.local`), type-generation script, pgTAP setup      | —            | S      |
| P1-03 | i18n skeleton: react-i18next, `en`/`da` namespaces, missing-key CI check                               | P1-01        | S      |
| P1-04 | Migration: `gyms`, `profiles`, `gym_memberships`, `invites`, `audit_log`, RLS helper functions         | P1-02        | M      |
| P1-05 | pgTAP tests for core permission matrix (roles × gyms)                                                  | P1-04        | M      |
| P1-06 | Supabase client, auth provider, session handling (PKCE), protected routes                              | P1-01, P1-04 | S      |
| P1-07 | Login, forgot/reset password, invite-accept (set password + locale) screens                            | P1-03, P1-06 | M      |
| P1-08 | App shell: nav, header, gym switcher, "all gyms" for admins, responsive layout                         | P1-06        | M      |
| P1-09 | Seed data: 3 gyms, one user per role, memberships                                                      | P1-04        | S      |
| P1-10 | GitHub Actions: lint, unit tests, `supabase db reset` + pgTAP on every push                            | P1-02, P1-05 | S      |

## Phase 2 — Users and gyms admin

| ID    | Task                                                               | Depends on   | Effort |
| ----- | ------------------------------------------------------------------ | ------------ | ------ |
| P2-01 | Gym list/create/edit/deactivate (superadmin)                       | P1-08        | S      |
| P2-02 | User list with role badges, gym filter, deactivate                 | P1-08        | M      |
| P2-03 | Edge Function `invite` (`inviteUserByEmail`, pending memberships)  | P1-04        | M      |
| P2-04 | Invite dialog (admin: any gym/role; manager: own gyms, staff only) | P2-02, P2-03 | M      |
| P2-05 | Role editing with audit log entries; audit log view (superadmin)   | P2-02        | S      |
| P2-06 | Audit trigger on `gym_memberships`/`profiles` role columns         | P1-04        | S      |

## Phase 3 — News and guides

| ID    | Task                                                                                                              | Depends on   | Effort |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| P3-01 | Tiptap editor component with image upload to `content` bucket + storage RLS                                       | P1-08        | M      |
| P3-02 | Migration: `posts`, `post_reads`, `guide_categories`, `guides`, `guide_acks`, `body_text` + tsvector, RLS + pgTAP | P1-04        | M      |
| P3-03 | News feed, post detail, editor, pin, draft/publish                                                                | P3-01, P3-02 | M      |
| P3-04 | Acknowledgement button, per-gym ack report (the reminder itself is P5-02's `ack reminder` trigger — `notifications` does not exist before P5-01) | P3-03        | M      |
| P3-05 | Guide categories tree, guide viewer, editor, versions, re-ack flag                                                | P3-01, P3-02 | L      |
| P3-06 | Guide/news full-text search UI                                                                                    | P3-05        | S      |
| P3-07 | Home page: unread/ack-required news block                                                                         | P3-04        | S      |

## Phase 4 — Daily ops

| ID    | Task                                                                                                | Depends on          | Effort |
| ----- | --------------------------------------------------------------------------------------------------- | ------------------- | ------ |
| P4-01 | Migration: checklist tables, RLS, pgTAP                                                             | P1-04               | M      |
| P4-02 | pg_cron job generating daily runs at 03:00 gym-local                                                | P4-01               | S      |
| P4-03 | Template editor (company-wide + per gym, items, schedule)                                           | P1-08, P4-01        | M      |
| P4-04 | Checklist run UI with Realtime sync, notes, completion                                              | P4-01               | M      |
| P4-05 | Completion history + missed runs on manager home                                                    | P4-04               | S      |
| P4-06 | Migration: `daily_log_entries`; timeline UI; tags                                                   | P1-04, P3-01        | M      |
| P4-07 | Migration: `incidents`, `incident_attachments`, `incident_comments`, `incidents` bucket, RLS, pgTAP | P1-04               | M      |
| P4-08 | Incident form (camera capture), list, detail, status flow, comments, assignee                       | P4-07, P3-01        | L      |
| P4-09 | Daily-log "issue" → pre-filled incident                                                             | P4-06, P4-08        | S      |
| P4-10 | Home page: today's checklists, open incidents, latest log entry                                     | P4-04, P4-08, P4-06 | S      |
| P4-11 | Migration: `events` + `event_gyms`, RLS (admin-only writes), pgTAP; Events page, list and month views | P1-04, P1-08        | M      |

## Phase 5 — Notifications and PWA

| ID    | Task                                                                                            | Depends on          | Effort |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------- | ------ |
| P5-01 | Migration: `notifications`, `notification_prefs`, `push_subscriptions`, RLS                     | P1-04               | S      |
| P5-02 | Triggers: incident created/status changed, ack reminder, invite                                 | P5-01, P4-07, P3-04 | M      |
| P5-03 | Edge Function `notify`: web push (VAPID) + Resend email; database webhook                       | P5-01               | M      |
| P5-04 | In-app inbox, unread badge, preferences screen                                                  | P5-01               | M      |
| P5-05 | PWA: manifest, service worker (push, notificationclick), install guide page, push opt-in button | P1-01, P5-03        | M      |
| P5-06 | Playwright e2e: login, checklist completion, incident creation                                  | P4-04, P4-08        | M      |

## Phase 6 — Team chat

| ID    | Task                                                                                                                                           | Depends on   | Effort |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| P6-01 | Migration: `channels`, `channel_members`, `messages`, `message_attachments`, `chat` bucket, `is_channel_member()`, RLS incl. DM privacy, pgTAP | P1-04        | M      |
| P6-02 | Triggers: gym/company channel creation, auto-membership on `gym_memberships` changes, `#company` for all active profiles                       | P6-01        | S      |
| P6-03 | Channel list with unread badges, three-pane/stacked layout, nav badge                                                                          | P1-08, P6-01 | M      |
| P6-04 | Message list: cursor pagination, Realtime inserts/updates, edit/delete, light markdown                                                         | P6-03        | L      |
| P6-05 | Composer: attachments, @mention autocomplete, typing presence                                                                                  | P6-04        | M      |
| P6-06 | DMs: start DM from user, member-hash dedupe                                                                                                    | P6-04        | S      |
| P6-07 | Custom channel create/manage (public/private, members)                                                                                         | P6-03        | M      |
| P6-08 | Mention + DM notifications (trigger → `notifications`), per-channel mute                                                                       | P6-05, P5-02 | S      |

## Phase 7 — Desktop and release

| ID    | Task                                                                           | Depends on   | Effort |
| ----- | ------------------------------------------------------------------------------ | ------------ | ------ |
| P7-01 | Tauri 2 shell loading built assets; platform shim in `src/lib/platform`        | P1-08        | M      |
| P7-02 | Deep link `gymops://` for invite/reset links + web fallback page               | P7-01, P1-07 | M      |
| P7-03 | Native notifications from Realtime `notifications` subscription                | P7-01, P5-01 | S      |
| P7-04 | Updater plugin + GitHub Releases feed; tagged build workflow for `.dmg`/`.msi` | P7-01        | M      |
| P7-05 | Sentry for web + desktop                                                       | P7-01        | S      |
| P7-06 | README: setup, env, signing/notarization steps                                 | P7-04        | S      |
| P7-07 | Full manual verification walkthrough (see `PROJECT_SPEC.md` §2 and plan)       | all P1–P7    | M      |

## Phase 7b — basics pass (decided 2026-09-03, spec in `docs/superpowers/specs/2026-09-03-basics-account-search-dm-design.md`)

| ID     | Task                                                                          | Depends on   | Effort |
| ------ | ----------------------------------------------------------------------------- | ------------ | ------ |
| P7B-01 | Account screen: own name, language, password (current password required)      | P1-07, P1-08 | M      |
| P7B-02 | `content_search()` SQL function with `ts_rank`; search results ordered by it   | P3-06        | S      |
| P7B-03 | `profiles_select` shows active admins to everyone; staff → admin DMs           | P6-06        | S      |

## Phase 7c — facelift (decided 2026-09-03, spec in `docs/superpowers/specs/2026-09-03-facelift-design.md`)

| ID     | Task                                                                          | Depends on   | Effort |
| ------ | ----------------------------------------------------------------------------- | ------------ | ------ |
| P7C-01 | Foundation: violet tokens, Inter self-hosted, radius and type scale, no dark   | P7-05        | S      |
| P7C-02 | Primitives restyled; `CardTitle` a heading; skeleton/avatar/sonner/tooltip/textarea/switch added | P7C-01 | M |
| P7C-03 | Shared layer: `Logo`, `PageHeader`, `EmptyState`, `LoadingState`, `StatusBadge` | P7C-02       | M      |
| P7C-04 | Shell: logo, pill nav, avatar menu in the header, auth layout                 | P7C-03       | S      |
| P7C-05 | Screen sweep: every route on the shared layer, touch targets, en/da check     | P7C-04       | L      |

## Phase 7d — refinement (decided 2026-09-04, plan in `docs/superpowers/plans/2026-09-04-refine.md`)

| ID     | Task                                                                          | Depends on   | Effort |
| ------ | ----------------------------------------------------------------------------- | ------------ | ------ |
| P7D-01 | Primitives: `checkbox`, `alert-dialog`, `tabs`, `toggle-group` vendored and restyled; 150 ms and 44 px gaps in the existing `ui/` closed | P7C-05 | S |
| P7D-02 | Checkbox rollout: the ten raw `<input type="checkbox">`, whole-row tap target on the checklist | P7D-01 | S |
| P7D-03 | `ConfirmDialog` on `AlertDialog`; the four hand-rolled confirms folded in; the five unguarded deletes guarded | P7D-01 | M |
| P7D-04 | Toasts: success where the result leaves the screen, errors on fire-and-forget toggles | P7D-01 | M |
| P7D-05 | Admin `h1` and `Tabs`; `ToggleGroup` for the segmented filters and multi-select values | P7D-01 | M |
| P7D-06 | `Tooltip` wired: provider in `App`, the four `title=` sites                    | P7D-01       | S      |
| P7D-07 | Polish sweep: `NativeSelect`, `UnreadCount`, radii, headings, empty/loading states, skip link | P7D-02 … 06 | L |
| P7D-08 | Docs, screenshots, PR                                                         | P7D-07       | S      |

## Phase 8 — AI assistant (V1.5)

| ID    | Task                                                                                                      | Depends on   | Effort |
| ----- | --------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| P8-01 | Migration: `app_settings`, `assistant_conversations`, `assistant_messages`, `assistant_usage`, `messages.from_assistant`, RLS | P3-02        | S      |
| P8-02 | `search_content` / `read_content` SQL functions over guides + posts (RLS-respecting)                      | P3-02        | S      |
| P8-03 | Edge Function `assistant`: Anthropic SDK tool runner, streaming SSE, caller JWT, usage cap, token logging | P8-01, P8-02 | L      |
| P8-04 | Ask page: conversation list, streaming answer view, citation links                                        | P8-03        | M      |
| P8-05 | `@assistant` in channels: trigger on mention, last 20 messages as context, bot reply insert               | P8-03, P6-05 | M      |
| P8-06 | Superadmin usage-cap setting + usage view                                                                 | P8-03        | S      |

## Phase 9 — hosted cutover (decided 2026-09-05, plan in `docs/superpowers/plans/2026-09-05-cutover.md`)

| ID    | Task                                                                                       | Depends on | Effort |
| ----- | ------------------------------------------------------------------------------------------ | ---------- | ------ |
| P9-01 | Admins browse and join the gym channels they may read (the P7-07 known gap)               | P6-07      | S      |
| P9-02 | Branded invite and recovery mails, Danish then English, wired in `config.toml`             | P2-03      | S      |
| P9-03 | Cloudflare Pages: `_redirects`, the project, `VITE_*` variables, first deploy, docs         | P7-04      | S      |
| P9-04 | Hosted database: link, extensions, `db push`, buckets, cron check, type drift check        | P8-01      | M      |
| P9-05 | Hosted auth mirrored from `config.toml`: Resend SMTP, URLs, password policy, templates      | P9-02      | M      |
| P9-06 | Secrets and the three functions deployed; Vault secrets for the notify webhook             | P9-04      | M      |
| P9-07 | First superadmin; sign-in, reset, invite, push and phone installs on the deployed origin   | P9-05, P9-06 | M    |
| P9-08 | First desktop release (v0.1.0) and the updater line (v0.1.1); Actions secrets              | P9-07      | M      |
| P9-09 | Pilot at one gym for a week; findings into Known gaps                                      | P9-08      | L      |

## Chat critique fixes (decided 2026-09-05, from `/impeccable critique`)

| ID     | Task                                                                                                                                   | Depends on | Effort |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| P6C-01 | Phone: lock the full-bleed frame at every width, scroll the list inside itself, follow the newest line only at the bottom, "New messages" pill | P6-04      | S      |
| P6C-02 | Composer: Enter starts a line on touch, draft kept per channel, 10 MB cap, sending state and retry, files uploaded before the row       | P6-05      | S      |
| P6C-03 | Stream: day headings, same-author grouping, 24-hour times, "You", the New rule, the mention tint, Edit removed, one menu per message     | P6-04      | M      |
| P6C-04 | Header: one channel menu (members for any non-DM channel, muted, settings, leave, delete), muted mark beside the title, `BellOff` everywhere | P6-07      | S      |
| P6C-06 | Phone bar: Chat in the first five entries (Home, Chat, Checklists, Daily log, Incidents), the rest after                                | P6C-01     | XS     |
| P6C-07 | Mentions: only a pick from the list is a person (kept in state, not re-derived from text); `@Name` set in the accent; solid tint + "Mentions you" for the addressed line | P6C-03     | S      |
| P6C-08 | Attachments: `file_name` column and the real name in the stream; image thumbnail in the composer chip                                  | P6-05      | S      |
| P6C-09 | Controls: outline "Find a channel" / "New channel"; mute as a verb item with a toast; Delete as a direct icon, no one-item menu; `NativeSelect` for the scope | P6C-04     | S      |
| P6C-10 | Sending: optimistic pending line in the stream; only the sent text is cleared from the box                                             | P6C-02     | S      |
| P6C-11 | Follow state recomputed on box resize (keyboard, window), not only on scroll                                                            | P6C-01     | XS     |
| P6C-12 | shadcn message kit: `MessageScroller` (`@shadcn/react`) as the transcript, `Marker` for day and "New" lines, `Message` + `Bubble` for DM channels only | P6C-11     | M      |
| P6C-13 | Bubbles in every channel, not only DMs; "Mentions you" mark in the header                                                             | P6C-12     | XS     |
| P6C-14 | WhatsApp bubble layout: name and time inside the bubble, clock while sending, chip markers                                              | P6C-13     | XS     |
| P6C-15 | Bubble critique: own surface on the `new` tint, 15 px body, icon jump button with unread badge, names in text colour + `highlight` bubble for mentions, sr-only author, tap-to-reveal Delete | P6C-14     | S      |
| P6C-16 | Round four: one header on a phone conversation, jump gutter + honest badge, failed line in the stream with Try again, violet New chip + `--bubble-own`, link labels, 60ch bubble cap | P6C-15     | S      |
| P6C-17 | Reply as a quote: `messages.reply_to` (same channel, pinned), quote block in the bubble, "Replying to" strip, jump with older-page fetch, `chat_reply` notification | P6C-16     | M      |
| P6C-18 | Reactions: `message_reactions` (four emoji, own rows only, channel pinned, live), count chip on the bubble, names dialog, `chat_reaction` notification deduped 5 min | P6C-16     | M      |
| P6C-19 | Copy to clipboard, and one `…` menu on every line (Reply, four reactions, Copy, Delete when allowed)                                     | P6C-17     | S      |
| P6C-05 | Copy and a11y: "Join a channel", "Conversations", DA `Annuller`/`Haller`, `Intl.ListFormat` for the typing line, combobox ARIA on the box, socket status line | P6C-03     | S      |

## Phone critique fixes (decided 2026-09-06, from `/impeccable critique` at 390 px, 26/40)

| ID     | Task                                                                                                                                           | Depends on | Effort |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| P7M-01 | Touch and zoom at the token: `--spacing: 4px` so `h-11` is 44 px at the 15 px root; `Input`, `Textarea`, `NativeSelect` 16 px so iOS does not zoom | —          | XS     |
| P7M-02 | Phone bar: five primary tabs (Home, Chat, Checklists, Daily log, More) and a More sheet for the rest; `sheet` vendored                          | P7M-01     | S      |
| P7M-03 | Home: one "Right now" block with rows (unread news, today's checklist, open incidents), one primary action, a real `h1`; empty sections one line | P7M-01     | S      |
| P7M-04 | Polish sweep: no `size="sm"` below `md`, inbox clock `hourCycle: 'h23'`, reactions do not notify (or coalesce per message)                     | P7M-01     | S      |

## Later (not scheduled)

- V2: tasks (`tasks`, recurrence, assignment, incident → task). Calendars shipped early as P4-11.
- V3: dashboards, `brp-sync` Edge Function (needs BRP API key, service account, rate limits, webhook info).
- Chat follow-ups: threads, reactions, search, a last-message preview in the channel list (needs `chat_overview()` to carry the body), a time on hover for grouped lines.
- Phone bottom bar: five primary tabs plus a More sheet, instead of nine entries scrolling sideways (noted in the facelift spec, P7C; needs `sheet` vendored, deferred from P7D). Scheduled as P7M-02.
- Deferred from P7D (2026-09-04): `command`/cmdk for the chat @mention listbox and a global search palette; `progress` for checklist completion; `collapsible` for the guide category tree; `scroll-area` for the chat lists; `react-hook-form` (every form is `useState` + `MissingRequirements`, and that is fine).
- Global "search anything" in the header: relocate `ContentSearch`, then add `search_vector` columns and branches for incidents, events, daily log and people; chat last.
- Branded en/da auth mail templates — before the cutover. (Acknowledgement reminders were listed here as missing; `send_ack_reminders()` has raised them nightly since P5-02, confirmed by the P7-07 walkthrough on 2026-09-04.)
- Assistant follow-ups: pgvector retrieval, live ops data, actions.

## Critical path

P1-01 → P1-04 → P1-06 → P1-08 → P3-01 → P3-05 → P4-08 → P5-02 → P6-04 → P7-04 → P7-07
