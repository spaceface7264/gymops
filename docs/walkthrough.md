# P7-07 — manual verification walkthrough

The human check of the screens on top of the pgTAP and Playwright suites,
against `PROJECT_SPEC.md` §2. Run it on the local stack (`npm run db:reset`
first, so the seed users and gyms are as described) in three clients: a
browser, the PWA on a phone, and the desktop app. Tick each line as it passes,
note what did not in `PROJECT_STATE.md` "Known gaps".

The web pass was driven on 2026-09-04 in Google Chrome through Playwright
(the Chrome extension was not connected), one throwaway spec per section,
against the local stack; nothing of it is kept, the ticks below are the
record. Still open: the two phone-install lines, web push by hand on the
deployed origin, and the desktop update line, which waits for the first
tagged build.

Seed users: `super@`, `admin@`, `manager@` (Copenhagen Nord), `staff@`
(Copenhagen Nord) at `gymops.test`, password `Password123`.

## 1. Sign-in and accounts (§2.1)

- [x] Sign in and out as each of the four users; a wrong password says so. _(verified 2026-09-04, web)_
- [x] Forgot password → Mailpit (`http://127.0.0.1:54324`) → link → new password → signed in. _(verified 2026-09-04, web)_
- [x] Invite a new staff member as admin (`npx supabase functions serve --env-file supabase/functions/.env` running) → mail → `/auth/callback` offers the app or the browser → account created with name, language and password. _(verified 2026-09-04, web)_
- [x] Manager can invite staff to their own gym only; staff cannot invite. _(verified 2026-09-04, web)_
- [x] Deactivate a user as admin: they are signed out on refresh and see the deactivated notice; reactivating restores them. _(verified 2026-09-04, web)_
- [x] Switch the UI language on the profile; every screen follows, nothing stays English/Danish. _(verified 2026-09-04, web: 20 routes against 287 English strings, no leak)_

## 2. Permission matrix (§2.1) — one row per line, checked in the UI

- [x] Only superadmin sees Admin → Gyms and Admin → Audit. _(verified 2026-09-04, web)_
- [x] Superadmin promotes and demotes an admin; the audit log records it. _(verified 2026-09-04, web — and found the Roles dialog showing the row it was opened with rather than the refetched one; fixed the same day)_
- [x] Company-wide news/guides: admin can, manager cannot. _(verified 2026-09-04, web)_
- [x] Gym news/guides and checklist templates: manager in own gym only; staff never. _(verified 2026-09-04, web)_
- [x] Checklists, daily log, incidents: staff and manager in their gyms; admin everywhere. _(verified 2026-09-04, web)_
- [x] Events: admin only; everyone at the gym reads them. _(verified 2026-09-04, web)_
- [x] Incident status: manager in own gym; staff cannot. _(verified 2026-09-04, web)_
- [x] Acknowledgement report: manager for own gym; staff never sees it. _(verified 2026-09-04, web)_
- [x] Custom chat channels: admin company-wide, manager own gyms, staff none. _(verified 2026-09-04, web)_
- [x] Delete another person's chat message: admin anywhere, manager own gym, staff only their own. _(verified 2026-09-04, web — "anywhere" only as far as the UI reaches: an admin is seated in `#company`, the custom channels and the gyms they hold a membership in, and neither the list nor Browse offers the other gym channels, although the database would let them read and moderate there; see Known gaps)_
- [x] A DM is invisible to everyone not in it, including superadmin. _(verified 2026-09-04, web)_

## 3. Modules (§2.2)

**Home**

- [x] Unread news needing acknowledgement, today's checklists, open incidents and the latest daily-log entry appear; the gym switcher changes all of them. _(verified 2026-09-04, web)_

**News**

- [x] Draft → publish → pinned; per gym and company-wide; rich text with an image. _(verified 2026-09-04, web)_
- [x] Required acknowledgement: staff confirms; manager's report lists who has not; reminder sends a notification. _(verified 2026-09-04, web — the reminder is the 07:00 UTC `send_ack_reminders()` job, run by hand with `as_of` two days ahead: 17 `ack_reminder` rows; the report's footnote still said reminders would arrive "once notifications ship", fixed the same day)_

**Guides**

- [x] Create, categorise, edit (new version); "re-acknowledge on edit" asks staff again. _(verified 2026-09-04, web)_
- [x] Full-text search finds a phrase in the body; one tree mixes company and gym guides. _(verified 2026-09-04, web)_

**Checklists**

- [x] Template (opening/closing/custom) → run exists for today (generation is `pg_cron` 03:00; create today's run via the fixture or `db:reset` seeds). _(verified 2026-09-04, web — the run built by hand the way the job builds it; `cron.job` holds `generate-checklist-runs`)_
- [x] Two windows: ticking an item in one shows in the other without reload. _(verified 2026-09-04, web — only after the fix: a manager's or staff member's window first joined `checklists:all`, was refused, and the tick then arrived in 0 of 3 tries; with the join gated on `canSeeAllGyms` it arrived in 2 of 2)_
- [x] Completion history; a missed run is visible to the manager. _(verified 2026-09-04, web)_

**Daily log**

- [x] Handover / note / issue entries; "issue" converts to an incident in one click and links back. _(verified 2026-09-04, web, except "links back": the incident is created prefilled, but nothing ties the two records afterwards — see Known gaps)_

**Incidents**

- [x] Report with kind, severity, photo; status open → in progress → resolved; comments; assignee. _(verified 2026-09-04, web)_
- [x] Reporting notifies the gym's manager and admins (inbox); high severity is recorded as an email by `notify`. _(verified 2026-09-04, web — `notify` answered `{"push":0,"email":"sent"}` for the manager's row)_

**Events**

- [x] Single date and from → to range with times; at one gym, several, or company-wide; list and month views. _(verified 2026-09-04, web)_

**Notifications**

- [x] Inbox, mark read/unread, mark all read; preferences per type; opening one follows its link. _(verified 2026-09-04, web)_
- [ ] Web push in Chrome (permission granted) delivers a notification that opens the right screen. _(not yet: 2026-09-04 tried it in Playwright's Chrome with the permission granted — "This device does not receive push", no subscription row; a headless browser has no push service. By hand, on the deployed origin, as the cutover list already says.)_
- [ ] Desktop: permission from the preferences screen; a new incident shows as a native notification. _(verified 2026-09-03)_

**Team chat**

- [x] Gym channel and `#company` exist automatically; custom public and private channels; DM with two and with three people. _(verified 2026-09-04, web)_
- [x] @mention autocompletes and notifies; attachment upload and download; edit and delete own message; typing indicator; unread badges in the nav. _(verified 2026-09-04, web — the typing indicator in a two-window probe; the unread badge was seen after a reload, its live update was not pinned down)_

**Admin**

- [x] Gym CRUD (superadmin); user list with roles per gym; role edits appear in the audit log. _(verified 2026-09-04, web)_

## 4. Clients (§2.5)

- [ ] PWA: install on an iPhone (Add to Home Screen) and on Android; opens standalone; push works on Android after opting in.
- [ ] Desktop: sign-in, deep link from an invite mail (`/auth/callback` → "Open in the GymOps app"), reset link requested in the app, cold start from a link. _(all verified 2026-09-03 in the debug bundle)_
- [ ] Desktop: publish a draft release on `gymops-releases` with a higher version; an installed app offers "Restart to update" and comes back on the new version. _(needs the first tagged build)_
- [x] Phone width in the browser: bottom tab bar, no horizontal scroll on any screen. _(verified 2026-09-04: 21 screens at 390 px as superadmin and as staff, no page scrolls sideways, the bar is on every screen — the bar itself scrolls past five entries, which is the logged facelift follow-up)_
