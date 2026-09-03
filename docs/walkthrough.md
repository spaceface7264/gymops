# P7-07 — manual verification walkthrough

The human check of the screens on top of the pgTAP and Playwright suites,
against `PROJECT_SPEC.md` §2. Run it on the local stack (`npm run db:reset`
first, so the seed users and gyms are as described) in three clients: a
browser, the PWA on a phone, and the desktop app. Tick each line as it passes,
note what did not in `PROJECT_STATE.md` "Known gaps".

Seed users: `super@`, `admin@`, `manager@` (Copenhagen Nord), `staff@`
(Copenhagen Nord) at `gymops.test`, password `Password123`.

## 1. Sign-in and accounts (§2.1)

- [ ] Sign in and out as each of the four users; a wrong password says so.
- [ ] Forgot password → Mailpit (`http://127.0.0.1:54324`) → link → new password → signed in.
- [ ] Invite a new staff member as admin (`npx supabase functions serve --env-file supabase/functions/.env` running) → mail → `/auth/callback` offers the app or the browser → account created with name, language and password.
- [ ] Manager can invite staff to their own gym only; staff cannot invite.
- [ ] Deactivate a user as admin: they are signed out on refresh and see the deactivated notice; reactivating restores them.
- [ ] Switch the UI language on the profile; every screen follows, nothing stays English/Danish.

## 2. Permission matrix (§2.1) — one row per line, checked in the UI

- [ ] Only superadmin sees Admin → Gyms and Admin → Audit.
- [ ] Superadmin promotes and demotes an admin; the audit log records it.
- [ ] Company-wide news/guides: admin can, manager cannot.
- [ ] Gym news/guides and checklist templates: manager in own gym only; staff never.
- [ ] Checklists, daily log, incidents: staff and manager in their gyms; admin everywhere.
- [ ] Events: admin only; everyone at the gym reads them.
- [ ] Incident status: manager in own gym; staff cannot.
- [ ] Acknowledgement report: manager for own gym; staff never sees it.
- [ ] Custom chat channels: admin company-wide, manager own gyms, staff none.
- [ ] Delete another person's chat message: admin anywhere, manager own gym, staff only their own.
- [ ] A DM is invisible to everyone not in it, including superadmin.

## 3. Modules (§2.2)

**Home**

- [ ] Unread news needing acknowledgement, today's checklists, open incidents and the latest daily-log entry appear; the gym switcher changes all of them.

**News**

- [ ] Draft → publish → pinned; per gym and company-wide; rich text with an image.
- [ ] Required acknowledgement: staff confirms; manager's report lists who has not; reminder sends a notification.

**Guides**

- [ ] Create, categorise, edit (new version); "re-acknowledge on edit" asks staff again.
- [ ] Full-text search finds a phrase in the body; one tree mixes company and gym guides.

**Checklists**

- [ ] Template (opening/closing/custom) → run exists for today (generation is `pg_cron` 03:00; create today's run via the fixture or `db:reset` seeds).
- [ ] Two windows: ticking an item in one shows in the other without reload.
- [ ] Completion history; a missed run is visible to the manager.

**Daily log**

- [ ] Handover / note / issue entries; "issue" converts to an incident in one click and links back.

**Incidents**

- [ ] Report with kind, severity, photo; status open → in progress → resolved; comments; assignee.
- [ ] Reporting notifies the gym's manager and admins (inbox); high severity is recorded as an email by `notify`.

**Events**

- [ ] Single date and from → to range with times; at one gym, several, or company-wide; list and month views.

**Notifications**

- [ ] Inbox, mark read/unread, mark all read; preferences per type; opening one follows its link.
- [ ] Web push in Chrome (permission granted) delivers a notification that opens the right screen.
- [ ] Desktop: permission from the preferences screen; a new incident shows as a native notification. _(verified 2026-09-03)_

**Team chat**

- [ ] Gym channel and `#company` exist automatically; custom public and private channels; DM with two and with three people.
- [ ] @mention autocompletes and notifies; attachment upload and download; edit and delete own message; typing indicator; unread badges in the nav.

**Admin**

- [ ] Gym CRUD (superadmin); user list with roles per gym; role edits appear in the audit log.

## 4. Clients (§2.5)

- [ ] PWA: install on an iPhone (Add to Home Screen) and on Android; opens standalone; push works on Android after opting in.
- [ ] Desktop: sign-in, deep link from an invite mail (`/auth/callback` → "Open in the GymOps app"), reset link requested in the app, cold start from a link. _(all verified 2026-09-03 in the debug bundle)_
- [ ] Desktop: publish a draft release on `gymops-releases` with a higher version; an installed app offers "Restart to update" and comes back on the new version. _(needs the first tagged build)_
- [ ] Phone width in the browser: bottom tab bar, no horizontal scroll on any screen.
