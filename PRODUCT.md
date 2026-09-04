# Product

## Register

product

## Users

**Staff** (the largest group). Bouldering-gym floor and front-desk staff, mostly 20 to 25 years old, often part-time, sometimes at more than one gym. Their context: one hand on the phone mid-shift, or a shared front-desk touch screen between customers. The job: tick the opening and closing checklist, write the handover in the daily log, report an incident with a photo before the details fade, read and confirm what management published, and reach the people on shift in chat.

**Managers.** Run one or a few gyms. They publish gym news and guides, keep the checklist templates current, see who has not confirmed a guide, triage incidents, invite staff and read the missed-checklist list on their home page. At the desk in the desktop app, on the phone otherwise.

**Admins and superadmins** (head office). Publish company-wide news and guides, run the events calendar centrally, manage users and gyms, and read the audit log. Mostly desktop; the "all gyms" view is theirs.

The company is a Danish chain of 10+ bouldering gyms with 200+ users. The interface runs in English and Danish; content is written in whichever language the author uses.

## Product Purpose

GymOps is the one internal system for the chain: news that must be acknowledged, guides with versions, daily checklists, the daily log, incidents and maintenance, the events calendar, team chat and notifications. It replaces the scattered chat groups, shared documents and spreadsheets a gym otherwise runs on, and it runs from one codebase in the browser, as a PWA on the phone and as a Windows and macOS desktop app.

The bet: a chain of gyms is run by the people on shift, so the operations system has to be something they will open on a phone without being told to. Everything else (role scoping per gym, permissions enforced in the database, the audit trail) exists so head office can trust what the app says without checking.

Success looks like: a shift can be run from a phone, nothing that must be confirmed goes unconfirmed, a manager knows the state of their gyms without asking, and a new hire uses it on day one without a training session.

## Brand Personality

Friendly, clear, calm.

Voice in practice: plain language, sentence case, short labels, no ops jargon. Casual but not jokey; the app is a colleague on shift, not a control room and not an HR department. Every screen names who did what and when, and an empty section says what would go there ("nothing is open here" is worth reading). Modelled on All Gravy: warm, phone-first, one accent colour, bold plain headings. Danish copy runs long, so labels are written to survive translation.

## Anti-references

GymOps is **not** an admin panel and must not feel like one. Active rejections:

- **Stock shadcn and the generic admin shell.** Zero-chroma neutrals, no typeface, dark mode with purple gradients, a dashboard that could belong to any SaaS. The facelift replaced exactly this; do not drift back.
- **Dense enterprise ops tools** (ServiceNow, Jira-style trackers). Data tables everywhere, filters before content, jargon, a product that needs a training session. Staff are not operators.
- **Corporate HR and intranet portals.** Stiff tone, stock photography, announcements nobody reads, everything three clicks behind a login. Being told something here should feel like a message from a colleague.

Feature-rich and reliable is fine. Busy, greyed-out or officious is not.

## Design Principles

1. **Built for the shift, not the desk.** The phone, one-handed, mid-shift is the primary surface; the front desk is a shared touch screen between customers. Big targets, a bottom tab bar, no drag-and-drop, nothing more than two taps away, and a way to sign out that is one tap further than an accidental thumb.
2. **One shape you learn once.** Pages keep their shape on a quiet day: an empty card stays, nav entries are never greyed out, and one gym switcher scopes everything rather than each module inventing its own filter. Staff should be able to work the app before they can explain it.
3. **Quiet unless it matters.** The accent colour is spent only on the thing that needs attention, "new" means literally unread or awaiting confirmation, nobody is notified of their own actions, and reminders chase only what is still unconfirmed. If everything is loud, nothing is.
4. **The record is the truth.** What a staff member wrote stays theirs; acknowledgements, timestamps and versions are stamped by the database, not claimed by the client; a missed checklist is shown as a gap, never backfilled; a notification says what it said when it was sent. Status in the UI is unambiguous because the data underneath is.
5. **Hide what you cannot do, never pretend.** The interface shows each role only its own actions, but permission lives in the database and the UI merely agrees. A deactivated account is told why. A DM is the one thing no admin can read, and the product says so.

## Accessibility & Inclusion

WCAG 2.1 AA. Every text and background pairing is computed against 4.5:1 and the lowest shipped is 4.8:1; the accent is never body text on white. Every control a thumb hits is at least 44 px tall. Focus is visible in the accent colour on every control, and each screen has one page heading with real heading landmarks inside cards. Status is never colour alone: each tone pairs a tint with dark text of the same hue and a dot. Native selects stay native for keyboard and screen readers; reordering uses up and down buttons. Everything respects `prefers-reduced-motion`, with no layout animation and no route transitions.

Light theme only, designed for lit gyms and front desks. UI in English and Danish with every string in both; Danish is checked first because it runs long. The desktop app ships its typeface and works offline.

## Reference Lane

All Gravy (allgravy.com) for the feel: a workforce app that hourly staff choose to open, white surfaces on a faint tinted ground, one accent, pill buttons, bold friendly headings. The reference is the warmth and phone-first clarity, not the marketing site.
