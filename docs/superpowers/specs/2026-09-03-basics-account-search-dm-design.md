# Basics pass — account screen, search ranking, staff → admin DMs

Date: 2026-09-03. Three gaps from the phase-7 assessment, each small, taken
together as one branch and one PR (task IDs P7B-01 … P7B-03 in
`PROJECT_TASKS.md`).

## 1. Account screen (P7B-01)

**Route** `/account`, inside the app shell. The header's email label becomes a
link to it. No nav entry — it belongs next to who is signed in, like the
inbox.

**Screen** — three independent cards, each a form with its own save button and
its own success/error line:

- **Name** — `full_name`. Saving writes `profiles.full_name` and the auth
  user's `full_name` metadata (as `useCompleteInvite` does), then invalidates
  `['auth']`, so the header and every "by …" label refetch. Empty is refused.
- **Language** — `locale`, the same `en`/`da` select as accept-invite. Saving
  writes `profiles.locale`; `useLocaleSync` switches the UI at once.
- **Password** — _current_, _new_, _repeat_. The new password passes
  `checkPassword` (length and character rule, mirrored from the server). The
  current password is verified by `signInWithPassword` with the signed-in
  user's own email; only when that succeeds does `updateUser({ password })`
  run. A wrong current password reports `auth.account.wrongPassword` and
  changes nothing. `secure_password_change` in `config.toml` stays off: the
  check is explicit in the app, which gives a translated error instead of
  GoTrue's, and the cutover checklist need not mirror another setting.

**Code** — hooks `useUpdateName`, `useUpdateLocale`, `useChangePassword` in
`src/features/auth/queries.ts`; page `src/routes/account-page.tsx`; route in
`router.tsx`; header link in `app-shell.tsx`; strings under `auth.account.*`
in `en` and `da`. No migration: `profiles_update` already lets a person edit
their own row, and `guard_profile_privileges()` (P1) keeps the role flags out of reach.

**Tests** — unit tests for the three hooks (what is written, what is
invalidated) and for the page: a wrong current password shows the message and
does not call `updateUser`; a mismatched repeat is refused before any call; a
saved language changes the UI language; a saved name appears in the header.

## 2. Search ranking (P7B-02)

**Today** `useContentSearch` runs two `textSearch` queries (posts, guides) and
concatenates them; the order is insertion order.

**Change** — one SQL function:

```sql
content_search(query text)
  returns table (kind text, id uuid, title text, body_text text,
                 status text, gym_name text, rank real)
  language sql stable security invoker set search_path = ''
```

`union all` over `posts` and `guides` (both `deleted_at is null`), matching
`search_vector @@ websearch_to_tsquery('simple', query)`, `rank =
ts_rank(search_vector, …)`, `order by rank desc, title`, `limit 40`.
`security invoker`, so `posts_select`/`guides_select` decide what a caller
sees, exactly as the two direct queries do now. `useContentSearch` calls it
with `.rpc('content_search', { query })` and maps rows to the existing
`SearchHit` shape; the excerpt logic is unchanged.

**Tests** — pgTAP: a staff member's call returns only what they may read
(gym-scoped guide of another gym absent; draft post of another author absent);
a title hit ranks above a body-only hit. Client: the search test's mock moves
from two tables to one rpc; result order follows `rank`.

## 3. Staff → admin DMs (P7B-03)

**Change** — one migration replacing `profiles_select` with the current
policy plus one branch:

```sql
or (profiles.active and (profiles.is_admin or profiles.is_superadmin))
```

Every active person can see active admins and superadmins (in this schema a
superadmin is also `is_admin`; both are reachable, decided 2026-09-03). A
deactivated admin stays invisible, as any deactivated person does.

**Effect** — `start_dm()` checks targets through `profiles_select`, so a staff
member can open a DM with an admin; `useColleagues()` (the DM picker),
`useChannelMembers()` (member lists) and the @mention picker read `profiles`
through the same policy, so admins stop being nameless rows in `#company` and
appear by name everywhere. No client change.

**Tests** — `010-core-permissions`: the staff visibility count grows by the
number of active admins and the assertions say so; `210-chat-dm`: staff opens
a DM with the admin, and a DM with a deactivated admin is refused; a new
assertion that staff still cannot see staff at another gym.

## Out of scope, recorded in `PROJECT_TASKS.md` "Later"

- Global "search anything" in the header: the same hook relocated, then more
  tables (incidents, events, daily log, people; chat last) each with a
  `search_vector`.
- Acknowledgement reminders and branded auth mail templates (the other two
  basics from the assessment) — separate, they touch `notify` and the cutover.

## Branch and docs

Branch `basics-account-search-dm` from `main` once PR #9 (phase 7) is merged;
otherwise from `phase-7-desktop`. Each task: code + tests, then its row in
`PROJECT_STATE.md` and any §3.2/§4 note in `PROJECT_SPEC.md`, in the same
commit. Conventional commits referencing the task id.
