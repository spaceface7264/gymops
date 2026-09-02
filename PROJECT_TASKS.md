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

## Phase 8 — AI assistant (V1.5)

| ID    | Task                                                                                                      | Depends on   | Effort |
| ----- | --------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| P8-01 | Migration: `assistant_conversations`, `assistant_messages`, `assistant_usage`, bot profile, RLS           | P3-02        | S      |
| P8-02 | `search_content` / `read_content` SQL functions over guides + posts (RLS-respecting)                      | P3-02        | S      |
| P8-03 | Edge Function `assistant`: Anthropic SDK tool runner, streaming SSE, caller JWT, usage cap, token logging | P8-01, P8-02 | L      |
| P8-04 | Ask page: conversation list, streaming answer view, citation links                                        | P8-03        | M      |
| P8-05 | `@assistant` in channels: trigger on mention, last 20 messages as context, bot reply insert               | P8-03, P6-05 | M      |
| P8-06 | Superadmin usage-cap setting + usage view                                                                 | P8-03        | S      |

## Later (not scheduled)

- V2: tasks (`tasks`, recurrence, assignment, incident → task). Calendars shipped early as P4-11.
- V3: dashboards, `brp-sync` Edge Function (needs BRP API key, service account, rate limits, webhook info).
- Chat follow-ups: threads, reactions, search.
- Assistant follow-ups: pgvector retrieval, live ops data, actions.

## Critical path

P1-01 → P1-04 → P1-06 → P1-08 → P3-01 → P3-05 → P4-08 → P5-02 → P6-04 → P7-04 → P7-07
